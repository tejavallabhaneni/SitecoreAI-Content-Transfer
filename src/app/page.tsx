import { JobsDashboard } from "@/components/jobs-dashboard"
import { LoginPanel } from "@/components/login-panel"
import { currentUser } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  try {
    if (!(await currentUser())) return <LoginPanel />
  } catch {
    return <LoginPanel />
  }
  return <JobsDashboard />
}
