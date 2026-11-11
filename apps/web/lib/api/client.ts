/** Extract an HTTP status from an ofetch/Nuxt fetch error. */
export function errorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const status = (error as { status?: unknown }).status
  return typeof status === 'number' ? status : undefined
}

export function isUnauthorized(error: unknown): boolean {
  return errorStatus(error) === 401
}

export function isNotFound(error: unknown): boolean {
  return errorStatus(error) === 404
}
