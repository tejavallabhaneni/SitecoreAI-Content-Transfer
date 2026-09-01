"use client"

import { AlertCircle } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useApi } from "@/hooks/use-api"
import { kindLabel } from "@/lib/format"
import type { Environment } from "@/lib/types"

export function EnvironmentsPanel() {
  const { data, error, loading, reload } = useApi<{ environments: Environment[] }>(
    "/api/environments",
  )
  const environments = data?.environments ?? []

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Environments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connected XM Cloud endpoints this workspace can transfer between. Disconnected targets
          cannot be selected as a destination.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Environments could not load</AlertTitle>
          <AlertDescription>
            {error}{" "}
            <button type="button" className="font-medium underline" onClick={() => reload()}>
              Try again
            </button>
          </AlertDescription>
        </Alert>
      ) : null}

      {loading && !data ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      ) : null}

      {!loading && !error && environments.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No environments connected</CardTitle>
            <CardDescription>
              Add an XM Cloud Authoring, Preview, or Live endpoint to start transferring content.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {environments.map((env) => (
          <Card key={env.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle>{env.name}</CardTitle>
                <Badge variant={env.connected ? "secondary" : "destructive"}>
                  {env.connected ? "Connected" : "Disconnected"}
                </Badge>
              </div>
              <CardDescription>
                {kindLabel(env.kind)} · {env.region}
              </CardDescription>
            </CardHeader>
            <CardContent className="font-mono text-xs text-muted-foreground">{env.host}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
