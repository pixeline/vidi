import { describe, it, expect, vi, beforeEach } from 'vitest'

const getActor = vi.fn()
const sessionHolder = vi.hoisted(() => ({ activeOrgId: undefined as number | undefined }))
const isAllowlisted = vi.fn()
const countOrgVerifications = vi.fn()
const getActorAvatar = vi.fn()

vi.mock('../../src/lib/authz/session', () => ({
  getActor: () => getActor(),
  getSession: async () => ({ activeOrgId: sessionHolder.activeOrgId }),
}))
vi.mock('../../src/lib/allowlist', () => ({ isAllowlisted: (did: string) => isAllowlisted(did) }))
vi.mock('../../src/lib/verify/verifiedCount', () => ({ countOrgVerifications: (did: string) => countOrgVerifications(did) }))
vi.mock('../../src/lib/atproto/profileCache', () => ({ getActorAvatar: (did: string) => getActorAvatar(did) }))

// Distinguish the members select from the orgs/accountVerifications selects
// by a sentinel field on the mocked table object passed to `.from()`.
vi.mock('../../src/db/schema', () => ({
  members: { __t: 'members' } as any,
  orgs: { __t: 'orgs' } as any,
  accountVerifications: { __t: 'accountVerifications' } as any,
}))

const rowsHolder = vi.hoisted(() => ({
  memberRows: [] as any[],
  orgRows: [] as any[],
  verificationCountRows: [] as any[],
}))
vi.mock('../../src/db/client', () => ({
  db: {
    select: () => ({
      from: (table: any) => ({
        where: async () => {
          if (table?.__t === 'orgs') return rowsHolder.orgRows
          if (table?.__t === 'accountVerifications') return rowsHolder.verificationCountRows
          return rowsHolder.memberRows
        },
      }),
    }),
  },
}))

import { GET } from '../../src/app/api/org/context/route'

