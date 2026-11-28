/**
 * A request's body as text, or null when it is larger than `max` bytes. A `Content-Length` above
 * `max` is refused before anything is read; otherwise the body is read as it streams in and given up
 * at the first byte past `max`, so a large body is never held whole (the iPhone app's routes, ADR 0088).
 */
export async function readBody(request: Request, max: number): Promise<string | null> {
  if (Number(request.headers.get("content-length") ?? "0") > max) return null;
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
