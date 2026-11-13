/** Limit request body bytes even when Content-Length is absent or dishonest. */
export async function readLimitedJson(request: Request, limit = 16_384): Promise<unknown> {
  const length = Number(request.headers.get("content-length") ?? "0")
  if (!Number.isFinite(length) || length < 0 || length > limit) {
    throw new Error("Request too large")
  }
  const stream = request.body
  if (!stream) throw new Error("Missing JSON request body")
  const reader = stream.getReader()
  const parts: Uint8Array[] = []
  let bytes = 0
  try {
    while (true) {
      const result = await reader.read()
      if (result.done) break
      bytes += result.value.byteLength
      if (bytes > limit) {
        await reader.cancel()
        throw new Error("Request too large")
      }
      parts.push(result.value)
    }
  } finally {
    reader.releaseLock()
  }
  const buffer = Buffer.concat(parts.map(part => Buffer.from(part)))
  return JSON.parse(buffer.toString("utf8")) as unknown
}