describe('GET /api/org/context', () => {
  beforeEach(() => {
    getActor.mockReset()
    isAllowlisted.mockReset()
    countOrgVerifications.mockReset()
    getActorAvatar.mockReset()
    getActorAvatar.mockResolvedValue('https://av.example/pic.jpg')
    sessionHolder.activeOrgId = undefined
    rowsHolder.memberRows = []
    rowsHolder.orgRows = []
    rowsHolder.verificationCountRows = []
  })

  it('returns 401 with orgId null when unauthenticated', async () => {
    getActor.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ orgId: null })
  })

  it('returns org handle + isAllowlisted + live verifiedCount for an owner', async () => {
    getActor.mockResolvedValue({ did: 'did:plc:org' })
    isAllowlisted.mockResolvedValue(true)
    countOrgVerifications.mockResolvedValue(42)
    rowsHolder.memberRows = [{ orgId: 7, role: 'owner', status: 'active', handle: 'stale.owner' }]
    rowsHolder.orgRows = [{ id: 7, did: 'did:plc:org', handle: 'org.example.com', country: 'BE' }]

    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      orgId: 7,
      role: 'owner',
      isAllowlisted: true,
      handle: 'org.example.com',
      orgHandle: 'org.example.com',
      avatar: 'https://av.example/pic.jpg',
      verifiedCount: 42,
      country: 'BE',
      orgs: [{ orgId: 7, handle: 'org.example.com', role: 'owner' }],
    })
    expect(countOrgVerifications).toHaveBeenCalledWith('did:plc:org')
  })

  it('returns the membership handle and live verifiedCount for a helper (scoped to the org, not the role)', async () => {
    getActor.mockResolvedValue({ did: 'did:plc:helper' })
    isAllowlisted.mockResolvedValue(false)
    countOrgVerifications.mockResolvedValue(5)
    rowsHolder.memberRows = [{ orgId: 7, role: 'helper', status: 'active', handle: 'pixeline.be' }]
    rowsHolder.orgRows = [{ id: 7, did: 'did:plc:org', handle: 'org.example.com' }]

    const res = await GET()
    expect(await res.json()).toEqual({
      orgId: 7,
      role: 'helper',
      isAllowlisted: false,
      handle: 'pixeline.be',
      orgHandle: 'org.example.com',
      avatar: 'https://av.example/pic.jpg',
      verifiedCount: 5,
      country: null,
      orgs: [{ orgId: 7, handle: 'org.example.com', role: 'helper' }],
    })
  })

  it('falls back to the locally-crawled count when the live network read fails', async () => {
    getActor.mockResolvedValue({ did: 'did:plc:org' })
    isAllowlisted.mockResolvedValue(true)
    countOrgVerifications.mockRejectedValue(new Error('network down'))
    rowsHolder.memberRows = [{ orgId: 7, role: 'owner', status: 'active', handle: 'org.example.com' }]
    rowsHolder.orgRows = [{ id: 7, did: 'did:plc:org', handle: 'org.example.com' }]
    rowsHolder.verificationCountRows = [{ value: 400 }]

    const res = await GET()
    const body = await res.json()
    expect(body.verifiedCount).toBe(400)
  })

  it('returns null orgId/role/handle/verifiedCount for an actor with no membership', async () => {
    getActor.mockResolvedValue({ did: 'did:plc:nobody' })
    isAllowlisted.mockResolvedValue(false)
    rowsHolder.memberRows = []

    const res = await GET()
    expect(await res.json()).toEqual({
      orgId: null,
      role: null,
      isAllowlisted: false,
      handle: null,
      orgHandle: null,
      avatar: 'https://av.example/pic.jpg',
      verifiedCount: null,
      country: null,
      orgs: [],
    })
  })

  it('surfaces isAllowlisted true for an allowlisted actor with no membership (can self-onboard)', async () => {
    getActor.mockResolvedValue({ did: 'did:plc:eligible' })
    isAllowlisted.mockResolvedValue(true)
    rowsHolder.memberRows = []

    const res = await GET()
    const body = await res.json()
    expect(body.orgId).toBeNull()
    expect(body.isAllowlisted).toBe(true)
  })

  describe('several memberships', () => {
    const two = () => {
      rowsHolder.memberRows = [
        { orgId: 2, role: 'helper', status: 'active', handle: 'me.it' },
        { orgId: 1, role: 'owner', status: 'active', handle: 'me.be' },
      ]
      rowsHolder.orgRows = [
        { id: 1, did: 'did:plc:be', handle: 'be.example', country: 'BE' },
        { id: 2, did: 'did:plc:it', handle: 'it.example', country: 'IT' },
      ]
    }
    beforeEach(() => {
      getActor.mockResolvedValue({ did: 'did:plc:me' })
      isAllowlisted.mockResolvedValue(false)
      countOrgVerifications.mockResolvedValue(1)
    })

    it('selects the session activeOrgId and lists every active membership by orgId', async () => {
      two()
      sessionHolder.activeOrgId = 2
      const body = await (await GET()).json()
      expect(body.orgId).toBe(2)
      expect(body.role).toBe('helper')
      expect(body.handle).toBe('me.it')
      expect(body.orgHandle).toBe('it.example')
      expect(body.country).toBe('IT')
      expect(body.orgs).toEqual([
        { orgId: 1, handle: 'be.example', role: 'owner' },
        { orgId: 2, handle: 'it.example', role: 'helper' },
      ])
      expect(countOrgVerifications).toHaveBeenCalledWith('did:plc:it')
    })

    it('falls back to the first org when activeOrgId matches no membership', async () => {
      two()
      sessionHolder.activeOrgId = 9
      const body = await (await GET()).json()
      expect(body.orgId).toBe(1)
      expect(body.orgs).toHaveLength(2)
    })

    it('excludes revoked memberships from orgs', async () => {
      two()
      rowsHolder.memberRows[1].status = 'revoked'
      sessionHolder.activeOrgId = 1
      const body = await (await GET()).json()
      expect(body.orgs).toEqual([{ orgId: 2, handle: 'it.example', role: 'helper' }])
      expect(body.orgId).toBe(2)
    })
  })
})
