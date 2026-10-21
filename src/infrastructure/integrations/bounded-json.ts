import "server-only";

/** Bound both inbound bodies and external API responses before parsing. */
export async function readBoundedJson(request: Request | Response, limit = 5_000_000): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("リクエストが空です。");
  const chunks: Uint8Array[] = []; let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > limit) { await reader.cancel(); throw new Error("リクエストが大きすぎます。"); }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
