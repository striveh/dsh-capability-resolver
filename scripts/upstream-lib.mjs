import { createHash } from 'node:crypto'

export function parseDshTag(tag) {
  const match = tag.match(/^dsh-v(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/)
  if (!match) return undefined
  return { tag, core: match.slice(1, 4).map(Number), pre: match[4]?.split('.') }
}

export function selectLatestDshRelease(releases) {
  return releases
    .filter(release => !release.draft && parseDshTag(release.tag_name) && release.published_at)
    .sort((left, right) => {
      const published = Date.parse(right.published_at) - Date.parse(left.published_at)
      if (published !== 0) return published
      return Number(right.id ?? 0) - Number(left.id ?? 0)
    })[0]
}

export function digestRoutes(tree, authorities) {
  if (tree.truncated) throw new Error('upstream recursive Git tree was truncated')
  const blobs = new Map(tree.tree.filter(entry => entry.type === 'blob').map(entry => [entry.path, entry.sha]))
  const missing = authorities.filter(path => !blobs.has(path))
  const rows = authorities.map(path => `${path}:${blobs.get(path)}`).sort()
  const digest = createHash('sha256').update(`${rows.join('\n')}\n`).digest('hex')
  return { digest, missing, rows }
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}
