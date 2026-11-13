import { Check, ClipboardCheck, FolderTree, Plug } from "lucide-react"
import { cn } from "@/lib/utils"

/** One colour per step, used wherever that step appears: indigo, teal, coral. */
export const stepTones = [
  { label: "Connect", icon: Plug, solid: "bg-connect text-white dark:text-background", tint: "bg-connect-tint text-connect-ink", text: "text-connect-ink", border: "border-t-connect" },
  { label: "Choose content", icon: FolderTree, solid: "bg-choose text-white dark:text-background", tint: "bg-choose-tint text-choose-ink", text: "text-choose-ink", border: "border-t-choose" },
  { label: "Review & transfer", icon: ClipboardCheck, solid: "bg-review text-white dark:text-background", tint: "bg-review-tint text-review-ink", text: "text-review-ink", border: "border-t-review" },
] as const

export function WorkflowSteps({ active }: { active: 1 | 2 | 3 }) {
  return <ol aria-label="Transfer steps" className="relative grid grid-cols-3 gap-2 overflow-hidden rounded-xl border bg-card p-3 sm:gap-5 sm:p-4">
    {stepTones.map(({ label, icon: Icon, solid, text }, index) => {
      const step = index + 1
      const current = active === step
      const done = step < active
      return <li key={label} aria-current={current ? "step" : undefined}
        className={cn("flex flex-col items-center gap-2 text-center text-xs sm:flex-row sm:gap-3 sm:text-left sm:text-sm", current ? cn("font-semibold", text) : done ? "text-foreground" : "text-muted-foreground")}>
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors", current ? cn(solid, "shadow-md") : done ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground")}>
          {done ? <Check className="size-4" aria-hidden="true" /> : <Icon className="size-4" aria-hidden="true" />}
        </span><span><span className="sr-only">Step {step}{done ? " (done)" : ""}: </span>{label}</span>
      </li>
    })}
  </ol>
}
