import { describe, it, expect } from 'vitest'
import { scoreAccount } from '../../src/lib/signals/countryProfile'
import { customProfile, parseSignalTerms, MAX_SIGNAL_TERMS, MAX_TERM_LENGTH } from '../../src/lib/signals/customTerms'
import { buildOrgProfile } from '../../src/lib/signals/profiles'

const bio = (description: string, handle = 'a.bsky.social') => ({ handle, description })

describe('parseSignalTerms', () => {
  it('splits on commas and newlines but not spaces, trims, lowercases, dedupes, keeps order', () => {
    expect(parseSignalTerms('Journalist, Le Monde\n\n  reporter ,journalist,\r\nLeMonde.fr')).toEqual([
      'journalist',
      'le monde',
      'reporter',
      'lemonde.fr',
    ])
  })

  it('accepts an array', () => {
    expect(parseSignalTerms(['A, b', 'c', ' ', 'A'])).toEqual(['a', 'b', 'c'])
  })

  it('exposes the limits', () => {
    expect(MAX_SIGNAL_TERMS).toBe(100)
    expect(MAX_TERM_LENGTH).toBe(60)
  })
})

describe('customProfile', () => {
  it('is null without terms', () => {
    expect(customProfile([])).toBeNull()
  })

  it('matches a word on its boundaries (+2)', () => {
    const p = customProfile(['journalist'])!
    expect(scoreAccount(p, bio('Investigative journalist'))).toEqual({ score: 2, signals: ['journalist'] })
    expect(scoreAccount(p, bio('journalistic')).score).toBe(0)
  })

  it('matches a phrase as a whole', () => {
    const p = customProfile(['le monde'])!
    expect(scoreAccount(p, bio('journaliste au Le Monde')).score).toBe(2)
    expect(scoreAccount(p, bio('le mondial')).score).toBe(0)
  })

  it('treats a dotted term as a handle domain (+3)', () => {
    const p = customProfile(['lemonde.fr', '.gouv.fr'])!
    expect(p.tlds).toEqual(['lemonde.fr', 'gouv.fr'])
    expect(scoreAccount(p, { handle: 'jane.lemonde.fr' })).toEqual({ score: 3, signals: ['.lemonde.fr handle'] })
    expect(scoreAccount(p, { handle: 'lemonde.fr' }).score).toBe(3)
    expect(scoreAccount(p, { handle: 'notlemonde.fr' }).score).toBe(0)
    expect(scoreAccount(p, { handle: 'lemondexfr' }).score).toBe(0)
    expect(scoreAccount(p, { handle: 'service.gouv.fr' })).toEqual({ score: 3, signals: ['.gouv.fr handle'] })
  })

  it('matches regex metacharacters literally', () => {
    const p = customProfile(['c++', '(a|b)', 'e-mail'])!
    expect(() => scoreAccount(p, bio('x'))).not.toThrow()
    expect(scoreAccount(p, bio('I write c++ daily')).score).toBe(2)
    expect(scoreAccount(p, bio('a')).score).toBe(0)
    expect(scoreAccount(p, bio('c')).score).toBe(0)
    expect(scoreAccount(p, bio('e-mail me')).score).toBe(2)
  })
})

describe('buildOrgProfile', () => {
  it('is null with neither a country nor terms', () => {
    expect(buildOrgProfile({ country: null, signalTerms: [] })).toBeNull()
  })

  it('custom-only profile is labelled Match / matching', () => {
    const p = buildOrgProfile({ country: null, signalTerms: ['journalist'] })!
    expect(p.code).toBe('Match')
    expect(p.name).toBe('Custom')
    expect(p.adjective).toBe('matching')
    expect(p.flag).toBeUndefined()
  })

  it('country-only profile is the country profile', () => {
    const p = buildOrgProfile({ country: 'IT', signalTerms: [] })!
    expect(p.code).toBe('IT')
    expect(scoreAccount(p, bio('🇮🇹 Roma')).score).toBe(5)
  })

  it('adds the country and custom scores', () => {
    const p = buildOrgProfile({ country: 'BE', signalTerms: ['journalist', 'lesoir.be'] })!
    expect(p.code).toBe('BE')
    expect(p.adjective).toBe('Belgian')
    const r = scoreAccount(p, { handle: 'a.bsky.social', description: 'Belgian journalist in Brussels' })
    // nationality 1 + Brussels 2 + journalist 2
    expect(r.score).toBe(5)
    expect(r.signals).toEqual(expect.arrayContaining(['nationality', 'journalist', 'Brussels']))
    // .be and .lesoir.be both fire on a lesoir.be handle
    expect(scoreAccount(p, { handle: 'jane.lesoir.be' }).score).toBe(6)
  })
})
