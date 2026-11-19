import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '../../../../db/client'
import { orgs } from '../../../../db/schema'
import { getActor } from '../../../../lib/authz/session'
import { assertOwner, AuthzError } from '../../../../lib/authz/membership'
import { profileFor } from '../../../../lib/signals/profiles'

function guard<T>(fn: () => Promise<T>) {
  return fn().catch((e) => {
    if (e instanceof AuthzError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  })
}

export async function PATCH(req: NextRequest) {
  return guard(async () => {
    const actor = await getActor(); if (!actor) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    const { orgId, country } = await req.json()
    await assertOwner(actor.did, orgId)
    let code: string | null = null
    if (country != null && country !== '') {
      const profile = profileFor(String(country))
      if (!profile) return NextResponse.json({ error: 'unknown_country' }, { status: 400 })
      code = profile.code
    }
    await db.update(orgs).set({ country: code }).where(eq(orgs.id, orgId))
    return NextResponse.json({ ok: true })
  })
}
