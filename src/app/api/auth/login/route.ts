import { NextRequest, NextResponse } from 'next/server'
import { getOAuthClient, ORG_SCOPE, MEMBER_SCOPE } from '@/lib/atproto/oauthClient'

export async function POST(req: NextRequest) {
  const { handle, asOrg } = await req.json()
  const client = await getOAuthClient()
  const url = await client.authorize(handle, { scope: asOrg === true ? ORG_SCOPE : MEMBER_SCOPE })
  return NextResponse.json({ url: url.toString() })
}
