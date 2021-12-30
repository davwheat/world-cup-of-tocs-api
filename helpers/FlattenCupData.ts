import CupData from '../cup.json'

const flat_cupData: { startDate: string; tweetId: string; team1: string; team2: string }[] = []

Object.keys(CupData).forEach(key => {
  let stageGameData = CupData[key]

  Object.keys(stageGameData).forEach(key2 => {
    let data = stageGameData[key2]

    flat_cupData.push(data)
  })
})

export default flat_cupData
