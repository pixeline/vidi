import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import AboutPage from '../../src/app/about/page'

afterEach(cleanup)

describe('AboutPage', () => {
  it('renders the three section headings', () => {
    render(<AboutPage />)
    for (const name of ['What Vidi can do with your account', 'What Vidi stores', 'How to leave']) {
      expect(screen.getByRole('heading', { name })).toBeTruthy()
    }
  })

  it('links the operator contact for deletion requests', () => {
    render(<AboutPage />)
    const link = screen.getByRole('link', { name: /operator/i }) as HTMLAnchorElement
    expect(link.href).toBe('https://mu.social/@pixeline.be')
  })

  it('links back to sign in', () => {
    render(<AboutPage />)
    expect((screen.getByRole('link', { name: /sign in/i }) as HTMLAnchorElement).getAttribute('href')).toBe('/')
  })
})
