import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getOAuthClient, hasVerificationScope, ORG_SCOPE } from '@/lib/atproto/oauthClient'
import { getSession } from '@/lib/authz/session'
import { requireEnv } from '@/lib/env'
import { db } from '@/db/client'
import { orgs } from '@/db/schema'

/** OAuth state marking a second authorize round trip asking an org for ORG_SCOPE. */
const ORG_REAUTH_STATE = 'org-reauth'

export async function GET(req: NextRequest) {
  const client = await getOAuthClient()
  const { session, state } = await client.callback(req.nextUrl.searchParams)

  // The login route cannot always tell an org account (active or disconnected) apart (PDS URL input,
  // AppView failure) and may have asked for MEMBER_SCOPE; that grant has now
  // replaced the org's stored writer session. Ask once more for ORG_SCOPE
  // before signing in. After that round trip, sign in whatever was granted so
  // a refusal cannot loop.
  if (state !== ORG_REAUTH_STATE) {
    const [org] = await db
      .select()
      .from(orgs)
      .where(eq(orgs.did, session.did))
    if (org && !hasVerificationScope((await session.getTokenInfo()).scope)) {
      const url = await client.authorize(session.did, { scope: ORG_SCOPE, state: ORG_REAUTH_STATE })
      return NextResponse.redirect(url.toString())
    }
  }

  const s = await getSession()
  s.did = session.did
  await s.save()
  return NextResponse.redirect(`${requireEnv('VIDI_PUBLIC_URL')}/search`)
}
