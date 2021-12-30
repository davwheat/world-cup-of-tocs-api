import dotenv from 'dotenv'
dotenv.config()
const env = process.env
import fetch from 'node-fetch'
import express, { urlencoded } from 'express'
const app = express()
const port = env.PORT
import Log, { SEVERITY } from './logger'
const TOKEN = process.env.TWITTER_BEARER_TOKEN
import { JSON as _JSON, File } from './helpers/SendResponse'
import { promises as fs } from 'fs'
import { createWriteStream } from 'fs'
import CreateSinglePollArrayFromTweetData from './models/CreateSinglePollArrayFromTweetData'
import SinglePoll from './models/SinglePoll'
import VotesInfo from './models/VotesInfo'
import morgan from 'morgan'
import compression from 'compression'
import { exit } from 'process'

const GetCupJson = async (): Promise<Record<string, any>> => JSON.parse((await fs.readFile('./cup.json')).toString())
const GetDataJson = async (): Promise<Record<string, any>> => JSON.parse((await fs.readFile('./data/data.min.json')).toString())
const GetGameNotes = async (): Promise<Record<string, any>> => JSON.parse((await fs.readFile('./game-notes.json')).toString())

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  res.header('Access-Control-Allow-Methods', 'GET')
  res.header('Access-Control-Max-Age', '86400')
  res.header('Cache-Control', `public, max-age=60, stale-if-error=600, stale-while-revalidate=120`)
  next()
})

// Add ETag caching
app.set('etag', 'weak')
app.use(
  urlencoded({
    extended: true,
  })
)

// Add gzip compression
app.use(compression())

app.use(morgan('combined', { stream: createWriteStream('./access.log', { flags: 'a' }) }))
app.use(morgan('dev'))

/**
 * @returns Tweet IDs identified by the algorithm to be a poll from Geoff
 */
