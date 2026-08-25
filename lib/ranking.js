/** Deterministic local lexical ranking for catalog and current capabilities. */
import { MATCHED_FIELD_ORDER } from "./catalog.js";
import { CAPABILITY_CATALOG_URL, CAPABILITY_PROVIDER_ID, } from "./types.js";
const STOP_WORDS = new Set([
    'a', 'able', 'an', 'and', 'app', 'can', 'data', 'do', 'does', 'doing', 'find', 'for', 'get',
    'i', 'in', 'is', 'it', 'live', 'me', 'my', 'need', 'of', 'on', 'or', 'plugin', 'plugins', 'please',
    'something', 'that', 'the', 'this', 'to', 'tool', 'tools', 'use', 'uses', 'using', 'want', 'with',
    '一个', '可以', '帮我', '插件', '工具', '希望', '想要', '需要', '能够', '这个', '那个',
]);
const CHINESE_REQUEST_FILLER = /(?:我想找|我想把|我想要?|想找|寻找|查找|需要|一个|一款|能用|可用|可以|能够|帮我|请|用来|用于|使用|支持|实时|插件|能力|工具|并且|以及|然后|的)/gu;
const VOICE_INTENT = /(?:录音|语音|音频|speech|audio|voice|recordings?)/iu;
const TRANSCRIPTION_INTENT = /(?:转成文字|转为文字|转文字|转成文本|转为文本|转写|语音识别|transcrib|transcription|speech[ -]?to[ -]?text)/iu;
const TRANSCRIPTION_CONCEPT = /(?:转写|识别|文字|文本|transcrib|transcription|text)/iu;
const CHINESE_TRANSCRIPTION_PHRASE = /(?:转成文字|转为文字|转文字|转成文本|转为文本|转写|语音识别)/gu;
const MARKET_DATA_INTENT = /\bmarkets?[ -]+data\b/iu;
const VOICE_EXPANSION = ['录音', '语音', '音频', 'speech', 'audio', 'voice', 'recording'];
const TRANSCRIPTION_EXPANSION = [
    '转写',
    '识别',
    '文字',
    '文本',
    'transcribe',
    'transcription',
    'text',
    'stt',
    'asr',
];
const MARKET_DATA_EVIDENCE = [
    'data',
    'quote',
    'quotes',
    'price',
    'prices',
    'ticker',
    'tickers',
    'ohlcv',
    'watchlist',
    'watchlists',
    'candlestick',
    'candlesticks',
    'kline',
];
const FINANCIAL_MARKET_EVIDENCE = [
    'finance',
    'financial',
    'stock',
    'stocks',
    'equity',
    'equities',
    'trading',
    'trade',
    'investment',
    'investing',
    'portfolio',
    'crypto',
    'security',
    'securities',
];
const RESTORED_E_FOR_ING = new Map([['transcrib', 'transcribe']]);
const MAX_MATCHED_TERM_CHARS = 80;
const MAX_CURRENT_CAPABILITY_NAME_CHARS = 200;
const MAX_CONFIGURED_REFERENCE_CHARS = 512;
function normalized(value) {
    return value.normalize('NFKC').toLocaleLowerCase('en-US');
}
function truncateText(value, maxChars) {
    const characters = Array.from(value);
    return characters.length <= maxChars ? value : characters.slice(0, maxChars).join('');
}
function withinTermBound(value) {
    return Array.from(value).length <= MAX_MATCHED_TERM_CHARS;
}
function latinVariants(token) {
    const queue = [token];
    const result = new Set();
    while (queue.length > 0) {
        const current = queue.shift();
        if (current === undefined || result.has(current) || !withinTermBound(current))
            continue;
        result.add(current);
        if (current.length > 4 && current.endsWith('s'))
            queue.push(current.slice(0, -1));
        if (current.length > 5 && current.endsWith('ing')) {
            const stem = current.slice(0, -3);
            queue.push(stem);
            const doubledConsonant = /([b-df-hj-np-tv-z])\1$/u.exec(stem);
            if (doubledConsonant !== null)
                queue.push(stem.slice(0, -1));
            const restored = RESTORED_E_FOR_ING.get(stem);
            if (restored !== undefined)
                queue.push(restored);
        }
    }
    return [...result];
}
function fieldTokenVariants(value) {
    const result = new Set();
    for (const match of normalized(value).matchAll(/[\p{L}\p{N}]+/gu)) {
        const token = match[0];
        if (token.length === 0 || STOP_WORDS.has(token))
            continue;
        if (/\p{Script=Han}/u.test(token)) {
            const characters = Array.from(token);
            if (withinTermBound(token))
                result.add(token);
            for (let index = 0; index + 1 < characters.length; index += 1) {
                const pair = `${characters[index]}${characters[index + 1]}`;
                if (!STOP_WORDS.has(pair))
                    result.add(pair);
            }
        }
        else {
            latinVariants(token).forEach(term => result.add(term));
        }
    }
    return [...result];
}
function deduplicatedConcept(variants) {
    const bounded = [...new Set(variants.filter(term => term.length > 0
            && !STOP_WORDS.has(term) && withinTermBound(term)))];
    return bounded.length === 0 ? undefined : { variants: bounded };
}
function exactTokenConcept(variants, required = false) {
    return {
        variants: [...new Set(variants.filter(withinTermBound))],
        exactTokensOnly: true,
        ...(required ? { required: true } : {}),
    };
}
function baseQueryConcepts(task) {
    const concepts = [];
    const seen = new Set();
    for (const match of normalized(task).matchAll(/[\p{L}\p{N}]+/gu)) {
        const token = match[0];
        if (STOP_WORDS.has(token))
            continue;
        const additions = [];
        if (/\p{Script=Han}/u.test(token)) {
            const characters = Array.from(token);
            if (characters.length <= 2)
                additions.push(deduplicatedConcept([token]));
            else {
                for (let index = 0; index + 1 < characters.length; index += 1) {
                    additions.push(deduplicatedConcept([`${characters[index]}${characters[index + 1]}`]));
                }
            }
        }
        else {
            additions.push(deduplicatedConcept(latinVariants(token)));
        }
        for (const concept of additions) {
            if (concept === undefined)
                continue;
            const key = concept.variants.join('\0');
            if (seen.has(key))
                continue;
            seen.add(key);
            concepts.push(concept);
        }
    }
    return concepts;
}
function extendIntentConcept(concepts, intent, expansion) {
    const variants = expansion.flatMap(fieldTokenVariants);
    const target = concepts.findIndex(concept => concept.variants.some(term => intent.test(term)));
    const expanded = deduplicatedConcept([
        ...(target < 0 ? [] : concepts[target]?.variants ?? []),
        ...variants,
    ]);
    if (expanded === undefined)
        return;
    if (target < 0)
        concepts.push(expanded);
    else
        concepts[target] = expanded;
}
function queryPlan(task) {
    const cleaned = task.replace(CHINESE_REQUEST_FILLER, ' ');
    const voiceIntent = VOICE_INTENT.test(cleaned);
    const transcriptionIntent = TRANSCRIPTION_INTENT.test(cleaned);
    const marketDataIntent = MARKET_DATA_INTENT.test(normalized(cleaned));
    const conceptSource = transcriptionIntent
        ? cleaned.replace(CHINESE_TRANSCRIPTION_PHRASE, ' 转写 ')
        : cleaned;
    const concepts = baseQueryConcepts(conceptSource);
    let baseConceptCount = concepts.length;
    if (voiceIntent)
        extendIntentConcept(concepts, VOICE_INTENT, VOICE_EXPANSION);
    if (transcriptionIntent) {
        extendIntentConcept(concepts, TRANSCRIPTION_CONCEPT, TRANSCRIPTION_EXPANSION);
    }
    if (marketDataIntent) {
        const marketIndex = concepts.findIndex(concept => concept.variants.some(term => term === 'market'));
        const marketConcept = concepts[marketIndex];
        if (marketConcept !== undefined) {
            concepts[marketIndex] = {
                ...marketConcept,
                exactTokensOnly: true,
                required: true,
            };
        }
        else {
            concepts.push(exactTokenConcept(['market', 'markets'], true));
        }
        concepts.push(exactTokenConcept(MARKET_DATA_EVIDENCE, true));
        concepts.push(exactTokenConcept(FINANCIAL_MARKET_EVIDENCE));
        baseConceptCount = Math.max(baseConceptCount, 2);
    }
    return { concepts, baseConceptCount };
}
function matchConcepts(concepts, value) {
    const field = new Set(fieldTokenVariants(value));
    const normalizedValue = normalized(value);
    const rawTokens = new Set([...normalizedValue.matchAll(/[\p{L}\p{N}]+/gu)].map(match => match[0]));
    const compact = normalizedValue.replaceAll(/[^\p{L}\p{N}]+/gu, '');
    const matches = [];
    concepts.forEach((concept, index) => {
        const terms = concept.variants.filter(term => concept.exactTokensOnly === true
            ? rawTokens.has(term)
            : field.has(term) || (term.length >= 3 && compact.includes(term)));
        if (terms.length > 0)
            matches.push({ index, terms });
    });
    return matches;
}
function configuredFor(plugin, configuredPlugins) {
    const github = `github:${plugin.owner}/${plugin.repositoryName}`;
    for (const entry of configuredPlugins) {
        const specifier = entry.moduleName;
        const npmMatch = plugin.npmPackage !== undefined
            && (specifier === plugin.npmPackage || specifier.startsWith(`${plugin.npmPackage}@`));
        const githubPath = plugin.repositoryPath === undefined
            ? undefined
            : `${github}#path:/${plugin.repositoryPath}`;
        const repositoryMatch = specifier === plugin.repositoryUrl
            || (plugin.repositoryPath === undefined && specifier.startsWith(`${plugin.repositoryUrl}#`))
            || (plugin.repositoryPath === undefined && (specifier === github || specifier.startsWith(`${github}#`)))
            || specifier === githubPath;
        const nameMatch = specifier === plugin.name || specifier.startsWith(`${plugin.name}@`);
        if (npmMatch || repositoryMatch || nameMatch) {
            return {
                entryId: truncateText(entry.entryId, MAX_CURRENT_CAPABILITY_NAME_CHARS),
                moduleName: truncateText(entry.moduleName, MAX_CONFIGURED_REFERENCE_CHARS),
                enabled: entry.enabled,
            };
        }
    }
    return undefined;
}
function catalogScore(task, plan, plugin) {
    const values = {
        name: plugin.name,
        owner: plugin.owner,
        category: `${plugin.category} ${plugin.categoryLabels.en} ${plugin.categoryLabels.zh}`,
        description: `${plugin.description.en} ${plugin.description.zh}`,
        npm: plugin.npmPackage ?? '',
    };
    const weights = {
        name: 9,
        npm: 8,
        category: 5,
        description: 4,
        owner: 1,
    };
    const fields = [];
    const matchedTerms = new Set();
    const strongestWeights = new Map();
    for (const field of MATCHED_FIELD_ORDER) {
        const matches = matchConcepts(plan.concepts, values[field]);
        if (matches.length === 0)
            continue;
        fields.push(field);
        matches.forEach((match) => {
            match.terms.forEach(term => matchedTerms.add(term));
            strongestWeights.set(match.index, Math.max(strongestWeights.get(match.index) ?? 0, weights[field]));
        });
    }
    if (plan.concepts.some((concept, index) => concept.required === true && !strongestWeights.has(index))) {
        return undefined;
    }
    let score = [...strongestWeights.values()].reduce((total, weight) => total + weight, 0);
    score += strongestWeights.size * 2;
    const compactTask = normalized(task).replaceAll(/[^\p{L}\p{N}]+/gu, '');
    const compactName = normalized(plugin.name).replaceAll(/[^\p{L}\p{N}]+/gu, '');
    const exactName = compactName.length >= 3 && compactTask.includes(compactName);
    if (exactName)
        score += 20;
    const minimumMatches = plan.baseConceptCount >= 2 ? 2 : 1;
    if (!exactName && strongestWeights.size < minimumMatches)
        return undefined;
    return { score, fields, terms: [...matchedTerms] };
}
/** Rank validated catalog records without any network access. */
export function rankCatalogCandidates(task, locale, plugins, configuredPlugins, limit, config) {
    const plan = queryPlan(task);
    if (plan.concepts.length === 0)
        return [];
    const ranked = [];
    for (const plugin of plugins) {
        const match = catalogScore(task, plan, plugin);
        if (match === undefined)
            continue;
        const configured = configuredFor(plugin, configuredPlugins);
        const candidate = {
            name: plugin.name,
            owner: plugin.owner,
            category: plugin.categoryLabels[locale],
            description: plugin.description[locale],
            ...(plugin.npmPackage === undefined
                ? {}
                : { installSpec: { kind: 'npm', packageName: plugin.npmPackage } }),
            ...(configured === undefined ? {} : { configured }),
            evidence: {
                providerId: CAPABILITY_PROVIDER_ID,
                catalogUrl: CAPABILITY_CATALOG_URL,
                catalogPageUrl: plugin.catalogPageUrl,
                repositoryUrl: plugin.repositoryUrl,
                matchedFields: match.fields,
                matchedTerms: match.terms.slice(0, config.maxMatchedTerms),
                ...(plugin.stars === undefined ? {} : { stars: plugin.stars }),
                ...(plugin.downloads === undefined ? {} : { downloads: plugin.downloads }),
                ...(plugin.added === undefined ? {} : { added: plugin.added }),
            },
        };
        if (configured?.enabled === true)
            continue;
        ranked.push({
            score: match.score,
            value: candidate,
        });
    }
    ranked.sort((left, right) => right.score - left.score
        || left.value.name.localeCompare(right.value.name));
    return ranked.slice(0, limit).map(item => item.value);
}
function currentScore(task, plan, name, description) {
    const nameMatches = matchConcepts(plan.concepts, name);
    const descriptionMatches = matchConcepts(plan.concepts, description);
    const concepts = new Set();
    const terms = new Set();
    nameMatches.forEach((match) => {
        concepts.add(match.index);
        match.terms.forEach(term => terms.add(term));
    });
    descriptionMatches.forEach((match) => {
        concepts.add(match.index);
        match.terms.forEach(term => terms.add(term));
    });
    if (plan.concepts.some((concept, index) => concept.required === true && !concepts.has(index))) {
        return undefined;
    }
    const compactTask = normalized(task).replaceAll(/[^\p{L}\p{N}]+/gu, '');
    const compactName = normalized(name).replaceAll(/[^\p{L}\p{N}]+/gu, '');
    const exactName = compactName.length >= 3 && compactTask.includes(compactName);
    if (!exactName && concepts.size < (plan.baseConceptCount >= 2 ? 2 : 1))
        return undefined;
    const nameConcepts = new Set(nameMatches.map(match => match.index));
    const score = [...concepts].reduce((total, index) => total + (nameConcepts.has(index) ? 9 : 4), 0);
    return { score, terms: [...terms] };
}
/** Rank bounded, explicitly possible current matches without claiming capability equivalence. */
export function rankPossibleCurrentMatches(task, current, catalog, config) {
    const plan = queryPlan(task);
    if (plan.concepts.length === 0)
        return [];
    const ranked = [];
    const seen = new Set();
    for (const capability of current.capabilities) {
        const match = currentScore(task, plan, capability.name, capability.description);
        if (match === undefined)
            continue;
        const key = `${capability.kind}:${capability.name}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        ranked.push({
            score: match.score,
            value: {
                kind: capability.kind,
                name: truncateText(capability.name, MAX_CURRENT_CAPABILITY_NAME_CHARS),
                description: truncateText(capability.description, config.maxDescriptionChars),
                matchedTerms: match.terms.slice(0, config.maxMatchedTerms),
            },
        });
    }
    for (const plugin of catalog) {
        const configured = configuredFor(plugin, current.configuredPlugins);
        if (configured === undefined)
            continue;
        const match = currentScore(task, plan, plugin.name, `${plugin.description.en} ${plugin.description.zh}`);
        if (match === undefined)
            continue;
        const key = `plugin:${configured.entryId}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        ranked.push({
            score: match.score + (configured.enabled ? 1_000 : 0),
            value: {
                kind: 'plugin',
                name: plugin.name,
                description: plugin.description.en,
                enabled: configured.enabled,
                matchedTerms: match.terms.slice(0, config.maxMatchedTerms),
            },
        });
    }
    for (const plugin of current.configuredPlugins) {
        const key = `plugin:${plugin.entryId}`;
        if (seen.has(key))
            continue;
        const match = currentScore(task, plan, plugin.moduleName, '');
        if (match === undefined)
            continue;
        seen.add(key);
        ranked.push({
            score: match.score + (plugin.enabled ? 1_000 : 0),
            value: {
                kind: 'plugin',
                name: truncateText(plugin.moduleName, MAX_CONFIGURED_REFERENCE_CHARS),
                enabled: plugin.enabled,
                matchedTerms: match.terms.slice(0, config.maxMatchedTerms),
            },
        });
    }
    ranked.sort((left, right) => right.score - left.score
        || left.value.kind.localeCompare(right.value.kind)
        || left.value.name.localeCompare(right.value.name));
    return ranked.slice(0, config.maxCurrentMatches).map(item => item.value);
}
//# sourceMappingURL=ranking.js.map