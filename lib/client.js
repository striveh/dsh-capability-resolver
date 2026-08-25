window.__ModuleLoader__.load({
	id: "dsh-capability-resolver",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");
		//#region lib/.build/types.js
		/** Public JSON and wire types for the capability resolver. */
		/** Fixed catalog origin. User task text is never appended to this URL. */
		const CAPABILITY_CATALOG_URL = "https://awesome-dsh-plugin.com/plugins.json";
		/** Logical Connection channel owned by this plugin. */
		const CAPABILITY_RESOLVER_RPC_CHANNEL = "/dsh-capability-resolver";
		/** Sole read-only method on the resolver channel. */
		const CAPABILITY_RESOLVER_RPC_ENDPOINT = "resolve";
		//#endregion
		//#region lib/.build/client/api.js
		const DECISIONS = /* @__PURE__ */ new Set([
			"use-existing",
			"consider-plugin",
			"no-match",
			"unavailable"
		]);
		const CURRENT_KINDS = /* @__PURE__ */ new Set([
			"plugin",
			"tool",
			"skill"
		]);
		const MATCHED_FIELDS = /* @__PURE__ */ new Set([
			"name",
			"owner",
			"category",
			"description",
			"npm"
		]);
		const NPM_ATOM = "[a-z0-9](?:[a-z0-9._~-]*[a-z0-9])?";
		const SAFE_NPM_PACKAGE = new RegExp(`^(?:${NPM_ATOM}|@${NPM_ATOM}\/${NPM_ATOM})$`);
		const CANONICAL_REPOSITORY = /^https:\/\/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]+)(?:\/tree\/(main|master)\/(.+))?$/;
		const MAX_CANDIDATES = 50;
		const MAX_CURRENT_MATCHES = 50;
		const MAX_MATCHED_FIELDS = 5;
		const MAX_MATCHED_TERMS = 50;
		const MAX_CATALOG_SOURCES = 1;
		const MAX_CANDIDATE_NAME_CODE_UNITS = 200;
		const MAX_CURRENT_NAME_CHARS = 512;
		const MAX_CATEGORY_CHARS = 120;
		const MAX_DESCRIPTION_CHARS = 4e3;
		const MAX_MATCHED_TERM_CHARS = 80;
		const MAX_REPOSITORY_NAME_CODE_UNITS = 100;
		const MAX_REPOSITORY_PATH_CHARS = 512;
		const MAX_REPOSITORY_SEGMENT_CODE_UNITS = 100;
		/**
		* Recheck the Host's canonical repository and catalog-page identity before rendering links.
		* @param owner - candidate owner that must equal the GitHub URL owner.
		* @param repositoryUrl - candidate GitHub repository or accepted monorepo URL.
		* @param catalogPageUrl - awesome-dsh-plugin page derived from the same identity.
		* @returns both unchanged canonical URLs, or `undefined` when either value is forged.
		*/
		function parseCanonicalCandidateLinks(owner, repositoryUrl, catalogPageUrl) {
			const match = CANONICAL_REPOSITORY.exec(repositoryUrl);
			if (match === null || match[1] !== owner || match[2] === void 0) return void 0;
			const repositoryName = match[2];
			if (repositoryName.length > MAX_REPOSITORY_NAME_CODE_UNITS || repositoryName.endsWith(".git")) return;
			const repositoryPath = match[4];
			if (repositoryPath !== void 0) {
				if (Array.from(repositoryPath).length > MAX_REPOSITORY_PATH_CHARS) return void 0;
				const segments = repositoryPath.split("/");
				if (segments.length === 0 || segments.some((segment) => segment.length === 0 || segment.length > MAX_REPOSITORY_SEGMENT_CODE_UNITS || segment === "." || segment === ".." || !/^[A-Za-z0-9._-]+$/.test(segment))) return;
			}
			return catalogPageUrl === `https://awesome-dsh-plugin.com/p/${owner}/${repositoryName}${repositoryPath === void 0 ? "" : `--${repositoryPath.split("/").join("-")}`}/` ? {
				repositoryUrl,
				catalogPageUrl
			} : void 0;
		}
		/** Error returned through a valid Connection RPC failure envelope. */
		var CapabilityResolverRpcError = class extends Error {
			code;
			/** @param error - validated Connection RPC error. */
			constructor(error) {
				super(error.message);
				this.name = "CapabilityResolverRpcError";
				this.code = error.code;
			}
		};
		function expectRecord(value, subject) {
			if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`dsh-capability-resolver: invalid ${subject}`);
			return value;
		}
		function expectString(value, subject) {
			if (typeof value !== "string") throw new Error(`dsh-capability-resolver: invalid ${subject}`);
			return value;
		}
		function expectCodeUnitBoundedString(value, subject, maxLength) {
			const result = expectString(value, subject);
			if (result.length > maxLength) throw new Error(`dsh-capability-resolver: oversized ${subject}`);
			return result;
		}
		function expectCharacterBoundedString(value, subject, maxLength) {
			const result = expectString(value, subject);
			if (Array.from(result).length > maxLength) throw new Error(`dsh-capability-resolver: oversized ${subject}`);
			return result;
		}
		function expectBoolean(value, subject) {
			if (typeof value !== "boolean") throw new Error(`dsh-capability-resolver: invalid ${subject}`);
			return value;
		}
		function expectArray(value, subject, maxItems) {
			if (!Array.isArray(value)) throw new Error(`dsh-capability-resolver: invalid ${subject}`);
			if (value.length > maxItems) throw new Error(`dsh-capability-resolver: oversized ${subject}`);
			return value;
		}
		function optionalString(value, subject) {
			return value === void 0 ? void 0 : expectString(value, subject);
		}
		function optionalBoolean(value, subject) {
			return value === void 0 ? void 0 : expectBoolean(value, subject);
		}
		function optionalCount(value, subject) {
			if (value === void 0) return void 0;
			if (!Number.isSafeInteger(value) || value < 0) throw new Error(`dsh-capability-resolver: invalid ${subject}`);
			return value;
		}
		function stringArray(value, subject, maxItems, maxItemChars) {
			return expectArray(value, subject, maxItems).map((entry, index) => expectCharacterBoundedString(entry, `${subject}[${index}]`, maxItemChars));
		}
		function matchedFieldArray(value, subject) {
			return expectArray(value, subject, MAX_MATCHED_FIELDS).map((entry, index) => {
				const field = expectString(entry, `${subject}[${index}]`);
				if (!MATCHED_FIELDS.has(field)) throw new Error(`dsh-capability-resolver: invalid ${subject}[${index}]`);
				return field;
			});
		}
		function validateCurrentMatch(value, subject) {
			const input = expectRecord(value, subject);
			const kind = expectString(input.kind, `${subject}.kind`);
			if (!CURRENT_KINDS.has(kind)) throw new Error(`dsh-capability-resolver: invalid ${subject}.kind`);
			expectCharacterBoundedString(input.name, `${subject}.name`, MAX_CURRENT_NAME_CHARS);
			if (input.description !== void 0) expectCharacterBoundedString(input.description, `${subject}.description`, MAX_DESCRIPTION_CHARS);
			optionalBoolean(input.enabled, `${subject}.enabled`);
			stringArray(input.matchedTerms, `${subject}.matchedTerms`, MAX_MATCHED_TERMS, MAX_MATCHED_TERM_CHARS);
			return input;
		}
		function validateEvidence(value, subject, owner) {
			const input = expectRecord(value, subject);
			if (input.providerId !== "awesome-dsh-plugin") throw new Error(`dsh-capability-resolver: invalid ${subject}.providerId`);
			if (input.catalogUrl !== "https://awesome-dsh-plugin.com/plugins.json") throw new Error(`dsh-capability-resolver: invalid ${subject}.catalogUrl`);
			const catalogPageUrl = expectString(input.catalogPageUrl, `${subject}.catalogPageUrl`);
			if (parseCanonicalCandidateLinks(owner, expectString(input.repositoryUrl, `${subject}.repositoryUrl`), catalogPageUrl) === void 0) throw new Error(`dsh-capability-resolver: unsafe ${subject} link identity`);
			matchedFieldArray(input.matchedFields, `${subject}.matchedFields`);
			stringArray(input.matchedTerms, `${subject}.matchedTerms`, MAX_MATCHED_TERMS, MAX_MATCHED_TERM_CHARS);
			optionalCount(input.stars, `${subject}.stars`);
			optionalCount(input.downloads, `${subject}.downloads`);
			const added = optionalString(input.added, `${subject}.added`);
			if (added !== void 0 && !/^\d{4}-\d{2}-\d{2}$/.test(added)) throw new Error(`dsh-capability-resolver: invalid ${subject}.added`);
			return input;
		}
		function validateCandidate(value, subject) {
			const input = expectRecord(value, subject);
			expectCodeUnitBoundedString(input.name, `${subject}.name`, MAX_CANDIDATE_NAME_CODE_UNITS);
			const owner = expectString(input.owner, `${subject}.owner`);
			expectCharacterBoundedString(input.category, `${subject}.category`, MAX_CATEGORY_CHARS);
			expectCharacterBoundedString(input.description, `${subject}.description`, MAX_DESCRIPTION_CHARS);
			validateEvidence(input.evidence, `${subject}.evidence`, owner);
			if (input.installSpec !== void 0) {
				const installSpec = expectRecord(input.installSpec, `${subject}.installSpec`);
				if (installSpec.kind !== "npm") throw new Error(`dsh-capability-resolver: invalid ${subject}.installSpec.kind`);
				const packageName = expectString(installSpec.packageName, `${subject}.installSpec.packageName`);
				if (packageName.length > 214 || packageName !== packageName.toLowerCase() || !SAFE_NPM_PACKAGE.test(packageName)) throw new Error(`dsh-capability-resolver: unsafe ${subject}.installSpec.packageName`);
			}
			if (input.configured !== void 0) {
				const configured = expectRecord(input.configured, `${subject}.configured`);
				expectString(configured.entryId, `${subject}.configured.entryId`);
				expectString(configured.moduleName, `${subject}.configured.moduleName`);
				expectBoolean(configured.enabled, `${subject}.configured.enabled`);
			}
			return input;
		}
		function validateSource(value, subject) {
			const input = expectRecord(value, subject);
			if (input.providerId !== "awesome-dsh-plugin") throw new Error(`dsh-capability-resolver: invalid ${subject}.providerId`);
			if (input.catalogUrl !== "https://awesome-dsh-plugin.com/plugins.json") throw new Error(`dsh-capability-resolver: invalid ${subject}.catalogUrl`);
			optionalString(input.fetchedAt, `${subject}.fetchedAt`);
			optionalString(input.updatedAt, `${subject}.updatedAt`);
			expectBoolean(input.stale, `${subject}.stale`);
			optionalCount(input.invalidEntryCount, `${subject}.invalidEntryCount`);
			optionalString(input.warning, `${subject}.warning`);
			return input;
		}
		/**
		* Validate the complete untrusted RPC value before any field reaches the UI.
		* @param value - decoded Connection response value.
		* @returns the validated resolution.
		*/
		function validateCapabilityResolution(value) {
			let serialized;
			try {
				serialized = JSON.stringify(value);
			} catch {
				throw new Error("dsh-capability-resolver: invalid resolve response JSON");
			}
			if (serialized === void 0 || new TextEncoder().encode(serialized).byteLength > 524288) throw new Error("dsh-capability-resolver: oversized resolve response");
			const input = expectRecord(value, "resolve response");
			if (input.schemaVersion !== 1) throw new Error("dsh-capability-resolver: unsupported resolve response.schemaVersion");
			const decision = expectString(input.decision, "resolve response.decision");
			if (!DECISIONS.has(decision)) throw new Error("dsh-capability-resolver: invalid resolve response.decision");
			expectArray(input.possibleCurrentMatches, "resolve response.possibleCurrentMatches", MAX_CURRENT_MATCHES).forEach((match, index) => {
				validateCurrentMatch(match, `resolve response.possibleCurrentMatches[${index}]`);
			});
			expectBoolean(input.currentSkillsComplete, "resolve response.currentSkillsComplete");
			expectArray(input.candidates, "resolve response.candidates", MAX_CANDIDATES).forEach((candidate, index) => {
				validateCandidate(candidate, `resolve response.candidates[${index}]`);
			});
			const catalog = expectRecord(input.catalog, "resolve response.catalog");
			expectBoolean(catalog.complete, "resolve response.catalog.complete");
			expectBoolean(catalog.stale, "resolve response.catalog.stale");
			optionalString(catalog.warning, "resolve response.catalog.warning");
			expectArray(catalog.sources, "resolve response.catalog.sources", MAX_CATALOG_SOURCES).forEach((source, index) => {
				validateSource(source, `resolve response.catalog.sources[${index}]`);
			});
			if (expectRecord(input.privacy, "resolve response.privacy").catalogRequestContainsTask !== false) throw new Error("dsh-capability-resolver: invalid resolve response.privacy.catalogRequestContainsTask");
			return input;
		}
		/**
		* Bind the generic Connection transport to the capability resolver channel.
		* @param rpc - browser Connection RPC service.
		* @returns typed read-only resolver client.
		*/
		function createCapabilityResolverClient(rpc) {
			return { async resolve(request, signal) {
				const result = await rpc.call(CAPABILITY_RESOLVER_RPC_CHANNEL, CAPABILITY_RESOLVER_RPC_ENDPOINT, request, signal);
				if (!result.ok) throw new CapabilityResolverRpcError(result.error);
				return validateCapabilityResolution(result.value);
			} };
		}
		//#endregion
		//#region \0dsh-capability-resolver-css:src/client/CapabilityResolverSettingsTab.module.css.mjs
		const css = ".ytKIKa_section{width:100%;max-width:760px;color:var(--dsw-alias-label-primary);flex-direction:column;gap:16px;display:flex}.ytKIKa_pageHeader,.ytKIKa_pageHeader h3,.ytKIKa_pageHeader p,.ytKIKa_privacy p,.ytKIKa_emptyState h3,.ytKIKa_emptyState p,.ytKIKa_failure p,.ytKIKa_result h3,.ytKIKa_result h4,.ytKIKa_result h5,.ytKIKa_result p,.ytKIKa_cardTitle,.ytKIKa_description,.ytKIKa_installSpec p,.ytKIKa_catalogState h4{margin:0}.ytKIKa_pageHeader{flex-direction:column;gap:4px;display:flex}.ytKIKa_pageHeader h3{font-size:16px;font-weight:600;line-height:24px}.ytKIKa_pageHeader p,.ytKIKa_resultIntro,.ytKIKa_description,.ytKIKa_owner,.ytKIKa_privacy p,.ytKIKa_emptyState p,.ytKIKa_installSpec p{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}.ytKIKa_form{flex-direction:column;gap:8px;display:flex}.ytKIKa_form label{font-size:13px;font-weight:600;line-height:20px}.ytKIKa_form textarea{box-sizing:border-box;resize:vertical;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);width:100%;min-height:80px;color:var(--dsw-alias-label-primary);font:inherit;border-radius:10px;outline:none;padding:10px 12px;font-size:13px;line-height:20px}.ytKIKa_form textarea::placeholder{color:var(--dsw-alias-label-tertiary)}.ytKIKa_form textarea:focus-visible{border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 2px color-mix(in srgb, var(--dsw-alias-state-business-primary) 18%, transparent)}.ytKIKa_form textarea:disabled{cursor:wait;opacity:.72}.ytKIKa_formActions,.ytKIKa_sourceHeading,.ytKIKa_cardHeader,.ytKIKa_configuredRow,.ytKIKa_candidateConfigured{align-items:center;gap:8px;display:flex}.ytKIKa_privacy,.ytKIKa_emptyState,.ytKIKa_failure,.ytKIKa_catalogState,.ytKIKa_configured{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-module-platform);border-radius:10px;padding:12px 14px}.ytKIKa_privacy{flex-direction:column;gap:4px;display:flex}.ytKIKa_privacy strong,.ytKIKa_emptyState h3{font-size:13px;font-weight:600;line-height:20px}.ytKIKa_emptyState{flex-direction:column;gap:3px;display:flex}.ytKIKa_progress,.ytKIKa_failure{align-items:center;gap:10px;min-height:28px;font-size:13px;line-height:20px;display:flex}.ytKIKa_failure{color:var(--dsw-alias-state-error-primary);justify-content:space-between}.ytKIKa_result{flex-direction:column;gap:12px;display:flex}.ytKIKa_resultHeading{justify-content:space-between;align-items:flex-start;gap:12px;display:flex}.ytKIKa_resultHeading h3{font-size:16px;font-weight:600;line-height:24px}.ytKIKa_resultTask{overflow-wrap:anywhere;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}.ytKIKa_configured{flex-direction:column;gap:8px;display:flex}.ytKIKa_configured h4,.ytKIKa_catalogState h4,.ytKIKa_details h5{font-size:13px;font-weight:600;line-height:20px}.ytKIKa_configured ul,.ytKIKa_candidates,.ytKIKa_warningList,.ytKIKa_sources{margin:0;padding:0;list-style:none}.ytKIKa_configured ul{flex-direction:column;gap:8px;display:flex}.ytKIKa_configured li{flex-direction:column;gap:3px;min-width:0;display:flex}.ytKIKa_configured code{overflow-wrap:anywhere;min-width:0;font-family:var(--ds-font-family-code);font-size:12px;line-height:18px}.ytKIKa_configured li>span{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}.ytKIKa_currentSkillsWarning{color:var(--dsw-alias-state-warn-label);font-size:12px;line-height:18px}.ytKIKa_candidates{flex-direction:column;gap:10px;display:flex}.ytKIKa_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;flex-direction:column;gap:9px;min-width:0;padding:14px;display:flex;overflow:hidden}.ytKIKa_card[data-recommended=true]{border-color:var(--dsw-alias-state-business-primary);box-shadow:var(--dsw-shadow-lv1)}.ytKIKa_cardHeader{justify-content:space-between}.ytKIKa_category{min-width:0;color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:18px;overflow:hidden}.ytKIKa_cardTitle{overflow-wrap:anywhere;font-size:15px;font-weight:600;line-height:22px}.ytKIKa_owner{font-size:12px;line-height:18px}.ytKIKa_candidateConfigured{flex-wrap:wrap}.ytKIKa_candidateConfigured code{overflow-wrap:anywhere;min-width:0;font-family:var(--ds-font-family-code);font-size:12px;line-height:18px}.ytKIKa_warningList{flex-wrap:wrap;gap:5px;display:flex}.ytKIKa_warningList li{background:color-mix(in srgb, var(--dsw-alias-state-warn-primary) 10%, transparent);color:var(--dsw-alias-state-warn-label);border-radius:5px;padding:2px 6px;font-size:11px;line-height:16px}.ytKIKa_disclosure{align-self:flex-start}.ytKIKa_chevron,.ytKIKa_chevronOpen{margin-left:4px}.ytKIKa_chevronOpen{transform:rotate(180deg)}.ytKIKa_details{border-top:1px solid var(--dsw-alias-border-l2);flex-direction:column;gap:10px;padding-top:12px;display:flex}.ytKIKa_evidenceList{grid-template-columns:minmax(92px,auto) minmax(0,1fr);gap:7px 12px;margin:0;font-size:12px;line-height:18px;display:grid}.ytKIKa_evidenceList>div{display:contents}.ytKIKa_evidenceList dt{color:var(--dsw-alias-label-tertiary)}.ytKIKa_evidenceList dd{overflow-wrap:anywhere;min-width:0;margin:0}.ytKIKa_evidenceList a{color:var(--dsw-alias-state-business-primary)}.ytKIKa_installSpec{background:var(--dsw-alias-bg-layer-1);border-radius:8px;flex-direction:column;align-items:flex-start;gap:7px;padding:10px;display:flex}.ytKIKa_installSpec code{overflow-wrap:anywhere;width:100%;color:var(--dsw-alias-label-primary);font-family:var(--ds-font-family-code);font-size:12px;line-height:18px}.ytKIKa_copySuccess,.ytKIKa_copyFailure{font-size:12px;line-height:18px}.ytKIKa_copySuccess{color:var(--dsw-alias-state-success-primary)}.ytKIKa_copyFailure,.ytKIKa_sourceWarning{color:var(--dsw-alias-state-error-primary)}.ytKIKa_catalogState{flex-direction:column;gap:8px;display:flex}.ytKIKa_sourceHeading{flex-wrap:wrap}.ytKIKa_sourceWarning{font-size:12px;line-height:18px}.ytKIKa_sources{flex-direction:column;gap:6px;display:flex}.ytKIKa_sources li{color:var(--dsw-alias-label-tertiary);flex-wrap:wrap;gap:4px 10px;font-size:12px;line-height:18px;display:flex}.ytKIKa_sources strong{color:var(--dsw-alias-label-secondary)}@media (width<=640px){.ytKIKa_resultHeading,.ytKIKa_failure{flex-direction:column;align-items:flex-start}.ytKIKa_evidenceList{flex-direction:column;gap:4px;display:flex}.ytKIKa_evidenceList>div{display:block}}";
		const tagId = "dsh-capability-resolver/CapabilityResolverSettingsTab.module.css";
		if (typeof document !== "undefined" && document.querySelector(`style[data-plugin-css="${tagId}"]`) === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-capability-resolver";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var CapabilityResolverSettingsTab_module_css_default = {
			"candidateConfigured": "ytKIKa_candidateConfigured",
			"candidates": "ytKIKa_candidates",
			"card": "ytKIKa_card",
			"cardHeader": "ytKIKa_cardHeader",
			"cardTitle": "ytKIKa_cardTitle",
			"catalogState": "ytKIKa_catalogState",
			"category": "ytKIKa_category",
			"chevron": "ytKIKa_chevron",
			"chevronOpen": "ytKIKa_chevronOpen",
			"configured": "ytKIKa_configured",
			"configuredRow": "ytKIKa_configuredRow",
			"copyFailure": "ytKIKa_copyFailure",
			"copySuccess": "ytKIKa_copySuccess",
			"currentSkillsWarning": "ytKIKa_currentSkillsWarning",
			"description": "ytKIKa_description",
			"details": "ytKIKa_details",
			"disclosure": "ytKIKa_disclosure",
			"emptyState": "ytKIKa_emptyState",
			"evidenceList": "ytKIKa_evidenceList",
			"failure": "ytKIKa_failure",
			"form": "ytKIKa_form",
			"formActions": "ytKIKa_formActions",
			"installSpec": "ytKIKa_installSpec",
			"owner": "ytKIKa_owner",
			"pageHeader": "ytKIKa_pageHeader",
			"privacy": "ytKIKa_privacy",
			"progress": "ytKIKa_progress",
			"result": "ytKIKa_result",
			"resultHeading": "ytKIKa_resultHeading",
			"resultIntro": "ytKIKa_resultIntro",
			"resultTask": "ytKIKa_resultTask",
			"section": "ytKIKa_section",
			"sourceHeading": "ytKIKa_sourceHeading",
			"sources": "ytKIKa_sources",
			"sourceWarning": "ytKIKa_sourceWarning",
			"warningList": "ytKIKa_warningList"
		};
		//#endregion
		//#region lib/.build/client/CapabilityResolverSettingsTab.js
		const FIELD_KEYS = {
			name: "fieldName",
			owner: "fieldOwner",
			category: "fieldCategory",
			description: "fieldDescription",
			npm: "fieldNpm"
		};
		const CURRENT_KIND_KEYS = {
			plugin: "kindPlugin",
			tool: "kindTool",
			skill: "kindSkill"
		};
		function EvidenceTerms({ terms, label }) {
			if (terms.length === 0) return null;
			return (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: label }), (0, react_jsx_runtime.jsx)("dd", { children: terms.join(" · ") })] });
		}
		/** Render Host-provided evidence without turning metadata into a trust claim. */
		function Evidence({ evidence, owner, t }) {
			const links = parseCanonicalCandidateLinks(owner, evidence.repositoryUrl, evidence.catalogPageUrl);
			const repositoryUrl = links?.repositoryUrl;
			const catalogPageUrl = links?.catalogPageUrl;
			const catalogUrl = evidence.catalogUrl === "https://awesome-dsh-plugin.com/plugins.json" ? CAPABILITY_CATALOG_URL : void 0;
			return (0, react_jsx_runtime.jsxs)("dl", {
				className: CapabilityResolverSettingsTab_module_css_default.evidenceList,
				children: [
					(0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("provider") }), (0, react_jsx_runtime.jsx)("dd", { children: evidence.providerId })] }),
					(0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("matchedFields") }), (0, react_jsx_runtime.jsx)("dd", { children: evidence.matchedFields.map((field) => t(FIELD_KEYS[field])).join(" · ") })] }),
					(0, react_jsx_runtime.jsx)(EvidenceTerms, {
						terms: evidence.matchedTerms,
						label: t("matchedTerms")
					}),
					repositoryUrl !== void 0 ? (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("repository") }), (0, react_jsx_runtime.jsx)("dd", { children: (0, react_jsx_runtime.jsx)("a", {
						href: repositoryUrl,
						target: "_blank",
						rel: "noopener noreferrer",
						children: repositoryUrl
					}) })] }) : null,
					catalogPageUrl !== void 0 ? (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("catalogPage") }), (0, react_jsx_runtime.jsx)("dd", { children: (0, react_jsx_runtime.jsx)("a", {
						href: catalogPageUrl,
						target: "_blank",
						rel: "noopener noreferrer",
						children: catalogPageUrl
					}) })] }) : null,
					catalogUrl !== void 0 ? (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("catalogSource") }), (0, react_jsx_runtime.jsx)("dd", { children: (0, react_jsx_runtime.jsx)("a", {
						href: catalogUrl,
						target: "_blank",
						rel: "noopener noreferrer",
						children: catalogUrl
					}) })] }) : null,
					evidence.stars !== void 0 ? (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("stars") }), (0, react_jsx_runtime.jsx)("dd", { children: evidence.stars })] }) : null,
					evidence.downloads !== void 0 ? (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("downloads") }), (0, react_jsx_runtime.jsx)("dd", { children: evidence.downloads })] }) : null,
					evidence.added !== void 0 ? (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("added") }), (0, react_jsx_runtime.jsx)("dd", { children: evidence.added })] }) : null
				]
			});
		}
		/** Render one ranked candidate and its explicitly unverified evidence. */
		function CandidateCard({ candidate, index, open, copyFeedback, onToggle, onCopy, t }) {
			const detailId = (0, react.useId)();
			const candidateId = `${candidate.owner}/${candidate.name}:${index}`;
			const copied = copyFeedback?.candidateId === candidateId ? copyFeedback.ok : void 0;
			const installSpec = candidate.installSpec;
			return (0, react_jsx_runtime.jsxs)("article", {
				className: CapabilityResolverSettingsTab_module_css_default.card,
				"data-recommended": index === 0 ? "true" : void 0,
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: CapabilityResolverSettingsTab_module_css_default.cardHeader,
						children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, {
							active: index === 0,
							children: t(index === 0 ? "recommended" : "alternative")
						}), (0, react_jsx_runtime.jsxs)("span", {
							className: CapabilityResolverSettingsTab_module_css_default.category,
							children: [
								t("category"),
								" · ",
								candidate.category
							]
						})]
					}),
					(0, react_jsx_runtime.jsx)("h4", {
						className: CapabilityResolverSettingsTab_module_css_default.cardTitle,
						children: candidate.name
					}),
					(0, react_jsx_runtime.jsxs)("p", {
						className: CapabilityResolverSettingsTab_module_css_default.owner,
						children: [
							t("owner"),
							" · ",
							candidate.owner
						]
					}),
					(0, react_jsx_runtime.jsx)("p", {
						className: CapabilityResolverSettingsTab_module_css_default.description,
						children: candidate.description
					}),
					candidate.configured !== void 0 ? (0, react_jsx_runtime.jsxs)("div", {
						className: CapabilityResolverSettingsTab_module_css_default.candidateConfigured,
						children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, {
							active: candidate.configured.enabled,
							children: t(candidate.configured.enabled ? "candidateConfiguredEnabled" : "candidateConfiguredDisabled")
						}), (0, react_jsx_runtime.jsx)("code", { children: candidate.configured.moduleName })]
					}) : null,
					(0, react_jsx_runtime.jsxs)("ul", {
						className: CapabilityResolverSettingsTab_module_css_default.warningList,
						"aria-label": t("unverifiedChecks"),
						children: [
							(0, react_jsx_runtime.jsx)("li", { children: t("warningCompatibility") }),
							(0, react_jsx_runtime.jsx)("li", { children: t("warningSecurity") }),
							(0, react_jsx_runtime.jsx)("li", { children: t("warningSource") })
						]
					}),
					(0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						type: "button",
						variant: "outline",
						size: "sm",
						className: CapabilityResolverSettingsTab_module_css_default.disclosure,
						"aria-expanded": open,
						"aria-controls": detailId,
						onClick: onToggle,
						children: [t(open ? "hideEvidence" : "showEvidence"), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, {
							className: open ? CapabilityResolverSettingsTab_module_css_default.chevronOpen : CapabilityResolverSettingsTab_module_css_default.chevron,
							"aria-hidden": "true"
						})]
					}),
					open ? (0, react_jsx_runtime.jsxs)("div", {
						className: CapabilityResolverSettingsTab_module_css_default.details,
						id: detailId,
						children: [
							(0, react_jsx_runtime.jsx)("h5", { children: t("evidenceTitle") }),
							(0, react_jsx_runtime.jsx)(Evidence, {
								evidence: candidate.evidence,
								owner: candidate.owner,
								t
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: CapabilityResolverSettingsTab_module_css_default.installSpec,
								children: [(0, react_jsx_runtime.jsx)("h5", { children: t("installSpecTitle") }), installSpec === void 0 ? (0, react_jsx_runtime.jsx)("p", { children: t("noInstallSpec") }) : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
									(0, react_jsx_runtime.jsx)("code", { children: installSpec.packageName }),
									(0, react_jsx_runtime.jsx)("p", { children: t("installSpecBody") }),
									(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										type: "button",
										variant: "outline",
										size: "sm",
										onClick: () => {
											onCopy(candidateId, installSpec.packageName);
										},
										children: t("copyInstallSpec")
									}),
									copied !== void 0 ? (0, react_jsx_runtime.jsx)("span", {
										className: copied ? CapabilityResolverSettingsTab_module_css_default.copySuccess : CapabilityResolverSettingsTab_module_css_default.copyFailure,
										role: "status",
										"aria-live": "polite",
										children: t(copied ? "copied" : "copyFailed")
									}) : null
								] })]
							})
						]
					}) : null
				]
			});
		}
		/** Render point-in-time catalog freshness and provider observations. */
		function CatalogState({ catalog, t }) {
			const headingId = (0, react.useId)();
			const hasWarning = catalog.warning !== void 0 || catalog.sources.some((source) => source.warning !== void 0);
			return (0, react_jsx_runtime.jsxs)("section", {
				className: CapabilityResolverSettingsTab_module_css_default.catalogState,
				"aria-labelledby": headingId,
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: CapabilityResolverSettingsTab_module_css_default.sourceHeading,
						children: [
							(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: !catalog.complete ? "error" : catalog.stale ? "warning" : "done" }),
							(0, react_jsx_runtime.jsx)("h4", {
								id: headingId,
								children: t("sourceTitle")
							}),
							(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, { children: t(catalog.complete ? "sourceComplete" : "sourcePartial") }),
							(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, { children: t(catalog.stale ? "sourceStale" : "sourceFresh") })
						]
					}),
					hasWarning ? (0, react_jsx_runtime.jsx)("p", {
						className: CapabilityResolverSettingsTab_module_css_default.sourceWarning,
						children: t("sourceWarning")
					}) : null,
					catalog.sources.length > 0 ? (0, react_jsx_runtime.jsx)("ul", {
						className: CapabilityResolverSettingsTab_module_css_default.sources,
						children: catalog.sources.map((source) => (0, react_jsx_runtime.jsxs)("li", { children: [
							(0, react_jsx_runtime.jsx)("strong", { children: source.providerId }),
							source.updatedAt !== void 0 ? (0, react_jsx_runtime.jsx)("span", { children: t("sourceUpdated", { time: source.updatedAt }) }) : null,
							source.fetchedAt !== void 0 ? (0, react_jsx_runtime.jsx)("span", { children: t("sourceFetched", { time: source.fetchedAt }) }) : null,
							source.invalidEntryCount !== void 0 && source.invalidEntryCount > 0 ? (0, react_jsx_runtime.jsx)("span", { children: t("sourceInvalidEntries", { count: source.invalidEntryCount }) }) : null
						] }, source.providerId))
					}) : null
				]
			});
		}
		/** Render current plugin, tool, and skill matches without calling them installed. */
		function CurrentMatches({ resolution, t }) {
			if (resolution.possibleCurrentMatches.length === 0 && resolution.currentSkillsComplete) return null;
			return (0, react_jsx_runtime.jsxs)("section", {
				className: CapabilityResolverSettingsTab_module_css_default.configured,
				children: [
					(0, react_jsx_runtime.jsx)("h4", { children: t("currentMatchesTitle") }),
					!resolution.currentSkillsComplete ? (0, react_jsx_runtime.jsx)("p", {
						className: CapabilityResolverSettingsTab_module_css_default.currentSkillsWarning,
						children: t("currentSkillsIncomplete")
					}) : null,
					resolution.possibleCurrentMatches.length > 0 ? (0, react_jsx_runtime.jsx)("ul", { children: resolution.possibleCurrentMatches.map((match, index) => (0, react_jsx_runtime.jsxs)("li", { children: [
						(0, react_jsx_runtime.jsxs)("div", {
							className: CapabilityResolverSettingsTab_module_css_default.configuredRow,
							children: [
								(0, react_jsx_runtime.jsx)("code", { children: match.name }),
								(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, { children: t(CURRENT_KIND_KEYS[match.kind]) }),
								match.enabled !== void 0 ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, {
									active: match.enabled,
									children: t(match.enabled ? "configuredEnabled" : "configuredDisabled")
								}) : null
							]
						}),
						match.description !== void 0 ? (0, react_jsx_runtime.jsx)("span", { children: match.description }) : null,
						match.matchedTerms.length > 0 ? (0, react_jsx_runtime.jsxs)("span", { children: [
							t("matchedTerms"),
							" · ",
							match.matchedTerms.join(" · ")
						] }) : null
					] }, `${match.kind}:${match.name}:${index}`)) }) : null
				]
			});
		}
		function decisionCopy(resolution, t) {
			switch (resolution.decision) {
				case "use-existing": return {
					title: t("existingTitle"),
					body: t("existingBody")
				};
				case "consider-plugin": return {
					title: t("candidatesTitle"),
					body: t("candidatesBody")
				};
				case "no-match": return {
					title: t("noMatchTitle"),
					body: t("noMatchBody")
				};
				case "unavailable": return {
					title: t("unavailableTitle"),
					body: t("unavailableBody")
				};
			}
		}
		/** Render the Host decision, configured matches, candidates, and catalog state. */
		function ResolutionResult({ task, resolution, expandedCandidateId, copyFeedback, onToggleCandidate, onCopyCandidate, t }) {
			const copy = decisionCopy(resolution, t);
			return (0, react_jsx_runtime.jsxs)("div", {
				className: CapabilityResolverSettingsTab_module_css_default.result,
				"aria-live": "polite",
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: CapabilityResolverSettingsTab_module_css_default.resultHeading,
						children: [(0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("p", {
							className: CapabilityResolverSettingsTab_module_css_default.resultTask,
							children: t("resultFor", { task })
						}), (0, react_jsx_runtime.jsx)("h3", { children: copy.title })] }), resolution.candidates.length > 0 ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, { children: t("candidateCount", { count: resolution.candidates.length }) }) : null]
					}),
					(0, react_jsx_runtime.jsx)("p", {
						className: CapabilityResolverSettingsTab_module_css_default.resultIntro,
						children: copy.body
					}),
					(0, react_jsx_runtime.jsx)(CurrentMatches, {
						resolution,
						t
					}),
					resolution.candidates.length > 0 ? (0, react_jsx_runtime.jsx)("section", {
						"aria-label": t("candidatesTitle"),
						children: (0, react_jsx_runtime.jsx)("ul", {
							className: CapabilityResolverSettingsTab_module_css_default.candidates,
							children: resolution.candidates.map((candidate, index) => {
								const id = `${candidate.owner}/${candidate.name}:${index}`;
								return (0, react_jsx_runtime.jsx)("li", { children: (0, react_jsx_runtime.jsx)(CandidateCard, {
									candidate,
									index,
									open: expandedCandidateId === id,
									copyFeedback,
									onToggle: () => {
										onToggleCandidate(id);
									},
									onCopy: onCopyCandidate,
									t
								}) }, id);
							})
						})
					}) : null,
					(0, react_jsx_runtime.jsx)(CatalogState, {
						catalog: resolution.catalog,
						t
					})
				]
			});
		}
		/** Render the read-only, need-first capability discovery tab. */
		function CapabilityResolverSettingsTab({ actions, cancel, resolve, retry, t, useResolver, useStore }) {
			const taskDraft = useStore((state) => state.taskDraft);
			const expandedCandidateId = useStore((state) => state.expandedCandidateId);
			const copyFeedback = useStore((state) => state.copyFeedback);
			const view = useResolver((state) => state);
			const busy = view.status === "resolving";
			const submit = (event) => {
				event.preventDefault();
				const task = taskDraft.trim();
				if (task.length === 0 || busy) return;
				actions.resetResultUi();
				resolve(task);
			};
			const copyCandidate = (candidateId, packageName) => {
				(0, _deepseek_ai_dsh_client_ui_primitives.writeClipboard)(packageName).then((ok) => {
					actions.setCopyFeedback(candidateId, ok);
				});
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				className: CapabilityResolverSettingsTab_module_css_default.section,
				"aria-busy": busy,
				"data-capability-resolver": true,
				children: [
					(0, react_jsx_runtime.jsxs)("header", {
						className: CapabilityResolverSettingsTab_module_css_default.pageHeader,
						children: [(0, react_jsx_runtime.jsx)("h3", { children: t("title") }), (0, react_jsx_runtime.jsx)("p", { children: t("intro") })]
					}),
					(0, react_jsx_runtime.jsxs)("form", {
						className: CapabilityResolverSettingsTab_module_css_default.form,
						onSubmit: submit,
						children: [
							(0, react_jsx_runtime.jsx)("label", {
								htmlFor: "capability-resolver-task",
								children: t("taskLabel")
							}),
							(0, react_jsx_runtime.jsx)("textarea", {
								id: "capability-resolver-task",
								rows: 3,
								maxLength: 500,
								value: taskDraft,
								placeholder: t("taskPlaceholder"),
								"aria-describedby": "capability-resolver-privacy-copy",
								disabled: busy,
								onChange: (event) => {
									actions.setTaskDraft(event.currentTarget.value);
								}
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: CapabilityResolverSettingsTab_module_css_default.formActions,
								children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "primary",
									type: "submit",
									disabled: busy || taskDraft.trim().length === 0,
									children: t("submit")
								}), busy ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									type: "button",
									variant: "outline",
									onClick: cancel,
									children: t("cancel")
								}) : null]
							})
						]
					}),
					(0, react_jsx_runtime.jsxs)("aside", {
						className: CapabilityResolverSettingsTab_module_css_default.privacy,
						"aria-labelledby": "capability-resolver-privacy",
						children: [(0, react_jsx_runtime.jsx)("strong", {
							id: "capability-resolver-privacy",
							children: t("privacyTitle")
						}), (0, react_jsx_runtime.jsx)("p", {
							id: "capability-resolver-privacy-copy",
							children: t("privacy")
						})]
					}),
					view.status === "idle" ? (0, react_jsx_runtime.jsxs)("section", {
						className: CapabilityResolverSettingsTab_module_css_default.emptyState,
						children: [(0, react_jsx_runtime.jsx)("h3", { children: t("idleTitle") }), (0, react_jsx_runtime.jsx)("p", { children: t("idleBody") })]
					}) : null,
					view.status === "resolving" ? (0, react_jsx_runtime.jsxs)("div", {
						className: CapabilityResolverSettingsTab_module_css_default.progress,
						role: "status",
						"aria-live": "polite",
						children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: "ongoing" }), (0, react_jsx_runtime.jsx)("span", { children: t("resolving") })]
					}) : null,
					view.status === "error" ? (0, react_jsx_runtime.jsxs)("div", {
						className: CapabilityResolverSettingsTab_module_css_default.failure,
						role: "alert",
						children: [(0, react_jsx_runtime.jsx)("p", { children: t("error") }), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							type: "button",
							variant: "outline",
							size: "sm",
							onClick: () => {
								retry();
							},
							children: t("retry")
						})]
					}) : null,
					view.status === "ready" ? (0, react_jsx_runtime.jsx)(ResolutionResult, {
						task: view.task,
						resolution: view.resolution,
						expandedCandidateId,
						copyFeedback,
						onToggleCandidate: actions.toggleCandidate,
						onCopyCandidate: copyCandidate,
						t
					}) : null
				]
			});
		}
		//#endregion
		//#region lib/.build/client/controller.js
		const IDLE = Object.freeze({ status: "idle" });
		/**
		* Apply-lifecycle-owned resolution state. The instance survives Settings view
		* remounts, owns cancellation, and refuses superseded request completions.
		*/
		var CapabilityResolverController = class {
			resolveCapability;
			view = IDLE;
			listeners = /* @__PURE__ */ new Set();
			active;
			generation = 0;
			lastTask;
			disposed = false;
			/** @param resolveCapability - local Host adapter owned by browser plugin apply. */
			constructor(resolveCapability) {
				this.resolveCapability = resolveCapability;
			}
			/** @returns the current immutable view. */
			getSnapshot = () => this.view;
			/**
			* Subscribe to view replacement.
			* @param listener - synchronous store observer.
			* @returns disposer for this subscription.
			*/
			subscribe = (listener) => {
				if (this.disposed) return () => {};
				this.listeners.add(listener);
				return () => {
					this.listeners.delete(listener);
				};
			};
			/**
			* Resolve one non-empty task, cancelling and superseding older work.
			* @param task - user task trimmed before it reaches the local Host.
			*/
			resolve = async (task) => {
				const normalized = task.trim();
				if (normalized.length === 0 || this.disposed) return;
				this.lastTask = normalized;
				const generation = ++this.generation;
				this.active?.abort();
				const active = new AbortController();
				this.active = active;
				this.publish({
					status: "resolving",
					task: normalized
				});
				try {
					const resolution = await Promise.resolve().then(() => this.resolveCapability(normalized, active.signal));
					if (generation !== this.generation) return;
					this.active = void 0;
					this.publish({
						status: "ready",
						task: normalized,
						resolution
					});
				} catch {
					if (generation !== this.generation) return;
					this.active = void 0;
					this.publish({
						status: "error",
						task: normalized
					});
				}
			};
			/** Retry the last admitted task with the locale active at retry time. */
			retry = async () => {
				if (this.lastTask !== void 0) await this.resolve(this.lastTask);
			};
			/** Cancel active work and return to the explanatory first state. */
			cancel = () => {
				if (this.disposed || this.active === void 0) return;
				++this.generation;
				this.active.abort();
				this.active = void 0;
				this.publish(IDLE);
			};
			/** Abort active work and drop subscribers when the browser plugin unloads. */
			dispose() {
				if (this.disposed) return;
				this.disposed = true;
				++this.generation;
				this.active?.abort();
				this.active = void 0;
				this.listeners.clear();
			}
			publish(view) {
				this.view = view;
				for (const listener of this.listeners) listener();
			}
		};
		//#endregion
		//#region lib/.build/client/locales.js
		/** Simplified Chinese dictionary and locale-key source of truth. */
		const zh = {
			tab: "按需求发现",
			title: "按需求发现能力",
			intro: "说清想完成的事，DSH 会先检查当前可见能力，再从固定插件目录中寻找候选。",
			taskLabel: "你想完成什么？",
			taskPlaceholder: "例如：把会议录音转成带时间戳的文字",
			submit: "分析所需能力",
			resolving: "正在本机分析能力…",
			cancel: "取消",
			privacyTitle: "隐私说明",
			privacy: "你的需求只发送到本机 DSH Host。Host 下载并缓存固定的 awesome-dsh-plugin 完整目录，匹配在本机完成；需求不会发送给目录站点、GitHub 或插件作者。",
			idleTitle: "从目标开始，不必先知道插件名",
			idleBody: "这里仅提供发现证据和安全安装参数，不会安装、启用或执行任何插件。",
			error: "暂时无法完成分析。你的目标仍保留在输入框中。",
			retry: "重试",
			existingTitle: "当前配置可能已满足",
			existingBody: "以下匹配项来自当前插件配置以及运行时可见的工具和技能，仅表示可能相关，不等同于已安装、兼容或已完成端到端验证。",
			currentMatchesTitle: "当前可能匹配的能力",
			currentSkillsIncomplete: "当前技能列表未完整载入；这里可能漏掉已可用的技能。",
			kindPlugin: "配置插件",
			kindTool: "工具",
			kindSkill: "技能",
			configuredEnabled: "已启用",
			configuredDisabled: "已停用",
			matchedTerms: "匹配词",
			candidatesTitle: "可考虑的插件",
			candidatesBody: "排序来自目录字段的本地匹配，不代表官方推荐、兼容保证或安全审计。",
			recommended: "优先查看",
			alternative: "备选",
			category: "分类",
			owner: "维护者",
			candidateConfiguredEnabled: "当前已配置 · 已启用",
			candidateConfiguredDisabled: "当前已配置 · 已停用",
			unverifiedChecks: "尚未验证的事项",
			showEvidence: "查看证据",
			hideEvidence: "收起证据",
			evidenceTitle: "发现证据",
			matchedFields: "匹配字段",
			fieldName: "名称",
			fieldOwner: "维护者",
			fieldCategory: "分类",
			fieldDescription: "描述",
			fieldNpm: "npm 包名",
			repository: "代码仓库",
			catalogPage: "目录页面",
			catalogSource: "目录数据源",
			provider: "目录来源",
			stars: "Stars",
			downloads: "下载量",
			added: "收录时间",
			warningCompatibility: "兼容性未验证",
			warningSecurity: "安全性未审查",
			warningSource: "版本与来源未锁定",
			installSpecTitle: "安全安装参数",
			installSpecBody: "仅复制经过语法校验的 npm 包名，供现有 dsh plugin add 流程使用；不会执行安装，也未验证该包与仓库的对应关系。",
			copyInstallSpec: "复制安装参数",
			copied: "已复制",
			copyFailed: "复制失败",
			noInstallSpec: "目录没有提供可安全复制的 npm 包名。",
			noMatchTitle: "暂未找到匹配候选",
			noMatchBody: "可以换一种更具体的目标描述后重试。没有可靠证据时，这里不会猜测推荐。",
			unavailableTitle: "插件目录暂不可用",
			unavailableBody: "当前配置检查仍可能有结果；目录恢复后可用同一目标重试。",
			sourceTitle: "目录状态",
			sourceComplete: "完整",
			sourcePartial: "不完整",
			sourceFresh: "目录可用",
			sourceStale: "缓存可能过期",
			sourceWarning: "目录读取存在警告；候选可能不完整或来自过期缓存。",
			sourceUpdated: "更新时间：{time}",
			sourceFetched: "读取时间：{time}",
			sourceInvalidEntries: "已跳过 {count} 条无效目录记录",
			resultFor: "目标：{task}",
			candidateCount: "共 {count} 个候选"
		};
		/** English dictionary checked against the Chinese key set. */
		const en = {
			tab: "Discover by need",
			title: "Discover capabilities by need",
			intro: "Describe the outcome first. DSH checks currently visible capabilities, then looks for candidates in a fixed plugin catalog.",
			taskLabel: "What do you want to accomplish?",
			taskPlaceholder: "For example: transcribe a meeting recording with timestamps",
			submit: "Analyze capabilities",
			resolving: "Analyzing capabilities locally…",
			cancel: "Cancel",
			privacyTitle: "Privacy",
			privacy: "Your task is sent only to the local DSH Host. The Host downloads and caches the complete, fixed awesome-dsh-plugin catalog and matches locally; your task is not sent to the catalog site, GitHub, or plugin authors.",
			idleTitle: "Start with the outcome, not a plugin name",
			idleBody: "This page only presents discovery evidence and safe installation parameters. It never installs, enables, or runs a plugin.",
			error: "Analysis is temporarily unavailable. Your task remains in the form.",
			retry: "Retry",
			existingTitle: "The current configuration may already satisfy this need",
			existingBody: "These possible matches come from the current plugin configuration and runtime-visible tools and skills. They do not claim installation, compatibility, or end-to-end verification.",
			currentMatchesTitle: "Possible matches in current capabilities",
			currentSkillsIncomplete: "The current skill list is incomplete, so this result may omit an available skill.",
			kindPlugin: "Configured plugin",
			kindTool: "Tool",
			kindSkill: "Skill",
			configuredEnabled: "Enabled",
			configuredDisabled: "Disabled",
			matchedTerms: "Matched terms",
			candidatesTitle: "Plugins to consider",
			candidatesBody: "Ranking comes from local catalog-field matching. It is not an official recommendation, compatibility guarantee, or security review.",
			recommended: "Review first",
			alternative: "Alternative",
			category: "Category",
			owner: "Maintainer",
			candidateConfiguredEnabled: "Currently configured · enabled",
			candidateConfiguredDisabled: "Currently configured · disabled",
			unverifiedChecks: "Unverified checks",
			showEvidence: "Show evidence",
			hideEvidence: "Hide evidence",
			evidenceTitle: "Discovery evidence",
			matchedFields: "Matched fields",
			fieldName: "Name",
			fieldOwner: "Maintainer",
			fieldCategory: "Category",
			fieldDescription: "Description",
			fieldNpm: "npm package name",
			repository: "Repository",
			catalogPage: "Catalog page",
			catalogSource: "Catalog source",
			provider: "Catalog provider",
			stars: "Stars",
			downloads: "Downloads",
			added: "Added",
			warningCompatibility: "Compatibility unverified",
			warningSecurity: "Security unreviewed",
			warningSource: "Version and source unpinned",
			installSpecTitle: "Safe installation parameters",
			installSpecBody: "Copies only an npm package name that passed syntax validation, for use with the existing dsh plugin add flow. It does not install anything or verify that the package corresponds to the repository.",
			copyInstallSpec: "Copy installation parameters",
			copied: "Copied",
			copyFailed: "Copy failed",
			noInstallSpec: "The catalog provides no npm package name that is safe to copy.",
			noMatchTitle: "No matching candidate yet",
			noMatchBody: "Try again with a more specific outcome. This page does not invent a recommendation when evidence is missing.",
			unavailableTitle: "Plugin catalog unavailable",
			unavailableBody: "Current-configuration matches may still be available. Retry the same task when the catalog recovers.",
			sourceTitle: "Catalog status",
			sourceComplete: "Complete",
			sourcePartial: "Incomplete",
			sourceFresh: "Catalog available",
			sourceStale: "Cache may be stale",
			sourceWarning: "The catalog reported a read warning; candidates may be incomplete or come from stale cache.",
			sourceUpdated: "Updated: {time}",
			sourceFetched: "Fetched: {time}",
			sourceInvalidEntries: "Skipped {count} invalid catalog records",
			resultFor: "Task: {task}",
			candidateCount: "{count} candidates"
		};
		//#endregion
		//#region lib/.build/client/store.js
		/** @returns the root-scoped store installed with the Settings tab. */
		function createCapabilityResolverViewStore() {
			return (0, _deepseek_ai_dsh_client_runtime_client.defineStore)({
				init: () => ({
					taskDraft: "",
					expandedCandidateId: null,
					copyFeedback: null
				}),
				actions: {
					setTaskDraft: (draft, value) => {
						draft.taskDraft = value;
					},
					toggleCandidate: (draft, candidateId) => {
						draft.expandedCandidateId = draft.expandedCandidateId === candidateId ? null : candidateId;
					},
					resetResultUi: (draft) => {
						draft.expandedCandidateId = null;
						draft.copyFeedback = null;
					},
					setCopyFeedback: (draft, candidateId, ok) => {
						draft.copyFeedback = {
							candidateId,
							ok
						};
					}
				}
			});
		}
		//#endregion
		//#region lib/.build/client/index.js
		/** Need-first capability discovery page contributed to Web Plugins settings. */
		/** Required browser services for the Settings contribution and local RPC carrier. */
		const inject = [
			"connection",
			"slots",
			"locale"
		];
		/** Register the read-only capability discovery page in Plugins settings. */
		function apply(ctx) {
			const namespace = "settings.capabilityResolver";
			const t = ctx.locale.bind(namespace);
			ctx.effect(() => ctx.locale.register(namespace, {
				zh,
				en
			}), "capability-resolver: dictionaries");
			const client = createCapabilityResolverClient(ctx.get("connection").rpc);
			const controller = new CapabilityResolverController((task, signal) => {
				const locale = ctx.locale.getSnapshot().active;
				return client.resolve({
					task,
					locale
				}, signal);
			});
			const store = createCapabilityResolverViewStore();
			ctx.effect(() => () => {
				controller.dispose();
			}, "capability-resolver: browser controller");
			const injected = () => ({
				hooks: { resolver: controller },
				resolve: controller.resolve,
				retry: controller.retry,
				cancel: controller.cancel
			});
			ctx.slots.inject("settings.plugins.tab", () => ctx.slots.register({
				name: "settings.plugins.tab",
				id: "discover",
				order: -10,
				label: () => t("tab"),
				locale: namespace,
				store,
				inject: injected
			}, CapabilityResolverSettingsTab));
		}
		//#endregion
		exports.CAPABILITY_RESOLVER_RPC_CHANNEL = CAPABILITY_RESOLVER_RPC_CHANNEL;
		exports.CAPABILITY_RESOLVER_RPC_ENDPOINT = CAPABILITY_RESOLVER_RPC_ENDPOINT;
		exports.CapabilityResolverRpcError = CapabilityResolverRpcError;
		exports.CapabilityResolverSettingsTab = CapabilityResolverSettingsTab;
		exports.apply = apply;
		exports.createCapabilityResolverClient = createCapabilityResolverClient;
		exports.inject = inject;
		exports.validateCapabilityResolution = validateCapabilityResolution;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map