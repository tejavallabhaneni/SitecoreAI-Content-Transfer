import { ConnectionGate } from "@/components/connection-gate"
import { ItemBrowser } from "@/components/item-browser"

export default function ItemsPage() {
  return <ConnectionGate><ItemBrowser /></ConnectionGate>
}

