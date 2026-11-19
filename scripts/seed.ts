import { db } from '../src/db/client'
import { asc } from 'drizzle-orm'
import { crawlSeeds, orgs } from '../src/db/schema'
import { addToAllowlist } from '../src/lib/allowlist'
import { validateEnv } from '../src/lib/env'
import { isMain } from '../src/lib/isMain'

export function parseSeeds(s: string): string[] {
  return s.split(',').map((x) => x.trim()).filter(Boolean)
}

export async function seed() {
  for (const did of parseSeeds(process.env.VIDI_SEED_ALLOWLIST ?? '')) {
    await addToAllowlist(did, '', 'seed')
  }
  const keywords = parseSeeds(process.env.VIDI_SEED_KEYWORDS ?? '')
  if (keywords.length) {
    // Keywords are per org now; attach env seeds to the first org. Before any
    // org has onboarded there is nothing to attach to, so skip.
    const [org] = await db.select({ id: orgs.id }).from(orgs).orderBy(asc(orgs.id)).limit(1)
    if (!org) {
      console.warn('seed: VIDI_SEED_KEYWORDS ignored, no org exists yet')
    } else {
      for (const kw of keywords) {
        await db.insert(crawlSeeds).values({ orgId: org.id, keyword: kw, enabled: true }).onConflictDoNothing()
      }
    }
  }
}

// ESM-safe CLI entrypoint check. Mirror of src/db/migrate.ts pattern.
if (isMain(import.meta.url)) {
  validateEnv()
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
