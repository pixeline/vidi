import { describe, it, expect, vi, beforeEach } from 'vitest'

const authorize = vi.fn()
const resolveHandle = vi.fn()
const selectOrgs = vi.fn()

vi.mock('../../src/lib/atproto/oauthClient', async () => {
  const actual = await vi.importActual<typeof import('../../src/lib/atproto/oauthClient')>(
    '../../src/lib/atproto/oauthClient'
  )
  return { ...actual, getOAuthClient: async () => ({ authorize }) }
})
vi.mock('../../src/lib/atproto/publicAgent', () => ({
  getPublicAppViewAgent: () => ({ com: { atproto: { identity: { resolveHandle: (a: unknown) => resolveHandle(a) } } } }),
}))
vi.mock('../../src/db/schema', () => ({ orgs: { did: 'orgs.did', status: 'orgs.status' } }))
vi.mock('drizzle-orm', () => ({ and: (...a: unknown[]) => a, eq: (c: unknown, v: unknown) => [c, v] }))
vi.mock('../../src/db/client', () => ({
  db: { select: () => ({ from: () => ({ where: (cond: unknown) => selectOrgs(cond) }) }) },
}))

import { POST } from '../../src/app/api/auth/login/route'
import { ORG_SCOPE, MEMBER_SCOPE } from '../../src/lib/atproto/oauthClient'

const req = (body: unknown) => new Request('http://x/vidi/api/auth/login', { method: 'POST', body: JSON.stringify(body) })

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    authorize.mockReset()
    resolveHandle.mockReset()
    selectOrgs.mockReset()
    authorize.mockResolvedValue(new URL('https://pds.example/authorize'))
    resolveHandle.mockResolvedValue({ data: { did: 'did:plc:someone' } })
    selectOrgs.mockResolvedValue([])
    process.env.VIDI_PUBLIC_URL = 'http://127.0.0.1:3000/vidi'
  })

  it('requests ORG_SCOPE when asOrg is true', async () => {
    const res = await POST(req({ handle: 'org.example.com', asOrg: true }) as any)
    expect((await res.json()).url).toBe('https://pds.example/authorize')
    expect(authorize).toHaveBeenCalledWith('org.example.com', { scope: ORG_SCOPE })
  })

  it('requests MEMBER_SCOPE when asOrg is omitted and the handle is not an org', async () => {
    await POST(req({ handle: 'me.example.com' }) as any)
    expect(authorize).toHaveBeenCalledWith('me.example.com', { scope: MEMBER_SCOPE })
  })

  it('forces ORG_SCOPE for an active org DID even when asOrg is omitted', async () => {
    resolveHandle.mockResolvedValue({ data: { did: 'did:plc:org' } })
    selectOrgs.mockImplementation(async (cond: any) => {
      // the query must filter on this DID and on status 'active'
      expect(JSON.stringify(cond)).toContain('did:plc:org')
      expect(JSON.stringify(cond)).toContain('active')
      return [{ id: 1, did: 'did:plc:org', status: 'active' }]
    })
    await POST(req({ handle: 'org.example.com' }) as any)
    expect(authorize).toHaveBeenCalledWith('org.example.com', { scope: ORG_SCOPE })
  })

  it('does not force ORG_SCOPE for a disconnected org (query filters on active)', async () => {
    resolveHandle.mockResolvedValue({ data: { did: 'did:plc:org' } })
    // a disconnected org yields no row from the status = active query
    selectOrgs.mockResolvedValue([])
    await POST(req({ handle: 'org.example.com' }) as any)
    expect(authorize).toHaveBeenCalledWith('org.example.com', { scope: MEMBER_SCOPE })
    expect(JSON.stringify(selectOrgs.mock.calls[0][0])).toContain('active')
  })

  it('falls back to the asOrg choice when resolveHandle throws', async () => {
    resolveHandle.mockRejectedValue(new Error('boom'))
    await POST(req({ handle: 'x.example.com', asOrg: true }) as any)
    expect(authorize).toHaveBeenLastCalledWith('x.example.com', { scope: ORG_SCOPE })
    await POST(req({ handle: 'x.example.com' }) as any)
    expect(authorize).toHaveBeenLastCalledWith('x.example.com', { scope: MEMBER_SCOPE })
  })
})
