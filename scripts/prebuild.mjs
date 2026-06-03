/**
 * Prebuild: stop dev server on port 3000 (avoids corrupt .next during build) and remove .next cache.
 */
import { execSync } from "child_process"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const nextDir = path.join(root, ".next")

if (process.platform === "win32") {
  try {
    execSync(
      'powershell -NoProfile -ExecutionPolicy Bypass -File "' +
        path.join(root, "scripts", "kill-dev-ports.ps1") +
        '"',
      { stdio: "inherit" }
    )
  } catch {
    /* ignore */
  }
}

function rm(dir) {
  if (!fs.existsSync(dir)) return
  for (let i = 0; i < 5; i++) {
    try {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
      console.log("Removed", dir)
      return
    } catch (e) {
      if (i === 4) throw e
    }
  }
}

rm(nextDir)
