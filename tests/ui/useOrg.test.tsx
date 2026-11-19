import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act, cleanup } from '@testing-library/react'
import { useOrg } from '@/lib/hooks/useOrg'
import { notifyVerifiedCountChanged } from '@/lib/verifiedCountBus'

afterEach(cleanup)

describe('useOrg', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  it('exposes verifiedCount from the org/context response', async () => {
    ;(global.fetch as any).mockResolvedValue({
      status: 200,
      json: async () => ({ orgId: 1, role: 'owner', canOnboard: true, handle: 'x', verifiedCount: 7 }),
    })
    const { result } = renderHook(() => useOrg())
    await waitFor(() => expect(result.current.verifiedCount).toBe(7))
  })

  it('exposes orgStatus and ownOrgStatus from the org/context response', async () => {
    ;(global.fetch as any).mockResolvedValue({
      status: 200,
      json: async () => ({ orgId: 1, role: 'owner', orgStatus: 'disconnected', ownOrgStatus: 'disconnected' }),
    })
    const { result } = renderHook(() => useOrg())
    await waitFor(() => expect(result.current.orgStatus).toBe('disconnected'))
    expect(result.current.ownOrgStatus).toBe('disconnected')
  })

  it('re-fetches org context when notified via the verifiedCountBus', async () => {
    let call = 0
    ;(global.fetch as any).mockImplementation(async () => {
      call++
      return {
        status: 200,
        json: async () => ({ orgId: 1, role: 'owner', canOnboard: true, handle: 'x', verifiedCount: call }),
      }
    })
    const { result } = renderHook(() => useOrg())
    await waitFor(() => expect(result.current.verifiedCount).toBe(1))

    act(() => {
      notifyVerifiedCountChanged()
    })

    await waitFor(() => expect(result.current.verifiedCount).toBe(2))
  })

  it('exposes orgs and selectOrg POSTs then refreshes', async () => {
    const calls: any[] = []
    ;(global.fetch as any).mockImplementation(async (url: string, init?: any) => {
      calls.push([url, init?.method ?? 'GET'])
      return {
        status: 200,
        json: async () => ({ orgId: 1, orgs: [{ orgId: 1, handle: 'a', role: 'owner' }, { orgId: 2, handle: 'b', role: 'helper' }] }),
      }
    })
    const { result } = renderHook(() => useOrg())
    await waitFor(() => expect(result.current.orgs).toHaveLength(2))
    await act(async () => {
      await result.current.selectOrg(2)
    })
    const post = calls.find((c) => c[0] === '/vidi/api/org/select')
    expect(post).toEqual(['/vidi/api/org/select', 'POST'])
    expect(calls.filter((c) => c[0] === '/vidi/api/org/context').length).toBeGreaterThanOrEqual(2)
  })
})
