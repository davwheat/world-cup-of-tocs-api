require('dotenv').config()
const env = process.env
const fetch = require('node-fetch')
const express = require('express')
const app = express()
const port = env.PORT
const Log = require('./logger')
const TOKEN = process.env.TWITTER_BEARER_TOKEN
const SendResponse = require('./helpers/SendResponse')
const fs = require('fs').promises
const fsSync = require('fs')
const CreateSinglePollArrayFromTweetData = require('./models/CreateSinglePollArrayFromTweetData')
const SinglePoll = require('./models/SinglePoll')
const VotesInfo = require('./models/VotesInfo')
const morgan = require('morgan')
const compression = require('compression')
const { exit } = require('process')

const GetCupJson = async () => JSON.parse((await fs.readFile('./cup.json')).toString())
const GetDataJson = async () => JSON.parse((await fs.readFile('./data/data.min.json')).toString())

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  res.header('Access-Control-Allow-Methods', 'GET')
  res.header('Access-Control-Max-Age', 86400)
  res.header('Cache-Control', `public, max-age=60, stale-if-error=600, stale-while-revalidate=120`)
  next()
})

// Add ETag caching
app.set('etag', 'weak')
app.use(
  express.urlencoded({
    extended: true,
  })
)

// Add gzip compression
app.use(compression())

app.use(morgan('combined', { stream: fsSync.createWriteStream('./access.log', { flags: 'a' }) }))
app.use(morgan('dev'))

/**
 * @returns {string[]} Tweet IDs identified by the algorithm to be a poll from Geoff!
 */
async function GetTweetIDs() {
  Log('Feteching tweet IDs...', Log.SEVERITY.INFO)
  //   'https://api.twitter.com/2/tweets/search/recent?query=from:geofftech AND #WorldCupOfTubeLines&expansions=attachments.poll_ids',
  const data = await fetch(
    `https://api.twitter.com/2/tweets/search/recent?query=` +
      `from:geofftech ` + //? from Geoff
      `%23WorldCupOfTrainOperators ` + //? has #WorldCupOfTrainOperators
      `-is:retweet ` + //? Is not a retweet
      `-is:quote` + //? Is not a quote tweet
      `&max_results=25` + //? Max 25 results
      `&expansions=attachments.poll_ids`, //? Include poll data
    // `https://api.twitter.com/2/tweets/search/recent?query=from:davwheat_ %23WorldCupOfTrainOperators -is:retweet -is:quote&max_results=100&expansions=attachments.poll_ids`,
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
      },
    }
  )

  const json = await data.json()
  // console.log(JSON.stringify(json, null, 2));

  if (!json.data) {
    Log('No tweets found.', Log.SEVERITY.WARNING)
    return null
  }

  Log('Filtering...', Log.SEVERITY.DEBUG)

  const pollTweets = json.data.filter(tweet => tweet.attachments && tweet.attachments.poll_ids && tweet.attachments.poll_ids[0])

  const ids = pollTweets.reduce((prev, curr) => [...prev, curr.id], [])

  // Log(JSON.stringify(ids));

  Log(`Identified ${ids.length} possible game tweets!`, Log.SEVERITY.INFO)

  return ids
}

