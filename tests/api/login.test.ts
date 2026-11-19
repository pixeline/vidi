import { describe, it, expect, vi, beforeEach } from 'vitest'

const authorize = vi.fn()
vi.mock('../../src/lib/atproto/oauthClient', async () => {
  const actual = await vi.importActual<typeof import('../../src/lib/atproto/oauthClient')>(
    '../../src/lib/atproto/oauthClient'
  )
  return { ...actual, getOAuthClient: async () => ({ authorize }) }
})

import { POST } from '../../src/app/api/auth/login/route'
import { ORG_SCOPE, MEMBER_SCOPE } from '../../src/lib/atproto/oauthClient'

const req = (body: unknown) => new Request('http://x/vidi/api/auth/login', { method: 'POST', body: JSON.stringify(body) })

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    authorize.mockReset()
    authorize.mockResolvedValue(new URL('https://pds.example/authorize'))
    process.env.VIDI_PUBLIC_URL = 'http://127.0.0.1:3000/vidi'
  })

  it('requests ORG_SCOPE when asOrg is true', async () => {
    const res = await POST(req({ handle: 'org.example.com', asOrg: true }) as any)
    expect((await res.json()).url).toBe('https://pds.example/authorize')
    expect(authorize).toHaveBeenCalledWith('org.example.com', { scope: ORG_SCOPE })
  })

  it('requests MEMBER_SCOPE when asOrg is omitted', async () => {
    await POST(req({ handle: 'me.example.com' }) as any)
    expect(authorize).toHaveBeenCalledWith('me.example.com', { scope: MEMBER_SCOPE })
  })
})
