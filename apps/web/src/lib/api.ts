import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { AnswerValidationError } from "@openquotestack/engine";
import {
  PlatformError,
  createPlatform,
} from "@openquotestack/database/platform";
import { getDatabase } from "@openquotestack/database";
import { jsonBody } from "./request-body";
import { operatorLog } from "./logging";
export async function apiRequest(request: Request, path: string[]) {
  const requestId = randomUUID();
  const headers = {
    "X-Request-Id": requestId,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  try {
    const platform = createPlatform(getDatabase());
    await platform.consumeRate("api-global", 2000);
    const bearer =
      request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1] ?? "";
    const principal = await platform.authenticate(bearer);
    const [resource, id] = path;
    if (
      !resource ||
      !["estimators", "estimates", "leads", "webhooks"].includes(resource) ||
      path.length > 2 ||
      (id && !/^[a-zA-Z0-9_-]{1,100}$/.test(id))
    )
      throw new PlatformError("not_found", 404, "Endpoint not found.");
    if (resource === "webhooks") {
      if (request.method === "GET" && !id)
        return Response.json(
          await platform.apiWebhooks(principal, "list", null),
          { headers },
        );
      if (request.method === "POST" && !id) {
        let input: unknown;
        try {
          input = await jsonBody(request);
        } catch {
          throw new PlatformError(
            "invalid_request",
            400,
            "A valid JSON body under 250 KB is required.",
          );
        }
        return Response.json(
          await platform.apiWebhooks(principal, "create", input),
          { status: 201, headers },
        );
      }
      if (request.method === "DELETE" && id)
        return Response.json(
          await platform.apiWebhooks(principal, "disable", id),
          { headers },
        );
      return Response.json(
        {
          error: {
            code: "method_not_allowed",
            message: "Method not allowed.",
            requestId,
          },
        },
        {
          status: 405,
          headers: { ...headers, Allow: id ? "DELETE" : "GET, POST" },
        },
      );
    }
    const kind = resource as "estimators" | "estimates" | "leads";
    if (request.method === "GET") {
      if (id)
        return Response.json(
          { data: await platform.getResource(principal, kind, id) },
          { headers },
        );
      const search = new URL(request.url).searchParams;
      if ([...search.keys()].some((key) => !["limit", "cursor"].includes(key)))
        throw new PlatformError(
          "invalid_request",
          400,
          "Unknown query parameter.",
        );
      return Response.json(
        await platform.listResources(
          principal,
          kind,
          Object.fromEntries(search),
        ),
        { headers },
      );
    }
    if (request.method === "POST" && kind === "estimates" && !id) {
      let body: unknown;
      try {
        body = await jsonBody(request);
      } catch {
        throw new PlatformError(
          "invalid_request",
          400,
          "A valid JSON body under 250 KB is required.",
        );
      }
      const result = await platform.submitEstimate(
        principal,
        body,
        request.headers.get("Idempotency-Key") ?? "",
      );
      return Response.json(
        { data: result.estimate },
        {
          status: result.replayed ? 200 : 201,
          headers: {
            ...headers,
            "Idempotency-Replayed": String(result.replayed),
          },
        },
      );
    }
    return Response.json(
      {
        error: {
          code: "method_not_allowed",
          message: "Method not allowed.",
          requestId,
        },
      },
      {
        status: 405,
        headers: {
          ...headers,
          Allow: kind === "estimates" && !id ? "GET, POST" : "GET",
        },
      },
    );
  } catch (error) {
    let status = 500,
      code = "internal_error",
      message = "The request could not be completed.";
    if (error instanceof PlatformError) {
      status = error.status;
      code = error.code;
      message = error.message;
    } else if (
      error instanceof ZodError ||
      error instanceof AnswerValidationError
    ) {
      status = 422;
      code = "validation_error";
      message = "The request contains invalid fields or answers.";
    }
    if (status === 500)
      operatorLog({
        level: "error",
        operation: "api.request",
        requestId,
        errorCategory: "internal_error",
      });
    return Response.json(
      { error: { code, message, requestId } },
      {
        status,
        headers: {
          ...headers,
          ...(status === 429 ? { "Retry-After": "60" } : {}),
          ...(status === 401
            ? { "WWW-Authenticate": 'Bearer realm="OpenQuoteStack"' }
            : {}),
        },
      },
    );
  }
}
