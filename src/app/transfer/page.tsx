import { currentUser } from "@/lib/auth/session"
import { TransferConsole } from "@/components/transfer-console"

export const dynamic = "force-dynamic"

export default async function TransferPage() {
  let login: string | null = null
  try { login = (await currentUser())?.login ?? null } catch { /* missing setup */ }
  return <TransferConsole login={login} />
}
