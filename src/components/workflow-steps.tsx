import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

const labels = ["Connect", "Choose content", "Review & transfer"]

export function WorkflowSteps({ active }: { active: 1 | 2 | 3 }) {
  return <ol aria-label="Transfer steps" className="grid grid-cols-3 gap-2 rounded-xl border bg-white p-3 sm:gap-5 sm:p-4">
    {labels.map((label, index) => <li key={label} aria-current={active === index + 1 ? "step" : undefined}
      className={cn("flex items-center gap-2 text-xs sm:gap-3 sm:text-sm", active === index + 1 ? "font-semibold text-brand-ink" : "text-muted-foreground")}>
      <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold", active === index + 1 ? "bg-primary text-white" : index + 1 < active ? "bg-brand-tint text-brand-ink" : "bg-muted text-muted-foreground")}>
        {index + 1 < active ? <Check className="size-3.5" aria-hidden="true" /> : index + 1}
      </span><span>{label}</span>
    </li>)}
  </ol>
}
