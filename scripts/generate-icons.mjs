// One-time script: rasterizes the hand-authored black-disc/white-corona-ring
// SVG (icon-source.svg) into the three PWA icon PNGs required by spec §9.
// Run with: node scripts/generate-icons.mjs
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SOURCE_SVG = path.join(__dirname, 'icon-source.svg')
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'icons')

export const ICON_TARGETS = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-512-maskable.png', size: 512 },
]

export async function generateIcons(outputDir = OUTPUT_DIR) {
  await mkdir(outputDir, { recursive: true })
  const svgBuffer = await readFile(SOURCE_SVG)
  for (const { file, size } of ICON_TARGETS) {
    await sharp(svgBuffer).resize(size, size).png().toFile(path.join(outputDir, file))
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await generateIcons()
  console.log(`Generated ${ICON_TARGETS.length} icons in ${OUTPUT_DIR}`)
}
