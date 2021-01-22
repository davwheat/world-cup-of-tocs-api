const { GetTocCodeFromName } = require('../TocData')
const SinglePoll = require('./SinglePoll')
const TwitterInfo = require('./TwitterInfo')
const VotesInfo = require('./VotesInfo')
const flat_cupData = require('../helpers/FlattenCupData')

/**
 * Creates an array of `SinglePoll` from a Twitter API response.
 *
 * This **does not** including voting history, or upcoming polls.
 *
 * @param { { data: Array, includes: { polls: Array }} } tweetData
 *
 * @returns {SinglePoll[]}
 **/
module.exports = function CreateSinglePollArrayFromTweetData(tweetData) {
  let array = []

  // console.log(tweetData)

  const allTweets = tweetData.tweets
  const allPolls = tweetData.polls

  const getPollById = id => allPolls.find(poll => poll.id === id)

  allTweets.forEach(tweet => {
    const poll = getPollById(tweet.attachments.poll_ids[0])

    const twitterInfo = new TwitterInfo({
      tweetId: tweet.id,
      startTime: tweet.created_at,
      endTime: poll.end_datetime,
      durationMinutes: poll.duration_minutes,
    })

    const team1Code = GetTocCodeFromName(poll.options[0].label)
    const team2Code = GetTocCodeFromName(poll.options[1].label)
    // const team1Code = poll.options[0].label
    // const team2Code = poll.options[1].label

    const votesInfoArray = [
      new VotesInfo({
        tocReportingMark: team1Code,
        votes: poll.options[0].votes,
      }),
      new VotesInfo({
        tocReportingMark: team2Code,
        votes: poll.options[1].votes,
      }),
    ]

    const cd = flat_cupData.find(d => d.tweetId === twitterInfo.tweetId)

    const singlePoll = new SinglePoll({
      scheduledStartDay: cd,
      votesInfo: votesInfoArray,
      twitterInfo: twitterInfo,
      votingStatus: poll.voting_status === 'closed' ? 'DONE' : 'IN_PROGRESS',
    })

    array.push(singlePoll)
  })

  return array
}
