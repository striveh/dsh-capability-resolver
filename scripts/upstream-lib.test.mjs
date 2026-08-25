import assert from 'node:assert/strict'
import { test } from 'node:test'

import { digestRoutes, parseDshTag, selectLatestDshRelease } from './upstream-lib.mjs'

test('parses DSH release tags only', () => {
  assert.deepEqual(parseDshTag('dsh-v0.1.1-rc.2'), {
    tag: 'dsh-v0.1.1-rc.2',
    core: [0, 1, 1],
    pre: ['rc', '2'],
  })
  assert.equal(parseDshTag('v0.1.1'), undefined)
})

test('selects the latest published non-draft DSH release', () => {
  const selected = selectLatestDshRelease([
    { id: 1, tag_name: 'dsh-v0.1.1-rc.1', published_at: '2026-08-20T00:00:00Z', draft: false },
    { id: 2, tag_name: 'dsh-v0.1.1-rc.2', published_at: '2026-08-21T00:00:00Z', draft: false },
    { id: 3, tag_name: 'dsh-v0.1.2', published_at: '2026-08-22T00:00:00Z', draft: true },
  ])
  assert.equal(selected?.tag_name, 'dsh-v0.1.1-rc.2')
})

test('digests tracked upstream blobs and reports missing paths', () => {
  const result = digestRoutes({
    truncated: false,
    tree: [
      { path: 'b', type: 'blob', sha: '2' },
      { path: 'a', type: 'blob', sha: '1' },
    ],
  }, ['a', 'b', 'missing'])
  assert.deepEqual(result.missing, ['missing'])
  assert.deepEqual(result.rows, ['a:1', 'b:2', 'missing:undefined'])
  assert.match(result.digest, /^[0-9a-f]{64}$/)
})
