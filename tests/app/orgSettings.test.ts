import { describe, it, expect, vi, beforeEach } from 'vitest'

const getActor = vi.fn()
const assertOwner = vi.fn()
const setSpy = vi.fn()
const whereSpy = vi.fn()

vi.mock('../../src/lib/authz/session', () => ({ getActor: () => getActor() }))
vi.mock('../../src/lib/authz/membership', async (orig) => {
  const mod: any = await orig()
  return { ...mod, assertOwner: (...a: unknown[]) => assertOwner(...a) }
})
vi.mock('../../src/db/schema', () => ({ orgs: { id: 'id' } as any }))
vi.mock('../../src/db/client', () => ({
  db: {
    update: () => ({
      set: (v: unknown) => {
        setSpy(v)
        return { where: async (w: unknown) => whereSpy(w) }
      },
    }),
  },
}))

import { PATCH } from '../../src/app/api/org/settings/route'
import { AuthzError } from '../../src/lib/authz/membership'

const req = (body: unknown) =>
  new Request('http://x/vidi/api/org/settings', { method: 'PATCH', body: JSON.stringify(body) }) as any

describe('PATCH /api/org/settings', () => {
  beforeEach(() => {
    getActor.mockReset()
    assertOwner.mockReset()
    setSpy.mockReset()
    whereSpy.mockReset()
    getActor.mockResolvedValue({ did: 'did:plc:owner' })
    assertOwner.mockResolvedValue(undefined)
  })

  it('returns 401 without an actor', async () => {
    getActor.mockResolvedValue(null)
    const res = await PATCH(req({ orgId: 1, country: 'BE' }))
    expect(res.status).toBe(401)
  })

  it('returns 403 when the caller is not an owner', async () => {
    assertOwner.mockRejectedValue(new AuthzError('owner required'))
    const res = await PATCH(req({ orgId: 1, country: 'BE' }))
    expect(res.status).toBe(403)
    expect(setSpy).not.toHaveBeenCalled()
  })

  it('rejects an unknown country with 400 unknown_country', async () => {
    const res = await PATCH(req({ orgId: 1, country: 'XX' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'unknown_country' })
    expect(setSpy).not.toHaveBeenCalled()
  })

  it('upper-cases a known country before saving', async () => {
    const res = await PATCH(req({ orgId: 1, country: 'it' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(setSpy).toHaveBeenCalledWith({ country: 'IT' })
  })

  it('clears the country with null', async () => {
    const res = await PATCH(req({ orgId: 1, country: null }))
    expect(res.status).toBe(200)
    expect(setSpy).toHaveBeenCalledWith({ country: null })
  })
})
