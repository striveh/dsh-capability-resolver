/** Public JSON and wire types for the capability resolver. */
/** Fixed catalog origin. User task text is never appended to this URL. */
export const CAPABILITY_CATALOG_URL = 'https://awesome-dsh-plugin.com/plugins.json';
/** Logical Connection channel owned by this plugin. */
export const CAPABILITY_RESOLVER_RPC_CHANNEL = '/dsh-capability-resolver';
/** Sole read-only method on the resolver channel. */
export const CAPABILITY_RESOLVER_RPC_ENDPOINT = 'resolve';
/** Version of the public resolver response. */
export const CAPABILITY_RESOLVER_SCHEMA_VERSION = 1;
/** Maximum UTF-8 JSON bytes returned by one resolver operation. */
export const MAX_CAPABILITY_RESOLUTION_BYTES = 524_288;
/** Stable catalog provider identity. */
export const CAPABILITY_PROVIDER_ID = 'awesome-dsh-plugin';
//# sourceMappingURL=types.js.map