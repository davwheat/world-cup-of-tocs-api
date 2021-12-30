import Fuse from 'fuse.js'

export type TubeCode = 'ju' | 'tr' | 'ba' | 'dl' | 'ci' | 'hc' | 'wc' | 'pi' | 'tl' | 'me' | 'no' | 'ce' | 'vi' | 'di' | 'ov'

/**
 * Defines the main color used for TOC branding, defined by their reporting mark.
 */
const TocColors = Object.freeze({
  vt: '#004354',
  em: '#ffa500',
  me: '#f1bc1e',
  aw: '#ff4500',
  ln: '#014133',
  cc: '#b7007c',
  cs: '#1d2e35',
  il: '#1e90ff',
  gc: '#1d1d1b',
  sr: '#1c4074',
  es: '#ffd700',
  cr: '#00bfff',
  xc: '#660f21',
  tl: '#e9438d',
  gn: '#0099ff',
  tp: '#010385',
  hx: '#523e63',
  gw: '#0a493e',
  lo: '#ff7518',
  le: '#d70428',
  gr: '#ce0e2d',
  ie: '#43a93b',
  nt: '#223262',
  ni: '#00d899',
  sn: '#8cc63e',
  se: '#00afe8',
  sw: '#0192cc',
  ht: '#de005c',
  gx: '#eb1e2d',
  lm: '#ff8200',
  xr: '#0019a8',
  sx: '#6b717a',
  '??': '#000',
})

/**
 * Defines a list of TOC names mapped to their reporting marks.
 */
const TocCodeToNameMap: Record<TubeCode | '??', string> = {
  ju: 'Jubilee',
  tr: 'Trams',
  ba: 'Bakerloo',
  dl: 'DLR',
  ci: 'Circle',
  hc: 'Hammersmith & City',
  wc: 'Waterloo & City',
  pi: 'Piccadilly',
  tl: 'Thameslink',
  me: 'Metropolitan',
  no: 'Northern',
  ce: 'Central',
  vi: 'Victoria',
  di: 'District',
  ov: 'Overground',
  '??': 'Unknown',
} as const

const _knownTocAliases: Partial<Record<TubeCode, string[]>> = {
  hc: ['H&C'],
  wc: ['W&C'],
  ov: ['London Overground'],
}

const _codeNameArrayMap: { code: TubeCode; name: string }[] = Object.keys(TocCodeToNameMap).reduce((arr, currentCode) => {
  return [...arr, { code: currentCode, name: TocCodeToNameMap[currentCode], alias: _knownTocAliases[currentCode] }]
}, [])

/**
 * Get a TOC's name from their two letter reporting mark.
 */
function GetTocName(code: string): string {
  let c = code.toString().toLowerCase()
  return TocCodeToNameMap[c] || 'Unknown'
}

function GetTocColor(code: string): string {
  let c = code.toString().toLowerCase()
  return TocColors[c] || '#000'
}

function GetTocCodeFromName(name: string): string {
  const fuseOptions = {
    isCaseSensitive: false,
    keys: ['name', 'alias'],
  }

  const fuse = new Fuse(_codeNameArrayMap, fuseOptions)

  return fuse.search(name)[0].item.code
}

export { GetTocName, GetTocColor, GetTocCodeFromName }
