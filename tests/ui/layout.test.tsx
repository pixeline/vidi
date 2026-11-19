import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'

const useOrgMock = vi.fn()
const replaceMock = vi.fn()
vi.mock('@/lib/hooks/useOrg', () => ({ useOrg: () => useOrgMock() }))
vi.mock('next/navigation', () => ({ usePathname: () => '/search', useRouter: () => ({ replace: replaceMock }) }))

import AppLayout from '../../src/app/(app)/layout'

afterEach(cleanup)
beforeEach(() => replaceMock.mockClear())

describe('AppLayout', () => {
  it('shows the Trusted Verifier org handle and verified count next to the Vidi logo', () => {
    useOrgMock.mockReturnValue({
      orgId: 1,
      role: 'owner',
      canOnboard: true,
      handle: 'org.example.com',
      orgHandle: 'belgium-atmosphe.re',
      authenticated: true,
      loading: false,
      verifiedCount: 42,
      refresh: vi.fn(),
    })
    render(<AppLayout>{null}</AppLayout>)
    expect(screen.getByText('belgium-atmosphe.re')).toBeTruthy()
    expect(screen.getByText(/42 verified/i)).toBeTruthy()
  })

  it('shows the org handle without a count while the count is not yet known', () => {
    useOrgMock.mockReturnValue({
      orgId: 1,
      role: 'owner',
      canOnboard: true,
      handle: 'org.example.com',
      orgHandle: 'belgium-atmosphe.re',
      authenticated: true,
      loading: false,
      verifiedCount: null,
      refresh: vi.fn(),
    })
    render(<AppLayout>{null}</AppLayout>)
    expect(screen.getByText('belgium-atmosphe.re')).toBeTruthy()
    expect(screen.queryByText(/verified/i)).toBeNull()
  })

  it('hides the verified count while it is not yet known', () => {
    useOrgMock.mockReturnValue({
      orgId: null,
      role: null,
      canOnboard: false,
      handle: null,
      authenticated: false,
      loading: true,
      verifiedCount: null,
      refresh: vi.fn(),
    })
    render(<AppLayout>{null}</AppLayout>)
    expect(screen.queryByText(/verified/i)).toBeNull()
  })

  it('does not render the app shell or children while auth is still resolving', () => {
    useOrgMock.mockReturnValue({
      orgId: null, role: null, canOnboard: false, handle: null,
      authenticated: null, loading: true, verifiedCount: null, refresh: vi.fn(),
    })
    render(<AppLayout><div>protected content</div></AppLayout>)
    expect(screen.queryByText('protected content')).toBeNull()
    expect(screen.queryByRole('link', { name: /^vidi$/i })).toBeNull()
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('redirects to the login page and hides the shell when the user is not authenticated', async () => {
    useOrgMock.mockReturnValue({
      orgId: null, role: null, canOnboard: false, handle: null,
      authenticated: false, loading: false, verifiedCount: null, refresh: vi.fn(),
    })
    render(<AppLayout><div>protected content</div></AppLayout>)
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/'))
    expect(screen.queryByText('protected content')).toBeNull()
    expect(screen.queryByRole('button', { name: /sign out/i })).toBeNull()
  })

  it('renders children and never redirects when authenticated', () => {
    useOrgMock.mockReturnValue({
      orgId: 1, role: 'helper', canOnboard: true, handle: 'org.example.com',
      avatar: null, authenticated: true, loading: false, verifiedCount: 0, refresh: vi.fn(),
    })
    render(<AppLayout><div>protected content</div></AppLayout>)
    expect(screen.getByText('protected content')).toBeTruthy()
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('renders the logged-in avatar image when one is available', () => {
    useOrgMock.mockReturnValue({
      orgId: 1, role: 'owner', canOnboard: true, handle: 'org.example.com',
      avatar: 'https://av.example/pic.jpg', authenticated: true, loading: false, verifiedCount: 0, refresh: vi.fn(),
    })
    render(<AppLayout>{null}</AppLayout>)
    expect(document.querySelector('img[src="https://av.example/pic.jpg"]')).toBeTruthy()
  })

  it('falls back to the handle initial when no avatar is set', () => {
    useOrgMock.mockReturnValue({
      orgId: 1, role: 'owner', canOnboard: true, handle: 'org.example.com',
      avatar: null, authenticated: true, loading: false, verifiedCount: 0, refresh: vi.fn(),
    })
    render(<AppLayout>{null}</AppLayout>)
    expect(document.querySelector('img')).toBeNull()
    expect(screen.getByText('O')).toBeTruthy()
  })

  it('shows the Settings link for an active member (helper), not just owners', () => {
    useOrgMock.mockReturnValue({
      orgId: 1, role: 'helper', canOnboard: true, handle: 'pixeline.be',
      avatar: null, authenticated: true, loading: false, verifiedCount: 0, refresh: vi.fn(),
    })
    render(<AppLayout>{null}</AppLayout>)
    expect(screen.getByRole('link', { name: /settings/i })).toBeTruthy()
  })

  it('hides the Settings link for a non-member (no org role)', () => {
    useOrgMock.mockReturnValue({
      orgId: null, role: null, canOnboard: true, handle: null,
      avatar: null, authenticated: true, loading: false, verifiedCount: null, refresh: vi.fn(),
    })
    render(<AppLayout>{null}</AppLayout>)
    expect(screen.queryByRole('link', { name: /settings/i })).toBeNull()
  })

  it('renders an Organization switcher with several orgs and calls selectOrg on change', () => {
    const selectOrg = vi.fn()
    useOrgMock.mockReturnValue({
      orgId: 1, role: 'owner', canOnboard: true, handle: 'me', orgHandle: 'be.example',
      orgs: [
        { orgId: 1, handle: 'be.example', role: 'owner' },
        { orgId: 2, handle: 'it.example', role: 'helper' },
      ],
      selectOrg, avatar: null, authenticated: true, loading: false, verifiedCount: 3, refresh: vi.fn(),
    })
    render(<AppLayout>{null}</AppLayout>)
    const select = screen.getByRole('combobox', { name: 'Organization' }) as HTMLSelectElement
    expect(select.value).toBe('1')
    fireEvent.change(select, { target: { value: '2' } })
    expect(selectOrg).toHaveBeenCalledWith(2)
  })

  it('renders no switcher with a single org', () => {
    useOrgMock.mockReturnValue({
      orgId: 1, role: 'owner', canOnboard: true, handle: 'me', orgHandle: 'be.example',
      orgs: [{ orgId: 1, handle: 'be.example', role: 'owner' }],
      selectOrg: vi.fn(), avatar: null, authenticated: true, loading: false, verifiedCount: 3, refresh: vi.fn(),
    })
    render(<AppLayout>{null}</AppLayout>)
    expect(screen.queryByRole('combobox', { name: 'Organization' })).toBeNull()
    expect(screen.getByText('be.example')).toBeTruthy()
  })

  describe('disconnected orgs', () => {
    const base = {
      handle: 'me', avatar: null, authenticated: true, loading: false, verifiedCount: 0,
      selectOrg: vi.fn(), refresh: vi.fn(),
    }

    it('offers Reconnect to the owner of a disconnected org', () => {
      useOrgMock.mockReturnValue({
        ...base, orgId: 1, role: 'owner', canOnboard: true, orgHandle: 'be.example',
        orgs: [{ orgId: 1, handle: 'be.example', role: 'owner' }],
        orgStatus: 'disconnected', ownOrgStatus: 'disconnected',
      })
      render(<AppLayout>{null}</AppLayout>)
      expect(screen.getByText('Reconnect this org')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Reconnect' })).toBeTruthy()
    })

    it('passes the signed-in account handle to OnboardOrg for the org consent redirect', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: 'no_org_session' }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ url: 'https://pds.example/authorize' }) })
      vi.stubGlobal('fetch', fetchMock)
      const originalLocation = window.location
      Object.defineProperty(window, 'location', { configurable: true, value: { href: 'http://x/vidi/search' } })
      try {
        useOrgMock.mockReturnValue({
          ...base, handle: 'italiatmosphe.re', orgId: 1, role: 'owner', canOnboard: true, orgHandle: 'be.example',
          orgs: [{ orgId: 1, handle: 'be.example', role: 'owner' }],
          orgStatus: 'disconnected', ownOrgStatus: 'disconnected',
        })
        render(<AppLayout>{null}</AppLayout>)
        fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }))
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
        expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ handle: 'italiatmosphe.re', asOrg: true })
      } finally {
        Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
        vi.unstubAllGlobals()
      }
    })

    it('does not offer Reconnect or Onboard to the owner of an active org', () => {
      useOrgMock.mockReturnValue({
        ...base, orgId: 1, role: 'owner', canOnboard: true, orgHandle: 'be.example',
        orgs: [{ orgId: 1, handle: 'be.example', role: 'owner' }],
        orgStatus: 'active', ownOrgStatus: 'active',
      })
      render(<AppLayout>{null}</AppLayout>)
      expect(screen.queryByText('Reconnect this org')).toBeNull()
      expect(screen.queryByRole('button', { name: /reconnect|onboard/i })).toBeNull()
      expect(screen.queryByText(/has disconnected Vidi/)).toBeNull()
    })

    it('does not offer Onboard to an eligible owner of an active org who has selected another org', () => {
      useOrgMock.mockReturnValue({
        ...base, orgId: 2, role: 'helper', canOnboard: true, orgHandle: 'it.example',
        orgs: [
          { orgId: 1, handle: 'be.example', role: 'owner' },
          { orgId: 2, handle: 'it.example', role: 'helper' },
        ],
        orgStatus: 'active', ownOrgStatus: 'active',
      })
      render(<AppLayout>{null}</AppLayout>)
      expect(screen.queryByRole('button', { name: /reconnect|onboard/i })).toBeNull()
    })

    it('still offers Onboard to an eligible account with no org yet', () => {
      useOrgMock.mockReturnValue({
        ...base, orgId: null, role: null, canOnboard: true, orgHandle: null, orgs: [],
        orgStatus: null, ownOrgStatus: null,
      })
      render(<AppLayout>{null}</AppLayout>)
      expect(screen.getByRole('button', { name: 'Onboard this org' })).toBeTruthy()
    })

    it('shows a paused banner and no Reconnect to a helper of a disconnected org', () => {
      useOrgMock.mockReturnValue({
        ...base, orgId: 1, role: 'helper', canOnboard: false, orgHandle: 'be.example',
        orgs: [{ orgId: 1, handle: 'be.example', role: 'helper' }],
        orgStatus: 'disconnected', ownOrgStatus: null,
      })
      render(<AppLayout>{null}</AppLayout>)
      expect(
        screen.getByText('This org has disconnected Vidi. Verifying is paused until the owner reconnects.'),
      ).toBeTruthy()
      expect(screen.queryByRole('button', { name: /reconnect/i })).toBeNull()
    })
  })
})
