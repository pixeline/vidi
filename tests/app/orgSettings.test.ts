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

  it('accepts any ISO country, not just curated ones', async () => {
    const res = await PATCH(req({ orgId: 1, country: 'PT' }))
    expect(res.status).toBe(200)
    expect(setSpy).toHaveBeenCalledWith({ country: 'PT' })
  })

  it('updates only signalTerms when only signalTerms is sent', async () => {
    const res = await PATCH(req({ orgId: 1, signalTerms: 'Journalist, Le Monde\nlemonde.fr, journalist' }))
    expect(res.status).toBe(200)
    expect(setSpy).toHaveBeenCalledWith({ signalTerms: ['journalist', 'le monde', 'lemonde.fr'] })
  })

  it('accepts signalTerms as an array and clears them with an empty list', async () => {
    await PATCH(req({ orgId: 1, signalTerms: ['Reporter', 'editor'] }))
    expect(setSpy).toHaveBeenLastCalledWith({ signalTerms: ['reporter', 'editor'] })
    await PATCH(req({ orgId: 1, signalTerms: [] }))
    expect(setSpy).toHaveBeenLastCalledWith({ signalTerms: [] })
  })

  it('updates both fields when both are sent', async () => {
    await PATCH(req({ orgId: 1, country: 'fr', signalTerms: ['journalist'] }))
    expect(setSpy).toHaveBeenCalledWith({ country: 'FR', signalTerms: ['journalist'] })
  })

  it('rejects more than 100 terms with 400 too_many_terms', async () => {
    const terms = Array.from({ length: 101 }, (_, i) => `term${i}`)
    const res = await PATCH(req({ orgId: 1, signalTerms: terms }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'too_many_terms' })
    expect(setSpy).not.toHaveBeenCalled()
  })

  it('rejects a term longer than 60 characters with 400 term_too_long', async () => {
    const res = await PATCH(req({ orgId: 1, signalTerms: ['a'.repeat(61)] }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'term_too_long' })
    expect(setSpy).not.toHaveBeenCalled()
  })

  it('rejects signalTerms that are neither a string nor a list of strings', async () => {
    const res = await PATCH(req({ orgId: 1, signalTerms: [1, 2] }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_signal_terms' })
    expect(setSpy).not.toHaveBeenCalled()
  })

  it('rejects a body with neither field with 400 nothing_to_update', async () => {
    const res = await PATCH(req({ orgId: 1 }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'nothing_to_update' })
    expect(setSpy).not.toHaveBeenCalled()
  })

  it('returns 403 to a helper saving signal words, without updating', async () => {
    assertOwner.mockRejectedValue(new AuthzError('owner required'))
    const res = await PATCH(req({ orgId: 1, signalTerms: ['journalist'] }))
    expect(res.status).toBe(403)
    expect(setSpy).not.toHaveBeenCalled()
  })
})
