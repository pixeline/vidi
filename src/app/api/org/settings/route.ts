import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '../../../../db/client'
import { orgs } from '../../../../db/schema'
import { getActor } from '../../../../lib/authz/session'
import { assertOwner, AuthzError } from '../../../../lib/authz/membership'
import { profileFor } from '../../../../lib/signals/profiles'
import { MAX_SIGNAL_TERMS, MAX_TERM_LENGTH, parseSignalTerms } from '../../../../lib/signals/customTerms'

function guard<T>(fn: () => Promise<T>) {
  return fn().catch((e) => {
    if (e instanceof AuthzError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  })
}

const bad = (error: string) => NextResponse.json({ error }, { status: 400 })

// Owner-only ranking settings. Only the fields present in the body change:
// `country` (any ISO 3166-1 code, or null/'' to clear) and `signalTerms`
// (a string split on commas/newlines, or a list of strings).
export async function PATCH(req: NextRequest) {
  return guard(async () => {
    const actor = await getActor(); if (!actor) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    const json = await req.json()
    const body: Record<string, unknown> = json && typeof json === 'object' ? json : {}
    const orgId = body.orgId as number
    await assertOwner(actor.did, orgId)
    const update: { country?: string | null; signalTerms?: string[] } = {}
    if ('country' in body) {
      const country = body.country
      let code: string | null = null
      if (country != null && country !== '') {
        const profile = profileFor(String(country))
        if (!profile) return bad('unknown_country')
        code = profile.code
      }
      update.country = code
    }
    if ('signalTerms' in body) {
      const raw = body.signalTerms ?? []
      const valid = typeof raw === 'string' || (Array.isArray(raw) && raw.every((t) => typeof t === 'string'))
      if (!valid) return bad('invalid_signal_terms')
      const terms = parseSignalTerms(raw)
      if (terms.length > MAX_SIGNAL_TERMS) return bad('too_many_terms')
      if (terms.some((t) => t.length > MAX_TERM_LENGTH)) return bad('term_too_long')
      update.signalTerms = terms
    }
    if (Object.keys(update).length === 0) return bad('nothing_to_update')
    await db.update(orgs).set(update).where(eq(orgs.id, orgId))
    return NextResponse.json({ ok: true })
  })
}
