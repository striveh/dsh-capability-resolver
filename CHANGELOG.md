# Changelog

All notable changes to this project are documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/striveh/dsh-capability-resolver/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/striveh/dsh-capability-resolver/releases/tag/v0.1.0
