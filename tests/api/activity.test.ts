import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('../../src/lib/authz/session', () => ({ getActor: async () => ({ did: 'did:plc:a' }) }))
vi.mock('../../src/lib/authz/membership', async (orig) => {
  const mod: any = await orig()
  return { ...mod, assertActiveMember: vi.fn(async () => {}) }
})
vi.mock('../../src/db/schema', () => ({
  verificationActions: { __t: 'va', id: 'va.id', orgId: 'va.orgId', actorDid: 'va.actorDid', subjectDid: 'va.subjectDid' },
  accounts: { __t: 'accounts', did: 'accounts.did', handle: 'accounts.handle' },
  members: { __t: 'members', orgId: 'members.orgId', memberDid: 'members.memberDid', handle: 'members.handle' },
  orgs: { __t: 'orgs', id: 'orgs.id', did: 'orgs.did', handle: 'orgs.handle' },
}))
vi.mock('drizzle-orm', () => ({
  and: (...a: unknown[]) => ({ op: 'and', a }),
  eq: (a: unknown, b: unknown) => ({ op: 'eq', a, b }),
  lt: (a: unknown, b: unknown) => ({ op: 'lt', a, b }),
  desc: (a: unknown) => ({ op: 'desc', a }),
  sql: (s: TemplateStringsArray) => ({ op: 'sql', s: s.join('?') }),
}))

let rows: unknown[] = []
let whereArg: any
let limitArg: number | undefined
vi.mock('../../src/db/client', () => ({
  db: {
    select: () => {
      const chain: any = {
        from: () => chain,
        leftJoin: () => chain,
        where: (w: unknown) => { whereArg = w; return chain },
        orderBy: () => chain,
        limit: async (n: number) => { limitArg = n; return rows },
      }
      return chain
    },
  },
}))

import { GET } from '../../src/app/api/activity/route'
import * as membership from '../../src/lib/authz/membership'

const row = (id: number) => ({
  id, action: 'verify', outcome: 'verified', subjectDid: 'did:plc:s', subjectHandle: 'bob', actorDid: 'did:plc:a',
  actorHandle: 'alice', recordUri: null, createdAt: new Date(),
})
const flat = (w: any): any[] => (w?.op === 'and' ? w.a.flatMap(flat) : [w])

beforeEach(() => { rows = []; whereArg = undefined; limitArg = undefined })

describe('GET /api/activity', () => {
  it('403s a non-member', async () => {
    vi.mocked(membership.assertActiveMember).mockRejectedValueOnce(new membership.AuthzError('member required'))
    const res = await GET(new NextRequest('http://x/vidi/api/activity?orgId=1'))
    expect(res.status).toBe(403)
  })

  it('filters on verificationActions.orgId and fetches 100 rows', async () => {
    await GET(new NextRequest('http://x/vidi/api/activity?orgId=7'))
    expect(flat(whereArg)).toContainEqual({ op: 'eq', a: 'va.orgId', b: 7 })
    expect(limitArg).toBe(100)
  })

  it('applies the before cursor as id < before', async () => {
    await GET(new NextRequest('http://x/vidi/api/activity?orgId=7&before=50'))
    expect(flat(whereArg)).toContainEqual({ op: 'lt', a: 'va.id', b: 50 })
  })

  it('nextBefore is the last id when a full page returns', async () => {
    rows = Array.from({ length: 100 }, (_, i) => row(500 - i))
    const body = await (await GET(new NextRequest('http://x/vidi/api/activity?orgId=1'))).json()
    expect(body.items).toHaveLength(100)
    expect(body.nextBefore).toBe(401)
  })

  it('nextBefore is null on a short page', async () => {
    rows = [row(3), row(2)]
    const body = await (await GET(new NextRequest('http://x/vidi/api/activity?orgId=1'))).json()
    expect(body.nextBefore).toBeNull()
  })
})
