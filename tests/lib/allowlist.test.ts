import { describe, it, expect, vi, beforeEach } from 'vitest'

// Fake tables: the db mock picks rows by the table passed to from(), and
// emulates the `enabled = true` filter isAllowlisted applies to the allowlist.
const allowlistRows: { did: string; enabled: boolean }[] = []
const verifierRows: { did: string }[] = []
vi.mock('../../src/db/client', async () => {
  const schema = await import('../../src/db/schema')
  return {
    db: {
      select: () => ({
        from: (table: unknown) => ({
          where: async () =>
            table === schema.trustedVerifierAllowlist
              ? allowlistRows.filter(r => r.enabled)
              : table === schema.trustedVerifiers
                ? verifierRows
                : [],
        }),
      }),
    },
  }
})

import { isSuperadmin, canOnboard } from '../../src/lib/allowlist'

describe('isSuperadmin', () => {
  it('matches configured DIDs only', () => {
    process.env.VIDI_SUPERADMIN_DIDS = 'did:plc:a, did:plc:b'
    expect(isSuperadmin('did:plc:a')).toBe(true)
    expect(isSuperadmin('did:plc:z')).toBe(false)
  })
})

describe('canOnboard', () => {
  beforeEach(() => {
    allowlistRows.length = 0
    verifierRows.length = 0
  })

  it('is true for a Trusted Verifier list DID that is not allowlisted', async () => {
    verifierRows.push({ did: 'did:plc:tv' })
    expect(await canOnboard('did:plc:tv')).toBe(true)
  })

  it('is true for an allowlisted DID', async () => {
    allowlistRows.push({ did: 'did:plc:al', enabled: true })
    expect(await canOnboard('did:plc:al')).toBe(true)
  })

  it('is false for neither', async () => {
    expect(await canOnboard('did:plc:none')).toBe(false)
  })

  it('is false for a disabled allowlist row that is not a trusted verifier', async () => {
    allowlistRows.push({ did: 'did:plc:off', enabled: false })
    expect(await canOnboard('did:plc:off')).toBe(false)
  })
})
