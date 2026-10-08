export class AccessDeniedError extends Error {
  constructor() {
    super("Resource not found or access denied");
    this.name = "AccessDeniedError";
  }
}
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}
export type Actor = { userId: string };
