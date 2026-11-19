import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const getActor = vi.fn()
const assertActiveMember = vi.fn()
const save = vi.fn()
const session: { activeOrgId?: number; save: typeof save } = { save }

vi.mock('../../src/lib/authz/session', () => ({
  getActor: () => getActor(),
  getSession: async () => session,
}))
vi.mock('../../src/lib/authz/membership', async (orig) => ({
  ...(await orig<typeof import('../../src/lib/authz/membership')>()),
  assertActiveMember: (did: string, orgId: number) => assertActiveMember(did, orgId),
}))

import { AuthzError } from '../../src/lib/authz/membership'
import { POST } from '../../src/app/api/org/select/route'

const req = (body: unknown) =>
  new NextRequest('http://x/vidi/api/org/select', { method: 'POST', body: JSON.stringify(body) })

describe('POST /api/org/select', () => {
  beforeEach(() => {
    getActor.mockReset()
    assertActiveMember.mockReset()
    save.mockReset()
    delete session.activeOrgId
  })

  it('returns 401 when unauthenticated', async () => {
    getActor.mockResolvedValue(null)
    const res = await POST(req({ orgId: 2 }))
    expect(res.status).toBe(401)
    expect(save).not.toHaveBeenCalled()
  })

  it('returns 403 for a non-member and does not save the session', async () => {
    getActor.mockResolvedValue({ did: 'did:plc:me' })
    assertActiveMember.mockRejectedValue(new AuthzError('forbidden'))
    const res = await POST(req({ orgId: 2 }))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'forbidden' })
    expect(session.activeOrgId).toBeUndefined()
    expect(save).not.toHaveBeenCalled()
  })

  it('stores activeOrgId and saves for a member', async () => {
    getActor.mockResolvedValue({ did: 'did:plc:me' })
    assertActiveMember.mockResolvedValue(undefined)
    const res = await POST(req({ orgId: 2 }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(assertActiveMember).toHaveBeenCalledWith('did:plc:me', 2)
    expect(session.activeOrgId).toBe(2)
    expect(save).toHaveBeenCalled()
  })

  it('returns 400 for an invalid orgId', async () => {
    getActor.mockResolvedValue({ did: 'did:plc:me' })
    const res = await POST(req({ orgId: 'nope' }))
    expect(res.status).toBe(400)
    expect(save).not.toHaveBeenCalled()
  })
})
