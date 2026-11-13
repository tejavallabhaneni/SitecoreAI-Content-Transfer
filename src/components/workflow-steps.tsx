import { Check, ClipboardCheck, FolderTree, Plug } from "lucide-react"
import { cn } from "@/lib/utils"

const steps = [
  { label: "Connect", icon: Plug, tone: "bg-brand-tint text-brand-ink" },
  { label: "Choose content", icon: FolderTree, tone: "bg-teal-50 text-teal-800" },
  { label: "Review & transfer", icon: ClipboardCheck, tone: "bg-brand-red-soft text-brand-red-ink" },
]

export function WorkflowSteps({ active }: { active: 1 | 2 | 3 }) {
  return <ol aria-label="Transfer steps" className="grid grid-cols-3 gap-2 rounded-xl border bg-white p-3 sm:gap-5 sm:p-4">
    {steps.map(({ label, icon: Icon, tone }, index) => <li key={label} aria-current={active === index + 1 ? "step" : undefined}
      className={cn("flex flex-col items-center gap-2 text-center text-xs sm:flex-row sm:gap-3 sm:text-left sm:text-sm", active === index + 1 ? "font-semibold text-brand-ink" : "text-muted-foreground")}>
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", active === index + 1 ? "bg-primary text-white shadow-sm" : index + 1 < active ? "bg-emerald-50 text-emerald-800" : tone)}>
        {index + 1 < active ? <Check className="size-4" aria-hidden="true" /> : <Icon className="size-4" aria-hidden="true" />}
      </span><span><span className="sr-only">Step {index + 1}: </span>{label}</span>
    </li>)}
  </ol>
}
