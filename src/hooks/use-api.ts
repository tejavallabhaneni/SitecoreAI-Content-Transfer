"use client"

import { useCallback, useEffect, useState } from "react"

export function useApi<T>(url: string | null, refreshMs = 0) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!url) return
    try {
      const res = await fetch(url, { cache: "no-store" })
      const body = (await res.json().catch(() => null)) as
        | T
        | { error?: string }
        | null
      if (!res.ok) {
        const message =
          body && typeof body === "object" && "error" in body && body.error
            ? body.error
            : `Request failed (${res.status})`
        throw new Error(message)
      }
      setData(body as T)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }, [url])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client data loader
    void reload()
  }, [reload])

  useEffect(() => {
    if (!refreshMs || !url) return
    const id = window.setInterval(() => {
      void reload()
    }, refreshMs)
    return () => window.clearInterval(id)
  }, [reload, refreshMs, url])

  return { data, error, loading, reload, setData }
}

export async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const payload = (await res.json().catch(() => null)) as T | { error?: string } | null
  if (!res.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && payload.error
        ? payload.error
        : `Request failed (${res.status})`
    throw new Error(message)
  }
  return payload as T
}

export async function patchJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const payload = (await res.json().catch(() => null)) as T | { error?: string } | null
  if (!res.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && payload.error
        ? payload.error
        : `Request failed (${res.status})`
    throw new Error(message)
  }
  return payload as T
}
