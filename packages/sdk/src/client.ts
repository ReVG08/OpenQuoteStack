import type {
  ListOptions,
  Page,
  EstimatorResource,
  EstimateResource,
  LeadResource,
  CreateEstimate,
} from "./api-types.js";
export class OpenQuoteStackError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly requestId?: string,
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "OpenQuoteStackError";
  }
}
export type ClientOptions = {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
};
/** Server-side API client. Keep API keys out of browser bundles. Requires Fetch and AbortSignal.timeout. */
export class OpenQuoteStack {
  private readonly baseUrl: string;
  private readonly transport: typeof globalThis.fetch;
  private readonly timeout: number;
  private readonly key: string;
  constructor(options: ClientOptions) {
    const url = new URL(options.baseUrl);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.protocol !== "https:" &&
        !(
          url.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
        ))
    )
      throw new TypeError(
        "baseUrl must use HTTPS or loopback HTTP without credentials, query or fragment",
      );
    if (!options.apiKey || /[\r\n]/.test(options.apiKey))
      throw new TypeError("apiKey is required");
    this.baseUrl = url.href.replace(/\/$/, "");
    this.key = options.apiKey;
    this.transport = options.fetch ?? globalThis.fetch;
    this.timeout = options.timeoutMs ?? 15000;
    if (
      !Number.isInteger(this.timeout) ||
      this.timeout < 1 ||
      this.timeout > 120000 ||
      !this.transport
    )
      throw new TypeError(
        "Fetch and a timeout between 1 and 120000 ms are required",
      );
  }
  private async request<T>(
    path: string,
    method = "GET",
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<T> {
    let response: Response;
    try {
      response = await this.transport(`${this.baseUrl}/api/v1/${path}`, {
        method,
        redirect: "error",
        credentials: "omit",
        signal: AbortSignal.timeout(this.timeout),
        headers: {
          Authorization: `Bearer ${this.key}`,
          Accept: "application/json",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new OpenQuoteStackError(
        0,
        "network_error",
        "The API request could not be completed.",
      );
    }
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new OpenQuoteStackError(
        response.status,
        "invalid_response",
        "The server did not return JSON.",
      );
    }
    if (!response.ok) {
      const error = (
        value as {
          error?: { code?: string; message?: string; requestId?: string };
        }
      )?.error;
      throw new OpenQuoteStackError(
        response.status,
        error?.code ?? "request_failed",
        error?.message ?? "API request failed.",
        error?.requestId,
        response.headers.has("Retry-After")
          ? Number(response.headers.get("Retry-After"))
          : undefined,
      );
    }
    return value as T;
  }
  private list<T>(resource: string, options: ListOptions = {}) {
    const query = new URLSearchParams();
    if (options.limit !== undefined) query.set("limit", String(options.limit));
    if (options.cursor) query.set("cursor", options.cursor);
    return this.request<Page<T>>(`${resource}${query.size ? `?${query}` : ""}`);
  }
  private async get<T>(resource: string, id: string) {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id))
      throw new TypeError("Invalid resource ID");
    return (await this.request<{ data: T }>(`${resource}/${id}`)).data;
  }
  readonly estimators = {
    list: (options?: ListOptions) =>
      this.list<EstimatorResource>("estimators", options),
    get: (id: string) => this.get<EstimatorResource>("estimators", id),
  };
  readonly estimates = {
    list: (options?: ListOptions) =>
      this.list<EstimateResource>("estimates", options),
    get: (id: string) => this.get<EstimateResource>("estimates", id),
    create: async (
      input: CreateEstimate,
      options: { idempotencyKey?: string } = {},
    ) =>
      (
        await this.request<{ data: EstimateResource }>(
          "estimates",
          "POST",
          input,
          options.idempotencyKey ?? globalThis.crypto.randomUUID(),
        )
      ).data,
  };
  readonly leads = {
    list: (options?: ListOptions) => this.list<LeadResource>("leads", options),
    get: (id: string) => this.get<LeadResource>("leads", id),
  };
}
