'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const SIGN_IN_AGAIN_MESSAGE =
  "Sign out, then sign in again as the verifier account with 'I'm signing in as the verifier account' ticked."

export function OnboardOrg({
  onOnboarded,
  reconnect = false,
  accountHandle,
}: {
  onOnboarded: () => void
  reconnect?: boolean
  accountHandle: string | null
}) {
  const [loading, setLoading] = useState(false)

  /** Ask the PDS for the org-level grant, then send the browser to consent. */
  async function requestOrgGrant(): Promise<boolean> {
    if (!accountHandle) return false
    try {
      const res = await fetch('/vidi/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: accountHandle, asOrg: true }),
      })
      if (!res.ok) return false
      const { url } = await res.json()
      if (typeof url !== 'string') return false
      window.location.href = url
      return true
    } catch {
      return false
    }
  }

  async function onboard() {
    setLoading(true)
    try {
      const res = await fetch('/vidi/api/org/onboard', { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (body?.error === 'no_org_session' || body?.error === 'missing_verification_scope') {
          if (!(await requestOrgGrant())) toast.error(SIGN_IN_AGAIN_MESSAGE)
          return
        }
        const message =
          body?.error === 'not_eligible'
            ? 'Only accounts on the Trusted Verifier list can set up an org. Ask the Vidi operator to add you.'
            : 'Could not onboard this org.'
        toast.error(message)
        return
      }
      toast.success(reconnect ? 'Org reconnected' : 'Org onboarded')
      onOnboarded()
    } catch {
      toast.error('Could not onboard this org')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="mb-6 border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle>{reconnect ? 'Reconnect this org' : 'Onboard this org'}</CardTitle>
        <CardDescription>
          {reconnect
            ? 'Vidi is disconnected from your verifier account. Reconnect it to let members verify again.'
            : 'No organization is set up for your account yet. Onboard it now to start searching and verifying accounts.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={onboard} disabled={loading}>
          {reconnect ? (loading ? 'Reconnecting…' : 'Reconnect') : loading ? 'Onboarding…' : 'Onboard this org'}
        </Button>
      </CardContent>
    </Card>
  )
}