async function GetTweetIDs(): Promise<string[]> {
  Log('Feteching tweet IDs...', SEVERITY.INFO)
  //   'https://api.twitter.com/2/tweets/search/recent?query=from:geofftech AND #WorldCupOfTubeLines&expansions=attachments.poll_ids',
  const data = await fetch(
    `https://api.twitter.com/2/tweets/search/recent?query=` +
      `from:geofftech ` + //? from Geoff
      `%23WorldCupOfTubeLines ` + //? has #WorldCupOfTrainOperators
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

  if (!json.data) {
    Log('No tweets found.', SEVERITY.WARNING)
    return null
  }

  Log('Filtering...', SEVERITY.DEBUG)

  const pollTweets: any[] = json.data.filter(tweet => tweet.attachments && tweet.attachments.poll_ids && tweet.attachments.poll_ids[0])

  const ids = pollTweets.reduce((prev, curr) => [...prev, curr.id], [] as string[])

  Log(`Identified ${ids.length} possible game tweets!`, SEVERITY.INFO)

  return ids
}

async function UpdatePollData() {
  const knownTweets = await GetCupJson()

  const firstToLastKeysOrder = ['groupStages', 'quarterFinal', 'semiFinal', 'runnerUp', 'final']

  const newKnownTweets = { ...knownTweets }
  const justIds = []

  const newTweetIds = await GetTweetIDs()

  if (!newTweetIds) {
    Log('No new tweet IDs found', SEVERITY.DEBUG)
  }

  let guessedGameTweetsCounter = 0

  // iterate through tweet IDs from old to new
  Log('Iterating through tweet Ids', SEVERITY.DEBUG)
  newTweetIds.reverse().forEach(id => {
    firstToLastKeysOrder.some(stage => {
      return Object.keys(newKnownTweets[stage]).some(k => {
        let key = k,
          currentTweetId = newKnownTweets[stage][k].tweetId

        // If we already have a tweet ID inserted into this game
        // add that ID to the list
        if (currentTweetId !== null) {
          justIds.push(currentTweetId)
        }

        // If the game's tweet ID matches this "new tweet ID"
        // stop searching for the ID
        if (currentTweetId === id) {
          return true
        }

        // This game has no tweet set, so this "new tweet" must
        // be for this game!
        if (currentTweetId === null) {
          newKnownTweets[stage][key].tweetId = id
          justIds.push(id)
          guessedGameTweetsCounter++
          return true
        }

        return false
      })
    })
  })

  // removes duplicate entries
  let finalIds = [...new Set(justIds)]

  while (finalIds.length > 100) {
    // max for twitter api is 100!
    // we need to do some magic, i do believe...

    // pop off the oldest tweets (front of array/stack)
    finalIds.shift()
  }

  Log(`${guessedGameTweetsCounter} IDs were not known to be correct`, guessedGameTweetsCounter > 0 ? SEVERITY.WARNING : SEVERITY.INFO)
  Log(`Fetching data for ${finalIds.length} tweets...`, SEVERITY.INFO)

  await fs.writeFile('cup.json', JSON.stringify(newKnownTweets, null, 2))

  // fetch data from twitter
  const data = await GetDataFromTwitterApi(...finalIds)
  // unix timestamp
  const now = new Date().getTime()

  let singlePollArray = CreateSinglePollArrayFromTweetData(data)

  let fullDataStructure = {
    groupStages: {},
    quarterFinal: {},
    semiFinal: {},
    runnerUp: {},
    final: {},
  }

  const cupData = await GetCupJson()
  const lastData = await GetDataJson()

  const finaliseDataStructure = stage => k => {
    const game = cupData[stage][k]

    if (!game.tweetId) {
      fullDataStructure[stage][k] = new SinglePoll({
        scheduledStartDay: game.startDate ? `${game.startDate}Z` : null,
        votesInfo: [
          game.team1 ? new VotesInfo({ tocReportingMark: game.team1 }) : null,
          game.team2 ? new VotesInfo({ tocReportingMark: game.team2 }) : null,
        ],
        votingStatus: 'UPCOMING',
      })
    } else {
      let thisPoll = singlePollArray.find(p => p.twitterInfo.tweetId === game.tweetId)

      /** @type {SinglePoll} */
      const lastDataGame: SinglePoll = lastData[stage][k]

      if (!thisPoll) {
        fullDataStructure[stage][k] = lastDataGame
        return
      }

      if (thisPoll.votingStatus === 'IN_PROGRESS') {
        Log(`Handling vote history of in-progress poll... (${stage}.${k})`, SEVERITY.DEBUG)

        if (lastDataGame.votesInfo[0].votes !== thisPoll.votesInfo[0].votes || lastDataGame.votesInfo[1].votes !== thisPoll.votesInfo[1].votes) {
          Log(`Vote count has changed: updating history...`, SEVERITY.DEBUG)

          // Updates have been made to the votes on the API, so we should add an item to the history
          lastDataGame.votesInfo.forEach((votes, i) => {
            if (Array.isArray(votes.votingHistory)) {
              Log('Using spread operator to update...', SEVERITY.DEBUG)
              thisPoll.votesInfo[i].votingHistory = [...votes.votingHistory, { timestamp: now, votes: thisPoll.votesInfo[i].votes }]
            } else {
              Log('Updating position ' + i, SEVERITY.DEBUG)
              thisPoll.votesInfo[i].votingHistory = [{ timestamp: now, votes: thisPoll.votesInfo[i].votes }]
            }
          })
        } else {
          Log(`Vote count has NOT changed.`, SEVERITY.DEBUG)

          lastDataGame.votesInfo.forEach((votes, i) => {
            thisPoll.votesInfo[i].votingHistory = votes.votingHistory
          })
        }
      } else {
        lastDataGame.votesInfo.forEach((votes, i) => {
          thisPoll.votesInfo[i].votingHistory = votes.votingHistory
        })
      }

      fullDataStructure[stage][k] = thisPoll
    }
  }

  Log('Finalising data structure')

  Log('Finalising groupStages', SEVERITY.DEBUG)
  Object.keys(cupData.groupStages).forEach(finaliseDataStructure('groupStages'))
  Log('Finalising quarterFinal', SEVERITY.DEBUG)
  Object.keys(cupData.quarterFinal).forEach(finaliseDataStructure('quarterFinal'))
  Log('Finalising semiFinal', SEVERITY.DEBUG)
  Object.keys(cupData.semiFinal).forEach(finaliseDataStructure('semiFinal'))
  Log('Finalising runnerUp', SEVERITY.DEBUG)
  Object.keys(cupData.runnerUp).forEach(finaliseDataStructure('runnerUp'))
  Log('Finalising final', SEVERITY.DEBUG)
  Object.keys(cupData.final).forEach(finaliseDataStructure('final'))

  Log('Writing data.json to disk', SEVERITY.DEBUG)
  await fs.writeFile('./data/data.json', JSON.stringify(fullDataStructure, null, 2))
  Log('Writing data.min.json to disk', SEVERITY.DEBUG)
  await fs.writeFile('./data/data.min.json', JSON.stringify(fullDataStructure))
  Log('All data writen. Waiting for next check...', SEVERITY.DEBUG)
}

/**
 *
 * @param  {...string} tweetIds
 * @returns {Promise<{tweets:Array.<{attachments:{poll_ids:string[]},id:string,text:string}>,polls:Array.<{id:string,options:Array.<{position:number,label:string,votes:number}>}>}}>}
 */
async function GetDataFromTwitterApi(...tweetIds: string[]): Promise<{
  tweets: Array<{ attachments: { poll_ids: string[] }; id: string; text: string }>
  polls: Array<{ id: string; options: Array<{ position: number; label: string; votes: number }> }>
}> {
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
  Log('Received data from Twitter API', SEVERITY.DEBUG)

  // console.log(JSON.stringify(tweet, null, 2))

  // console.log(tweet)

  return {
    tweets: tweet?.data || [],
    polls: tweet?.includes?.polls || [],
  }
}

app.get(`/v1/all_polls`, async (req, res) => {
  const data = await GetDataJson()

  return _JSON(res, data)
})

app.get(`/v1/game_notes`, async (req, res) => {
  const data = await GetGameNotes()

  return _JSON(res, data)
})

app.get(`/favicon.ico`, async (req, res) => {
  return File(res, 'icon.ico')
})

Log(`Starting API listener...`, SEVERITY.DEBUG)

if (!TOKEN) {
  Log(`No API token specified!`, SEVERITY.ERROR)
  exit(1)
}

let listener = app.listen(port || 2678, () => {
  Log(`Listening at ${listener.address()}`, SEVERITY.INFO)

  Log('Fetching data from the Twitter API')
  UpdatePollData()

  // Update every 2 mins
  setInterval(() => {
    Log('Fetching latest data from the Twitter API')
    UpdatePollData()
  }, 1 * 60 * 1000)
})
