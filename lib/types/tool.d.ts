/** Model-facing, discovery-only capability resolver tool. */
import type { Context } from '@deepseek-ai/cordis';
import { type InferValue, type ToolDefinition, type ToolRunContext } from '@deepseek-ai/dsh-tools';
import type { CapabilityResolver } from './resolver.ts';
import { type CapabilityResolution, type CurrentCapabilityObservation, type ResolvedCapabilityResolverConfig } from './types.ts';
/** Sole model-visible tool name. */
export declare const CAPABILITY_RESOLVE_TOOL_NAME = "capability_resolve";
declare const modelResolutionOutputSchema: {
    readonly type: "object";
    readonly additionalProperties: false;
    readonly properties: {
        readonly schemaVersion: {
            readonly type: "integer";
            readonly const: 1;
            readonly required: true;
        };
        readonly decision: {
            readonly type: "string";
            readonly enum: readonly ["use-existing", "consider-plugin", "no-match", "unavailable"];
            readonly required: true;
        };
        readonly current: {
            readonly type: "object";
            readonly additionalProperties: false;
            readonly required: true;
            readonly properties: {
                readonly possibleMatchCount: {
                    readonly type: "integer";
                    readonly required: true;
                };
                readonly availableMatchCount: {
                    readonly type: "integer";
                    readonly required: true;
                };
                readonly kinds: {
                    readonly type: "array";
                    readonly required: true;
                    readonly items: {
                        readonly type: "string";
                        readonly enum: readonly ["plugin", "tool", "skill"];
                    };
                };
                readonly skillsComplete: {
                    readonly type: "boolean";
                    readonly required: true;
                };
            };
        };
        readonly candidates: {
            readonly type: "array";
            readonly required: true;
            readonly items: {
                readonly type: "object";
                readonly additionalProperties: false;
                readonly properties: {
                    readonly rank: {
                        readonly type: "integer";
                        readonly required: true;
                    };
                    readonly installSpec: {
                        readonly type: "object";
                        readonly additionalProperties: false;
                        readonly properties: {
                            readonly kind: {
                                readonly type: "string";
                                readonly const: "npm";
                                readonly required: true;
                            };
                            readonly packageName: {
                                readonly type: "string";
                                readonly required: true;
                            };
                        };
                    };
                    readonly configured: {
                        readonly type: "object";
                        readonly additionalProperties: false;
                        readonly properties: {
                            readonly enabled: {
                                readonly type: "boolean";
                                readonly required: true;
                            };
                        };
                    };
                    readonly evidence: {
                        readonly type: "object";
                        readonly additionalProperties: false;
                        readonly required: true;
                        readonly properties: {
                            readonly providerId: {
                                readonly type: "string";
                                readonly const: "awesome-dsh-plugin";
                                readonly required: true;
                            };
                            readonly catalogPageUrl: {
                                readonly type: "string";
                                readonly required: true;
                            };
                            readonly repositoryUrl: {
                                readonly type: "string";
                                readonly required: true;
                            };
                            readonly matchedFields: {
                                readonly type: "array";
                                readonly required: true;
                                readonly items: {
                                    readonly type: "string";
                                    readonly enum: readonly ["name", "owner", "category", "description", "npm"];
                                };
                            };
                            readonly stars: {
                                readonly type: "integer";
                            };
                            readonly downloads: {
                                readonly type: "integer";
                            };
                            readonly added: {
                                readonly type: "string";
                            };
                        };
                    };
                };
            };
        };
        readonly catalog: {
            readonly type: "object";
            readonly additionalProperties: false;
            readonly required: true;
            readonly properties: {
                readonly complete: {
                    readonly type: "boolean";
                    readonly required: true;
                };
                readonly stale: {
                    readonly type: "boolean";
                    readonly required: true;
                };
                readonly providerId: {
                    readonly type: "string";
                    readonly const: "awesome-dsh-plugin";
                    readonly required: true;
                };
                readonly catalogUrl: {
                    readonly type: "string";
                    readonly const: "https://awesome-dsh-plugin.com/plugins.json";
                    readonly required: true;
                };
                readonly invalidEntryCount: {
                    readonly type: "integer";
                    readonly required: true;
                };
            };
        };
        readonly privacy: {
            readonly type: "object";
            readonly additionalProperties: false;
            readonly required: true;
            readonly properties: {
                readonly catalogRequestContainsTask: {
                    readonly type: "boolean";
                    readonly const: false;
                    readonly required: true;
                };
            };
        };
        readonly safety: {
            readonly type: "object";
            readonly additionalProperties: false;
            readonly required: true;
            readonly properties: {
                readonly catalogMetadataTrusted: {
                    readonly type: "boolean";
                    readonly const: false;
                    readonly required: true;
                };
                readonly catalogFreeTextOmitted: {
                    readonly type: "boolean";
                    readonly const: true;
                    readonly required: true;
                };
                readonly installationPerformed: {
                    readonly type: "boolean";
                    readonly const: false;
                    readonly required: true;
                };
            };
        };
    };
};
/** Canonical value exposed to the model and Code Mode for one resolver call. */
export type CapabilityModelResolution = InferValue<typeof modelResolutionOutputSchema>;
/**
 * Remove catalog and current-capability free text before the result reaches a model or session log.
 * @param value - complete resolver result retained for the loopback browser RPC.
 * @returns a bounded projection containing only strict identifiers, enums, booleans, and numbers.
 */
export declare function projectCapabilityResolutionForModel(value: CapabilityResolution): CapabilityModelResolution;
type CapabilityAgent = NonNullable<ToolRunContext['agent']>;
/** Read current Loader, tool, and model-invocable skill metadata in one scope. */
export declare function collectCurrentCapabilities(ctx: Context, agent: CapabilityAgent | undefined, signal: AbortSignal): Promise<CurrentCapabilityObservation>;
/** Render the safe canonical projection into concise model-facing discovery text. */
export declare function renderCapabilityModelResolution(value: CapabilityModelResolution): string;
/** Create the discovery-only tool bound to the current Host resolver. */
export declare function createCapabilityResolveTool(ctx: Context, resolver: CapabilityResolver, config: ResolvedCapabilityResolverConfig): ToolDefinition;
export {};
//# sourceMappingURL=tool.d.ts.map