/**
 * Converts category SVGs to transparent-friendly WebP (96px).
 * Run: node scripts/generate-category-webp.mjs
 */
import { readdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import sharp from "sharp"

const __dirname = dirname(fileURLToPath(import.meta.url))
const dir = join(__dirname, "..", "public", "images", "categories")

for (const file of readdirSync(dir).filter(f => f.endsWith(".svg"))) {
  const base = file.replace(".svg", "")
  const input = join(dir, file)
  const output = join(dir, `${base}.webp`)
  await sharp(input).resize(120, 120).webp({ quality: 88, alphaQuality: 100 }).toFile(output)
  console.log("webp", base)
}

console.log("WebP export complete")
