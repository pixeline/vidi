'use client'
import { useCallback, useEffect, useState } from 'react'
import { useOrg } from '@/lib/hooks/useOrg'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type ActivityItem = {
  id: number
  action: 'verify' | 'revoke'
  outcome: string
  subjectDid: string
  subjectHandle: string | null
  actorDid: string
  actorHandle: string | null
  recordUri: string | null
  createdAt: string
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
  ['second', 1],
]
const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

function formatRelative(iso: string, now = Date.now()) {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000)
  const abs = Math.abs(seconds)
  const [unit, size] = UNITS.find(([, s]) => abs >= s) ?? UNITS[UNITS.length - 1]
  return rtf.format(Math.round(seconds / size), unit)
}

const who = (handle: string | null, did: string) => (handle ? `@${handle}` : did)

function Row({ item }: { item: ActivityItem }) {
  const done = item.outcome === 'verified' || item.outcome === 'revoked'
  const verb = item.action === 'revoke' ? 'revoked' : 'verified'
  return (
    <li className="flex items-center gap-2 border-b py-2 text-sm last:border-b-0">
      <span>
        {who(item.actorHandle, item.actorDid)} {verb} {who(item.subjectHandle, item.subjectDid)}
      </span>
      {!done && (
        <Badge variant={item.outcome === 'error' ? 'destructive' : 'secondary'}>{item.outcome}</Badge>
      )}
      <span className="ml-auto text-muted-foreground">· {formatRelative(item.createdAt)}</span>
    </li>
  )
}

export default function ActivityPage() {
  const { orgId } = useOrg()
  const [items, setItems] = useState<ActivityItem[]>([])
  const [nextBefore, setNextBefore] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(
    async (before: number | null) => {
      if (orgId == null) return
      setLoading(true)
      try {
        const res = await fetch(`/vidi/api/activity?orgId=${orgId}${before != null ? `&before=${before}` : ''}`)
        if (!res.ok) return
        const d = await res.json()
        setItems((prev) => (before == null ? d.items : [...prev, ...d.items]))
        setNextBefore(d.nextBefore ?? null)
      } finally {
        setLoading(false)
        setLoaded(true)
      }
    },
    [orgId]
  )

  useEffect(() => {
    load(null)
  }, [load])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {loaded && items.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
        <ul>
          {items.map((i) => (
            <Row key={i.id} item={i} />
          ))}
        </ul>
        {nextBefore != null && (
          <Button variant="outline" size="sm" className="mt-4" disabled={loading} onClick={() => load(nextBefore)}>
            Load more
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
