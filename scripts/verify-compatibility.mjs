import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(await readFile(resolve(root, 'compatibility/dsh.json'), 'utf8'))
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
const failures = []

function check(condition, message) {
  if (!condition) failures.push(message)
}

const upstream = manifest.upstream ?? {}
const authorities = Array.isArray(manifest.routeAuthorities) ? manifest.routeAuthorities : []
const authorityPaths = authorities.map(entry => entry?.path)

check(manifest.schemaVersion === 1, 'compatibility schemaVersion must be 1')
check(manifest.packageVersion === pkg.version, 'compatibility packageVersion must match package.json')
check(upstream.repository === 'deepseek-ai/deepseek-harness', 'compatibility repository must be the official DSH repository')
check(upstream.verifiedTag === 'dsh-v0.1.1-rc.2', 'verifiedTag must remain dsh-v0.1.1-rc.2 until a reviewed update')
check(upstream.verifiedVersion === '0.1.1-rc.2', 'verifiedVersion must be 0.1.1-rc.2')
check(upstream.verifiedTagCommit === 'b150a551b8d465e31e418e1b2eaf5e79bbb7d28e', 'verifiedTagCommit must pin the reviewed rc.2 commit')
check(/^[0-9a-f]{64}$/.test(upstream.routeDigest ?? ''), 'routeDigest must be a SHA-256 digest')
check(authorityPaths.length >= 8, 'compatibility manifest must track the runtime and publication authorities')
check(new Set(authorityPaths).size === authorityPaths.length, 'compatibility authority paths must be unique')
check(authorities.every(entry => typeof entry?.path === 'string' && typeof entry?.when === 'string'), 'each authority needs path and when strings')
check(pkg.engines?.dsh === upstream.verifiedVersion, 'engines.dsh must equal the sole verified DSH version')
for (const [name, version] of Object.entries(pkg.peerDependencies ?? {})) {
  if (name.startsWith('@deepseek-ai/dsh-')) {
    check(version === upstream.verifiedVersion, `${name} peer must equal the sole verified DSH version`)
  }
}

if (failures.length > 0) {
  process.stderr.write('compatibility verification failed:\n')
  for (const failure of failures) process.stderr.write(`- ${failure}\n`)
  process.exitCode = 1
} else {
  process.stdout.write(`compatibility verification passed (${upstream.verifiedTag}, ${authorityPaths.length} authorities)\n`)
}
