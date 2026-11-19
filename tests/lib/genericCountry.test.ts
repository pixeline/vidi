import { describe, it, expect } from 'vitest'
import { scoreAccount } from '../../src/lib/signals/countryProfile'
import { COUNTRY_CODES, genericCountryProfile } from '../../src/lib/signals/genericCountry'
import { profileFor } from '../../src/lib/signals/profiles'

describe('COUNTRY_CODES', () => {
  it('lists the 249 ISO 3166-1 alpha-2 country codes and no pseudo-codes', () => {
    expect(COUNTRY_CODES).toHaveLength(249)
    expect(new Set(COUNTRY_CODES).size).toBe(249)
    for (const code of ['EU', 'UN', 'EZ', 'QO', 'ZZ', 'XA', 'XB', 'XK']) expect(COUNTRY_CODES).not.toContain(code)
    for (const code of ['BE', 'PT', 'GB', 'US', 'AQ', 'AX']) expect(COUNTRY_CODES).toContain(code)
  })
})

describe('generic country profile', () => {
  it('builds a flag + domain + country-name profile for a non-curated country', () => {
    const pt = profileFor('PT')!
    expect(pt).not.toBeNull()
    expect(pt.code).toBe('PT')
    expect(pt.name).toBe('Portugal')
    expect(pt.adjective).toBe('Portugal')
    expect(pt.flag).toBe('🇵🇹')
    expect(pt.tlds).toEqual(['pt'])
    expect(pt.places).toEqual({})
    expect(scoreAccount(pt, { handle: 'ana.pt' })).toEqual({ score: 3, signals: ['.pt handle'] })
    expect(scoreAccount(pt, { handle: 'a.bsky.social', description: 'vivo em Portugal' })).toEqual({ score: 3, signals: ['country'] })
    // Polish display name
    expect(scoreAccount(pt, { handle: 'a.bsky.social', description: 'Portugalia' }).score).toBe(3)
    expect(scoreAccount(pt, { handle: 'a.bsky.social', description: '🇵🇹' }).score).toBe(3)
  })

  it('is case-insensitive and stable', () => {
    expect(profileFor('pt')).toBe(profileFor('PT'))
  })

  it('uses .uk for GB', () => {
    expect(profileFor('GB')!.tlds).toEqual(['uk'])
    expect(scoreAccount(profileFor('GB')!, { handle: 'jane.co.uk' }).score).toBe(3)
  })

  it('skips ccTLDs that are mostly used generically', () => {
    expect(profileFor('IO')!.tlds).toEqual([])
    expect(profileFor('TV')!.tlds).toEqual([])
    expect(scoreAccount(profileFor('TV')!, { handle: 'stream.tv' }).score).toBe(0)
  })

  it('builds a working profile for every country code', () => {
    for (const code of COUNTRY_CODES) {
      const p = profileFor(code)!
      expect(p.code).toBe(code)
      expect(() => scoreAccount(p, { handle: 'a.bsky.social', description: p.name })).not.toThrow()
      expect(scoreAccount(p, { handle: 'a.bsky.social', description: p.name }).score).toBeGreaterThanOrEqual(3)
    }
  })

  it('returns null for codes that are not countries', () => {
    expect(profileFor('EU')).toBeNull()
    expect(profileFor('ZZ')).toBeNull()
    expect(profileFor('XX')).toBeNull()
    expect(genericCountryProfile('EU')).toBeNull()
  })

  it('prefers the curated profile when one exists', () => {
    expect(Object.keys(profileFor('BE')!.places).length).toBeGreaterThan(0)
  })
})
