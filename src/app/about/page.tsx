import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { VidiMark } from '@/components/VidiMark'

// Public page (outside the (app) auth group): a verifier org can read what
// Vidi does with its account before signing in. Also served as the OAuth
// client's policy_uri.
export default function AboutPage() {
  return (
    <main className="flex flex-1 justify-center p-4">
      <div className="flex w-full max-w-2xl flex-col gap-4">
        <div className="flex items-center gap-3">
          <VidiMark className="size-10 shrink-0" />
          <h1 className="text-2xl font-semibold tracking-tight">About Vidi and your data</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2} className="text-lg font-semibold">What Vidi can do with your account</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p>
              If you sign in as a verifier account, Vidi gets one permission:{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                repo:app.bsky.graph.verification
              </code>
              . It lets Vidi create or delete verification records on that account.
            </p>
            <p>
              Vidi cannot post, follow, change your profile, or read your messages. If you sign in
              as a helper, Vidi only learns who you are. It gets no permission to act on your
              account.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2} className="text-lg font-semibold">What Vidi stores</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p>For each verifier organization, Vidi stores:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>the encrypted OAuth session for the account;</li>
              <li>the members: their DID, handle and role;</li>
              <li>the backlog of accounts waiting for review;</li>
              <li>the keyword seeds used to find accounts;</li>
              <li>the log of every verify and revoke, which members can read on the Activity page.</li>
            </ul>
            <p>
              Vidi also keeps public profile data for the accounts it crawls. That data is already
              public on Bluesky. It is shared by all organizations, not kept per organization.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2} className="text-lg font-semibold">How to leave</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p>
              An owner can open Settings and choose Disconnect. Vidi revokes its token at once and
              can no longer act on the account.
            </p>
            <p>
              To have all of your organization&apos;s data deleted, ask the{' '}
              <a
                href="https://mu.social/@pixeline.be"
                target="_blank"
                rel="me noopener noreferrer"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                operator
              </a>
              .
            </p>
          </CardContent>
        </Card>

        <p className="text-sm">
          <Link href="/" className="font-medium text-primary underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
