import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const expected = process.argv[2]
if (expected !== '0.1.1-rc.2') {
  throw new Error(`expected the sole supported DSH release 0.1.1-rc.2, received ${expected ?? '<missing>'}`)
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const virtualStoreLock = await readFile(resolve(root, 'node_modules/.pnpm/lock.yaml'), 'utf8')
const installed = [...virtualStoreLock.matchAll(
  /@deepseek-ai\/dsh-[a-z0-9-]+@(\d+\.\d+\.\d+(?:-[0-9a-z.-]+)?)/g,
)].map(match => match[1])
const versions = [...new Set(installed)].sort()

if (versions.length === 0) throw new Error('no installed DSH packages found in the virtual-store lockfile')
if (versions.length !== 1 || versions[0] !== expected) {
  throw new Error(`expected an all-${expected} DSH graph, found ${versions.join(', ')}`)
}

process.stdout.write(`installed DSH graph is uniformly ${expected}\n`)
