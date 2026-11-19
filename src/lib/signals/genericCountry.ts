import { regexEscape, type SignalProfile } from './countryProfile'

// Every officially assigned ISO 3166-1 alpha-2 country code (249). Reserved and
// user-assigned codes (EU, UN, EZ, QO, XA, XB, XK, ZZ…) are deliberately absent.
export const COUNTRY_CODES: readonly string[] = (
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ ' +
  'BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ ' +
  'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ ' +
  'DE DJ DK DM DO DZ ' +
  'EC EE EG EH ER ES ET ' +
  'FI FJ FK FM FO FR ' +
  'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY ' +
  'HK HM HN HR HT HU ' +
  'ID IE IL IM IN IO IQ IR IS IT ' +
  'JE JM JO JP ' +
  'KE KG KH KI KM KN KP KR KW KY KZ ' +
  'LA LB LC LI LK LR LS LT LU LV LY ' +
  'MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ ' +
  'NA NC NE NF NG NI NL NO NP NR NU NZ ' +
  'OM ' +
  'PA PE PF PG PH PK PL PM PN PR PS PT PW PY ' +
  'QA ' +
  'RE RO RS RU RW ' +
  'SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ ' +
  'TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ ' +
  'UA UG UM US UY UZ ' +
  'VA VC VE VG VI VN VU ' +
  'WF WS ' +
  'YE YT ' +
  'ZA ZM ZW'
).split(' ')

const COUNTRY_SET = new Set(COUNTRY_CODES)

// ccTLDs mostly registered for generic use (.io, .tv, .me…): a handle on one
// says nothing about the country.
const GENERIC_TLDS = new Set([
  'io', 'tv', 'me', 'co', 'ai', 'fm', 'gg', 'ly', 'to', 'cc', 'ws', 'sh', 'la', 'am', 'nu', 'tk', 'ml', 'ga', 'cf', 'gq',
])

// The languages whose name for the country counts as a "country" mention.
const NAME_LANGUAGES = ['en', 'fr', 'de', 'es', 'it', 'nl', 'pt', 'pl', 'sv', 'da', 'nb', 'fi', 'cs', 'ro', 'hu', 'el']

const displayNames = new Map<string, Intl.DisplayNames>()
function regionName(code: string, lang: string): string | undefined {
  let dn = displayNames.get(lang)
  if (!dn) {
    dn = new Intl.DisplayNames([lang], { type: 'region' })
    displayNames.set(lang, dn)
  }
  return dn.of(code)
}

/** English display name of a country code (e.g. 'PT' → 'Portugal'). */
export function countryName(code: string): string {
  return regionName(code.toUpperCase(), 'en') ?? code.toUpperCase()
}

const flagOf = (code: string) =>
  String.fromCodePoint(...[...code].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65))

const cache = new Map<string, SignalProfile>()

/**
 * Fallback for countries without a curated list: flag (+3), the national
 * handle domain (+3) and the country's name in the main European languages
 * (+3). Cached so each code yields one stable object (scoreAccount caches its
 * compiled regexes per profile object).
 */
export function genericCountryProfile(code: string): SignalProfile | null {
  const upper = code.toUpperCase()
  if (!COUNTRY_SET.has(upper)) return null
  let p = cache.get(upper)
  if (!p) {
    const name = countryName(upper)
    const tld = upper === 'GB' ? 'uk' : upper.toLowerCase()
    const words: string[] = []
    for (const lang of NAME_LANGUAGES) {
      const w = regionName(upper, lang)?.toLowerCase()
      if (w && !words.includes(w)) words.push(w)
    }
    p = {
      code: upper,
      name,
      adjective: name,
      flag: flagOf(upper),
      tlds: GENERIC_TLDS.has(tld) ? [] : [tld],
      rules: [{ name: 'country', weight: 3, words: words.map(regexEscape) }],
      places: {},
    }
    cache.set(upper, p)
  }
  return p
}
