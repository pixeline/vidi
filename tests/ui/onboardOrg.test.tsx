import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'

const toastError = vi.fn()
const toastSuccess = vi.fn()
vi.mock('sonner', () => ({ toast: { error: (m: string) => toastError(m), success: (m: string) => toastSuccess(m) } }))

import { OnboardOrg } from '../../src/components/OnboardOrg'

const FALLBACK =
  "Sign out, then sign in again as the verifier account with 'I'm signing in as the verifier account' ticked."

const fetchMock = vi.fn()
const originalLocation = window.location

function respond(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

beforeEach(() => {
  fetchMock.mockReset()
  toastError.mockReset()
  toastSuccess.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  Object.defineProperty(window, 'location', { configurable: true, value: { href: 'http://x/vidi/search' } })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
})

describe('OnboardOrg', () => {
  for (const error of ['no_org_session', 'missing_verification_scope']) {
    it(`on ${error} requests org consent and redirects instead of toasting`, async () => {
      fetchMock
        .mockResolvedValueOnce(respond({ error }, 409))
        .mockResolvedValueOnce(respond({ url: 'https://pds.example/authorize' }))
      render(<OnboardOrg onOnboarded={vi.fn()} reconnect accountHandle="italiatmosphe.re" />)
      fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }))
      await waitFor(() => expect(window.location.href).toBe('https://pds.example/authorize'))
      const [url, init] = fetchMock.mock.calls[1]
      expect(url).toBe('/vidi/api/auth/login')
      expect(init.method).toBe('POST')
      expect(JSON.parse(init.body)).toEqual({ handle: 'italiatmosphe.re', asOrg: true })
      expect(toastError).not.toHaveBeenCalled()
    })
  }

  it('falls back to a toast when there is no account handle, without calling login', async () => {
    fetchMock.mockResolvedValueOnce(respond({ error: 'no_org_session' }, 409))
    render(<OnboardOrg onOnboarded={vi.fn()} reconnect accountHandle={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(FALLBACK))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to a toast when the login call fails', async () => {
    fetchMock
      .mockResolvedValueOnce(respond({ error: 'missing_verification_scope' }, 409))
      .mockResolvedValueOnce(respond({}, 500))
    render(<OnboardOrg onOnboarded={vi.fn()} accountHandle="italiatmosphe.re" />)
    fireEvent.click(screen.getByRole('button', { name: 'Onboard this org' }))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(FALLBACK))
    expect(window.location.href).toBe('http://x/vidi/search')
  })

  it('on success calls onOnboarded and toasts', async () => {
    fetchMock.mockResolvedValueOnce(respond({ ok: true }))
    const onOnboarded = vi.fn()
    render(<OnboardOrg onOnboarded={onOnboarded} reconnect accountHandle="italiatmosphe.re" />)
    fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }))
    await waitFor(() => expect(onOnboarded).toHaveBeenCalled())
    expect(toastSuccess).toHaveBeenCalledWith('Org reconnected')
  })
})
