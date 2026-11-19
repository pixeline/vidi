import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/lib/authz/membership', () => ({
  assertActiveMember: (...args: unknown[]) => assertMemberMock(...args),
  AuthzError: class extends Error {
    status = 403
  },
}))
const assertMemberMock = vi.fn()

// Distinguish the seeds select from the accounts-count select by a sentinel on
// the mocked table object passed to `.from()`.
vi.mock('drizzle-orm', () => ({
  eq: (col: unknown, val: unknown) => ({ op: 'eq', col, val }),
  and: (...args: unknown[]) => ({ op: 'and', args }),
  count: () => ({}),
}))

const orgIdCol = { __c: 'orgId' }
const keywordCol = { __c: 'keyword' }
vi.mock('../../src/db/schema', () => ({
  crawlSeeds: { __t: 'crawlSeeds', orgId: orgIdCol, keyword: keywordCol } as any,
  accounts: { __t: 'accounts' } as any,
}))

let seedRows: unknown[] = []
let accountsCountRows: unknown[] = [{ value: 0 }]
const selectWheres: unknown[] = []
const insertCalls: Array<{ values: unknown; conflict: unknown }> = []
const updateCalls: Array<{ set: unknown; where: unknown }> = []

vi.mock('../../src/db/client', () => ({
  db: {
    select: () => ({
      from: (table: any) =>
        table?.__t === 'accounts'
          ? accountsCountRows
          : {
              where: (cond: unknown) => {
                selectWheres.push(cond)
                return Promise.resolve(seedRows)
              },
            },
    }),
    insert: () => ({
      values: (values: unknown) => ({
        onConflictDoUpdate: (conflict: unknown) => {
          insertCalls.push({ values, conflict })
          return Promise.resolve()
        },
      }),
    }),
    update: () => ({
      set: (set: unknown) => ({
        where: (where: unknown) => {
          updateCalls.push({ set, where })
          return Promise.resolve()
        },
      }),
    }),
  },
}))

describe('crawl-seeds route', () => {
  beforeEach(() => {
    vi.resetModules()
    seedRows = [{ id: 1, keyword: 'brussels', enabled: true }]
    accountsCountRows = [{ value: 1234 }]
    insertCalls.length = 0
    selectWheres.length = 0
    updateCalls.length = 0
    assertMemberMock.mockReset()
  })

  it('401 when not logged in (GET)', async () => {
    vi.doMock('../../src/lib/authz/session', () => ({ getActor: async () => null }))
    const { GET } = await import('../../src/app/api/crawl-seeds/route')
    const req = new Request('http://x/vidi/api/crawl-seeds?orgId=1')
    expect((await GET(req as any)).status).toBe(401)
  })

  it('403 when not an active member (GET)', async () => {
    vi.doMock('../../src/lib/authz/session', () => ({ getActor: async () => ({ did: 'did:plc:outsider' }) }))
    assertMemberMock.mockImplementation(async () => {
      const { AuthzError } = await import('../../src/lib/authz/membership')
      throw new AuthzError('member required')
    })
    const { GET } = await import('../../src/app/api/crawl-seeds/route')
    const req = new Request('http://x/vidi/api/crawl-seeds?orgId=1')
    expect((await GET(req as any)).status).toBe(403)
  })

  it('lists seeds and the harvested-accounts count for an active member', async () => {
    vi.doMock('../../src/lib/authz/session', () => ({ getActor: async () => ({ did: 'did:plc:helper' }) }))
    assertMemberMock.mockResolvedValue(undefined)
    const { GET } = await import('../../src/app/api/crawl-seeds/route')
    const req = new Request('http://x/vidi/api/crawl-seeds?orgId=1')
    const res = await GET(req as any)
    const body = await res.json()
    expect(body.seeds).toEqual(seedRows)
    expect(body.accountsCount).toBe(1234)
  })

  it('POST upserts a keyword, re-enabling if it already exists (member allowed)', async () => {
    vi.doMock('../../src/lib/authz/session', () => ({ getActor: async () => ({ did: 'did:plc:helper' }) }))
    assertMemberMock.mockResolvedValue(undefined)
    const { POST } = await import('../../src/app/api/crawl-seeds/route')
    const req = new Request('http://x/vidi/api/crawl-seeds', {
      method: 'POST',
      body: JSON.stringify({ orgId: 1, keyword: 'namur' }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(200)
    expect(insertCalls[0].values).toEqual({ orgId: 1, keyword: 'namur', enabled: true })
  })

  it('GET filters seeds by orgId', async () => {
    vi.doMock('../../src/lib/authz/session', () => ({ getActor: async () => ({ did: 'did:plc:helper' }) }))
    assertMemberMock.mockResolvedValue(undefined)
    const { GET } = await import('../../src/app/api/crawl-seeds/route')
    await GET(new Request('http://x/vidi/api/crawl-seeds?orgId=7') as any)
    expect(selectWheres[0]).toEqual({ op: 'eq', col: orgIdCol, val: 7 })
  })

  it('POST inserts with orgId and conflicts on (orgId, keyword)', async () => {
    vi.doMock('../../src/lib/authz/session', () => ({ getActor: async () => ({ did: 'did:plc:helper' }) }))
    assertMemberMock.mockResolvedValue(undefined)
    const { POST } = await import('../../src/app/api/crawl-seeds/route')
    await POST(
      new Request('http://x/vidi/api/crawl-seeds', {
        method: 'POST',
        body: JSON.stringify({ orgId: 1, keyword: 'roma' }),
      }) as any
    )
    expect(insertCalls[0].values).toEqual({ orgId: 1, keyword: 'roma', enabled: true })
    expect((insertCalls[0].conflict as any).target).toEqual([orgIdCol, keywordCol])
  })

  it('PATCH toggles enabled state (member allowed)', async () => {
    vi.doMock('../../src/lib/authz/session', () => ({ getActor: async () => ({ did: 'did:plc:helper' }) }))
    assertMemberMock.mockResolvedValue(undefined)
    const { PATCH } = await import('../../src/app/api/crawl-seeds/route')
    const req = new Request('http://x/vidi/api/crawl-seeds', {
      method: 'PATCH',
      body: JSON.stringify({ orgId: 1, keyword: 'namur', enabled: false }),
    })
    const res = await PATCH(req as any)
    expect(res.status).toBe(200)
    expect(updateCalls[0].set).toEqual({ enabled: false })
  })

  it("PATCH only touches the caller's org", async () => {
    vi.doMock('../../src/lib/authz/session', () => ({ getActor: async () => ({ did: 'did:plc:helper' }) }))
    assertMemberMock.mockResolvedValue(undefined)
    const { PATCH } = await import('../../src/app/api/crawl-seeds/route')
    await PATCH(
      new Request('http://x/vidi/api/crawl-seeds', {
        method: 'PATCH',
        body: JSON.stringify({ orgId: 3, keyword: 'namur', enabled: false }),
      }) as any
    )
    expect(updateCalls[0].where).toEqual({
      op: 'and',
      args: [
        { op: 'eq', col: orgIdCol, val: 3 },
        { op: 'eq', col: keywordCol, val: 'namur' },
      ],
    })
  })
})
