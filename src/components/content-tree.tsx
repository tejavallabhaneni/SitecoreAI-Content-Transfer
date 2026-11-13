"use client"

import { useCallback, useEffect, useState } from "react"
import { ChevronRight, File, Folder, FolderOpen, Image as ImageIcon, LoaderCircle } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import type { Backend, TreeNode } from "@/lib/transfer"

type Compare = "new" | "exists" | "differs"
type Loaded = { nodes: TreeNode[]; compare: Record<string, Compare> } | { error: string }

const ROOT_NODES: TreeNode[] = [
  { id: "root-content", name: "Content", path: "/sitecore/content", template: "", hasChildren: true },
  { id: "root-media", name: "Media Library", path: "/sitecore/media library", template: "", hasChildren: true },
]
const normalize = (id: string) => id.toLowerCase().replace(/[{}-]/g, "")
const badges: Record<Compare, { label: string; className: string }> = {
  new: { label: "New", className: "bg-emerald-100 text-emerald-800" },
  exists: { label: "Exists", className: "bg-slate-100 text-slate-800" },
  differs: { label: "ID differs", className: "bg-rose-100 text-rose-800" },
}

/**
 * One environment's content tree. Children load when a folder opens. With a
 * `compareTo` environment, each item is marked New, Exists or ID differs.
 */
export function ContentTree({ backend, env, compareTo, selected, onToggle, label }: {
  backend: Backend; env: string; compareTo?: string; label: string
  selected?: Set<string>; onToggle?: (node: TreeNode, on: boolean) => void
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(["/sitecore/content"]))
  const [loaded, setLoaded] = useState<Record<string, Loaded>>({})

  const load = useCallback(async (path: string) => {
    try {
      const nodes = await backend.children(env, path)
      let compare: Record<string, Compare> = {}
      if (compareTo) {
        const others = await backend.children(compareTo, path).catch(() => [] as TreeNode[])
        const byPath = new Map(others.map(other => [other.path.toLowerCase(), other]))
        compare = Object.fromEntries(nodes.map(node => {
          const match = byPath.get(node.path.toLowerCase())
          return [node.path, !match ? "new" : normalize(match.id) === normalize(node.id) ? "exists" : "differs"]
        }))
      }
      setLoaded(old => ({ ...old, [path]: { nodes, compare } }))
    } catch (error) {
      setLoaded(old => ({ ...old, [path]: { error: error instanceof Error ? error.message : "Couldn’t load this folder." } }))
    }
  }, [backend, env, compareTo])

  // Load the first level once; the parent remounts this tree when environments change.
  useEffect(() => { void load("/sitecore/content") }, [load])

  function toggleOpen(path: string) {
    setOpen(old => {
      const next = new Set(old)
      if (next.has(path)) next.delete(path)
      else { next.add(path); if (!loaded[path]) void load(path) }
      return next
    })
  }

  function rows(nodes: TreeNode[], depth: number, compare: Record<string, Compare>): React.ReactNode {
    return nodes.map(node => {
      const isRoot = depth === 0
      const expanded = open.has(node.path)
      const children = loaded[node.path]
      const state = compare[node.path]
      const media = node.path.toLowerCase().startsWith("/sitecore/media library")
      const Icon = !node.hasChildren ? (media ? ImageIcon : File) : expanded ? FolderOpen : Folder
      return <li key={node.path} role="treeitem" aria-expanded={node.hasChildren ? expanded : undefined} aria-selected={selected?.has(node.path.toLowerCase()) || undefined}>
        <div className="group flex min-h-9 items-center gap-1.5 rounded-md pr-2 hover:bg-white/10" style={{ paddingLeft: depth * 16 + 4 }}>
          {node.hasChildren
            ? <button type="button" onClick={() => toggleOpen(node.path)} className="flex size-6 shrink-0 items-center justify-center rounded hover:bg-white/15" aria-label={`${expanded ? "Close" : "Open"} ${node.name}`}>
                <ChevronRight className={cn("size-4 transition-transform", expanded && "rotate-90")} aria-hidden="true" /></button>
            : <span className="size-6 shrink-0" />}
          {onToggle && !isRoot && <Checkbox checked={Boolean(selected?.has(node.path.toLowerCase()))} onCheckedChange={on => onToggle(node, Boolean(on))} aria-label={`Select ${node.name}`} />}
          <Icon className="size-4 shrink-0 opacity-80" aria-hidden="true" />
          <button type="button" className="min-w-0 flex-1 truncate text-left text-sm" onClick={() => node.hasChildren ? toggleOpen(node.path) : onToggle && !isRoot && onToggle(node, !selected?.has(node.path.toLowerCase()))} title={node.path}>{node.name}</button>
          {state && <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", badges[state].className)}>{badges[state].label}</span>}
        </div>
        {expanded && <ul role="group">{!children
          ? <li className="flex items-center gap-2 py-1.5 text-xs text-muted-foreground" style={{ paddingLeft: (depth + 1) * 16 + 34 }}><LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />Loading…</li>
          : "error" in children ? <li className="py-1.5 text-xs text-rose-200" style={{ paddingLeft: (depth + 1) * 16 + 34 }}>{children.error}</li>
          : children.nodes.length === 0 ? <li className="py-1.5 text-xs text-muted-foreground" style={{ paddingLeft: (depth + 1) * 16 + 34 }}>Empty</li>
          : rows(children.nodes, depth + 1, children.compare)}</ul>}
      </li>
    })
  }

  return <ul role="tree" aria-label={label} className="space-y-0.5">{rows(ROOT_NODES, 0, {})}</ul>
}
