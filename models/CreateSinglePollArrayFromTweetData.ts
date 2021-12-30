import { GetTocCodeFromName } from '../TocData'
import SinglePoll from './SinglePoll'
import TwitterInfo from './TwitterInfo'
import VotesInfo from './VotesInfo'
import CupData from '../helpers/FlattenCupData'

/**
 * Creates an array of `SinglePoll` from a Twitter API response.
 *
 * This **does not** including voting history, or upcoming polls.
 **/
export default function CreateSinglePollArrayFromTweetData(tweetData: { data: any[]; includes: { polls: any[] } }): SinglePoll[] {
  let array = []

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

    const cd = CupData.find(d => d.tweetId === twitterInfo.tweetId)

    const singlePoll = new SinglePoll({
      scheduledStartDay: cd ? new Date(`${cd.startDate}Z`).getTime() : poll.voting_status === 'UPCOMING' ? null : 0,
      votesInfo: votesInfoArray,
      twitterInfo: twitterInfo,
      votingStatus: poll.voting_status === 'closed' ? 'DONE' : 'IN_PROGRESS',
    })

    array.push(singlePoll)
  })

  return array
}
