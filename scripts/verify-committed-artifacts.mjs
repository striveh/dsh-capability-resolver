#!/usr/bin/env node

import { access, cp, mkdir, mkdtemp, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

import { compareArtifactTrees } from './artifact-tree.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const buildInputs = [
  'package.json',
  'pnpm-workspace.yaml',
  'tsconfig.json',
  'tsconfig.host.json',
  'tsconfig.client.json',
  'tsdown.config.ts',
  'src',
  'scripts/clean.mjs',
  'scripts/clean-client-build.mjs',
]

function runBuild(directory) {
  const npmExecPath = process.env.npm_execpath
  const command = npmExecPath === undefined
    ? process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
    : process.execPath
  const args = npmExecPath === undefined
    ? ['run', 'build']
    : [npmExecPath, 'run', 'build']
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: directory,
      env: { ...process.env, NODE_ENV: 'production' },
      stdio: 'inherit',
    })
    child.once('error', rejectRun)
    child.once('exit', (code, signal) => {
      if (code === 0) resolveRun()
      else rejectRun(new Error(`isolated artifact build failed (${signal ?? `exit ${code ?? 'unknown'}`})`))
    })
  })
}

function reportDifferences(result) {
  const rows = [
    ...result.missing.map(path => `missing from isolated build: lib/${path}`),
    ...result.unexpected.map(path => `missing from committed artifacts: lib/${path}`),
    ...result.changed.map(path => `byte mismatch: lib/${path}`),
  ]
  if (rows.length === 0) return false
  process.stderr.write('committed artifact verification failed:\n')
  for (const row of rows) process.stderr.write(`- ${row}\n`)
  process.stderr.write('Run pnpm run build, review lib/, and commit the regenerated artifacts.\n')
  return true
}

let temporaryRoot
try {
  await access(join(root, 'node_modules'))
  temporaryRoot = await mkdtemp(join(tmpdir(), 'dsh-capability-artifacts-'))
  for (const path of buildInputs) {
    const target = join(temporaryRoot, path)
    await mkdir(dirname(target), { recursive: true })
    await cp(join(root, path), target, { recursive: true })
  }
  await symlink(
    join(root, 'node_modules'),
    join(temporaryRoot, 'node_modules'),
    process.platform === 'win32' ? 'junction' : 'dir',
  )
  await runBuild(temporaryRoot)
  const result = await compareArtifactTrees(join(root, 'lib'), join(temporaryRoot, 'lib'))
  if (reportDifferences(result)) process.exitCode = 1
  else process.stdout.write('committed artifact verification passed (isolated production build matches lib byte-for-byte)\n')
} catch (error) {
  process.stderr.write(`committed artifact verification failed: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
} finally {
  if (temporaryRoot !== undefined) await rm(temporaryRoot, { recursive: true, force: true })
}
