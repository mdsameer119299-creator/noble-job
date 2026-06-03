/**
 * Finalizes .next/standalone for Hostinger (Git or ZIP deploy).
 * - Copies .next/static and public into the standalone tree
 * - Writes a minimal runtime package.json (no prebuild / no source scripts)
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const standalone = path.join(root, ".next", "standalone")
const staticDir = path.join(root, ".next", "static")
const publicDir = path.join(root, "public")

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.error(`Missing: ${src}`)
    process.exit(1)
  }
  fs.cpSync(src, dest, { recursive: true })
}

if (!fs.existsSync(path.join(standalone, "server.js"))) {
  console.error("Run npm run build first (.next/standalone/server.js not found).")
  process.exit(1)
}

const standaloneNext = path.join(standalone, ".next")
fs.mkdirSync(standaloneNext, { recursive: true })

copyDir(staticDir, path.join(standaloneNext, "static"))
if (fs.existsSync(publicDir)) {
  copyDir(publicDir, path.join(standalone, "public"))
}

const runtimePackage = {
  name: "noble-job",
  version: "1.0.0",
  private: true,
  description: "Noble Job — production standalone runtime (Hostinger)",
  engines: {
    node: ">=20.0.0",
  },
  scripts: {
    build:
      "node -e \"console.log('Hostinger standalone build skipped')\"",
    start: "node server.js",
  },
}

fs.writeFileSync(
  path.join(standalone, "package.json"),
  `${JSON.stringify(runtimePackage, null, 2)}\n`
)

const hostingerConfigPath = path.join(root, "hostinger.json")
if (fs.existsSync(hostingerConfigPath)) {
  fs.copyFileSync(hostingerConfigPath, path.join(standalone, "hostinger.json"))
}

const deployReadme = `# Hostinger ZIP deployment (pre-built standalone)

Upload hostinger-standalone.zip — zip root must contain server.js and hostinger.json.

hPanel → Deployments → Settings → Build and output → Change from Default to custom:

  Root directory:     /
  Install command:    (empty)
  Build command:      npm run build   (no-op; Hostinger Default runs this)
  Output directory:   (empty)
  Start command:      HOSTNAME=0.0.0.0 node server.js
  Node.js version:    20

Rebuild locally: npm run pack:hostinger
`

fs.writeFileSync(path.join(standalone, "HOSTINGER_README.txt"), deployReadme)

console.log("Standalone bundle ready:")
console.log("  .next/standalone/.next/static")
console.log("  .next/standalone/public")
console.log("  .next/standalone/package.json (runtime-only)")
console.log("Start: HOSTNAME=0.0.0.0 PORT=3000 node .next/standalone/server.js")
