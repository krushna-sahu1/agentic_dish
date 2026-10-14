/** A user-facing error from the service layer (safe to show / give to the agent). */
export class ServiceError extends Error {
  constructor(
    message: string,
    public code: string = "invalid",
    public data?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function assertOk<T>(res: { data: T | null; error: { message: string } | null }, what = "query"): T {
  if (res.error) throw new Error(`${what} failed: ${res.error.message}`);
  return res.data as T;
}
