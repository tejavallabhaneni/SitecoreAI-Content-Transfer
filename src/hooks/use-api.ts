"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { connectionRevision, serverRevision, sessionRead, subscribeConnection } from "@/lib/browser-session"

export function useApi<T>(url: string | null, refreshMs = 0) {
  const revision = useSyncExternalStore(subscribeConnection, connectionRevision, serverRevision)
  const requestNumber = useRef(0)
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!url) return
    const requestId = ++requestNumber.current
    const requestedRevision = connectionRevision()
    try {
      const body = await sessionRead<T>(url)
      if (requestId !== requestNumber.current || requestedRevision !== connectionRevision()) return
      setData(body)
      setError(null)
    } catch (err) {
      if (requestId !== requestNumber.current || requestedRevision !== connectionRevision()) return
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      if (requestId === requestNumber.current && requestedRevision === connectionRevision()) setLoading(false)
    }
  }, [url])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clear prior user's data when a tab connection changes
    setData(null)
    void reload()
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps -- monotonic request generation, not a DOM ref
      requestNumber.current++
    }
  }, [reload, revision])

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

