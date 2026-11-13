// Preserve installed package notices without publishing local paths or env values.
import { execFileSync } from "node:child_process"
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

const root = process.cwd()
const directories = execFileSync("npm", ["ls", "--omit=dev", "--parseable", "--all"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim().split(/\r?\n/).filter(p => p !== root)
const inventory = []
const sections = ["Content Transfer — third-party notices\n\nGenerated from installed production packages. Includes optional server/build dependencies; inclusion does not mean a package is sent to the browser. This inventory is not a legal clearance certificate.\n\nFonts: see /licenses/dm-sans.txt and /licenses/geist-mono.txt.\n\nCan I Use data: Copyright Alexis Deveria and contributors, https://caniuse.com/ ; compressed by caniuse-lite, https://github.com/browserslist/caniuse-lite ; CC BY 4.0. The app does not modify that package's data.\n"]
const seen = new Set()
async function projectLicense(packageName) {
  const directory = path.join(root, "node_modules", packageName)
  const filename = (await readdir(directory)).find(name => /^licen[cs]e(?:\.md|\.txt)?$/i.test(name))
  if (!filename) throw new Error(`No upstream project licence found for ${packageName}`)
  return readFile(path.join(directory, filename), "utf8")
}
for (const directory of directories.sort()) {
  const pkg = JSON.parse(await readFile(path.join(directory, "package.json"), "utf8"))
  const key = `${pkg.name}@${pkg.version}`
  if (seen.has(key)) continue
  seen.add(key)
  const files = (await readdir(directory)).filter(name => /^(licen[cs]e|copying|notice|copyright)([. -]|$)/i.test(name) && !/ \d+(?:\.|$)/.test(name))
  const notices = []
  for (const file of files) {
    try { notices.push(`--- ${file} ---\n${await readFile(path.join(directory, file), "utf8")}`) } catch { /* Directories are not licence texts. */ }
  }
  let supplement = ""
  if (!notices.length && pkg.name.startsWith("@next/")) {
    notices.push(`--- Next.js monorepo LICENSE ---\n${await projectLicense("next")}`)
    supplement = "https://github.com/vercel/next.js"
  }
  if (!notices.length && pkg.name === "client-only") {
    notices.push(`--- React project LICENSE ---\n${await projectLicense("react")}`)
    supplement = "https://github.com/facebook/react"
  }
  if (pkg.name.includes("sharp-libvips") || pkg.name === "@img/sharp-wasm32") {
    notices.push(`--- libvips LGPL v3 and GPL v3 supplement ---\n${await readFile(path.join(root, "public/licenses/lgpl-3.0.txt"), "utf8")}\n${await readFile(path.join(root, "public/licenses/gpl-3.0.txt"), "utf8")}`)
    supplement = "Native/WASM image tooling; source and build scripts: https://github.com/lovell/sharp-libvips and https://github.com/lovell/sharp . Review redistribution obligations before distributing binaries."
  }
  const license = typeof pkg.license === "string" ? pkg.license : JSON.stringify(pkg.license ?? "UNKNOWN")
  const repository = typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url
  inventory.push({ name: pkg.name, version: pkg.version, license, repository, noticesAvailable: notices.length > 0, ...(supplement ? { supplement } : {}) })
  if (inventory.length % 100 === 0) console.log(`Collected ${inventory.length} package notices`)
  sections.push(`\n${"=".repeat(72)}\n${key}\nDeclared licence: ${license}\n${repository ? `Source: ${repository}\n` : ""}${supplement ? `${supplement}\n` : ""}\n${notices.join("\n\n") || "No bundled licence text found. Review upstream before redistribution."}\n`)
}
// Next.js ships additional vendored components outside npm's dependency graph.
async function collectVendored(directory, relative = "") {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const rel = path.join(relative, entry.name)
    if (/ \d+(?:\.|$)/.test(entry.name)) continue
    if (entry.isDirectory()) await collectVendored(path.join(directory, entry.name), rel)
    else if (/^(licen[cs]e|copying|notice|copyright)([. -]|$)/i.test(entry.name)) sections.push(`\n--- Next.js vendored component: ${rel} ---\n${await readFile(path.join(directory, entry.name), "utf8")}\n`)
  }
}
await collectVendored(path.join(root, "node_modules/next/dist/compiled"))
await mkdir(path.join(root, "public/licenses"), { recursive: true })
await writeFile(path.join(root, "public/THIRD_PARTY_NOTICES.txt"), sections.join("\n"))
await writeFile(path.join(root, "public/licenses/packages.json"), JSON.stringify(inventory.sort((a, b) => a.name.localeCompare(b.name)), null, 2) + "\n")
const missing = inventory.filter(pkg => !pkg.noticesAvailable)
console.log(`Recorded ${inventory.length} production package notices; ${missing.length} packages without bundled or supplemental licence text.`)
if (missing.length) console.warn(missing.map(pkg => `${pkg.name}@${pkg.version}`).join(", "))
