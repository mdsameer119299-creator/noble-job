/**
 * Creates hostinger-standalone.zip from .next/standalone (run after prepare-hostinger-standalone).
 * Zip root = server.js, package.json, node_modules, .next, public (no scripts/ source).
 */
import { execSync } from "child_process"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const standalone = path.join(root, ".next", "standalone")
const outZip = path.join(root, "hostinger-standalone.zip")

if (!fs.existsSync(path.join(standalone, "server.js"))) {
  console.error("Missing .next/standalone/server.js — run: npm run build:hostinger")
  process.exit(1)
}

if (fs.existsSync(outZip)) {
  fs.unlinkSync(outZip)
}

for (const name of fs.readdirSync(standalone)) {
  if (name.endsWith(".zip")) {
    fs.unlinkSync(path.join(standalone, name))
    console.warn(`Removed stray archive from bundle: ${name}`)
  }
}

const zipCmd =
  process.platform === "win32"
    ? `powershell -NoProfile -Command "Compress-Archive -Path '${standalone.replace(/'/g, "''")}\\*' -DestinationPath '${outZip.replace(/'/g, "''")}' -Force"`
    : `cd "${standalone}" && zip -rq "${outZip}" . -x "*.zip"`

execSync(zipCmd, { stdio: "inherit" })

console.log(`Created ${outZip}`)
console.log("Upload to Hostinger → Node.js Web App → Upload ZIP (use HOSTINGER_README.txt settings)")
