import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq, lt, sql } from 'drizzle-orm'
import { db } from '../../../db/client'
import { accounts, members, orgs, verificationActions } from '../../../db/schema'
import { getActor } from '../../../lib/authz/session'
import { assertActiveMember, AuthzError } from '../../../lib/authz/membership'

const PAGE_SIZE = 100

function guard<T>(fn: () => Promise<T>) {
  return fn().catch((e) => {
    if (e instanceof AuthzError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  })
}

export async function GET(req: NextRequest) {
  return guard(async () => {
    const actor = await getActor(); if (!actor) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    const orgId = Number(req.nextUrl.searchParams.get('orgId'))
    await assertActiveMember(actor.did, orgId)
    const beforeParam = req.nextUrl.searchParams.get('before')
    const before = beforeParam ? Number(beforeParam) : null

    const conditions = [eq(verificationActions.orgId, orgId)]
    if (before != null && Number.isFinite(before)) conditions.push(lt(verificationActions.id, before))

    const rows = await db
      .select({
        id: verificationActions.id,
        action: verificationActions.action,
        outcome: verificationActions.outcome,
        subjectDid: verificationActions.subjectDid,
        subjectHandle: accounts.handle,
        actorDid: verificationActions.actorDid,
        // Member handle, or the org's own handle when the org account acted.
        actorHandle: sql<string | null>`coalesce(${members.handle}, ${orgs.handle})`,
        recordUri: verificationActions.recordUri,
        createdAt: verificationActions.createdAt,
      })
      .from(verificationActions)
      .leftJoin(accounts, eq(accounts.did, verificationActions.subjectDid))
      .leftJoin(members, and(eq(members.orgId, verificationActions.orgId), eq(members.memberDid, verificationActions.actorDid)))
      .leftJoin(orgs, and(eq(orgs.id, verificationActions.orgId), eq(orgs.did, verificationActions.actorDid)))
      .where(and(...conditions))
      .orderBy(desc(verificationActions.id))
      .limit(PAGE_SIZE)

    const nextBefore = rows.length === PAGE_SIZE ? rows[rows.length - 1].id : null
    return NextResponse.json({ items: rows, nextBefore })
  })
}
