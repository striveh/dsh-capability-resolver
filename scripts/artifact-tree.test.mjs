import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { compareArtifactTrees } from './artifact-tree.mjs'

test('artifact comparison reports file-set and byte differences deterministically', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-capability-artifact-tree-'))
  t.after(async () => { await rm(root, { recursive: true, force: true }) })
  const expected = join(root, 'expected')
  const actual = join(root, 'actual')
  await Promise.all([
    mkdir(join(expected, 'nested'), { recursive: true }),
    mkdir(join(actual, 'nested'), { recursive: true }),
  ])
  await Promise.all([
    writeFile(join(expected, 'same.js'), 'same\n'),
    writeFile(join(actual, 'same.js'), 'same\n'),
    writeFile(join(expected, 'changed.js'), 'before\n'),
    writeFile(join(actual, 'changed.js'), 'after\n'),
    writeFile(join(expected, 'nested', 'missing.d.ts'), 'missing\n'),
    writeFile(join(actual, 'nested', 'unexpected.js.map'), 'unexpected\n'),
  ])

  await expectComparison(expected, actual, {
    missing: ['nested/missing.d.ts'],
    unexpected: ['nested/unexpected.js.map'],
    changed: ['changed.js'],
  })
})

async function expectComparison(expected, actual, value) {
  assert.deepEqual(await compareArtifactTrees(expected, actual), value)
}
