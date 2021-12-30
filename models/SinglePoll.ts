export default class SinglePoll {
  /**
   * UTC midnight on day of the poll
   */
  scheduledStartDay: number

  /**
   * Describes whether the poll is yet to begin (tweet not posted), is in progress, or has closed to new votes.
   */
  votingStatus: 'UPCOMING' | 'IN_PROGRESS' | 'DONE'

  /**
   * Tweet info about a poll. `null` if not started.
   */
  twitterInfo: import('./TwitterInfts.j') | null

  /**
   * Voting info about a poll. `null` if not started, otherwise has length of 2: `0` being the first option, and `1` being the second.
   */
  votesInfo: import('./VotesInfo')[] | null

  /**
   * Creates an instance of `SinglePoll`.
   *
   * @param {number|string} data.scheduledStartDay                            A date string from Twitter API, or a Unix timestamp.
   * @param {"UPCOMING"|"IN_PROGRESS"|"DONE"} [data.votingStatus="UPCOMING"]  A date string from Twitter API, or a Unix timestamp.
   * @param {import('./TwitterInfo')|null} [data.twitterInfo=null]    An instance of `TwitterInfo`, if a tweet exists, otherwise `null`.
   * @param {import('./VotesInfo')[]|null} data.votesInfo             An array of length two containing instances of `VotesInfo`.
   */
  constructor(data: {
    scheduledStartDay: number | string
    votingStatus?: 'UPCOMING' | 'IN_PROGRESS' | 'DONE'
    twitterInfo?: import('./TwitterInfo') | null
    votesInfo: import('./VotesInfo')[] | null
  }) {
    const { scheduledStartDay, votingStatus, twitterInfo, votesInfo } = data

    this.scheduledStartDay = typeof scheduledStartDay === 'number' ? scheduledStartDay : new Date(scheduledStartDay).getTime()
    this.votingStatus = votingStatus ? votingStatus : 'UPCOMING'
    this.twitterInfo = twitterInfo ? twitterInfo : null
    this.votesInfo = votesInfo ? votesInfo : null
  }
}
