# Contributing

Thanks for improving `dsh-capability-resolver`. Keep the plugin read-only, locally ranked, source-transparent, and narrow enough that a candidate remains a human review step.

## Development baseline

- Node.js `22.19.x`
- pnpm `11.21.0`
- DeepSeek Harness `0.1.1-rc.2`, the only declared compatibility lane

Install and run the local gates:

```sh
pnpm install --frozen-lockfile
node scripts/assert-dsh-test-version.mjs 0.1.1-rc.2
pnpm verify
pnpm pack --dry-run
```

Build artifacts under `lib/` are part of the GitHub distribution and must change with source. `pnpm verify:artifacts` performs a clean production build in an isolated temporary directory and compares its complete file set and bytes with `lib/`; it never repairs the checkout before deciding whether the gate passes. Do not add `prepare`, `preinstall`, `install`, or `postinstall`: Git consumers must not have to authorize package code execution during installation.

## Design invariants

- Fetch the complete fixed `https://awesome-dsh-plugin.com/plugins.json` catalog without task text, configured capabilities, credentials, cookies, or session identifiers.
- Keep the catalog URL out of Config and reject redirect, size, timeout, content-type, root-schema, per-entry, URL, and package-name failures at their owning edge.
- Let one bad external entry produce a partial result, not a whole-catalog denial of service; never expose the raw invalid row in user warnings.
- Rank deterministically and locally. Do not rank on a one-character substring, generic English/Chinese request filler, stars, or downloads.
- Describe Loader modules as configured, not installed or healthy.
- Preserve explicit complete, stale, invalid-entry, warning, and source evidence.
- Keep the Connection endpoint fixed and loopback-only; validate every RPC request.
- Register the browser page through the Plugins settings slot; do not patch built-in page internals.
- Keep every registration disposable and all retained state bounded by the plugin apply lifecycle.
- Do not construct or execute an install command. A candidate and optional structured package name remain evidence for manual review.
- Do not describe community metadata as DeepSeek endorsement, compatibility proof, security review, or trust certification.

## Tests expected for a change

- Fixed outbound URL and proof that English and Chinese task text never reaches fetch.
- Root validation, partial invalid-row handling, unsafe URL/package rejection, byte/entry limits, timeout, fresh cache, stale fallback, cancellation, and disposal.
- English/Chinese stop words, exact token behavior, deterministic order, configured matches, current tool/Skill filtering, result bounds, and all four decisions.
- Tool schema, Agent scope, read-only output, and absence of installation execution.
- Loopback authority, RPC payload validation, cancellation, and teardown.
- Plugins settings loading, error, empty, current match, candidate, stale/partial warning, evidence disclosure, safe external link, copy, cancellation, and narrow layout states.
- Build and package checks for manifest, export, loader, patch, dependency, or artifact changes.

Use synthetic fixtures. Do not put real prompts, configured private plugin names, credentials, proprietary repositories, or malicious payload bodies in issues, screenshots, logs, or test output.

## DSH compatibility updates

When the upstream workflow reports drift:

1. Do not broaden `engines.dsh`, peers, README claims, or `compatibility/dsh.json` automatically.
2. Inspect the new release diff and every changed tracked authority from the pinned official tag.
3. Update source only where the reviewed DSH API requires it; record failures before fixes.
4. Add a separate exact CI lane for every release that will remain supported and assert the installed DSH graph is uniform before and after tests.
5. Run typechecks, behavior tests, a clean build, package verification, publication preview, isolated profile installation, `--dump-config`, real Web boot, the keyless browser journey, disable/remove, and any required update behavior.
6. Update the compatibility record only after all claimed lanes pass. Keep failed or unrun evidence explicit.
7. Release the compatibility change with the exact DSH tag/commit, CI links, acceptance receipt, and remaining uncertainty.

## Release checklist

1. Update `CHANGELOG.md`, package version, both READMEs, and compatibility evidence together.
2. Start from a clean reviewed commit and run the development gates above.
3. Require the isolated committed-artifact comparison to pass, then run `pnpm pack`, inspect every archive path and the packed `package.json`, and compute SHA-256. Repack from the same commit and require the same digest.
4. Install the exact public tag or release asset into an isolated `DSH_HOME` Web profile. Inspect the effective config, boot Web, and run the keyless Plugins settings journey.
5. Verify disable, remove, and restart behavior. An update path is required once more than one release exists.
6. Protect the `v*` tag, create an immutable GitHub release when available, attach the `.tgz`, publish its digest, and link the exact CI run.
7. Do not publish to the `@deepseek-ai` npm scope. If npm publication is added later, use an independently owned name, provenance, two-factor protection, and the same packed bytes.

## Pull requests

Keep changes focused. State the user-visible outcome, privacy/trust impact, DSH version impact, commands run, browser evidence for UI changes, and anything still unverified. Security reports belong in the private path documented by [`SECURITY.md`](SECURITY.md).
