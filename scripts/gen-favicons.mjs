/**
 * Generate favicon/app-icon assets from the Noble Job logo.
 * Usage: node scripts/gen-favicons.mjs
 * Outputs to public/: favicon.ico, favicon-16x16.png, favicon-32x32.png,
 * apple-touch-icon.png (180), icon-192.png, icon-512.png
 */
import sharp from "sharp"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const SRC = path.join(root, "public", "images", "noble-job-logo.png")
const OUT = path.join(root, "public")

// Square the source on a white background (logo is ~square, JPEG → no alpha).
function square(size) {
  return sharp(SRC)
    .resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
}

const PNGS = [
  ["favicon-16x16.png", 16],
  ["favicon-32x32.png", 32],
  ["apple-touch-icon.png", 180],
  ["icon-192.png", 192],
  ["icon-512.png", 512],
]

/** Assemble a real .ico (embedded PNGs at 16/32/48). */
async function buildIco(sizes) {
  const pngs = await Promise.all(sizes.map((s) => square(s).toBuffer()))
  const count = pngs.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type = icon
  header.writeUInt16LE(count, 4)
  const entries = Buffer.alloc(16 * count)
  let offset = 6 + 16 * count
  pngs.forEach((png, i) => {
    const s = sizes[i]
    const e = i * 16
    entries.writeUInt8(s >= 256 ? 0 : s, e + 0) // width
    entries.writeUInt8(s >= 256 ? 0 : s, e + 1) // height
    entries.writeUInt8(0, e + 2) // palette
    entries.writeUInt8(0, e + 3) // reserved
    entries.writeUInt16LE(1, e + 4) // color planes
    entries.writeUInt16LE(32, e + 6) // bits per pixel
    entries.writeUInt32LE(png.length, e + 8) // size
    entries.writeUInt32LE(offset, e + 12) // offset
    offset += png.length
  })
  return Buffer.concat([header, entries, ...pngs])
}

const meta = await sharp(SRC).metadata()
console.log(`source: ${meta.width}x${meta.height} ${meta.format}`)

for (const [name, size] of PNGS) {
  await square(size).toFile(path.join(OUT, name))
  console.log("wrote", name, `(${size}x${size})`)
}

const ico = await buildIco([16, 32, 48])
fs.writeFileSync(path.join(OUT, "favicon.ico"), ico)
console.log("wrote favicon.ico (16/32/48,", ico.length, "bytes)")
