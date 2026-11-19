import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '../../../../db/client'
import { orgs, oauthSession } from '../../../../db/schema'
import { getActor } from '../../../../lib/authz/session'
import { assertOwner, AuthzError } from '../../../../lib/authz/membership'
import { getOAuthClient } from '../../../../lib/atproto/oauthClient'

function guard<T>(fn: () => Promise<T>) {
  return fn().catch((e) => {
    if (e instanceof AuthzError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  })
}

export async function POST(req: NextRequest) {
  return guard(async () => {
    const actor = await getActor(); if (!actor) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    const { orgId } = await req.json()
    await assertOwner(actor.did, orgId)
    const [org] = await db.select().from(orgs).where(eq(orgs.id, orgId))
    if (!org) return NextResponse.json({ error: 'org_not_found' }, { status: 404 })
    // Best-effort: the PDS may be unreachable or the token already revoked.
    // Disconnecting locally must still succeed, so log and carry on.
    try {
      const client = await getOAuthClient()
      await client.revoke(org.did)
    } catch (e) {
      console.error('org disconnect: token revoke failed', org.did, e)
    }
    await db.delete(oauthSession).where(eq(oauthSession.did, org.did))
    await db.update(orgs).set({ status: 'disconnected' }).where(eq(orgs.id, orgId))
    return NextResponse.json({ ok: true })
  })
}
