/**
 * Supabase PostgREST provides access to a managed PostgreSQL database.
 * All requests are server-side with the service-role key, never client-side.
 * RLS stays enabled; only the application backend is allowed to use this key.
 */
export type TransferRow = {
  id: string
  owner_login: string
  source_host: string
  destination_host: string
  item_path: string
  scope: "SingleItem" | "ItemAndDescendants"
  merge_strategy: "KeepExistingItem" | "OverrideExistingItem"
  status: "pending_preflight" | "queued" | "running" | "succeeded" | "failed"
  operation_id: string | null
  progress: number
  completed_chunks: number
  total_chunks: number
  transfer_files: string[]
  last_error: string | null
  created_at: string
  updated_at: string
  preflight_details?: unknown
  preflight_verified_at?: string | null
  approved_at?: string | null
  worker_id?: string | null
  attempts?: number
}

function config(): { base: string; key: string } {
  const base = process.env.SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!base || !key) throw new Error("PostgreSQL backend is not configured")
  const url = new URL(base)
  if (
    url.protocol !== "https:" ||
    !/^[a-z0-9-]+\.supabase\.co$/i.test(url.hostname) ||
    url.pathname !== "/" || url.search || url.hash
  ) throw new Error("Supabase project URL must be an HTTPS supabase.co origin")
  return { base: url.origin, key }
}

export async function db<T>(
  path: string,
  init: { method?: string; body?: unknown; prefer?: string } = {},
): Promise<T> {
  const { base, key } = config()
  const response = await fetch(`${base}/rest/v1/${path}`, {
    method: init.method ?? "GET",
    headers: {
      "apikey": key,
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...(init.prefer ? { "Prefer": init.prefer } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) {
    // Avoid returning the raw database body to the browser.
    throw new Error(`Database operation failed (HTTP ${response.status})`)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

function ownerQuery(owner: string): string {
  return encodeURIComponent(owner.toLowerCase())
}

export function listTransfers(owner: string): Promise<TransferRow[]> {
  return db<TransferRow[]>(`transfer_jobs?owner_login=eq.${ownerQuery(owner)}&order=created_at.desc&limit=100`)
}

export async function getTransfer(owner: string, id: string): Promise<TransferRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const result = await db<TransferRow[]>(
    `transfer_jobs?id=eq.${encodeURIComponent(id)}&owner_login=eq.${ownerQuery(owner)}&limit=1`,
  )
  return result[0] ?? null
}

export async function createTransfer(input: {
  owner_login: string
  source_host: string
  destination_host: string
  item_path: string
  scope: TransferRow["scope"]
  merge_strategy: TransferRow["merge_strategy"]
}): Promise<TransferRow> {
  const result = await db<TransferRow[]>("transfer_jobs", {
    method: "POST",
    body: { ...input, status: "pending_preflight" },
    prefer: "return=representation",
  })
  if (!result[0]) throw new Error("Database did not return a transfer record")
  return result[0]
}


export async function storePreflight(owner: string, id: string, report: unknown): Promise<TransferRow | null> {
  const rows = await db<TransferRow[]>(
    `transfer_jobs?id=eq.${encodeURIComponent(id)}&owner_login=eq.${ownerQuery(owner)}&status=eq.pending_preflight`,
    {
      method: "PATCH",
      body: { preflight_details: report, preflight_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      prefer: "return=representation",
    },
  )
  return rows[0] ?? null
}

export async function approvePreflight(owner: string, id: string, checkedAt: string): Promise<TransferRow | null> {
  const rows = await db<TransferRow[]>(
    `transfer_jobs?id=eq.${encodeURIComponent(id)}&owner_login=eq.${ownerQuery(owner)}&status=eq.pending_preflight&preflight_verified_at=eq.${encodeURIComponent(checkedAt)}`,
    {
      method: "PATCH",
      body: { approved_at: new Date().toISOString(), status: "queued", updated_at: new Date().toISOString() },
      prefer: "return=representation",
    },
  )
  return rows[0] ?? null
}

export async function claimTransfer(worker: string): Promise<TransferRow | null> {
  const rows = await db<TransferRow[]>("rpc/claim_next_transfer_job", {
    method: "POST",
    body: { worker_name: worker },
  })
  return rows[0] ?? null
}

export async function workerUpdate(
  jobId: string,
  worker: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const rows = await db<TransferRow[]>(
    `transfer_jobs?id=eq.${encodeURIComponent(jobId)}&worker_id=eq.${encodeURIComponent(worker)}&status=eq.running`,
    {
      method: "PATCH",
      body: { ...patch, updated_at: new Date().toISOString() },
      prefer: "return=representation",
    },
  )
  if (rows.length !== 1) throw new Error("Worker lost exclusive job ownership")
}
