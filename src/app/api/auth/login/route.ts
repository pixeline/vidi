import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getOAuthClient, ORG_SCOPE, MEMBER_SCOPE } from '@/lib/atproto/oauthClient'
import { getPublicAppViewAgent } from '@/lib/atproto/publicAgent'
import { db } from '@/db/client'
import { orgs } from '@/db/schema'

/**
 * OAuth sessions are stored one per DID and overwritten on every login, so a
 * normal login by an active org account would replace its narrow-scope writer
 * session with a plain `atproto` one. Always request ORG_SCOPE for those.
 * Resolution failures fall back to the user's choice rather than blocking login.
 */
async function isActiveOrgHandle(handle: string): Promise<boolean> {
  try {
    const res = await getPublicAppViewAgent().com.atproto.identity.resolveHandle({ handle })
    const [org] = await db
      .select()
      .from(orgs)
      .where(and(eq(orgs.did, res.data.did), eq(orgs.status, 'active')))
    return !!org
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const { handle, asOrg } = await req.json()
  const client = await getOAuthClient()
  const forceOrg = asOrg === true ? false : await isActiveOrgHandle(handle)
  const scope = asOrg === true || forceOrg ? ORG_SCOPE : MEMBER_SCOPE
  const url = await client.authorize(handle, { scope })
  return NextResponse.json({ url: url.toString() })
}
