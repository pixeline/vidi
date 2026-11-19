import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import LoginPage from '../../src/app/page'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('LoginPage', () => {
  it('renders a handle input', () => {
    render(<LoginPage />)
    expect(screen.getByPlaceholderText(/handle/i)).toBeTruthy()
  })

  it('has an unchecked verifier-account checkbox by default', () => {
    render(<LoginPage />)
    const box = screen.getByLabelText("I'm signing in as the verifier account") as HTMLInputElement
    expect(box.checked).toBe(false)
  })

  it('sends asOrg: true when the box is ticked, false otherwise', async () => {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url.includes('/auth/login')) return { ok: true, json: async () => ({ url: '#' }) }
      return { ok: true, json: async () => ({ actors: [] }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<LoginPage />)
    fireEvent.change(screen.getByPlaceholderText(/handle/i), { target: { value: 'org.example.com' } })
    fireEvent.click(screen.getByLabelText("I'm signing in as the verifier account"))
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => {
      const call = fetchMock.mock.calls.find((c) => String(c[0]).includes('/auth/login'))
      expect(call).toBeTruthy()
      expect(JSON.parse(String(call![1]?.body))).toEqual({ handle: 'org.example.com', asOrg: true })
    })
  })
})
