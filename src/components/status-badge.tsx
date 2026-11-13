import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { JobStatus } from "@/lib/types"

const labels: Record<JobStatus, string> = {
  queued: "Queued",
  running: "Running",
  success: "Success",
  error: "Error",
  unknown: "Unknown",
}

export function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "capitalize",
        status === "queued" && "border-amber-200 bg-amber-50 text-amber-800",
        status === "running" && "border-sky-200 bg-sky-50 text-sky-800",
        status === "success" && "border-teal-200 bg-teal-50 text-teal-800",
        status === "error" && "border-red-200 bg-red-50 text-red-800",
        status === "unknown" && "border-neutral-200 bg-neutral-50 text-neutral-800",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "queued" && "bg-amber-500",
          status === "running" && "animate-pulse bg-sky-500",
          status === "success" && "bg-teal-600",
          status === "error" && "bg-red-600",
        status === "unknown" && "bg-neutral-400",
        )}
      />
      {labels[status]}
    </Badge>
  )
}
