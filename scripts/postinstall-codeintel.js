#!/usr/bin/env node
// Best-effort provisioning of the keyless code-intelligence tools (CodeGraph,
// Repowise) for a fresh clone. Never fails `npm install` — every step is
// wrapped so a missing/broken tool just gets skipped with a warning.

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: 'pipe', encoding: 'utf8', ...opts })
}

function commandExists(cmd) {
  try {
    run(`command -v ${cmd}`)
    return true
  } catch {
    return false
  }
}

function warn(msg) {
  console.warn(`[postinstall-codeintel] ${msg}`)
}

function setupCodegraph() {
  if (!commandExists('codegraph')) {
    warn('codegraph not found — installing globally (npm install -g @colbymchenry/codegraph)')
    try {
      run('npm install -g @colbymchenry/codegraph', { stdio: 'inherit' })
    } catch {
      warn(
        'codegraph install failed — skipping. Install manually: https://github.com/colbymchenry/codegraph',
      )
      return
    }
  }
  if (!existsSync('.codegraph')) {
    warn('initializing CodeGraph (codegraph init .)')
    try {
      run('codegraph init .', { stdio: 'inherit' })
    } catch {
      warn('codegraph init failed — skipping')
    }
  }
}

function installRepowise() {
  const attempts = [
    'uv tool install repowise',
    'pipx install repowise',
    'python3 -m pip install --user repowise',
  ]
  for (const cmd of attempts) {
    const tool = cmd.split(' ')[0]
    if (!commandExists(tool)) continue
    try {
      run(cmd, { stdio: 'inherit' })
      return true
    } catch {
      // try the next mechanism
    }
  }
  return false
}

function setupRepowise() {
  if (!commandExists('repowise')) {
    warn('repowise not found — installing (uv/pipx/pip fallback chain)')
    if (!installRepowise()) {
      warn(
        'repowise install failed — skipping. Install manually: https://pypi.org/project/repowise/',
      )
      return
    }
  }
  if (!existsSync('.repowise')) {
    warn('indexing with Repowise (repowise init . --no-prose -y)')
    try {
      run('repowise init . --no-prose -y', { stdio: 'inherit' })
    } catch {
      warn('repowise init failed — skipping')
    }
  }
}

function main() {
  if (process.env.CI) {
    // Dev-convenience tools only — skip in CI to avoid slowing/breaking builds.
    return
  }
  try {
    setupCodegraph()
  } catch (err) {
    warn(`unexpected error setting up CodeGraph: ${err.message}`)
  }
  try {
    setupRepowise()
  } catch (err) {
    warn(`unexpected error setting up Repowise: ${err.message}`)
  }
}

main()
