import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

type SeedRow = { id?: number; orgId?: number; keyword: string; enabled: boolean; orgStatus?: string }
let seedRows: SeedRow[] = []
let joined: unknown[] = []

// Columns are plain names so the mocked where() can apply eq/and conditions
// to the rows; a row's org status (from the orgs join) defaults to active.
vi.mock('../../src/db/schema', () => ({
  crawlSeeds: { keyword: 'keyword', enabled: 'enabled', orgId: 'orgId' },
  orgs: { id: 'orgs.id', status: 'orgStatus' },
}))
vi.mock('drizzle-orm', () => ({
  and: (...conds: unknown[]) => ({ and: conds }),
  eq: (col: string, val: unknown) => ({ col, val }),
}))
const matches = (row: SeedRow, cond: any): boolean =>
  cond.and
    ? cond.and.every((c: unknown) => matches(row, c))
    : ({ orgStatus: 'active', ...row } as Record<string, unknown>)[cond.col] === cond.val
vi.mock('../../src/db/client', () => {
  const where = async (cond: unknown) => seedRows.filter((r) => matches(r, cond))
  return {
    db: {
      select: () => ({
        from: () => ({
          innerJoin: (table: unknown, on: unknown) => {
            joined.push([table, on])
            return { where }
          },
          where,
        }),
      }),
    },
  }
})

const searchActorsTypeahead = vi.fn()
const ctorSpy = vi.fn()

vi.mock('@atproto/api', () => ({
  AtpAgent: class {
    constructor(opts: { service: string }) {
      ctorSpy(opts)
      return { app: { bsky: { actor: { searchActorsTypeahead } } } } as any
    }
  },
}))

import { runKeywordSeed } from '../../src/crawler/keywordSeed'

describe('runKeywordSeed', () => {
  const originalUrl = process.env.VIDI_TYPEAHEAD_URL

  beforeEach(() => {
    seedRows = []
    joined = []
    searchActorsTypeahead.mockReset()
    ctorSpy.mockReset()
    delete process.env.VIDI_TYPEAHEAD_URL
  })

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.VIDI_TYPEAHEAD_URL
    else process.env.VIDI_TYPEAHEAD_URL = originalUrl
  })

  it('defaults to https://typeahead.waow.tech when VIDI_TYPEAHEAD_URL is unset', async () => {
    seedRows = [{ id: 1, keyword: 'brussels', enabled: true }]
    searchActorsTypeahead.mockResolvedValue({ data: { actors: [] } })

    await runKeywordSeed({} as any)

    expect(ctorSpy).toHaveBeenCalledWith({ service: 'https://typeahead.waow.tech' })
  })

  it('uses VIDI_TYPEAHEAD_URL when configured', async () => {
    process.env.VIDI_TYPEAHEAD_URL = 'https://custom-typeahead.example'
    seedRows = [{ id: 1, keyword: 'brussels', enabled: true }]
    searchActorsTypeahead.mockResolvedValue({ data: { actors: [] } })

    await runKeywordSeed({} as any)

    expect(ctorSpy).toHaveBeenCalledWith({ service: 'https://custom-typeahead.example' })
  })

  it('calls searchActorsTypeahead per enabled seed keyword and dedupes DIDs', async () => {
    seedRows = [
      { id: 1, keyword: 'brussels', enabled: true },
      { id: 2, keyword: 'belgium', enabled: true },
    ]
    searchActorsTypeahead
      .mockResolvedValueOnce({ data: { actors: [{ did: 'did:plc:a' }, { did: 'did:plc:b' }] } })
      .mockResolvedValueOnce({ data: { actors: [{ did: 'did:plc:b' }, { did: 'did:plc:c' }] } })

    const dids = await runKeywordSeed({} as any)

    expect(searchActorsTypeahead).toHaveBeenCalledTimes(2)
    expect(searchActorsTypeahead).toHaveBeenNthCalledWith(1, { q: 'brussels', limit: 100 })
    expect(searchActorsTypeahead).toHaveBeenNthCalledWith(2, { q: 'belgium', limit: 100 })
    expect(dids.sort()).toEqual(['did:plc:a', 'did:plc:b', 'did:plc:c'])
  })

  it('queries a keyword shared by two orgs once', async () => {
    seedRows = [
      { orgId: 1, keyword: 'roma', enabled: true },
      { orgId: 2, keyword: 'roma', enabled: true },
    ]
    searchActorsTypeahead.mockResolvedValue({ data: { actors: [{ did: 'did:plc:a' }] } })

    await runKeywordSeed({} as any)

    expect(searchActorsTypeahead).toHaveBeenCalledTimes(1)
    expect(searchActorsTypeahead).toHaveBeenCalledWith({ q: 'roma', limit: 100 })
  })

  it('skips keywords of a disconnected org', async () => {
    seedRows = [
      { orgId: 1, keyword: 'brussels', enabled: true, orgStatus: 'active' },
      { orgId: 2, keyword: 'roma', enabled: true, orgStatus: 'disconnected' },
      { orgId: 1, keyword: 'gent', enabled: false, orgStatus: 'active' },
    ]
    searchActorsTypeahead.mockResolvedValue({ data: { actors: [] } })

    await runKeywordSeed({} as any)

    expect(joined).toHaveLength(1)
    expect(searchActorsTypeahead).toHaveBeenCalledTimes(1)
    expect(searchActorsTypeahead).toHaveBeenCalledWith({ q: 'brussels', limit: 100 })
  })

  it('returns an empty array when there are no enabled seeds', async () => {
    seedRows = []
    const dids = await runKeywordSeed({} as any)
    expect(dids).toEqual([])
    expect(searchActorsTypeahead).not.toHaveBeenCalled()
  })

  it('isolates a failing keyword so the others still contribute DIDs', async () => {
    seedRows = [
      { id: 1, keyword: 'namur', enabled: true },
      { id: 2, keyword: 'liège', enabled: true },
      { id: 3, keyword: 'gent', enabled: true },
    ]
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    searchActorsTypeahead
      .mockResolvedValueOnce({ data: { actors: [{ did: 'did:plc:a' }] } })
      .mockRejectedValueOnce(new Error('Output/actors/21/handle must be a valid handle'))
      .mockResolvedValueOnce({ data: { actors: [{ did: 'did:plc:c' }] } })

    const dids = await runKeywordSeed({} as any)

    expect(searchActorsTypeahead).toHaveBeenCalledTimes(3)
    expect(dids.sort()).toEqual(['did:plc:a', 'did:plc:c'])
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('keyword "liège" failed'),
      expect.any(Error)
    )
    consoleErrorSpy.mockRestore()
  })
})
