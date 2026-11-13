import { redirect } from "next/navigation"
import { JobsDashboard } from "@/components/jobs-dashboard"
import { demoModeEnabled } from "@/lib/security/demo-mode"

export default function HomePage() {
  if (!demoModeEnabled()) redirect("/transfer")
  return <JobsDashboard />
}
