/** Enforce the limit while streaming, including requests without Content-Length. */
export async function boundedBody(
  request: Request,
  max: number,
): Promise<Uint8Array> {
  if (Number(request.headers.get("content-length") ?? 0) > max)
    throw new Error("Body too large");
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) throw new Error("Body too large");
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel();
    throw error;
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }
  return body;
}
export async function jsonBody(
  request: Request,
  max = 250000,
): Promise<unknown> {
  if (
    request.headers.get("content-type")?.split(";")[0]?.trim() !==
    "application/json"
  )
    throw new Error("JSON content type required");
  return JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(
      await boundedBody(request, max),
    ),
  );
}
