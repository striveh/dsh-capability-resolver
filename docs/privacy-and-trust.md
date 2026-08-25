# Privacy and trust

[中文](privacy-and-trust.zh.md)

Capability discovery combines local user text with untrusted public metadata. This document separates what leaves the Host, what can persist elsewhere in DSH, and what a candidate result does not prove.

## External request

The built-in provider sends one bounded HTTPS GET to `https://awesome-dsh-plugin.com/plugins.json`. Concurrent observations share one in-flight GET; observer-specific cancellation does not reveal task text or start another request while another observer still waits. The destination is fixed in source and absent from plugin configuration. The request does not include the task, session id, configured module names, tool names, skill names, cookies, credentials, an install request, or a search query.

The catalog service and ordinary network infrastructure can still observe the Host's network address, request time, TLS and HTTP metadata, and the fact that this catalog was downloaded. Standard DNS, proxy, endpoint-security, or corporate network policy may add its own observation.

## Local task handling

The Host trims, bounds, normalizes, and ranks the task locally. The resolver keeps a catalog cache, not a task-history database. The browser page can hold the active form and result in ordinary page memory.

When an Agent invokes `capability_resolve`, the task is subject to normal DSH model request and session logging behavior. The tool does not return the complete browser RPC result to the model. It first creates a separate safe projection, and normal DSH logging applies only to that projected tool result. This plugin does not bypass, redact, or delete those DSH-owned records. A direct UI resolution is not made model-visible merely by using the page.

The UI calls a fixed Connection RPC channel guarded for loopback access. Same-user local processes, browser extensions, screen capture, a compromised Host, or a compromised browser can still observe data available to that user. Loopback is an access restriction, not an isolation boundary against the local account.

## Catalog retention

The Host retains only a bounded last successful normalized catalog in memory. Fresh and stale ceilings determine reuse. Plugin disposal clears the cache, aborts its shared request, and waits for that request to settle. Cache state disappears on plugin reload, disable, uninstall, or DSH process exit. The plugin does not write catalog or task data to its own disk files or browser persistent storage.

## Untrusted metadata

Every catalog row is untrusted. Names, descriptions, categories, repository links, popularity counts, dates, and package names can be wrong, stale, manipulated, or malicious. Parsing and URL/package-name restrictions reduce injection and command-construction risk; they do not inspect repository code or prove maintainer identity.

DSH `0.1.1-rc.2` has no standard tool-result annotation that marks a text block as untrusted for model serialization and session replay. Its tool runtime gives Code Mode the canonical value and renders content from that value. A direct call sends that render to the model and stores it in `tool/result`; a nested Code Mode call stores its render in `tool/code-dispatch`. The resolver therefore does not rely on a textual warning or an unavailable taint marker. The model-facing canonical value and render contain only a bounded whitelist: the fixed provider and catalog identity, strictly revalidated repository and catalog-page URLs, a strictly parsed optional npm package identifier, matched-field enums, non-negative numeric/date facts, current-match counts and kinds, catalog completeness/staleness/count state, and explicit privacy/read-only flags.

Catalog names, descriptions, category labels, matched terms, warning strings, configured module identifiers, and current tool/Skill names and descriptions remain available only in the deeply validated loopback UI response. They are omitted from the model-facing canonical value and therefore from the tool's session-facing render. If a candidate no longer has a strict repository identity at projection time, it is omitted; a `consider-plugin` result with no remaining safe candidate becomes `unavailable`.

The following are discovery evidence only:

- local lexical matches;
- inclusion in the catalog or a GitHub topic;
- catalog pages and repository links;
- stars, downloads, or admission dates; and
- a structured npm package name.

None of them proves DSH compatibility, package integrity, security, maintenance quality, legal suitability, or DeepSeek endorsement.

## No installation authority

The plugin never calls `dsh plugin add`, a package manager, a shell, a subprocess API, or an installer. It never enables, disables, updates, or removes another plugin. A structured `installSpec` is one value for a human to inspect; it is not consent and is never executed.

Before installing a candidate, inspect its exact source revision, package manifest, lifecycle scripts, dependencies, permissions, requested credentials, DSH version support, release evidence, and removal behavior. Prefer a pinned tag or commit and an isolated profile acceptance run.

## Reportable security problems

Useful private reports include task text leaving the Host, arbitrary catalog destinations, redirects bypassing the fixed source, unbounded input or retention, cross-origin RPC access, command construction or execution, unsafe link rendering, raw malicious catalog data leaking into logs, or a mismatch between package artifacts and source. Follow [`SECURITY.md`](../SECURITY.md) and use synthetic data.
