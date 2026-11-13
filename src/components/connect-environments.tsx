"use client"

import { useState, useSyncExternalStore } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { connectionRevision, isConnected, serverRevision, setConnection, sitecoreAction, subscribeConnection } from "@/lib/browser-session"
import type { Connections } from "@/lib/sitecore/public-transfer"

const empty = () => ({ host: "", clientId: "", clientSecret: "" })

export function ConnectEnvironments() {
  useSyncExternalStore(subscribeConnection, connectionRevision, serverRevision)
  const connected = isConnected()
  const [source, setSource] = useState(empty)
  const [destination, setDestination] = useState(empty)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function connect(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("")
    try {
      const data = await sitecoreAction<Connections>("connect", { credentials: { source, destination } })
      setConnection(data)
      setSource(empty()); setDestination(empty())
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to connect.") }
    finally { setBusy(false) }
  }

  return <Card>
    <CardHeader>
      <CardTitle>{connected ? "Your environments are connected" : "Connect your SitecoreAI environments"}</CardTitle>
      <CardDescription>
        Use environment automation credentials with Organization Admin or Owner permissions.
        The app exchanges credentials with Sitecore and keeps the resulting tokens only in this tab’s memory.
        Content and history stay in Sitecore. Reloading or closing the tab clears the connection.
      </CardDescription>
    </CardHeader>
    <CardContent>
      {connected ? <Button variant="outline" onClick={() => {
        if (window.confirm("Disconnect this tab? Any draft or chunk-forwarding work in this tab will stop. Imports already accepted by Sitecore may continue.")) setConnection(null)
      }}>Disconnect environments</Button> : <form onSubmit={connect} className="space-y-5" autoComplete="off">
        <div className="grid gap-6 lg:grid-cols-2">
          {(["source", "destination"] as const).map(side => {
            const value = side === "source" ? source : destination
            const change = side === "source" ? setSource : setDestination
            return <fieldset key={side} disabled={busy} className="space-y-3 rounded-lg border p-4">
              <legend className="px-2 text-sm font-medium capitalize">{side} authoring environment</legend>
              {(["host", "clientId", "clientSecret"] as const).map(field => <div className="space-y-1" key={field}>
                <Label htmlFor={`${side}-${field}`}>{field === "host" ? "Environment host" : field === "clientId" ? "Client ID" : "Client secret"}</Label>
                <Input id={`${side}-${field}`} type={field === "clientSecret" ? "password" : "text"} value={value[field]}
                  placeholder={field === "host" ? "your-environment.sitecorecloud.io" : undefined}
                  onChange={event => change(old => ({ ...old, [field]: event.target.value }))} required autoComplete="off" spellCheck={false} />
              </div>)}
            </fieldset>
          })}
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <p className="text-xs text-muted-foreground">Connect only environments you are authorized to manage. Transfers write to the destination master database; publishing remains a separate action.</p>
        <Button type="submit" disabled={busy}>{busy ? "Checking SitecoreAI access…" : "Connect environments"}</Button>
      </form>}
    </CardContent>
  </Card>
}
