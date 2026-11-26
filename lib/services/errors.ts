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
