# DSH Capability Resolver

[中文](README.zh.md)

[![CI](https://github.com/striveh/dsh-capability-resolver/actions/workflows/ci.yml/badge.svg)](https://github.com/striveh/dsh-capability-resolver/actions/workflows/ci.yml)
[![Upstream DSH compatibility](https://github.com/striveh/dsh-capability-resolver/actions/workflows/upstream-drift.yml/badge.svg)](https://github.com/striveh/dsh-capability-resolver/actions/workflows/upstream-drift.yml)

An unofficial, independently maintained DeepSeek Harness plugin that answers a need-first question: which capabilities are already configured, and which community plugins are worth inspecting next?

The resolver is read-only. It does not install, enable, disable, update, or execute a candidate. It downloads the complete public catalog from `https://awesome-dsh-plugin.com/plugins.json`, keeps the user's task on the local DSH Host, and ranks normalized entries locally. The Plugins settings page shows the deeply validated full evidence; the model-facing tool receives a separate safe projection that omits untrusted catalog free text.

Catalog inclusion, topics, stars, and download counts are discovery metadata. They are not DeepSeek endorsement, compatibility proof, a security review, or a recommendation to install.

## Status and compatibility

Version `0.1.1` has one declared target: DeepSeek Harness `0.1.1-rc.2`. It does not claim compatibility with an older or newer DSH release. This maintenance release changes release metadata and installation guidance; resolver runtime behavior is unchanged from `0.1.0`.

The machine-readable record is [`compatibility/dsh.json`](compatibility/dsh.json). A weekly workflow compares the latest published DSH release and the Git blob digest of the exact official files this plugin relies on. A new release, moved tag, missing authority, or changed digest opens or updates one review issue and fails the workflow. Automation never broadens the compatibility claim.

## What it does

- Reads current Loader module names and current model-invocable tools and skills.
- Fetches only the fixed HTTPS community catalog; request text is never included in that fetch.
- Parses the catalog with bounded input and isolates invalid entries instead of failing all discovery.
- Ranks English and Chinese needs deterministically on the Host.
- Returns one of `use-existing`, `consider-plugin`, `no-match`, or `unavailable`, with current matches, catalog completeness, stale state, warnings, candidates, and match evidence.
- Exposes the result through a loopback-only `/dsh-capability-resolver` Connection RPC channel.
- Adds a discovery tab owned by Web Plugins settings and a read-only `capability_resolve` tool whose canonical and rendered result contains only strict identifiers and bounded local/numeric facts.
- May expose a strictly parsed npm package name as structured `installSpec` evidence. It never turns that value into a command.

## Install

Prerequisites:

- DeepSeek Harness `0.1.1-rc.2`;
- Node.js `22.19` or a newer version allowed by the package engine; and
- pnpm on `PATH`, as required by `dsh plugin`.

Install the pinned `v0.1.1` tag into the Web profile:

```sh
dsh plugin --profile web add github:striveh/dsh-capability-resolver#v0.1.1
dsh --profile web --dump-config
dsh web
```

To update an existing `v0.1.0` installation, run the same pinned `add` command for `v0.1.1`, inspect the expanded configuration, and restart Web:

```sh
dsh plugin --profile web add github:striveh/dsh-capability-resolver#v0.1.1
dsh --profile web --dump-config
```

Restart a running Web profile after adding, updating, disabling, or removing the bundle. The expanded configuration should contain a `dsh-capability-resolver` layer. The repository commits `lib/` and intentionally has no `prepare`, `preinstall`, `install`, or `postinstall` script, so a GitHub install does not need package build permission.

For an unreleased checkout during development:

```sh
dsh plugin --profile web add .
dsh --profile web --dump-config
dsh web
```

## Use

Open Web Settings, choose Plugins, and use the discovery tab to describe a capability in English or Chinese. The page shows configured matches first and community candidates only when the local ranker finds evidence.

The model-facing tool provides the same read-only discovery path for an Agent-backed session. Normal DSH session logging rules apply to the tool arguments and its safe projected result. Catalog names, descriptions, categories, matched terms, warnings, and current capability names are omitted from both the model-facing canonical value and the session-facing render; strict repository/catalog URLs and an optional validated npm identifier preserve candidate identification. The catalog provider still never receives the task text.

Review the repository, catalog page, and package contents yourself before taking any installation step. A candidate can be relevant and still be incompatible, abandoned, unsafe, mislabeled, or unsuitable for the active profile.

## Configuration

The bundle declares every deployment-tunable default. The catalog URL is intentionally not configurable.

| Field | Default | Allowed range | Meaning |
| --- | ---: | ---: | --- |
| `freshCacheMs` | `900000` | `1000..86400000` | Age through which the last successful catalog is fresh. |
| `staleCacheMs` | `86400000` | `1000..604800000` | Maximum age for an explicitly stale last-good fallback; must be at least `freshCacheMs`. |
| `fetchTimeoutMs` | `5000` | `100..60000` | Timeout for the fixed catalog request. |
| `maxCatalogBytes` | `8388608` | `65536..33554432` | Maximum response bytes accepted before parsing. |
| `maxCatalogEntries` | `5000` | `1..20000` | Maximum catalog entries considered. |
| `maxTaskChars` | `2000` | `64..16000` | Maximum admitted task length. |
| `maxResults` | `8` | `1..50` | Maximum community candidates returned. |
| `maxCurrentMatches` | `8` | `1..50` | Maximum configured/tool/skill matches returned. |
| `maxDescriptionChars` | `600` | `80..4000` | Maximum retained candidate description length. |
| `maxMatchedTerms` | `12` | `1..50` | Maximum local match terms exposed as evidence. |

To override defaults, add a later row to `$DSH_HOME/profiles/web/cordis.patch.yml`. DSH replaces the row's complete `config`, so restate all fields:

```yaml
- id: dsh-capability-resolver
  config:
    freshCacheMs: 900000
    staleCacheMs: 86400000
    fetchTimeoutMs: 5000
    maxCatalogBytes: 8388608
    maxCatalogEntries: 5000
    maxTaskChars: 2000
    maxResults: 8
    maxCurrentMatches: 8
    maxDescriptionChars: 600
    maxMatchedTerms: 12
```

## Disable or remove

Keep the dependency but disable the plugin with a later profile patch, then restart Web:

```yaml
- id: dsh-capability-resolver
  disabled: true
```

Remove the dependency and its bundle layer with:

```sh
dsh plugin --profile web remove dsh-capability-resolver
```

The plugin does not create an installation database or persist task text. Removing it does not remove any plugin the user may have installed separately after reviewing a candidate.

## Privacy and trust

The Host owns an in-memory, bounded last-good catalog cache. UI requests use the loopback Connection channel. The fixed external request downloads the catalog without task text, credentials, cookies, or an install action. See [`docs/privacy-and-trust.md`](docs/privacy-and-trust.md) for retention and threat assumptions, and [`docs/design.md`](docs/design.md) for the UI/model result split.

The plugin does not provide a sandbox, malware scan, package signature verification, dependency audit, compatibility test, or maintainer identity proof for candidates. Source links are evidence for a human next step, not a trust decision.

## Development and release evidence

```sh
pnpm install --frozen-lockfile
node scripts/assert-dsh-test-version.mjs 0.1.1-rc.2
pnpm verify
pnpm pack --dry-run
```

`pnpm verify` runs Host and Client typechecks, focused tests, compatibility-helper tests, an isolated clean production build, the publication package verifier, and the pinned compatibility-record verifier. The artifact gate compares the isolated build's complete `lib/` file set and bytes with the publication artifacts without rebuilding over the checkout first. The package verifier separately checks exports, required artifact paths, the lazy Web loader id, bundle defaults, the loopback channel, the fixed catalog URL, the absence of install-time lifecycle scripts, and the absence of command-execution dependencies in built JavaScript.

A build or unit suite is not installable-bundle acceptance. A release must also install the exact public tag into an isolated DSH home/profile, inspect `--dump-config`, boot Web, exercise the Plugins settings journey with keyless fixtures, and verify disable/remove behavior. See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Limitations

- Ranking combines lexical evidence with a small audited intent vocabulary for common cross-language needs; it is not general semantic search or proof of fitness.
- A complete catalog can still omit a useful plugin; an incomplete or stale result says so explicitly.
- Loader presence means configured, not successfully installed, enabled, compatible, or healthy.
- The fixed community catalog is an independent external source and may contain inaccurate or malicious metadata.
- This plugin proposes no automatic install, validation, rollback, or update workflow.
- DSH is a developer preview; a future release may require source, package, UI, RPC, or profile changes.

## License

[MIT](LICENSE). DeepSeek Harness and DeepSeek names belong to their respective owners.
