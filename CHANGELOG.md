# Changelog

All notable changes to this project are documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-11-05

### Changed

- Migrated the resolver to the reviewed DeepSeek Harness `0.2.1-rc.5` compatibility lane: `dsh-client-runtime` to `dsh-client-store`, the Slots service to `dsh-client-ui-renderer`, the loopback Connection RPC signature, and the renamed `IconChevronDownOutlineRegular`.
- Advanced the package and compatibility-record release identity to `0.2.0` and updated the tracked authority digest for the `0.2.1-rc.5` release, including the Code Mode to PTC authority rename.

## [0.1.1] - 2026-08-27

### Fixed

- Replaced the stale pre-release install wording with a pinned `v0.1.1` install command and an explicit `v0.1.0` to `v0.1.1` update path in both READMEs.

### Changed

- Advanced the package and compatibility-record release identity to `0.1.1` while retaining the exact DeepSeek Harness `0.1.1-rc.2` compatibility lane and unchanged resolver runtime behavior.

## [0.1.0] - 2026-08-25

### Added

- Read-only local resolution across configured Loader modules, current model-invocable tools and skills, and a fixed public community plugin catalog.
- Bounded catalog transport, isolated external-entry parsing, deterministic English/Chinese matching with a small audited intent vocabulary, and explicit complete/stale/unavailable evidence.
- A model-facing `capability_resolve` tool and loopback-only Connection RPC channel that never install or mutate a plugin.
- A Web Plugins settings discovery page with configured matches, candidate evidence, source links, and explicit trust limitations.
- One-package Host+Client bundle metadata, committed build artifacts, exact DSH `0.1.1-rc.2` compatibility declarations, CI/package gates, and weekly upstream drift detection.

### Security

- Split the full loopback UI resolution from a safe model projection so untrusted catalog and current-capability free text cannot enter the `capability_resolve` canonical value, model render, or direct/nested result session content.
- Revalidate the browser RPC byte, collection, text, and canonical candidate-link limits before any community metadata can render as an external link.

[Unreleased]: https://github.com/striveh/dsh-capability-resolver/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/striveh/dsh-capability-resolver/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/striveh/dsh-capability-resolver/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/striveh/dsh-capability-resolver/releases/tag/v0.1.0
