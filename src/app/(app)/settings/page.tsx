'use client'
import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useOrg } from '@/lib/hooks/useOrg'
import { parseKeywords } from '@/lib/keywords'
import { PROFILES } from '@/lib/signals/profiles'
import { COUNTRY_CODES, countryName } from '@/lib/signals/genericCountry'

type Seed = { id: number; keyword: string; enabled: boolean }

const NO_TERMS: string[] = []

type CountryOption = { code: string; name: string }
const byName = (a: CountryOption, b: CountryOption) => a.name.localeCompare(b.name, 'en')
// Countries with curated local lists first, then every other ISO country,
// which gets the generic flag + domain + country-name signals.
const CURATED_COUNTRIES: CountryOption[] = Object.values(PROFILES)
  .map((p) => ({ code: p.code, name: p.name }))
  .sort(byName)
const OTHER_COUNTRIES: CountryOption[] = COUNTRY_CODES.filter((code) => !PROFILES[code])
  .map((code) => ({ code, name: countryName(code) }))
  .sort(byName)

export function SettingsView({
  role,
  orgId,
  seeds: initialSeeds,
  accountsCount,
  country = null,
  signalTerms = NO_TERMS,
  onRankingSaved,
  orgHandle = null,
  orgStatus = null,
  onDisconnected,
}: {
  role: string
  orgId: number
  seeds: Seed[]
  accountsCount: number | null
  country?: string | null
  signalTerms?: string[]
  onRankingSaved?: () => void
  orgHandle?: string | null
  orgStatus?: string | null
  onDisconnected?: () => void
}) {
  const [seeds, setSeeds] = useState(initialSeeds)
  const [newKeyword, setNewKeyword] = useState('')
  const [running, setRunning] = useState(false)
  const [termsText, setTermsText] = useState(signalTerms.join('\n'))
  const [savingTerms, setSavingTerms] = useState(false)

  // SettingsPage mounts this component as soon as org context resolves, but
  // its crawl-seeds fetch is still in flight at that point — seeds always
  // starts empty and the real list arrives a moment later via a prop update.
  // useState's initializer only runs once, so without this effect that later
  // update would be silently dropped and the list would stay empty forever.
  useEffect(() => {
    setSeeds(initialSeeds)
  }, [initialSeeds])

  // Re-sync with the saved (normalised) terms after a save/refresh.
  useEffect(() => {
    setTermsText(signalTerms.join('\n'))
  }, [signalTerms])

  async function addKeyword() {
    // Split the entry on commas/whitespace so pasting a city list adds one
    // keyword per city; de-dupes and drops blanks.
    const parsed = parseKeywords(newKeyword)
    if (parsed.length === 0) return
    const res = await fetch('/vidi/api/crawl-seeds', {
      method: 'POST',
      body: JSON.stringify({ orgId, keywords: parsed }),
    })
    if (!res.ok) {
      toast.error(parsed.length > 1 ? 'Could not add keywords' : 'Could not add keyword')
      return
    }
    setSeeds((prev) => {
      const next = [...prev]
      for (const kw of parsed) {
        const idx = next.findIndex((s) => s.keyword.toLowerCase() === kw.toLowerCase())
        if (idx === -1) next.push({ id: Date.now() + next.length, keyword: kw, enabled: true })
        else next[idx] = { ...next[idx], enabled: true }
      }
      return next
    })
    setNewKeyword('')
  }

  async function toggle(keyword: string, enabled: boolean) {
    const res = await fetch('/vidi/api/crawl-seeds', {
      method: 'PATCH',
      body: JSON.stringify({ orgId, keyword, enabled }),
    })
    if (!res.ok) {
      toast.error('Could not update keyword')
      return
    }
    setSeeds((prev) => prev.map((s) => (s.keyword === keyword ? { ...s, enabled } : s)))
  }

  async function saveCountry(value: string) {
    const res = await fetch('/vidi/api/org/settings', {
      method: 'PATCH',
      body: JSON.stringify({ orgId, country: value || null }),
    })
    if (!res.ok) {
      toast.error('Could not update country')
      return
    }
    onRankingSaved?.()
  }

  async function saveSignalTerms() {
    setSavingTerms(true)
    try {
      const res = await fetch('/vidi/api/org/settings', {
        method: 'PATCH',
        body: JSON.stringify({ orgId, signalTerms: termsText }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error(
          d.error === 'too_many_terms'
            ? 'Too many signal words (100 at most)'
            : d.error === 'term_too_long'
              ? 'A signal word is too long (60 characters at most)'
              : 'Could not save signal words',
        )
        return
      }
      toast.success('Signal words saved')
      onRankingSaved?.()
    } finally {
      setSavingTerms(false)
    }
  }

  async function disconnect() {
    const label = orgHandle ? `@${orgHandle}` : 'this org'
    if (!window.confirm(`Disconnect Vidi from ${label}? Members will no longer be able to verify until you reconnect.`)) return
    const res = await fetch('/vidi/api/org/disconnect', { method: 'POST', body: JSON.stringify({ orgId }) })
    if (!res.ok) {
      toast.error('Could not disconnect Vidi')
      return
    }
    toast.success('Vidi disconnected')
    onDisconnected?.()
  }

  async function runCrawlNow() {
    setRunning(true)
    try {
      const res = await fetch('/vidi/api/crawl/run', { method: 'POST', body: JSON.stringify({ orgId }) })
      if (!res.ok) {
        toast.error('Could not start crawl')
        return
      }
      toast.success('Crawl queued — the worker will pick it up shortly.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage crawl discovery keywords for this instance.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Crawl Keywords</CardTitle>
          <CardDescription>
            The crawler searches each enabled keyword on the network and harvests matching accounts
            into the searchable pool that Search browses
            {accountsCount != null && (
              <>
                {' — '}
                <span className="font-medium text-foreground">{accountsCount.toLocaleString()}</span>
                {' accounts harvested so far'}
              </>
            )}
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              addKeyword()
            }}
          >
            <div className="flex flex-1 flex-col gap-1">
              <Label htmlFor="new-keyword">Add keywords</Label>
              <Input
                id="new-keyword"
                value={newKeyword}
                placeholder="Places, topics, institutions, hashtags…"
                onChange={(e) => setNewKeyword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Separate multiple keywords with commas or spaces.</p>
            </div>
            <Button type="submit">Add</Button>
          </form>
          <div className="flex flex-wrap gap-2">
            {seeds.map((s) => (
              <Badge
                key={s.id}
                variant={s.enabled ? 'default' : 'outline'}
                render={<button type="button" />}
                aria-pressed={s.enabled}
                onClick={() => toggle(s.keyword, !s.enabled)}
                className="cursor-pointer gap-1"
              >
                {s.keyword}
                {s.enabled ? <X className="size-3" /> : <Plus className="size-3" />}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {role === 'owner' && (
        <Card>
          <CardHeader>
            <CardTitle>Ranking signals</CardTitle>
            <CardDescription>
              Ranks the To Be Verified list by evidence that an account belongs to your community. Pick a
              country, add your own signal words, or both. Leave both empty to keep the order accounts were
              added.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="ranking-country">Country (optional)</Label>
              <select
                id="ranking-country"
                value={country ?? ''}
                onChange={(e) => void saveCountry(e.target.value)}
                className="h-9 w-fit rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">None</option>
                <optgroup label="With local signals">
                  {CURATED_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{`${c.name} (${c.code})`}</option>
                  ))}
                </optgroup>
                <optgroup label="Other countries">
                  {OTHER_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{`${c.name} (${c.code})`}</option>
                  ))}
                </optgroup>
              </select>
            </div>
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                void saveSignalTerms()
              }}
            >
              <Label htmlFor="ranking-terms">Your signal words</Label>
              <textarea
                id="ranking-terms"
                value={termsText}
                rows={5}
                onChange={(e) => setTermsText(e.target.value)}
                aria-describedby="ranking-terms-help"
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
              />
              <p id="ranking-terms-help" className="text-xs text-muted-foreground">
                One per line or comma-separated. Words and phrases are matched in names and bios (+2 each).
                Entries with a dot, like lemonde.fr, match handles on that domain (+3).
              </p>
              <Button type="submit" className="w-fit" disabled={savingTerms}>
                Save signal words
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {role === 'owner' && (
        <Button onClick={runCrawlNow} disabled={running}>
          {running ? 'Starting…' : 'Run crawl now'}
        </Button>
      )}

      {role === 'owner' && orgStatus !== 'disconnected' && (
        <Card>
          <CardHeader>
            <CardTitle>Disconnect Vidi</CardTitle>
            <CardDescription>
              Revokes Vidi&apos;s access to your verifier account. Members, backlog and activity history are kept.
              Use Reconnect at the top of the page to turn it back on.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={() => void disconnect()}>
              {orgHandle ? `Disconnect Vidi from @${orgHandle}` : 'Disconnect Vidi'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function SettingsPage() {
  const { orgId, role, loading, country, signalTerms, orgHandle, orgStatus, refresh } = useOrg()
  const [seeds, setSeeds] = useState<Seed[]>([])
  const [accountsCount, setAccountsCount] = useState<number | null>(null)

  useEffect(() => {
    // Keyword settings are open to any active member (owner or helper).
    if (orgId && role) {
      fetch(`/vidi/api/crawl-seeds?orgId=${orgId}`)
        .then(async (r) => {
          if (!r.ok) {
            toast.error('Could not load crawl keywords')
            return
          }
          const d = await r.json()
          setSeeds(d.seeds ?? [])
          setAccountsCount(d.accountsCount ?? null)
        })
        .catch(() => toast.error('Could not load crawl keywords'))
    }
  }, [orgId, role])

  if (loading || !orgId || !role) return null
  return <SettingsView role={role} orgId={orgId} seeds={seeds} accountsCount={accountsCount} country={country} signalTerms={signalTerms} onRankingSaved={refresh} orgHandle={orgHandle} orgStatus={orgStatus} onDisconnected={refresh} />
}
