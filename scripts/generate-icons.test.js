import path from 'node:path'
import os from 'node:os'
import { mkdtemp, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { generateIcons } from './generate-icons.js'

// Independently authored from spec §9 — deliberately NOT imported from
// generate-icons.js, so a drift in that module's own ICON_TARGETS would
// fail this test instead of passing by circular self-reference.
const EXPECTED_TARGETS = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-512-maskable.png', size: 512 },
]

describe('generate-icons', () => {
  let outputDir

  beforeAll(async () => {
    outputDir = await mkdtemp(path.join(os.tmpdir(), 'eclipse-icons-'))
    await generateIcons(outputDir)
  })

  afterAll(async () => {
    await rm(outputDir, { recursive: true, force: true })
  })

  it.each(EXPECTED_TARGETS)('generates $file at $size x $size pixels', async ({ file, size }) => {
    const filePath = path.join(outputDir, file)

    expect(existsSync(filePath)).toBe(true)

    const metadata = await sharp(filePath).metadata()

    expect(metadata.width).toBe(size)
    expect(metadata.height).toBe(size)
  })
})
