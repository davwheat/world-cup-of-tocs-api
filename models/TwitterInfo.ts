/**
 * Holds info about a tweet. Used within `SinglePoll`.
 */
export default class TwitterInfo {
  /**
   * ID of the poll's tweet
   */
  tweetId: string

  /**
   * When the poll opened for votes (UTC timestamp).
   */
  startTime: number

  /**
   * When the poll closed for new votes (UTC timestamp).
   */
  endTime: number

  /**
   * Overall length of the poll in minutes.
   */
  durationMinutes: number

  /**
   * Creates an instance of TwitterInfo.
   *
   * @param {object} data
   * @param {string} data.tweetId         ID of the poll's tweet
   * @param {string} data.startTime       When the poll began accepting votes
   * @param {string} data.endTime         When the poll stopped/will stop accepting votes
   * @param {string} data.durationMinutes Poll duration in minutes
   */
  constructor(data: { tweetId: string; startTime: string; endTime: string; durationMinutes: string }) {
    const { tweetId, startTime, endTime, durationMinutes } = data

    this.tweetId = tweetId
    this.startTime = typeof startTime === 'number' ? startTime : new Date(startTime).getTime()
    this.endTime = typeof endTime === 'number' ? endTime : new Date(endTime).getTime()
    this.durationMinutes = durationMinutes
  }
}
