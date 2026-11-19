import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getOAuthClient, ORG_SCOPE, MEMBER_SCOPE } from '@/lib/atproto/oauthClient'
import { getPublicAppViewAgent } from '@/lib/atproto/publicAgent'
import { db } from '@/db/client'
import { orgs } from '@/db/schema'

/**
 * OAuth sessions are stored one per DID and overwritten on every login, so a
 * normal login by an onboarded org account (active or disconnected) would replace its narrow-scope writer
 * session with a plain `atproto` one. Always request ORG_SCOPE for those, so a disconnected org's owner can reconnect without ticking the box.
 * A `did:` input is used as the DID directly; other inputs are resolved as
 * handles (a PDS URL fails resolution — the callback re-asks for ORG_SCOPE if
 * that lets an org slip through). Resolution failures are logged and
 * fall back to the user's choice rather than blocking login.
 */
async function isOrgAccount(input: string): Promise<boolean> {
  try {
    const did = input.startsWith('did:')
      ? input
      : (await getPublicAppViewAgent().com.atproto.identity.resolveHandle({ handle: input })).data.did
    const [org] = await db
      .select()
      .from(orgs)
      .where(eq(orgs.did, did))
    return !!org
  } catch (err) {
    console.error('login: could not check whether the account is an org', err)
    return false
  }
}

export async function POST(req: NextRequest) {
  const { handle, asOrg } = await req.json()
  const client = await getOAuthClient()
  const forceOrg = asOrg === true ? false : await isOrgAccount(handle)
  const scope = asOrg === true || forceOrg ? ORG_SCOPE : MEMBER_SCOPE
  const url = await client.authorize(handle, { scope })
  return NextResponse.json({ url: url.toString() })
}
