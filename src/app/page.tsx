import { JobsDashboard } from "@/components/jobs-dashboard"
import { LoginPanel } from "@/components/login-panel"
import { currentUser } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  let authenticated = false
  try {
    authenticated = !!(await currentUser())
  } catch { /* OAuth app has not yet been configured. */ }
  return authenticated ? <JobsDashboard /> : <LoginPanel />
}
