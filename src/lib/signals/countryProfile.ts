/**
 * Additive "is this account from <country>?" evidence scorer, generalised from
 * the bluesky-belgians list-grower (belgians/signals.py). Weights stack so a
 * list can be sorted by confidence rather than gambled on a yes/no threshold:
 * 🇧🇪 + Brussels + KU Leuven = 3 + 2 + 2 = 7, a lone `.be` handle = 3.
 * Empirically (Belgium), score ≥ 3 was ~90% precise and ≥ 5 effectively 100%.
 */
export type CountryProfile = {
  code: string // 'BE'
  name: string // 'Belgium' (Settings option label)
  adjective: string // 'Belgian' (UI copy: "strong Belgian signals")
  flag: string // '🇧🇪'
  tlds: string[] // ['be']
  rules: { name: string; weight: number; words: string[] }[]
  places: Record<string, string[]> // display name -> variants
}

export type SignalResult = { score: number; signals: string[] }

// Score ≥ 3 was ~90% precise in the list-grower's manual audit (one solid signal).
export const STRONG_SCORE = 3

// JS `\b` is ASCII-only (even with /u), so accented endings like "belgië"
// would never match; use Unicode-aware letter/number lookarounds instead.
const word = (alts: string) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${alts})(?![\\p{L}\\p{N}])`, 'iu')

type Compiled = {
  tldPatterns: { tld: string; re: RegExp }[]
  flag: RegExp
  rules: { name: string; weight: number; re: RegExp }[]
  places: [string, RegExp][]
}

const cache = new WeakMap<CountryProfile, Compiled>()

function compile(p: CountryProfile): Compiled {
  let c = cache.get(p)
  if (!c) {
    c = {
      tldPatterns: p.tlds.map((tld) => ({ tld, re: new RegExp(`\\.${tld}$`, 'i') })),
      flag: new RegExp(p.flag, 'u'),
      rules: p.rules.map((r) => ({ name: r.name, weight: r.weight, re: word(r.words.join('|')) })),
      places: Object.entries(p.places).map(([name, variants]) => [name, word(variants.join('|'))]),
    }
    cache.set(p, c)
  }
  return c
}

export function scoreAccount(
  p: CountryProfile,
  acc: { handle?: string | null; displayName?: string | null; description?: string | null },
): SignalResult {
  const c = compile(p)
  const handle = acc.handle ?? ''
  const text = [handle, acc.displayName ?? '', acc.description ?? ''].join('\n')
  const signals: string[] = []
  let score = 0

  for (const t of c.tldPatterns) {
    if (t.re.test(handle)) {
      signals.push(`.${t.tld} handle`)
      score += 3
    }
  }
  if (c.flag.test(text)) {
    signals.push(p.flag)
    score += 3
  }
  for (const r of c.rules) {
    if (r.re.test(text)) {
      signals.push(r.name)
      score += r.weight
    }
  }
  const places = c.places.filter(([, re]) => re.test(text)).map(([name]) => name)
  if (places.length) {
    signals.push(...places)
    score += 2
  }
  return { score, signals }
}
