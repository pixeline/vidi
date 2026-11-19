export const ORG_DISCONNECTED_MESSAGE =
  'This org has disconnected Vidi. The owner can turn it back on with Reconnect.'

/** Toast text for a non-ok /api/verify response. */
export async function verifyErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string }
    if (body?.error === 'org_inactive') return ORG_DISCONNECTED_MESSAGE
  } catch {
    /* non-JSON error body */
  }
  return 'Verification failed'
}
