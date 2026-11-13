import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function LoginPanel() {
  return <div className="mx-auto max-w-2xl pt-16">
    <Card>
      <CardHeader>
        <CardTitle>SitecoreAI Content Transfer</CardTitle>
        <CardDescription>Sign in with an authorized GitHub account to use this installation.</CardDescription>
      </CardHeader>
      <CardContent>
        <a href="/api/auth/github" className="inline-flex rounded-lg bg-primary px-4 py-2 text-primary-foreground">
          Sign in with GitHub
        </a>
      </CardContent>
    </Card>
  </div>
}
