'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function OnboardOrg({ onOnboarded }: { onOnboarded: () => void }) {
  const [loading, setLoading] = useState(false)

  async function onboard() {
    setLoading(true)
    try {
      const res = await fetch('/vidi/api/org/onboard', { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        const message =
          body?.error === 'not_eligible'
            ? 'Only accounts on the Trusted Verifier list can set up an org. Ask the Vidi operator to add you.'
            : body?.error === 'no_org_session'
              ? 'Sign in as the org account before onboarding.'
              : body?.error === 'missing_verification_scope'
                ? "Sign out, then sign in again as the verifier account with 'I'm signing in as the verifier account' ticked."
                : 'Could not onboard this org.'
        toast.error(message)
        return
      }
      toast.success('Org onboarded')
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
        <CardTitle>Onboard this org</CardTitle>
        <CardDescription>
          No organization is set up for your account yet. Onboard it now to start searching and
          verifying accounts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={onboard} disabled={loading}>
          {loading ? 'Onboarding…' : 'Onboard this org'}
        </Button>
      </CardContent>
    </Card>
  )
}
