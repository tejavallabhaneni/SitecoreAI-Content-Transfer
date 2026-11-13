import { ConnectionGate } from "@/components/connection-gate"
import { NewJobForm } from "@/components/new-job-form"

export default function NewJobPage() {
  return <ConnectionGate><NewJobForm /></ConnectionGate>
}

