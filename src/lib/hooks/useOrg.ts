'use client'
import { useCallback, useEffect, useState } from 'react'
import { subscribeVerifiedCountChanged } from '../verifiedCountBus'

// Org context resolved from /vidi/api/org/context (the session's selected org).
export type OrgSummary = { orgId: number; handle: string; role: 'owner' | 'helper' }
export type OwnOrgStatus = 'active' | 'disconnected' | null

// Shared empty list so consumers memoising on signalTerms don't recompute.
const NO_TERMS: string[] = []

export function useOrg() {
  const [orgId, setOrgId] = useState<number | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [canOnboard, setCanOnboard] = useState<boolean>(false)
  const [handle, setHandle] = useState<string | null>(null)
  const [orgHandle, setOrgHandle] = useState<string | null>(null)
  const [avatar, setAvatar] = useState<string | null>(null)
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [verifiedCount, setVerifiedCount] = useState<number | null>(null)
  const [country, setCountry] = useState<string | null>(null)
  const [signalTerms, setSignalTerms] = useState<string[]>(NO_TERMS)
  const [orgs, setOrgs] = useState<OrgSummary[]>([])
  // Status of the selected org, and of the org the actor *is* (if any).
  const [orgStatus, setOrgStatus] = useState<string | null>(null)
  const [ownOrgStatus, setOwnOrgStatus] = useState<OwnOrgStatus>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/vidi/api/org/context')
      setAuthenticated(res.status !== 401)
      const d = await res.json()
      setOrgId(d.orgId ?? null)
      setRole(d.role ?? null)
      setCanOnboard(d.canOnboard ?? false)
      setHandle(d.handle ?? null)
      setOrgHandle(d.orgHandle ?? null)
      setAvatar(d.avatar ?? null)
      setVerifiedCount(d.verifiedCount ?? null)
      setCountry(d.country ?? null)
      setSignalTerms(d.signalTerms ?? NO_TERMS)
      setOrgs(d.orgs ?? [])
      setOrgStatus(d.orgStatus ?? null)
      setOwnOrgStatus(d.ownOrgStatus ?? null)
    } catch {
      setAuthenticated(false)
      setOrgId(null)
      setRole(null)
      setCanOnboard(false)
      setHandle(null)
      setOrgHandle(null)
      setAvatar(null)
      setVerifiedCount(null)
      setCountry(null)
      setSignalTerms(NO_TERMS)
      setOrgs([])
      setOrgStatus(null)
      setOwnOrgStatus(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const selectOrg = useCallback(
    async (id: number) => {
      await fetch('/vidi/api/org/select', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orgId: id }),
      })
      await refresh()
    },
    [refresh]
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  // Other components (e.g. a just-completed verify action) call
  // notifyVerifiedCountChanged() so every mounted useOrg() instance picks up
  // the new count without a full page reload — see verifiedCountBus.ts.
  useEffect(() => subscribeVerifiedCountChanged(refresh), [refresh])

  return { orgId, setOrgId, role, canOnboard, handle, orgHandle, avatar, authenticated, loading, verifiedCount, country, signalTerms, orgs, orgStatus, ownOrgStatus, selectOrg, refresh }
}
