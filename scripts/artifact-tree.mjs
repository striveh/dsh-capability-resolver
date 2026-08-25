import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

async function readArtifactTree(root) {
  const files = new Map()

  async function visit(directory, prefix) {
    const entries = await readdir(directory, { withFileTypes: true })
    entries.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0)
    for (const entry of entries) {
      const relativePath = prefix.length === 0 ? entry.name : `${prefix}/${entry.name}`
      const absolutePath = join(directory, entry.name)
      if (entry.isDirectory()) {
        await visit(absolutePath, relativePath)
      } else if (entry.isFile()) {
        files.set(relativePath, await readFile(absolutePath))
      } else {
        throw new Error(`artifact tree contains a non-file entry: ${relativePath}`)
      }
    }
  }

  await visit(root, '')
  return files
}

/** Compare two artifact directories by relative file set and bytes. */
export async function compareArtifactTrees(expectedRoot, actualRoot) {
  const [expected, actual] = await Promise.all([
    readArtifactTree(expectedRoot),
    readArtifactTree(actualRoot),
  ])
  const missing = [...expected.keys()].filter(path => !actual.has(path))
  const unexpected = [...actual.keys()].filter(path => !expected.has(path))
  const changed = [...expected.entries()]
    .filter(([path, bytes]) => {
      const actualBytes = actual.get(path)
      return actualBytes !== undefined && !bytes.equals(actualBytes)
    })
    .map(([path]) => path)
  return { missing, unexpected, changed }
}
