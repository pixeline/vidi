# Hosted Multi-Verifier Vidi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let other Trusted Verifiers (e.g. @italiatmosphe.re) use the hosted Vidi instance as separate orgs, without being able to touch each other's settings, and without handing Vidi full write access to their accounts.

**Architecture:** The data model is already partly multi-tenant (`orgs`, `members`, `backlog_items` and `verification_actions` carry `orgId`; every route calls `assertActiveMember`). This plan closes the remaining gaps in three phases that each ship on their own:
1. **Isolation:** keyword seeds per org, a per-org country profile replacing the hard-coded Belgian scorer, and an org switcher for people in several orgs.
2. **Trust:** narrow OAuth scope (`repo:app.bsky.graph.verification` for the org account, plain `atproto` for helpers), owner-initiated disconnect, a visible activity log, and a public "what Vidi stores" page.
3. **Self-serve onboarding:** any account on the configured Trusted Verifier list(s) can onboard without the superadmin allowlisting it first.

The `accounts` pool stays shared on purpose: every org benefits from every crawl, and a card shows that another country's verifier already verified an account.

**Tech Stack:** Next.js 16 App Router (`basePath: '/vidi'`), Drizzle ORM / PostgreSQL 16, `@atproto/oauth-client-node` 0.4.x (`@atproto/oauth-client` 0.7.7), iron-session, Vitest + Testing Library, shadcn/ui on @base-ui/react.

**Spec:** No separate spec document. The design comes from the assessment in the session that produced this plan; its decisions are restated in "Design Decisions" below so this file stands on its own.

## Design Decisions

