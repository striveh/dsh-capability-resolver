# AGENTS.md

`dsh-capability-resolver` is an independently maintained DeepSeek Harness plugin. Keep plugin work in this repository; do not edit `../deepseek-harness` unless the user explicitly requests an upstream change.

Before changing DSH integration code, use the installed `dsh-plugin-development` Skill when available. Treat this repository's pinned dependencies, [`compatibility/dsh.json`](compatibility/dsh.json), installed declarations, and tests as the version-specific authority; inspect the matching official DSH tag or checkout when an API remains unclear.

Read [`docs/design.md`](docs/design.md), [`docs/privacy-and-trust.md`](docs/privacy-and-trust.md), and [`CONTRIBUTING.md`](CONTRIBUTING.md) before non-trivial changes. Preserve the read-only design: the fixed catalog request never receives task text, external metadata remains untrusted and bounded, resolution stays local, and the plugin never installs, enables, executes, updates, or removes a candidate.

Edit `src/`, tests, and affected documentation together. `lib/` is generated distribution output; do not hand-edit it. Run focused tests while developing, then the repository verification and package-preview commands documented in `CONTRIBUTING.md`. Do not publish, push, create releases, or broaden the declared DSH compatibility lane without explicit authorization and completed compatibility evidence.
