/**
 * Turns anything thrown into a readable reason.
 * @param error what was thrown
 * @returns the error's message, or the value as text
 */
export function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}
