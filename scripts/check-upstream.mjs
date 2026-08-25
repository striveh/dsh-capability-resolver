#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { digestRoutes, selectLatestDshRelease, sha256 } from './upstream-lib.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(await readFile(resolve(root, 'compatibility/dsh.json'), 'utf8'))
const [owner, repo] = manifest.upstream.repository.split('/')
const apiBase = `https://api.github.com/repos/${owner}/${repo}`
const args = process.argv.slice(2)
const reportIndex = args.indexOf('--report')
const reportPath = reportIndex >= 0 ? args[reportIndex + 1] : undefined
const printJson = args.includes('--json')

async function github(path) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  const response = await fetch(`${apiBase}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'dsh-capability-resolver-upstream-audit',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!response.ok) throw new Error(`GitHub API ${path} returned ${response.status}`)
  return response.json()
}

async function allReleases() {
  const releases = []
  for (let page = 1; page <= 10; page += 1) {
    const batch = await github(`/releases?per_page=100&page=${page}`)
    releases.push(...batch)
    if (batch.length < 100) return releases
  }
  throw new Error('more than 1000 upstream releases; extend pagination before trusting the latest release')
}

async function run() {
  const [head, releases] = await Promise.all([
    github(`/commits/${encodeURIComponent(manifest.upstream.defaultBranch)}`),
    allReleases(),
  ])
  const latestRelease = selectLatestDshRelease(releases)
  if (!latestRelease) throw new Error('no published dsh-v* release found upstream')

  const verifiedRelease = releases.find(release => !release.draft && release.tag_name === manifest.upstream.verifiedTag)
  const commitRefs = [...new Set([latestRelease.tag_name, ...(verifiedRelease ? [manifest.upstream.verifiedTag] : [])])]
  const commits = new Map(await Promise.all(commitRefs.map(async ref => [ref, await github(`/commits/${encodeURIComponent(ref)}`)])))
  const latestReleaseCommit = commits.get(latestRelease.tag_name).sha
  const pinnedCommit = commits.get(manifest.upstream.verifiedTag)?.sha

  const tree = await github(`/git/trees/${head.sha}?recursive=1`)
  const authorities = manifest.routeAuthorities.map(entry => entry.path)
  const routes = digestRoutes(tree, authorities)
  const drift = []
  if (latestRelease.tag_name !== manifest.upstream.verifiedTag) drift.push(`new published release: ${latestRelease.tag_name} (${latestReleaseCommit})`)
  if (!verifiedRelease) drift.push(`verified release disappeared: ${manifest.upstream.verifiedTag}`)
  else if (pinnedCommit !== manifest.upstream.verifiedTagCommit) drift.push(`verified tag moved from ${manifest.upstream.verifiedTagCommit} to ${pinnedCommit}`)
  if (routes.missing.length > 0) drift.push(`tracked authority paths missing: ${routes.missing.join(', ')}`)
  if (routes.digest !== manifest.upstream.routeDigest) drift.push(`tracked authority digest changed: ${routes.digest}`)

  const fingerprint = sha256(JSON.stringify({
    latestRelease: [latestRelease.tag_name, latestReleaseCommit],
    head: head.sha,
    routeDigest: routes.digest,
    drift,
  }))
  const result = {
    status: drift.length === 0 ? 'current' : 'review-required',
    checkedAt: new Date().toISOString(),
    latestRelease: {
      tag: latestRelease.tag_name,
      commit: latestReleaseCommit,
      publishedAt: latestRelease.published_at,
    },
    head: head.sha,
    reviewedHead: manifest.upstream.reviewedHead,
    routeDigest: routes.digest,
    reviewedRouteDigest: manifest.upstream.routeDigest,
    fingerprint,
    drift,
  }
  const report = [
    '<!-- dsh-capability-resolver:upstream-drift:v1 -->',
    `<!-- fingerprint:${fingerprint} -->`,
    '',
    '# Upstream DSH compatibility audit',
    '',
    `Status: **${result.status}**`,
    '',
    `- Checked: ${result.checkedAt}`,
    `- Latest published release: \`${latestRelease.tag_name}\` (\`${latestReleaseCommit}\`)`,
    `- Current \`${manifest.upstream.defaultBranch}\`: \`${head.sha}\``,
    `- Last reviewed head: \`${manifest.upstream.reviewedHead}\``,
    `- Tracked authority digest: \`${routes.digest}\``,
    '',
    ...(drift.length > 0 ? ['## Review required', '', ...drift.map(item => `- ${item}`), ''] : []),
    'A new commit alone is informational when every tracked authority blob is unchanged. A new DSH release, moved tag, missing authority, or changed authority digest requires a human review, the compatibility lane, and installable-bundle acceptance before any support claim changes.',
    '',
  ].join('\n')
  if (reportPath) await writeFile(reportPath, report)
  if (printJson) console.log(JSON.stringify(result, null, 2))
  else console.log(report)
  process.exitCode = drift.length === 0 ? 0 : 2
}

try {
  await run()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  const report = `# Upstream DSH compatibility audit\n\nStatus: **error**\n\n- ${message}\n`
  if (reportPath) await writeFile(reportPath, report)
  console.error(report)
  process.exitCode = 1
}
