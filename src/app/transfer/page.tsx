import { currentUser } from "@/lib/auth/session"
import { TransferConsole } from "@/components/transfer-console"

export const dynamic = "force-dynamic"

export default async function TransferPage() {
  const session = await currentUser()
  return <TransferConsole login={session?.login ?? null} />
}
