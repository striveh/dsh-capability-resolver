# Design

[中文](design.zh.md)

`dsh-capability-resolver` is one installable Host+Client bundle because the resolver, model-facing consumer, Connection adapter, and Plugins settings page ship and change together.

## Data flow

```text
fixed public catalog GET ──> bounded parser ──> last-good Host cache
                                                   |
Loader entries + model-invocable tools/skills      |
                        \                          |
user task ───────────────> deterministic local resolver
                                      |             |
                         capability_resolve tool    |
                                      |             |
                         safe model projection      |
                                      |             |
                  model + result session log       |
                                                    |
                         loopback Connection RPC <──┘
                                      |
                         full validated UI response
                                      |
                            Plugins settings tab
```

The catalog provider receives only a fixed GET for `https://awesome-dsh-plugin.com/plugins.json`. The natural-language task is admitted and matched after catalog download. There is no query parameter, request body, configurable destination, or provider callback that receives the task.

## Host ownership

The Host owns configuration, catalog transport, input bounds, normalized entries, deterministic ranking, last-good cache state, Loader observation, current model-invocable tool/Skill reads, and the loopback RPC handler. Registration and cache state belong to the plugin apply lifecycle and are disposed together.

The cache has separate fresh and stale windows. A successful observation may be reused while fresh. Concurrent cold or refresh observations join one in-flight fixed-origin GET. Cancelling one observer does not cancel work still owned by another observer; when the last observer leaves, or the plugin is disposed, the shared request is aborted. Disposal waits for that request to settle. If refresh fails, the last successful observation may be used only inside the stale ceiling and is labeled stale. An unavailable or partially parsed catalog remains explicit in the result.

Current Loader modules are reported as configured. The resolver does not infer that a module installed successfully, initialized, passed health checks, or is compatible with the current DSH release.

## Catalog normalization

The root catalog identity, canonical update date or UTC timestamp, and categories are validated before entries are consumed. Category labels and accepted monorepo paths have fixed character ceilings. Entry parsing is isolated: invalid rows are omitted and counted without exposing their untrusted raw contents. Response bytes, entry count, descriptions, task text, result count, current matches, and exposed matched terms all have configured limits. The complete loopback resolution also has a fixed 512 KiB UTF-8 JSON ceiling; construction drops trailing optional candidates and possible matches while retaining the item required to support `use-existing` or `consider-plugin`.

Repository and catalog page links must pass the accepted HTTPS rules. An optional npm package name becomes `{ kind: "npm", packageName }` only after strict package-name parsing. Catalog shell text is never retained as an install instruction.

## Local ranking

English and Chinese text is normalized before matching. Common request filler and low-information capability wording are excluded, Latin matches use meaningful tokens instead of arbitrary substrings, and Chinese phrases retain useful local terms. Inflections and intent synonyms derived from one original query concept count as one unit of coverage, so expansion cannot satisfy a multi-concept threshold by itself. The phrase `market data` requires exact market and data-capability evidence; separate financial-domain evidence increases coverage so plugin marketplaces do not win on a name-only match. A small source-reviewed vocabulary expands common cross-language intents such as voice transcription; adding an intent requires a focused false-positive and ordering test. This remains deterministic local matching, not general semantic search. Ranking uses only local normalized entry fields and deterministic tie-breaks. Popularity metadata may be displayed as source evidence but does not establish relevance, trust, compatibility, or safety.

## Consumers

The `capability_resolve` tool combines current model-invocable tools and skills with the Host catalog resolution. DSH `0.1.1-rc.2` provides canonical tool values and rendered content but no standard untrusted-content marker that changes model serialization or session replay. The tool therefore maps the full resolution to a separate safe canonical value before DSH sees the successful result. The projection omits all catalog and current-capability free text, revalidates repository, catalog-page, and optional npm identifiers, retains only stable source identity and bounded local/numeric facts, and renders an explicit untrusted-data warning. This same safe value reaches Code Mode. A direct call sends the safe render to the model and `tool/result`; a Code Mode sub-call stores the safe render in `tool/code-dispatch`. The tool never performs the suggested next step.

The browser client registers one `settings.plugins.tab` contribution. It calls the fixed loopback channel and deeply validates the complete response before rendering configured matches, catalog state, candidates, and evidence. Validation re-enforces the Host's 512 KiB JSON ceiling, maximum collection/text lengths, canonical GitHub repository grammar, and the awesome-dsh-plugin page derived from the same owner/repository/path identity. This UI-only response may retain bounded untrusted names, descriptions, category labels, and warnings; it is not reused as the tool result. External links are inert unless they pass that identity check. The UI does not construct or run an installation command.

## Failure behavior

- Invalid configuration fails during plugin load.
- Blank, oversized, malformed, or cancelled local requests fail at the request edge.
- Transport timeout, non-JSON content, oversized data, invalid root data, and unavailable last-good state return an explicit unavailable result.
- Invalid individual entries produce a partial result and bounded generic warning.
- A failed external refresh never breaks Loader/tool/Skill reads or mutates configured plugins.
- Disposal cancels owned work and removes the RPC, tool, and UI registration through their normal plugin lifecycles.

## Compatibility ownership

[`compatibility/dsh.json`](../compatibility/dsh.json) pins the only declared DSH release and the official files that own profile installation, client loading, Connection RPC, Plugins settings, tools, and skills. The scheduled workflow detects drift but never edits the record or claims compatibility. A maintainer must review the changed official sources and rerun the release acceptance path.
