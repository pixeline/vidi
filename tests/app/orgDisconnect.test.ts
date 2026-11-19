import { describe, it, expect, vi, beforeEach } from 'vitest'

const getActor = vi.fn()
const assertOwner = vi.fn()
const revoke = vi.fn()
const deleteSpy = vi.fn()
const setSpy = vi.fn()
let orgRow: unknown[] = []

vi.mock('../../src/lib/authz/session', () => ({ getActor: () => getActor() }))
vi.mock('../../src/lib/authz/membership', async (orig) => {
  const mod: any = await orig()
  return { ...mod, assertOwner: (...a: unknown[]) => assertOwner(...a) }
})
vi.mock('../../src/lib/atproto/oauthClient', () => ({
  getOAuthClient: async () => ({ revoke: (...a: unknown[]) => revoke(...a) }),
}))
vi.mock('../../src/db/schema', () => ({
  orgs: { id: 'orgs.id' } as any,
  oauthSession: { did: 'oauth_session.did' } as any,
}))
vi.mock('../../src/db/client', () => ({
  db: {
    select: () => ({ from: () => ({ where: async () => orgRow }) }),
    delete: () => ({ where: async (w: unknown) => deleteSpy(w) }),
    update: () => ({
      set: (v: unknown) => {
        setSpy(v)
        return { where: async () => undefined }
      },
    }),
  },
}))

import { POST } from '../../src/app/api/org/disconnect/route'
import { AuthzError } from '../../src/lib/authz/membership'

const req = (body: unknown) =>
  new Request('http://x/vidi/api/org/disconnect', { method: 'POST', body: JSON.stringify(body) }) as any

describe('POST /api/org/disconnect', () => {
  beforeEach(() => {
    for (const m of [getActor, assertOwner, revoke, deleteSpy, setSpy]) m.mockReset()
    getActor.mockResolvedValue({ did: 'did:plc:owner' })
    assertOwner.mockResolvedValue(undefined)
    revoke.mockResolvedValue(undefined)
    orgRow = [{ id: 1, did: 'did:plc:org', status: 'active' }]
  })

  it('returns 403 for a helper', async () => {
    assertOwner.mockRejectedValue(new AuthzError('owner required'))
    const res = await POST(req({ orgId: 1 }))
    expect(res.status).toBe(403)
    expect(revoke).not.toHaveBeenCalled()
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(setSpy).not.toHaveBeenCalled()
  })

  it('revokes the token, deletes the session and marks the org disconnected', async () => {
    const res = await POST(req({ orgId: 1 }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(revoke).toHaveBeenCalledWith('did:plc:org')
    expect(deleteSpy).toHaveBeenCalledTimes(1)
    expect(setSpy).toHaveBeenCalledWith({ status: 'disconnected' })
  })

  it('still deletes and updates when revoke rejects, logging the error', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    revoke.mockRejectedValue(new Error('pds down'))
    const res = await POST(req({ orgId: 1 }))
    expect(await res.json()).toEqual({ ok: true })
    expect(deleteSpy).toHaveBeenCalledTimes(1)
    expect(setSpy).toHaveBeenCalledWith({ status: 'disconnected' })
    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })
})
