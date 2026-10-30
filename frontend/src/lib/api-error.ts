/** Machine-readable `code` the backend adds to some error responses (e.g. "has_contracts"). */
export function apiErrorCode(error: unknown): string | undefined {
  const data = (error as { data?: unknown } | null)?.data;
  if (data && typeof data === 'object' && 'code' in data && typeof data.code === 'string') return data.code;
  return undefined;
}
