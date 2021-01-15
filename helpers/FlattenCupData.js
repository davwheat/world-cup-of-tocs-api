const CupData = require('../cup.json')

/** @type {{ startDate: string, tweetId: string, team1: string, team2: string }[]} */
let flat_cupData = []

Object.keys(CupData).forEach(key => {
  let stageGameData = CupData[key]

  Object.keys(stageGameData).forEach(key2 => {
    let data = stageGameData[key2]

    flat_cupData = [...flat_cupData, data]
  })
})

// console.log(flat_cupData)

module.exports = flat_cupData
