import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import ActivityPage from '../../src/app/(app)/activity/page'

vi.mock('@/lib/hooks/useOrg', () => ({ useOrg: () => ({ orgId: 3 }) }))

const NOW = new Date('2026-11-19T12:00:00Z')
const item = (over: Record<string, unknown>) => ({
  id: 10, action: 'verify', outcome: 'verified', subjectDid: 'did:plc:bob', subjectHandle: 'bob',
  actorDid: 'did:plc:alice', actorHandle: 'alice', recordUri: null,
  createdAt: new Date(NOW.getTime() - 2 * 3600_000).toISOString(), ...over,
})

const fetchMock = vi.fn()
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body })

describe('ActivityPage', () => {
  it('renders "@alice verified @bob" with a relative time', async () => {
    fetchMock.mockResolvedValue(ok({ items: [item({})], nextBefore: null }))
    render(<ActivityPage />)
    expect(await screen.findByText(/@alice verified @bob/)).toBeTruthy()
    expect(screen.getByText(/2 hours ago/)).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledWith('/vidi/api/activity?orgId=3')
  })

  it('falls back to DIDs and says "revoked"', async () => {
    fetchMock.mockResolvedValue(ok({ items: [item({ action: 'revoke', outcome: 'revoked', subjectHandle: null, actorHandle: null })], nextBefore: null }))
    render(<ActivityPage />)
    expect(await screen.findByText(/did:plc:alice revoked did:plc:bob/)).toBeTruthy()
  })

  it('renders an error outcome as a destructive badge', async () => {
    fetchMock.mockResolvedValue(ok({ items: [item({ outcome: 'error' })], nextBefore: null }))
    render(<ActivityPage />)
    const badge = await screen.findByText('error')
    expect(badge.className).toMatch(/text-destructive/)
  })

  it('renders a skip outcome as a non-destructive badge', async () => {
    fetchMock.mockResolvedValue(ok({ items: [item({ outcome: 'skipped-denylist' })], nextBefore: null }))
    render(<ActivityPage />)
    const badge = await screen.findByText('skipped-denylist')
    expect(badge.className).not.toMatch(/text-destructive/)
  })

  it('"Load more" fetches with before and appends', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ items: [item({ id: 10 })], nextBefore: 10 }))
      .mockResolvedValueOnce(ok({ items: [item({ id: 9, subjectHandle: 'carol' })], nextBefore: null }))
    render(<ActivityPage />)
    fireEvent.click(await screen.findByRole('button', { name: /load more/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('/vidi/api/activity?orgId=3&before=10'))
    expect(await screen.findByText(/@alice verified @carol/)).toBeTruthy()
    expect(screen.getByText(/@alice verified @bob/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /load more/i })).toBeNull()
  })
})
