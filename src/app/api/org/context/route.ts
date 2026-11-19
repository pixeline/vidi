import { NextResponse } from 'next/server'
import { count, eq, inArray } from 'drizzle-orm'
import { db } from '../../../../db/client'
import { accountVerifications, members, orgs } from '../../../../db/schema'
import { getActor, getSession } from '../../../../lib/authz/session'
import { isAllowlisted } from '../../../../lib/allowlist'
import { countOrgVerifications } from '../../../../lib/verify/verifiedCount'
import { getActorAvatar } from '../../../../lib/atproto/profileCache'

export async function GET() {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ orgId: null }, { status: 401 })

  const rows = await db.select().from(members).where(eq(members.memberDid, actor.did))
  const activeRows = rows.filter((r) => r.status === 'active').sort((a, b) => a.orgId - b.orgId)
  const orgRowsAll = activeRows.length
    ? await db.select().from(orgs).where(inArray(orgs.id, activeRows.map((r) => r.orgId)))
    : []
  const orgById = new Map(orgRowsAll.map((o) => [o.id, o]))
  const orgList = activeRows.map((r) => ({
    orgId: r.orgId,
    handle: orgById.get(r.orgId)?.handle ?? '',
    role: r.role,
  }))
  // The selected org is the session's activeOrgId when it is still an active
  // membership, else the first one.
  const session = await getSession()
  const active = activeRows.find((r) => r.orgId === session.activeOrgId) ?? activeRows[0]

  const allowlisted = await isAllowlisted(actor.did)
  // The logged-in profile's avatar (cached); null falls back to initials/icon.
  const avatar = await getActorAvatar(actor.did)

  let handle: string | null = null
  // The Trusted Verifier org's own handle (e.g. verifier.example.org), shown in
  // the header regardless of the caller's role — it identifies who we verify
  // *for*, whereas `handle` is the caller's own display identity.
  let orgHandle: string | null = null
  let verifiedCount: number | null = null
  let country: string | null = null
  if (active) {
    const org = orgById.get(active.orgId)
    orgHandle = org?.handle ?? null
    country = org?.country ?? null
    // An owner's display identity is the org's own handle; a helper's handle
    // is captured at invite time on the membership row.
    handle = active.role === 'owner' ? (org?.handle ?? active.handle ?? null) : (active.handle ?? null)
    if (org) {
      // The live on-network record count is the true total (includes accounts
      // verified directly on Bluesky/mu, not just via Vidi). Fall back to the
      // locally-crawled count if the network read fails so the header still
      // shows a sensible number.
      try {
        verifiedCount = await countOrgVerifications(org.did)
      } catch {
        const countRows = await db
          .select({ value: count() })
          .from(accountVerifications)
          .where(eq(accountVerifications.verifierDid, org.did))
        verifiedCount = countRows[0]?.value ?? 0
      }
    }
  }

  return NextResponse.json({
    orgId: active?.orgId ?? null,
    role: active?.role ?? null,
    isAllowlisted: allowlisted,
    handle,
    orgHandle,
    avatar,
    verifiedCount,
    country,
    orgs: orgList,
  })
}