async function UpdatePollData() {
  const knownTweets = await GetCupJson()
  const firstToLastKeysOrder = ['knockout', 'groupStages', 'quarterFinal', 'semiFinal', 'runnerUp', 'final']

  const newKnownTweets = { ...knownTweets }
  const justIds = []

  const newTweetIds = await GetTweetIDs()

  if (!newTweetIds) {
    Log('No new tweet IDs found', Log.SEVERITY.DEBUG)
  }

  let counter = 0

  // iterate through tweet IDs from old to new
  Log('Iterating through tweet Ids', Log.SEVERITY.DEBUG)
  newTweetIds.reverse().forEach(id => {
    firstToLastKeysOrder.some(stage => {
      return Object.keys(newKnownTweets[stage]).some(k => {
        let key = k,
          value = newKnownTweets[stage][k].tweetId

        if (value !== null) {
          justIds.push(value)
        }

        if (value === id) {
          // We know about this ID already
          return true
        }

        // First unknown tweet found -- this must be that tweet!
        if (value === null) {
          newKnownTweets[stage][key].tweetId = id
          justIds.push(id)
          counter++
          return true
        }

        return false
      })
    })
  })

  Log(`${counter} IDs were not known to be correct`, counter > 0 ? Log.SEVERITY.WARNING : Log.SEVERITY.INFO)
  Log(`Fetching data for ${justIds.length} tweets...`, Log.SEVERITY.INFO)

  await fs.writeFile('cup.json', JSON.stringify(newKnownTweets, null, 2))

  // fetch data from twitter
  const data = await GetDataFromTwitterApi(...justIds)
  // unix timestamp
  const now = new Date().getTime()

  let singlePollArray = CreateSinglePollArrayFromTweetData(data)

  let fullDataStructure = {
    knockout: {},
    groupStages: {},
    quarterFinal: {},
    semiFinal: {},
    runnerUp: {},
    final: {},
  }

  const cupData = await GetCupJson()
  const lastData = await GetDataJson()

  const finaliseDataStructure = stage => k => {
    /** @type {SinglePoll} */
    const game = cupData[stage][k]

    if (!game.tweetId) {
      fullDataStructure[stage][k] = new SinglePoll({
        scheduledStartDay: game.startDate ? `${game.startDate}Z` : 0,
        votesInfo: [
          game.team1 ? new VotesInfo({ tocReportingMark: game.team1 }) : null,
          game.team2 ? new VotesInfo({ tocReportingMark: game.team2 }) : null,
        ],
        votingStatus: 'UPCOMING',
      })
    } else {
      let thisPoll = singlePollArray.find(p => p.twitterInfo.tweetId === game.tweetId)

      /** @type {SinglePoll} */
      const lastDataGame = lastData[stage][k]

      if (thisPoll.votingStatus === 'IN_PROGRESS') {
        Log(`Handling vote history of in-progress poll... (${stage}.${k})`, Log.SEVERITY.DEBUG)

        if (lastDataGame.votesInfo[0].votes !== thisPoll.votesInfo[0].votes || lastDataGame.votesInfo[1].votes !== thisPoll.votesInfo[1].votes) {
          Log(`Vote count has changed: updating history...`, Log.SEVERITY.DEBUG)

          // Updates have been made to the votes on the API, so we should add an item to the history
          lastDataGame.votesInfo.forEach(
            /**
             * @param {VotesInfo} votes
             * @param {0|1} i
             */
            (votes, i) => {
              if (Array.isArray(votes.votingHistory)) {
                Log('Using spread operator to update...', Log.SEVERITY.DEBUG)
                thisPoll.votesInfo[i].votingHistory = [...votes.votingHistory, { timestamp: now, votes: thisPoll.votesInfo[i].votes }]
              } else {
                Log('Updating position ' + i, Log.SEVERITY.DEBUG)
                thisPoll.votesInfo[i].votingHistory = [{ timestamp: now, votes: thisPoll.votesInfo[i].votes }]
              }
            }
          )
        } else {
          Log(`Vote count has NOT changed.`, Log.SEVERITY.DEBUG)

          lastDataGame.votesInfo.forEach(
            /**
             * @param {VotesInfo} votes
             * @param {0|1} i
             */
            (votes, i) => {
              thisPoll.votesInfo[i].votingHistory = votes.votingHistory
            }
          )
        }
      } else {
        lastDataGame.votesInfo.forEach(
          /**
           * @param {VotesInfo} votes
           * @param {0|1} i
           */
          (votes, i) => {
            thisPoll.votesInfo[i].votingHistory = votes.votingHistory
          }
        )
      }

      fullDataStructure[stage][k] = thisPoll
    }
  }

  Log('Finalising data structure')

  Log('Finalising knockout', Log.SEVERITY.DEBUG)
  Object.keys(cupData.knockout).forEach(finaliseDataStructure('knockout'))
  Log('Finalising groupStages', Log.SEVERITY.DEBUG)
  Object.keys(cupData.groupStages).forEach(finaliseDataStructure('groupStages'))
  Log('Finalising quarterFinal', Log.SEVERITY.DEBUG)
  Object.keys(cupData.quarterFinal).forEach(finaliseDataStructure('quarterFinal'))
  Log('Finalising semiFinal', Log.SEVERITY.DEBUG)
  Object.keys(cupData.semiFinal).forEach(finaliseDataStructure('semiFinal'))
  Log('Finalising runnerUp', Log.SEVERITY.DEBUG)
  Object.keys(cupData.runnerUp).forEach(finaliseDataStructure('runnerUp'))
  Log('Finalising final', Log.SEVERITY.DEBUG)
  Object.keys(cupData.final).forEach(finaliseDataStructure('final'))

  // console.log(JSON.stringify(fullDataStructure, null, 2))

  // update latest copy of data
  // historicalData.latest_all = allData
  // Log(JSON.stringify(historicalData.latest_all));

  // Log(JSON.stringify(historicalData));

  Log('Writing data.json to disk', Log.SEVERITY.DEBUG)
  await fs.writeFile('./data/data.json', JSON.stringify(fullDataStructure, null, 2))
  Log('Writing data.min.json to disk', Log.SEVERITY.DEBUG)
  await fs.writeFile('./data/data.min.json', JSON.stringify(fullDataStructure))
  Log('All data writen. Waiting for next check...', Log.SEVERITY.DEBUG)
}

/**
 *
 * @param  {...string} tweetIds
 * @returns {Promise<{tweets:Array.<{attachments:{poll_ids:string[]},id:string,text:string}>,polls:Array.<{id:string,options:Array.<{position:number,label:string,votes:number}>}>}}>}
 */
async function GetDataFromTwitterApi(...tweetIds) {
  const tweet = await (
    await fetch(
      `https://api.twitter.com/2/tweets?ids=${tweetIds.join(',')}` +
        `&tweet.fields=created_at` +
        `&expansions=attachments.poll_ids` +
        `&poll.fields=duration_minutes,end_datetime,id,options,voting_status`,
      {
        headers: { Authorization: `Bearer ${TOKEN}` },
      }
    )
  ).json()
  Log('Received data from Twitter API', Log.SEVERITY.DEBUG)

  // console.log(JSON.stringify(tweet, null, 2))

  // console.log(tweet)

  return {
    tweets: tweet.data,
    polls: tweet.includes.polls,
  }
}

app.get(`/v1/all_polls`, async (req, res) => {
  const data = GetDataJson()

  return SendResponse.JSON(res, data)
})

app.get(`/favicon.ico`, async (req, res) => {
  return SendResponse.File(res, 'icon.ico')
})

Log(`Starting API listener...`, Log.SEVERITY.DEBUG)

if (!TOKEN) {
  Log(`No API token specified!`, Log.SEVERITY.ERROR)
  exit(1)
}

let listener = app.listen(port || 2678, () => {
  Log(`Listening at localhost:${listener.address().port}`, Log.SEVERITY.INFO)

  Log('Fetching data from the Twitter API')
  UpdatePollData()

  // Update every 2 mins
  setInterval(() => {
    Log('Fetching latest data from the Twitter API')
    UpdatePollData()
  }, 1 * 60 * 1000)
})
