import { NextResponse } from 'next/server'
import { db } from '../../../../db/client'
import { orgs, members } from '../../../../db/schema'
import { getActor } from '../../../../lib/authz/session'
import { canOnboard } from '../../../../lib/allowlist'
import { getOrgScope } from '../../../../lib/atproto/orgAgent'
import { getPublicAppViewAgent } from '../../../../lib/atproto/publicAgent'
import { hasVerificationScope } from '../../../../lib/atproto/oauthClient'

export async function POST() {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  if (!(await canOnboard(actor.did))) {
    return NextResponse.json({ error: 'not_eligible' }, { status: 403 })
  }

  // Prove we hold the org writer session: the owner must have logged in AS
  // the org account, so its OAuth session is stored under actor.did.
  let scope: string
  try {
    scope = await getOrgScope(actor.did)
  } catch {
    return NextResponse.json({ error: 'no_org_session' }, { status: 400 })
  }
  if (!hasVerificationScope(scope)) {
    return NextResponse.json({ error: 'missing_verification_scope' }, { status: 400 })
  }

  // app.bsky.* reads go through the public AppView; a narrow-scope session
  // cannot call proxied app.bsky methods.
  let handle: string
  try {
    const profile = await getPublicAppViewAgent().getProfile({ actor: actor.did })
    handle = profile.data.handle
  } catch {
    return NextResponse.json({ error: 'no_org_session' }, { status: 400 })
  }

  const [org] = await db
    .insert(orgs)
    .values({
      did: actor.did,
      handle,
      status: 'active',
      scopes: scope,
      onboardedByDid: actor.did,
    })
    .onConflictDoUpdate({
      target: orgs.did,
      set: { handle, status: 'active', scopes: scope },
    })
    .returning()

  await db
    .insert(members)
    .values({ orgId: org.id, memberDid: actor.did, handle, role: 'owner' })
    .onConflictDoUpdate({
      target: [members.orgId, members.memberDid],
      set: { role: 'owner', status: 'active' },
    })

  return NextResponse.json({ ok: true, orgId: org.id })
}