- **Seeds:** `crawl_seeds` gets `org_id`. Uniqueness becomes `(org_id, keyword)`. The crawler queries each distinct enabled keyword once, across all orgs; results go into the shared pool.
- **Country profiles live in code** (`src/lib/signals/profiles.ts`), not in the database. The owner picks one in Settings (`orgs.country`, ISO 3166 alpha-2, nullable). `null` means no scoring: the backlog keeps the server order and shows no score badge. New countries are added by PR. Ship `BE` (an exact port of today's rules) and `IT`.
- **Active org** is stored in the iron-session cookie (`activeOrgId`). It falls back to the first active membership when unset or no longer valid.
- **Scopes:** `ORG_SCOPE = 'atproto repo:app.bsky.graph.verification'` and `MEMBER_SCOPE = 'atproto'`. The client metadata declares `ORG_SCOPE`, which covers both. Login asks for `ORG_SCOPE` only when the user ticks "I'm signing in as the verifier account".
- **Disconnect** revokes the org's token, deletes its `oauth_session` row and sets `orgs.status = 'disconnected'`. It keeps members, backlog and the activity log. Verify and revoke already refuse a non-`active` org (`org_inactive`, 403).
- **Eligibility to onboard** = on the allowlist OR in `trusted_verifiers` (filled by the crawler from `TRUSTED_VERIFIER_LIST_URIS`).

## Global Constraints

- Migrations are generated with `DATABASE_URL='postgres://x' npx drizzle-kit generate`, then hand-edited only to add the backfill statements this plan specifies. Never edit an already-applied migration (`0000`–`0003`).
- The Belgian scorer's behaviour must not change: every existing case in `tests/lib/belgianSignals.test.ts` must pass unchanged against `scoreAccount(PROFILES.BE, …)`.
- Never read `app.bsky.*` through an org's or a member's OAuth agent. Use `getPublicAppViewAgent()`, because a narrow-scope session cannot call proxied app.bsky methods.
- All new API routes follow the existing `guard()` + `getActor()` + `assertActiveMember`/`assertOwner` pattern and return `{ error: <snake_case> }` on failure.
- Client fetches use the `/vidi/api/...` prefix (basePath).
- TDD: write the failing test, confirm red, implement, confirm green. `npm test` and `npx tsc --noEmit` must be clean at the end of every task.
- One Conventional Commit per task, ending with the `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` trailer.

## Review Focus

1. **The existing Belgian org on first deploy:** its seeds must still be its own (backfill), `country` must be `BE`, and verifying must keep working on its old `transition:generic` session until the owner signs in again. Tests: Task 1 Step 1 (backfill SQL review), Task 3 Step 1, Task 5 Step 1.
2. **Someone in two orgs switches org, then verifies:** the record is written by the selected org. A stale `activeOrgId` (membership revoked since) falls back to the first active membership instead of returning a 403 loop. Test: Task 4 Step 1.
3. **An owner signs in without ticking "verifier account" and clicks Onboard:** they get `missing_verification_scope` and a toast that tells them to sign in again with the box ticked. No org row is created. Test: Task 5 Step 1.
4. **The org is disconnected while a helper has Search open:** verify returns `org_inactive` and writes no record; the UI shows "This org has disconnected Vidi". Test: Task 6 Step 1.
5. **Two orgs add the same keyword:** the crawler queries it once, and disabling it in one org leaves it enabled for the other. Test: Task 1 Step 1.

---

## Phase 1: Isolation

### Task 1: Keyword seeds per org

**Files:**
- Modify: `src/db/schema.ts` (`crawlSeeds`)
- Create: `drizzle/0004_*.sql` (generated, then hand-edited)
- Modify: `src/app/api/crawl-seeds/route.ts`
- Modify: `src/crawler/keywordSeed.ts`
- Test: `tests/api/crawlSeeds.test.ts`, `tests/crawler/keywordSeed.test.ts`

**Interfaces:**
- Produces: `crawlSeeds` columns `{ id, orgId: integer NOT NULL, keyword, enabled }`, unique index `crawl_seeds_org_keyword_uniq` on `(org_id, keyword)`. The global `keyword` unique constraint is gone.

- [ ] **Step 1: Write the failing tests**

In `tests/api/crawlSeeds.test.ts`, extend the db mock so `.from()` returns an object with a `where(cond)` that records `cond`, then add:
- `GET filters seeds by orgId`: the recorded `where` for the seeds select references `crawlSeeds.orgId`.
- `POST inserts with orgId and conflicts on (orgId, keyword)`: `insertCalls[0].values` equals `{ orgId: 1, keyword: 'roma', enabled: true }` and `conflict.target` is `[crawlSeeds.orgId, crawlSeeds.keyword]`.
- `PATCH only touches the caller's org`: the recorded update `where` references both `crawlSeeds.orgId` and `crawlSeeds.keyword`.

In `tests/crawler/keywordSeed.test.ts` add `queries a keyword shared by two orgs once`: seed rows `[{orgId:1,keyword:'roma',enabled:true},{orgId:2,keyword:'roma',enabled:true}]`, so `searchActorsTypeahead` is called exactly once with `q: 'roma'`.

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx vitest run tests/api/crawlSeeds.test.ts tests/crawler/keywordSeed.test.ts`
Expected: FAIL on the new cases.

- [ ] **Step 3: Change the schema and generate the migration**

In `crawlSeeds`: add `orgId: integer('org_id').notNull()`, drop `.unique()` from `keyword`, and add the table callback `(t) => ({ orgKeyword: uniqueIndex('crawl_seeds_org_keyword_uniq').on(t.orgId, t.keyword) })`.
Run `DATABASE_URL='postgres://x' npx drizzle-kit generate`. In the generated SQL, change the `ADD COLUMN "org_id" integer NOT NULL` into three statements: add the column as nullable; `UPDATE "crawl_seeds" SET "org_id" = (SELECT min("id") FROM "orgs");` (the single Belgian org today); then `ALTER COLUMN "org_id" SET NOT NULL`. Keep `--> statement-breakpoint` separators between statements.

- [ ] **Step 4: Scope the route and dedupe the crawler**

`GET`: `.where(eq(crawlSeeds.orgId, orgId))`. `POST`: insert `{ orgId, keyword: kw, enabled: true }` with `target: [crawlSeeds.orgId, crawlSeeds.keyword]`. `PATCH`: `where(and(eq(crawlSeeds.orgId, orgId), eq(crawlSeeds.keyword, keyword)))`. In `runKeywordSeed`, put the enabled keywords into a `Set` before querying.

- [ ] **Step 5: Run the tests to confirm they pass**

Run: `npx vitest run tests/api/crawlSeeds.test.ts tests/crawler/keywordSeed.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit** — `feat(seeds): scope crawl keywords per org`

---

### Task 2: Country profiles replace the Belgian scorer

**Files:**
- Create: `src/lib/signals/countryProfile.ts`, `src/lib/signals/profiles.ts`
- Delete: `src/lib/belgianSignals.ts`
- Move + modify: `tests/lib/belgianSignals.test.ts` → `tests/lib/countryProfile.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // countryProfile.ts
  export type CountryProfile = {
    code: string            // 'BE'
    name: string            // 'Belgium' (Settings option label)
    adjective: string       // 'Belgian' (UI copy: "strong Belgian signals")
    flag: string            // '🇧🇪'
    tlds: string[]          // ['be']
    rules: { name: string; weight: number; words: string[] }[]
    places: Record<string, string[]>   // display name -> variants
  }
  export type SignalResult = { score: number; signals: string[] }
  export function scoreAccount(p: CountryProfile, acc: { handle?: string | null; displayName?: string | null; description?: string | null }): SignalResult
  export const STRONG_SCORE = 3
  // profiles.ts
  export const PROFILES: Record<string, CountryProfile>   // keys 'BE', 'IT'
  export function profileFor(code: string | null | undefined): CountryProfile | null
  ```

- [ ] **Step 1: Write the failing tests**

Move the test file. Replace every `belgianSignals(x)` with `scoreAccount(PROFILES.BE, x)` and keep each expectation byte-for-byte, including the `'🇧🇪'` and `'.be handle'` signal names. Add:
- `IT: flag + city + nationality`: `scoreAccount(PROFILES.IT, { handle: 'a.bsky.social', description: '🇮🇹 italiana, vivo a Milano' })` → `score` `3 + 2 + 1`, and `signals` contains `'🇮🇹'`, `'Milan'`, `'nationality'`.
- `IT: .it handle`: `{ handle: 'mario.it' }` → `{ score: 3, signals: ['.it handle'] }`.
- `profileFor` returns `null` for `null`, `''` and `'XX'`, and returns the profile for `'it'` (case-insensitive).

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/lib/countryProfile.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`scoreAccount` keeps the existing algorithm exactly:
- a handle ending in one of `.${tld}` adds 3 (signal `.${tld} handle`);
- the flag adds 3 (signal = the flag);
- each rule whose words match adds its weight (signal = the rule name);
- any number of matching places adds 2 once (signals = place names in profile order).

Words compile through the existing Unicode-aware `word()` helper (move it from `belgianSignals.ts`). Cache compiled regexes per profile object in a `WeakMap`.

`PROFILES.BE` is today's data reshaped: rules `country`(3), `institution`(2), `nationality`(1), `football`(1). Same alternations, with the regex alternations split into word arrays; `'ku ?leuven'` and `'standard (?:de )?liège'` stay as regex-fragment strings.

`PROFILES.BE` also gets name `Belgium`, adjective `Belgian`, flag `🇧🇪`, tlds `['be']`.

`PROFILES.IT`: name `Italy`, adjective `Italian`, flag `🇮🇹`, tlds `['it']`, rules:
- `country`(3): `italia, italy, italie, italien`
- `institution`(2): `polimi, sapienza, unibo, bocconi, unimi, cnr, infn, rai`
- `nationality`(1): `italiano, italiana, italiani, italiane, italian`
- `football`(1): `juventus, juve, forza inter, forza napoli, as roma`

Places: `Rome: roma|rome`, `Milan: milano|milan`, `Naples: napoli|naples`, `Turin: torino|turin`, `Florence: firenze|florence`, `Bologna`, `Venice: venezia|venice`, `Genoa: genova|genoa`, `Palermo`, `Bari`, `Sicily: sicilia|sicily`, `Sardinia: sardegna|sardinia`, `Tuscany: toscana|tuscany`.

Add a code comment that the IT lists are a first draft for an Italian verifier to review.

- [ ] **Step 4: Run to confirm pass**

Run: `npx vitest run tests/lib/countryProfile.test.ts && npx tsc --noEmit`
Expected: PASS. tsc errors in `backlog/page.tsx` are expected until Task 3; fix them there and commit Tasks 2 and 3 separately but in order.

- [ ] **Step 5: Commit** — `refactor(signals): generalise Belgian scorer into country profiles`

---

### Task 3: Org country setting drives the backlog

**Files:**
- Modify: `src/db/schema.ts` (`orgs.country`), create `drizzle/0005_*.sql`
- Create: `src/app/api/org/settings/route.ts`
- Modify: `src/app/api/org/context/route.ts`, `src/lib/hooks/useOrg.ts`
- Modify: `src/app/(app)/backlog/page.tsx`, `src/app/(app)/settings/page.tsx`
- Test: `tests/app/orgSettings.test.ts` (new), `tests/app/orgContext.test.ts`, `tests/ui/backlogPage.test.tsx`, `tests/ui/settings.test.tsx`

**Interfaces:**
- Consumes: `profileFor`, `scoreAccount`, `STRONG_SCORE`, `PROFILES` (Task 2).
- Produces: `orgs.country: text | null`. `PATCH /vidi/api/org/settings` body `{ orgId: number, country: string | null }`, owner only. It responds `{ ok: true }`, or `400 { error: 'unknown_country' }`. `/api/org/context` adds `country: string | null`; `useOrg()` exposes `country`.

- [ ] **Step 1: Write the failing tests**
- `orgSettings.test.ts`: 401 without an actor; 403 when `assertOwner` throws `AuthzError`; `'XX'` → 400 `unknown_country`; `'it'` → update called with `{ country: 'IT' }`; `null` → `{ country: null }`.
- `orgContext.test.ts`: the owner case returns `country: 'BE'` from the org row.
- `backlogPage.test.tsx`:
  - with `country: 'IT'`, an item described "🇮🇹 Roma" sorts above one with no signal, and its badge reads `IT 5`;
  - with `country: null`, no score badge renders and the summary line has no "strong … signals" segment.
- `settings.test.tsx`: an owner sees a "Country profile" `<select>` with options "None", "Belgium (BE)", "Italy (IT)"; a helper does not see it.

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/app/orgSettings.test.ts tests/app/orgContext.test.ts tests/ui/backlogPage.test.tsx tests/ui/settings.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Schema: `country: text('country')`. Generate the migration and append `UPDATE "orgs" SET "country" = 'BE' WHERE "handle" = 'belgium-atmosphe.re';`.

Route: upper-case the input and validate it against `PROFILES` keys.

Backlog page:
- `const profile = profileFor(country)`;
- score with `scoreAccount(profile, …)` only when `profile` is set;
- the badge shows `${profile.code} ${score}`, with title `${profile.adjective} evidence score`;
- the summary says `strong ${profile.adjective} signals`;
- rename the `be` field on `Scored` to `sig`.

Settings page:
- add an owner-only Country profile card with a native `<select>` that PATCHes and then calls `refresh()`;
- change the keyword placeholder to `"City names, regions, institutions…"`.

Label options as `${profile.name} (${profile.code})`.

- [ ] **Step 4: Run to confirm pass**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit** — `feat(org): per-org country profile for backlog scoring`

---

### Task 4: Several memberships and an org switcher

**Files:**
- Modify: `src/lib/authz/session.ts` (`ActorSession`)
- Create: `src/app/api/org/select/route.ts`
- Modify: `src/app/api/org/context/route.ts`, `src/lib/hooks/useOrg.ts`, `src/app/(app)/layout.tsx`
- Test: `tests/app/orgSelect.test.ts` (new), `tests/app/orgContext.test.ts`, `tests/ui/layout.test.tsx`, `tests/ui/useOrg.test.tsx`

**Interfaces:**
- Produces:
  - `ActorSession = { did?: string; activeOrgId?: number }`.
  - `POST /vidi/api/org/select` body `{ orgId: number }`. It calls `assertActiveMember`, stores `activeOrgId` and returns `{ ok: true }`.
  - `/api/org/context` adds `orgs: { orgId: number; handle: string; role: 'owner' | 'helper' }[]` (all active memberships, ordered by `orgId`). The selected org is `activeOrgId` when it is in `orgs`, else `orgs[0]`.
  - `useOrg()` adds `orgs` and `selectOrg(orgId: number): Promise<void>`, which POSTs and then calls `refresh()`.

- [ ] **Step 1: Write the failing tests**
- `orgContext.test.ts`:
  - two memberships with session `activeOrgId: 2` → `orgId: 2`, `orgs.length === 2`;
  - `activeOrgId: 9` with no such membership → `orgId` = first;
  - a revoked membership is excluded from `orgs`.
- `orgSelect.test.ts`: 403 for a non-member (and the session is not saved); for a member, `session.activeOrgId === 2` and `save` is called.
- `layout.test.tsx`: with `orgs.length === 2`, a `combobox` labelled "Organization" renders, and changing it calls `selectOrg(2)`; with one org, no combobox renders.

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/app/orgContext.test.ts tests/app/orgSelect.test.ts tests/ui/layout.test.tsx tests/ui/useOrg.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

In the context route:
- read `getSession()` for `activeOrgId`;
- join `members` → `orgs` for handles;
- pick the selected org as described above.

The header replaces the static `orgHandle` span with a native `<select aria-label="Organization">` when there is more than one org, and keeps the span otherwise.

- [ ] **Step 4: Run to confirm pass**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit** — `feat(org): support several memberships with an org switcher`

---

## Phase 2: Trust

### Task 5: Narrow OAuth scopes

**Files:**
- Modify: `src/lib/atproto/oauthClient.ts`, `src/lib/atproto/orgAgent.ts`
- Modify: `src/app/api/auth/login/route.ts`, `src/app/page.tsx`
- Modify: `src/app/api/org/onboard/route.ts`, `src/components/OnboardOrg.tsx`
- Test: `tests/lib/oauthClient.test.ts`, `tests/app/orgOnboard.test.ts`, `tests/ui/login.test.tsx`, `tests/api/login.test.ts` (new)

**Interfaces:**
- Produces:
  ```ts
  // oauthClient.ts
  export const ORG_SCOPE = 'atproto repo:app.bsky.graph.verification'
  export const MEMBER_SCOPE = 'atproto'
  export function hasVerificationScope(scope: string): boolean  // true for ORG_SCOPE-granting or 'transition:generic' scopes
  // orgAgent.ts
  export async function getOrgScope(orgDid: string): Promise<string>  // granted scope from session.getTokenInfo()
  ```
  `POST /vidi/api/auth/login` body `{ handle: string; asOrg?: boolean }`. Onboard returns `400 { error: 'missing_verification_scope' }` when `hasVerificationScope` is false.

- [ ] **Step 1: Write the failing tests**
- `oauthClient.test.ts`: confidential and loopback metadata `scope === ORG_SCOPE`.
- `hasVerificationScope`:
  - `'atproto repo:app.bsky.graph.verification'` → true;
  - `'atproto transition:generic'` → true (the old Belgian session keeps working);
  - `'atproto'` → false;
  - `'atproto repo:app.bsky.feed.post'` → false.
- `login.test.ts`: `asOrg: true` → `authorize` is called with `{ scope: ORG_SCOPE }`; when omitted → `{ scope: MEMBER_SCOPE }`.
- `orgOnboard.test.ts`:
  - `getOrgScope` resolves `'atproto'` → 400 `missing_verification_scope` and no insert;
  - with the scope present, the handle comes from a mocked `getPublicAppViewAgent().getProfile`, and `getOrgAgent` is not used for the profile read.
- `login.test.tsx`: a checkbox labelled "I'm signing in as the verifier account" is unchecked by default, and ticking it sends `asOrg: true`.

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/lib/oauthClient.test.ts tests/app/orgOnboard.test.ts tests/ui/login.test.tsx tests/api/login.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`hasVerificationScope` splits on whitespace and checks for `transition:generic` or a `repo:` token whose collection is `app.bsky.graph.verification` (allow a `?action=` suffix).

`getOrgScope` restores the session and returns `(await session.getTokenInfo()).scope`.

The onboard route:
- swaps the profile read to `getPublicAppViewAgent()`;
- stores the granted scope in `orgs.scopes` instead of the hard-coded string.

`OnboardOrg` maps `missing_verification_scope` to: "Sign out, then sign in again as the verifier account with 'I'm signing in as the verifier account' ticked."

The checkbox helper text on the login page: "Vidi will only be able to create and delete verification records on this account."

- [ ] **Step 4: Run to confirm pass**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Smoke-test on loopback**

With `VIDI_PUBLIC_URL=http://127.0.0.1:3000/vidi`, sign in with the box ticked on a test account. The consent screen must list only verification-record access. Verify one account, then revoke it; both must succeed.

If the PDS rejects the granular scope, stop and report back. Do not fall back to `transition:generic` silently.

- [ ] **Step 6: Commit** — `feat(auth): request only verification-record scope for org accounts`

---

### Task 6: Owner can disconnect Vidi

**Files:**
- Create: `src/app/api/org/disconnect/route.ts`
- Modify: `src/app/(app)/settings/page.tsx`, `src/app/(app)/search/page.tsx`, `src/app/(app)/backlog/page.tsx`
- Test: `tests/app/orgDisconnect.test.ts` (new), `tests/ui/settings.test.tsx`, `tests/ui/searchPageVerify.test.tsx`

**Interfaces:**
- Produces: `POST /vidi/api/org/disconnect` body `{ orgId: number }`, owner only. It calls `getOAuthClient().revoke(org.did)` (errors logged and swallowed), deletes the `oauthSession` row for `org.did`, sets `orgs.status = 'disconnected'`, and returns `{ ok: true }`. Re-onboarding resets the status to `active` (existing upsert).

- [ ] **Step 1: Write the failing tests**
- `orgDisconnect.test.ts`:
  - 403 for a helper;
  - for an owner: `revoke` is called with the org DID, the `oauthSession` delete runs, and the status update sets `'disconnected'`;
  - when `revoke` rejects, the delete and the status update still run and the response is `{ ok: true }`.
- `settings.test.tsx`: an owner sees a "Disconnect Vidi from @handle" button; clicking it opens a confirm, and confirming POSTs.
- `searchPageVerify.test.tsx`: a verify response `403 { error: 'org_inactive' }` shows the toast "This org has disconnected Vidi. The owner can reconnect by onboarding again."

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/app/orgDisconnect.test.ts tests/ui/settings.test.tsx tests/ui/searchPageVerify.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement.** Use the existing `Button`; a `window.confirm` is acceptable for the confirm step. Apply the same toast mapping in the backlog page's verify handler.

- [ ] **Step 4: Run to confirm pass**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit** — `feat(org): let owners disconnect Vidi and revoke its token`

---

### Task 7: Activity log page

**Files:**
- Create: `src/app/api/activity/route.ts`, `src/app/(app)/activity/page.tsx`
- Modify: `src/app/(app)/layout.tsx` (nav link)
- Test: `tests/api/activity.test.ts`, `tests/ui/activity.test.tsx` (new)

**Interfaces:**
- Produces: `GET /vidi/api/activity?orgId=N&before=<id>`, active member. It returns `{ items: { id, action: 'verify'|'revoke', outcome, subjectDid, subjectHandle: string|null, actorDid, actorHandle: string|null, recordUri: string|null, createdAt }[], nextBefore: number|null }`. Items are newest first, 100 per page, and filtered by `orgId`.
  - `subjectHandle` is a left join on `accounts`.
  - `actorHandle` is a left join on `members` (same `orgId`), falling back to `orgs.handle` when the actor is the org itself.

- [ ] **Step 1: Write the failing tests**
- `activity.test.ts`: 403 for a non-member; the query filters on `verificationActions.orgId`; `nextBefore` is the last item's `id` when 100 rows come back, else `null`.
- `activity.test.tsx`: renders "@alice verified @bob · 2 h ago"; an `error` outcome renders a destructive badge; "Load more" fetches with `before`.

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/api/activity.test.ts tests/ui/activity.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement.** Add the nav link `{ href: '/activity', label: 'Activity' }` for all members. Format relative times with `Intl.RelativeTimeFormat` (no new dependency).

- [ ] **Step 4: Run to confirm pass**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit** — `feat(activity): show the org's verify/revoke log to its members`

---

### Task 8: "What Vidi stores" page and neutral branding

**Files:**
- Create: `src/app/about/page.tsx` (public, outside the `(app)` auth group)
- Modify: `src/lib/atproto/oauthClient.ts` (`policy_uri`), `src/app/page.tsx` and `src/components/SiteFooter.tsx` (links), `.env.example`, `README.md`
- Test: `tests/lib/oauthClient.test.ts`, `tests/ui/about.test.tsx` (new)

**Interfaces:**
- Produces: the confidential client metadata gains `policy_uri: \`${publicUrl}/about\``.

- [ ] **Step 1: Write the failing tests**
- `oauthClient.test.ts`: `policy_uri === 'https://vidi.example.org/vidi/about'` for that `VIDI_PUBLIC_URL`.
- `about.test.tsx`: the page renders the headings "What Vidi can do with your account", "What Vidi stores", "How to leave".

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/lib/oauthClient.test.ts tests/ui/about.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

The page copy must state these facts:
- Org accounts grant only `repo:app.bsky.graph.verification` (create or delete verification records). Helper accounts grant only identity.
- Stored per org:
  - the encrypted OAuth session;
  - members (DID, handle, role);
  - the backlog;
  - the keyword seeds;
  - the verify/revoke log.
- Public profile data of crawled accounts is shared across orgs.
- Leaving: Settings → Disconnect revokes the token at once. Full deletion of an org's data is on request to the operator (link to the footer contact).

Also:
- add an "About & data" link on the login page and in the footer;
- set the `.env.example` `VIDI_PUBLIC_URL` to `https://vidi.example.org/vidi`;
- update the comment in `org/context/route.ts` to not name a country;
- add a README section "Hosting several verifiers" covering onboarding, the country profiles PR path, and the domain-move note from the Ops Checklist.

- [ ] **Step 4: Run to confirm pass**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit** — `docs(about): public page on what Vidi stores and can do`

---

## Phase 3: Self-serve onboarding

### Task 9: Trusted Verifier list members can onboard themselves

**Files:**
- Modify: `src/lib/allowlist.ts`, `src/app/api/org/onboard/route.ts`, `src/app/api/org/context/route.ts`, `src/lib/hooks/useOrg.ts`, `src/app/(app)/layout.tsx`, `src/components/OnboardOrg.tsx`
- Test: `tests/lib/allowlist.test.ts`, `tests/app/orgOnboard.test.ts`, `tests/app/orgContext.test.ts`, `tests/ui/layout.test.tsx`, `tests/ui/useOrg.test.tsx`, `tests/ui/members.test.tsx`

**Interfaces:**
- Produces: `export async function canOnboard(did: string): Promise<boolean>` = `isAllowlisted(did)` OR a row in `trustedVerifiers` with that DID. `/api/org/context` renames its `isAllowlisted` field to `canOnboard`, and so does `useOrg()`. The onboard route's 403 error becomes `not_eligible`.

- [ ] **Step 1: Write the failing tests**
- `allowlist.test.ts`:
  - `canOnboard` is true for a trusted-verifier DID that is not allowlisted;
  - true for an allowlisted DID;
  - false for neither;
  - false for a DID whose allowlist row has `enabled: false` and that is not a trusted verifier.
- `orgOnboard.test.ts`: `not_eligible` replaces `not_allowlisted`.
- `orgContext.test.ts` and the UI tests: rename the field in fixtures and assertions.
- `OnboardOrg` maps `not_eligible` to: "Only accounts on the Trusted Verifier list can set up an org. Ask the Vidi operator to add you."

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/lib/allowlist.test.ts tests/app tests/ui`
Expected: FAIL.

- [ ] **Step 3: Implement.** Keep `isAllowlisted` and the superadmin allowlist route as they are: they remain the manual fallback for a verifier that is not on the list yet.

- [ ] **Step 4: Run to confirm pass**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit** — `feat(onboard): let Trusted Verifier list members onboard themselves`

---

## Ops Checklist (not code; for the operator after the phases ship)

- **Before merging:** run the loopback smoke test from Task 5 Step 5 on a test account.
- **After Phase 2 deploys:** the Belgian owner signs in as `belgium-atmosphe.re` (verification access is now requested automatically for an active org account), then verifies and revokes one test account to confirm writes work.
- **Neutral domain (open decision):** pick a hostname that isn't country-specific. Then:
  1. add an Nginx server block proxying `/vidi` to `127.0.0.1:3010`;
  2. issue a TLS cert;
  3. set `VIDI_PUBLIC_URL` in `/opt/vidi/.env`;
  4. redeploy.

  The OAuth `client_id` changes with the domain, so every user, org accounts included, signs in once more. Keep the old hostname redirecting to the new one.
- **Backups:** the database now holds other orgs' (encrypted) sessions, so add a nightly `pg_dump` of the `vidi_pg` volume, stored off-box.
- **Check `TRUSTED_VERIFIER_LIST_URIS`:** confirm it points at the list that includes the #teamEurope verifiers before announcing Phase 3.
