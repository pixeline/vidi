import { describe, it, expect, vi, beforeEach } from 'vitest'

const callback = vi.fn()
const authorize = vi.fn()
const selectOrgs = vi.fn()
const save = vi.fn()
const sessionHolder = vi.hoisted(() => ({ s: {} as { did?: string; save?: () => Promise<void> } }))

vi.mock('../../src/lib/atproto/oauthClient', async () => {
  const actual = await vi.importActual<typeof import('../../src/lib/atproto/oauthClient')>(
    '../../src/lib/atproto/oauthClient'
  )
  return { ...actual, getOAuthClient: async () => ({ callback, authorize }) }
})
vi.mock('../../src/lib/authz/session', () => ({ getSession: async () => sessionHolder.s }))
vi.mock('../../src/db/schema', () => ({ orgs: { did: 'orgs.did', status: 'orgs.status' } }))
vi.mock('drizzle-orm', () => ({ and: (...a: unknown[]) => a, eq: (c: unknown, v: unknown) => [c, v] }))
vi.mock('../../src/db/client', () => ({
  db: { select: () => ({ from: () => ({ where: (cond: unknown) => selectOrgs(cond) }) }) },
}))

import { GET } from '../../src/app/api/auth/callback/route'
import { ORG_SCOPE, MEMBER_SCOPE } from '../../src/lib/atproto/oauthClient'

const req = () => {
  const url = new URL('http://x/vidi/api/auth/callback?code=c&state=s&iss=i')
  return { nextUrl: url } as any
}

const oauthSession = (did: string, scope: string) => ({ did, getTokenInfo: async () => ({ scope }) })

describe('GET /api/auth/callback', () => {
  beforeEach(() => {
    callback.mockReset()
    authorize.mockReset()
    selectOrgs.mockReset()
    save.mockReset()
    sessionHolder.s = { save }
    authorize.mockResolvedValue(new URL('https://pds.example/authorize?org'))
    selectOrgs.mockResolvedValue([])
    process.env.VIDI_PUBLIC_URL = 'http://127.0.0.1:3000/vidi'
  })

  it('re-asks an active org with a narrow grant for ORG_SCOPE instead of signing in', async () => {
    callback.mockResolvedValue({ session: oauthSession('did:plc:org', MEMBER_SCOPE), state: null })
    selectOrgs.mockImplementation(async (cond: any) => {
      expect(JSON.stringify(cond)).toContain('did:plc:org')
      expect(JSON.stringify(cond)).toContain('active')
      return [{ id: 1, did: 'did:plc:org', status: 'active' }]
    })
    const res = await GET(req())
    expect(authorize).toHaveBeenCalledWith('did:plc:org', { scope: ORG_SCOPE, state: 'org-reauth' })
    expect(res.headers.get('location')).toBe('https://pds.example/authorize?org')
    expect(save).not.toHaveBeenCalled()
    expect(sessionHolder.s.did).toBeUndefined()
  })

  it('signs in after an org-reauth round trip even if the grant is still narrow (no loop)', async () => {
    callback.mockResolvedValue({ session: oauthSession('did:plc:org', MEMBER_SCOPE), state: 'org-reauth' })
    selectOrgs.mockResolvedValue([{ id: 1, did: 'did:plc:org', status: 'active' }])
    const res = await GET(req())
    expect(authorize).not.toHaveBeenCalled()
    expect(sessionHolder.s.did).toBe('did:plc:org')
    expect(save).toHaveBeenCalled()
    expect(res.headers.get('location')).toBe('http://127.0.0.1:3000/vidi/search')
  })

  it('signs in a non-org account with a narrow grant', async () => {
    callback.mockResolvedValue({ session: oauthSession('did:plc:me', MEMBER_SCOPE), state: null })
    const res = await GET(req())
    expect(authorize).not.toHaveBeenCalled()
    expect(sessionHolder.s.did).toBe('did:plc:me')
    expect(save).toHaveBeenCalled()
    expect(res.headers.get('location')).toBe('http://127.0.0.1:3000/vidi/search')
  })

  it('signs in an active org that already granted ORG_SCOPE', async () => {
    callback.mockResolvedValue({ session: oauthSession('did:plc:org', ORG_SCOPE), state: null })
    selectOrgs.mockResolvedValue([{ id: 1, did: 'did:plc:org', status: 'active' }])
    const res = await GET(req())
    expect(authorize).not.toHaveBeenCalled()
    expect(sessionHolder.s.did).toBe('did:plc:org')
    expect(save).toHaveBeenCalled()
    expect(res.headers.get('location')).toBe('http://127.0.0.1:3000/vidi/search')
  })
})
