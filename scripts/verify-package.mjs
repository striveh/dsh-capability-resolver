import { access, readFile, readdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PACKAGE_NAME = 'dsh-capability-resolver'
const PLUGIN_NAME = 'capability-resolver'
const DSH_VERSION = '0.1.1-rc.2'
const PATCH_PATH = './cordis.patch.yml'
const CATALOG_URL = 'https://awesome-dsh-plugin.com/plugins.json'
const RPC_PATH = '/dsh-capability-resolver'
const CLIENT_LOADER_MARKER = 'window.__ModuleLoader__.load'
const REQUIRED_CLIENT_INJECTIONS = [
  '@deepseek-ai/dsh-client-connection',
  '@deepseek-ai/dsh-client-locale',
  '@deepseek-ai/dsh-client-runtime',
  '@deepseek-ai/dsh-client-ui-settings',
  '@deepseek-ai/dsh-client-ui-settings-plugins',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-slots',
]
const REQUIRED_DSH_PEERS = [
  ...REQUIRED_CLIENT_INJECTIONS,
  '@deepseek-ai/dsh-skill',
  '@deepseek-ai/dsh-tools',
]
const INSTALL_LIFECYCLE_SCRIPTS = ['prepare', 'preinstall', 'install', 'postinstall']
const REQUIRED_PATCH_DEFAULTS = {
  freshCacheMs: '900000',
  staleCacheMs: '86400000',
  fetchTimeoutMs: '5000',
  maxCatalogBytes: '8388608',
  maxCatalogEntries: '5000',
  maxTaskChars: '2000',
  maxResults: '8',
  maxCurrentMatches: '8',
  maxDescriptionChars: '600',
  maxMatchedTerms: '12',
}
const REQUIRED_FILES = [
  'lib/index.js',
  'lib/types/index.d.ts',
  'lib/types.js',
  'lib/types/types.d.ts',
  'lib/client.js',
  'lib/types/client/index.d.ts',
  'cordis.patch.yml',
  'README.md',
  'README.zh.md',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'LICENSE',
  'compatibility/dsh.json',
  'docs/design.md',
  'docs/design.zh.md',
  'docs/privacy-and-trust.md',
  'docs/privacy-and-trust.zh.md',
]

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const failures = []

function check(condition, message) {
  if (!condition) failures.push(message)
}

function valueAt(object, keys) {
  let current = object
  for (const key of keys) {
    if (typeof current !== 'object' || current === null || !(key in current)) return undefined
    current = current[key]
  }
  return current
}

async function readText(path) {
  return readFile(resolve(root, path), 'utf8')
}

async function exists(path) {
  try {
    await access(resolve(root, path))
    return true
  } catch {
    return false
  }
}

async function filesUnder(directory) {
  const entries = await readdir(resolve(root, directory), { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = `${directory}/${entry.name}`
    if (entry.isDirectory()) files.push(...await filesUnder(path))
    else if (entry.isFile()) files.push(path)
  }
  return files
}

let manifest
try {
  manifest = JSON.parse(await readText('package.json'))
} catch (error) {
  failures.push(`package.json is not readable JSON: ${error instanceof Error ? error.message : String(error)}`)
  manifest = {}
}

check(manifest.name === PACKAGE_NAME, `package name must be ${PACKAGE_NAME}`)
check(manifest.version === '0.1.0', 'initial package version must be 0.1.0')
check(manifest.type === 'module', 'package type must be module')
check(manifest.main === 'lib/index.js', 'main must be lib/index.js')
check(manifest.types === 'lib/types/index.d.ts', 'types must be lib/types/index.d.ts')
check(valueAt(manifest, ['exports', '.', 'default']) === './lib/index.js', 'root default export must be ./lib/index.js')
check(valueAt(manifest, ['exports', '.', 'types']) === './lib/types/index.d.ts', 'root types export must be ./lib/types/index.d.ts')
check(valueAt(manifest, ['exports', './client', 'default']) === './lib/client.js', 'client default export must be ./lib/client.js')
check(valueAt(manifest, ['exports', './client', 'types']) === './lib/types/client/index.d.ts', 'client types export must be ./lib/types/client/index.d.ts')
check(valueAt(manifest, ['exports', './types', 'default']) === './lib/types.js', 'runtime types export must be ./lib/types.js')
check(valueAt(manifest, ['exports', './types', 'types']) === './lib/types/types.d.ts', 'declaration types export must be ./lib/types/types.d.ts')
check(valueAt(manifest, ['exports', './cordis.patch.yml']) === PATCH_PATH, 'patch export must be ./cordis.patch.yml')
check(valueAt(manifest, ['dsh', 'bundle', 'patch']) === PATCH_PATH, 'dsh.bundle.patch must reference ./cordis.patch.yml')
check(valueAt(manifest, ['dsh', 'client', 'platform']) === 'web', 'dsh.client.platform must be web')
check(valueAt(manifest, ['engines', 'dsh']) === DSH_VERSION, `engines.dsh must be exactly ${DSH_VERSION}`)
check(valueAt(manifest, ['peerDependencies', '@deepseek-ai/cordis']) === '4.0.1', 'Cordis peer must be 4.0.1')
check(valueAt(manifest, ['peerDependencies', '@deepseek-ai/cordis-plugin-loader']) === '1.0.2', 'Loader peer must be 1.0.2')
check(valueAt(manifest, ['peerDependencies', '@deepseek-ai/schemastery']) === '3.18.1', 'Schemastery peer must be 3.18.1')
for (const dependency of REQUIRED_DSH_PEERS) {
  check(valueAt(manifest, ['peerDependencies', dependency]) === DSH_VERSION, `${dependency} peer must be ${DSH_VERSION}`)
}

const injections = valueAt(manifest, ['dsh', 'client', 'inject'])
check(Array.isArray(injections), 'dsh.client.inject must be an array')
if (Array.isArray(injections)) {
  check(JSON.stringify(injections) === JSON.stringify(REQUIRED_CLIENT_INJECTIONS), 'dsh.client.inject must equal the reviewed Plugins settings dependency list')
}

const publishedFiles = manifest.files
check(Array.isArray(publishedFiles), 'files must be an explicit array')
if (Array.isArray(publishedFiles)) {
  for (const path of [
    'lib',
    'docs',
    'compatibility',
    'cordis.patch.yml',
    'README.md',
    'README.zh.md',
    'CHANGELOG.md',
    'CONTRIBUTING.md',
    'SECURITY.md',
    'LICENSE',
  ]) {
    check(publishedFiles.includes(path), `files is missing ${path}`)
  }
  check(!publishedFiles.includes('src'), 'files must not publish raw src as a distribution entry')
  check(!publishedFiles.includes('tests'), 'files must not publish tests')
}

for (const script of INSTALL_LIFECYCLE_SCRIPTS) {
  check(valueAt(manifest, ['scripts', script]) === undefined, `install-time lifecycle script ${script} must be absent`)
}
const verifyScript = valueAt(manifest, ['scripts', 'verify'])
check(typeof verifyScript === 'string' && verifyScript.includes('pnpm run verify:artifacts'), 'verify must run the isolated committed-artifact gate')
check(typeof verifyScript === 'string' && !verifyScript.includes('pnpm run build'), 'verify must not rebuild over checkout artifacts before package verification')
for (const path of REQUIRED_FILES) check(await exists(path), `required built/package file is missing: ${path}`)
check(!await exists('lib/.build'), 'temporary client compilation directory lib/.build must be absent')

let builtJavaScript = ''
try {
  const checkoutMarkers = new Set([root, root.replaceAll('\\', '/')])
  for (const path of await filesUnder('lib')) {
    const artifact = await readText(path)
    if (path.endsWith('.js')) builtJavaScript += `${artifact}\n`
    for (const marker of checkoutMarkers) {
      check(!artifact.includes(marker), `built artifact embeds the absolute checkout path: ${path}`)
    }
  }
} catch (error) {
  failures.push(`cannot scan built artifacts: ${error instanceof Error ? error.message : String(error)}`)
}
check(builtJavaScript.includes(CATALOG_URL), `built Host must contain the fixed catalog URL ${CATALOG_URL}`)
check(builtJavaScript.includes(RPC_PATH), `built Host must register the fixed ${RPC_PATH} channel`)
check(/loopback/i.test(builtJavaScript), 'built Host must retain an explicit loopback authority check')
check(!/(?:node:)?child_process|\bexeca\b|\bshelljs\b/u.test(builtJavaScript), 'built package must not import a command-execution library')

let patch = ''
try {
  patch = await readText('cordis.patch.yml')
} catch (error) {
  failures.push(`cannot read cordis.patch.yml: ${error instanceof Error ? error.message : String(error)}`)
}
check(/^\s*-\s+insert:\s*$/m.test(patch), 'cordis.patch.yml must insert a bundle row')
check(new RegExp(`^\\s+-\\s+id:\\s+${PACKAGE_NAME}\\s*$`, 'm').test(patch), `bundle patch must use id ${PACKAGE_NAME}`)
check(new RegExp(`^\\s+name:\\s+${PACKAGE_NAME}\\s*$`, 'm').test(patch), `bundle patch must load package ${PACKAGE_NAME}`)
check(!/^\s+disabled:\s+true\s*$/m.test(patch), 'bundle patch must not disable discovery by default')
check(!/^\s+catalogUrl:\s*/m.test(patch), 'the catalog URL must not be configurable')
for (const [field, value] of Object.entries(REQUIRED_PATCH_DEFAULTS)) {
  check(new RegExp(`^\\s+${field}:\\s+${value}\\s*$`, 'm').test(patch), `bundle patch must declare ${field}: ${value}`)
}

let clientBundle = ''
try {
  clientBundle = await readText('lib/client.js')
} catch (error) {
  failures.push(`cannot read lib/client.js: ${error instanceof Error ? error.message : String(error)}`)
}
check(clientBundle.includes(CLIENT_LOADER_MARKER), 'client bundle is missing the DSH Web module-loader wrapper')
check(new RegExp(`window\\.__ModuleLoader__\\.load\\(\\{\\s*id:\\s*["']${PACKAGE_NAME}["']`).test(clientBundle), `client loader id must be ${PACKAGE_NAME}`)
check(clientBundle.includes(RPC_PATH), `client bundle is missing its ${RPC_PATH} Connection channel`)

try {
  const host = await import(`${pathToFileURL(resolve(root, 'lib/index.js')).href}?verify-package`)
  check(host.name === PLUGIN_NAME, `host plugin name must be ${PLUGIN_NAME}`)
  check(typeof host.apply === 'function', 'host export apply must be a function')
  check(typeof host.Config === 'object' || typeof host.Config === 'function', 'host export Config must be a Schemastery schema')
  check(typeof host.resolveConfig === 'function', 'host export resolveConfig must be a function')
} catch (error) {
  failures.push(`built host entry cannot be imported: ${error instanceof Error ? error.stack ?? error.message : String(error)}`)
}

for (const readmePath of ['README.md', 'README.zh.md']) {
  let readme = ''
  try {
    readme = await readText(readmePath)
  } catch (error) {
    failures.push(`cannot read ${readmePath}: ${error instanceof Error ? error.message : String(error)}`)
  }
  check(readme.includes('dsh plugin --profile web add github:striveh/dsh-capability-resolver#v0.1.0'), `${readmePath} must contain the pinned GitHub install command`)
  check(readme.includes(DSH_VERSION), `${readmePath} must state the sole ${DSH_VERSION} compatibility target`)
  check(readme.includes(CATALOG_URL), `${readmePath} must disclose the fixed catalog URL`)
}

if (failures.length > 0) {
  process.stderr.write('package verification failed:\n')
  for (const failure of failures) process.stderr.write(`- ${failure}\n`)
  process.exitCode = 1
} else {
  process.stdout.write(`package verification passed (${REQUIRED_FILES.length} required files, ${REQUIRED_CLIENT_INJECTIONS.length} client injections)\n`)
}
