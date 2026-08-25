# Security policy

## Supported versions

Security fixes target the latest `0.1.x` release on the default branch. DSH compatibility is separately and narrowly limited to `0.1.1-rc.2` until reviewed evidence changes that declaration.

## Report a vulnerability privately

Use GitHub private vulnerability reporting:

1. Open the repository's **Security** tab.
2. Choose **Advisories** → **Report a vulnerability**.
3. Include affected versions, a synthetic reproduction, impact, and any suggested mitigation.

Do not open a public issue containing a working exploit, user task text, configured private plugin names, credentials, proprietary catalog data, or captured DSH session content. If private reporting is unavailable, open a public issue without vulnerability detail and ask the maintainer to enable a private contact path.

## Relevant security boundaries

A useful report may show:

- task, session, tool, skill, or Loader data sent to the external catalog;
- an arbitrary destination, redirect, credential, cookie, or proxy bypass added by the plugin;
- unbounded response, entry, cache, task, description, term, current-match, or candidate handling;
- whole-catalog denial of service from one malformed entry or raw malicious rows exposed in logs/UI;
- unsafe URL rendering, npm package parsing, shell construction, subprocess use, or automatic install/mutation;
- RPC access outside the loopback authority, payload-validation bypass, cancellation leak, or disposal leak;
- stale data presented as complete/fresh, or external metadata presented as compatibility/security certification;
- unexpected disk/browser persistence; or
- a published archive that differs from the reviewed source or embeds a checkout path.

The following are documented limitations, not vulnerabilities by themselves: local lexical false positives, inaccurate community metadata, catalog omission, a same-user local process observing loopback data, or a candidate failing after a user independently chooses to install it.

See [`docs/privacy-and-trust.md`](docs/privacy-and-trust.md) for the complete data and trust model.
