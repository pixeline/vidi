import { regexEscape, type SignalProfile } from './countryProfile'

// Signal words an org owner types in Settings, for verifiers whose community is
// a theme (journalists, scientists…) rather than, or as well as, a country.
export const MAX_SIGNAL_TERMS = 100
export const MAX_TERM_LENGTH = 60

/**
 * Splits on commas and newlines only, so a phrase like "le monde" stays one
 * term. Trims, lowercases, drops empties and duplicates, keeps the order.
 */
export function parseSignalTerms(input: string | string[]): string[] {
  const parts = (Array.isArray(input) ? input : [input]).flatMap((s) => s.split(/[,\r\n]+/))
  const out: string[] = []
  for (const part of parts) {
    const term = part.trim().toLowerCase()
    if (term && !out.includes(term)) out.push(term)
  }
  return out
}

// `lemonde.fr` or `.gouv.fr`: a dot and no whitespace means a handle domain.
const isDomainTerm = (term: string) => term.includes('.') && !/\s/.test(term)

/**
 * Word/phrase terms match names and bios (+2 each); domain terms match handles
 * on that domain or its subdomains (+3, like a country TLD).
 */
export function customProfile(terms: string[]): SignalProfile | null {
  if (terms.length === 0) return null
  const tlds: string[] = []
  const rules: SignalProfile['rules'] = []
  for (const term of terms) {
    if (isDomainTerm(term)) {
      const domain = term.replace(/^\.+/, '')
      if (domain && !tlds.includes(domain)) tlds.push(domain)
    } else {
      rules.push({ name: term, weight: 2, words: [regexEscape(term)] })
    }
  }
  return { code: 'Match', name: 'Custom', adjective: 'matching', tlds, rules, places: {} }
}
