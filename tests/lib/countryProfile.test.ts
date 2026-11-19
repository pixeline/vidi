import { describe, it, expect } from 'vitest'
import { scoreAccount } from '../../src/lib/signals/countryProfile'
import { PROFILES, profileFor } from '../../src/lib/signals/profiles'

describe('scoreAccount BE', () => {
  it('stacks flag + city + institution', () => {
    const r = scoreAccount(PROFILES.BE, { handle: 'x.bsky.social', description: '🇧🇪 researcher at KU Leuven, living in Brussel' })
    expect(r.score).toBe(3 + 2 + 2)
    expect(r.signals).toEqual(expect.arrayContaining(['🇧🇪', 'institution', 'Brussels']))
  })

  it('scores a lone .be handle as strong', () => {
    expect(scoreAccount(PROFILES.BE, { handle: 'rvloock.be' })).toEqual({ score: 3, signals: ['.be handle'] })
  })

  it('treats the nationality word as weak', () => {
    expect(scoreAccount(PROFILES.BE, { handle: 'a.bsky.social', description: 'Belgian beer fan' }).score).toBe(1)
  })

  it('does not fire on substrings or excluded ambiguous words', () => {
    // "namen" (NL names), "bergen" (NL mountains), "belgeo" (substring)
    expect(scoreAccount(PROFILES.BE, { handle: 'a.bsky.social', description: 'namen bergen belgeo' })).toEqual({ score: 0, signals: [] })
  })

  it('counts several places once', () => {
    const r = scoreAccount(PROFILES.BE, { handle: 'a.bsky.social', description: 'Gent ↔ Antwerpen' })
    expect(r.score).toBe(2)
    expect(r.signals).toEqual(['Antwerp', 'Ghent'])
  })

  it('matches accented words at their boundaries', () => {
    expect(scoreAccount(PROFILES.BE, { handle: 'a.bsky.social', description: 'Woon in België, werk in Liège' }).signals).toEqual([
      'country',
      'Liège',
    ])
    expect(scoreAccount(PROFILES.BE, { handle: 'a.bsky.social', description: 'xliège' }).score).toBe(0)
  })

  it('handles missing fields', () => {
    expect(scoreAccount(PROFILES.BE, {})).toEqual({ score: 0, signals: [] })
  })
})

describe('scoreAccount IT', () => {
  it('IT: flag + city + nationality', () => {
    const r = scoreAccount(PROFILES.IT, { handle: 'a.bsky.social', description: '🇮🇹 italiana, vivo a Milano' })
    expect(r.score).toBe(3 + 2 + 1)
    expect(r.signals).toEqual(expect.arrayContaining(['🇮🇹', 'Milan', 'nationality']))
  })

  it('IT: .it handle', () => {
    expect(scoreAccount(PROFILES.IT, { handle: 'mario.it' })).toEqual({ score: 3, signals: ['.it handle'] })
  })
})

describe('scoreAccount FR/ES/NL/NO', () => {
  it('FR: flag + institution + city', () => {
    const r = scoreAccount(PROFILES.FR, { handle: 'a.bsky.social', description: '🇫🇷 chercheuse au CNRS, Lyon' })
    expect(r.score).toBe(3 + 2 + 2)
    expect(r.signals).toEqual(expect.arrayContaining(['🇫🇷', 'institution', 'Lyon']))
  })

  it('ES: .es handle', () => {
    expect(scoreAccount(PROFILES.ES, { handle: 'mario.es' })).toEqual({ score: 3, signals: ['.es handle'] })
  })

  it('NL: nationality + city', () => {
    const r = scoreAccount(PROFILES.NL, { handle: 'a.bsky.social', description: 'Dutch journalist in Utrecht' })
    expect(r.score).toBe(1 + 2)
    expect(r.signals).toEqual(['nationality', 'Utrecht'])
  })

  it('NL: does not fire on words common in other languages', () => {
    expect(scoreAccount(PROFILES.NL, { handle: 'a.bsky.social', description: 'uva nos rug' })).toEqual({ score: 0, signals: [] })
  })

  it('NO: flag + city', () => {
    expect(scoreAccount(PROFILES.NO, { handle: 'a.bsky.social', description: '🇳🇴 Oslo' }).score).toBe(5)
  })
})

describe('profileFor', () => {
  it('returns null for missing or unknown codes', () => {
    expect(profileFor(null)).toBeNull()
    expect(profileFor('')).toBeNull()
    expect(profileFor('XX')).toBeNull()
  })

  it('is case-insensitive', () => {
    expect(profileFor('it')).toBe(PROFILES.IT)
  })
})
