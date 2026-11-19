import { NextRequest, NextResponse } from 'next/server'
import { getActor, getSession } from '../../../../lib/authz/session'
import { assertActiveMember, AuthzError } from '../../../../lib/authz/membership'

function guard<T>(fn: () => Promise<T>) {
  return fn().catch((e) => {
    if (e instanceof AuthzError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  })
}

export async function POST(req: NextRequest) {
  return guard(async () => {
    const actor = await getActor(); if (!actor) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    const { orgId } = await req.json().catch(() => ({}))
    if (!Number.isInteger(orgId)) return NextResponse.json({ error: 'invalid_org' }, { status: 400 })
    await assertActiveMember(actor.did, orgId)
    const session = await getSession()
    session.activeOrgId = orgId
    await session.save()
    return NextResponse.json({ ok: true })
  })
}
