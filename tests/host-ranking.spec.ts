import { describe, expect, it } from 'vitest'
import type { CatalogPluginRecord } from '../src/catalog.ts'
import { rankCatalogCandidates, rankPossibleCurrentMatches } from '../src/ranking.ts'
import { resolveConfig } from '../src/index.ts'
import type { CurrentCapabilityObservation } from '../src/types.ts'

const config = resolveConfig()

function plugin(overrides: Partial<CatalogPluginRecord> = {}): CatalogPluginRecord {
  return {
    name: 'Meeting Transcriber',
    owner: 'acme',
    repositoryName: 'meeting-transcriber',
    repositoryUrl: 'https://github.com/acme/meeting-transcriber',
    catalogPageUrl: 'https://awesome-dsh-plugin.com/p/acme/meeting-transcriber/',
    category: 'audio',
    categoryLabels: { en: 'Audio', zh: '音频' },
    description: { en: 'Transcribe meeting audio', zh: '转录会议录音' },
    npmPackage: '@acme/dsh-meeting-transcriber',
    stars: 1,
    downloads: 2,
    added: '2026-08-24',
    ...overrides,
  }
}

describe('local capability ranking', () => {
  it('removes Chinese request filler before matching catalog text', () => {
    const unrelated = plugin({
      name: 'Plugin Helper',
      repositoryName: 'plugin-helper',
      repositoryUrl: 'https://github.com/acme/plugin-helper',
      catalogPageUrl: 'https://awesome-dsh-plugin.com/p/acme/plugin-helper/',
      category: 'tools',
      categoryLabels: { en: 'Tools & Capabilities', zh: '工具与能力' },
      description: { en: 'Manage generic tools', zh: '一个可以使用的插件工具' },
      npmPackage: '@acme/dsh-plugin-helper',
    })

    const ranked = rankCatalogCandidates(
      '我想找一个可以转录会议录音的插件',
      'zh',
      [unrelated, plugin()],
      [],
      8,
      config,
    )

    expect(ranked.map(candidate => candidate.name)).toEqual(['Meeting Transcriber'])
    expect(ranked[0]?.evidence.matchedTerms).toEqual(expect.arrayContaining(['转录', '会议', '录音']))
  })

  it('derives useful English forms without using popularity as a ranking signal', () => {
    const alpha = plugin({
      name: 'Alpha Audio',
      repositoryName: 'alpha-audio',
      repositoryUrl: 'https://github.com/acme/alpha-audio',
      catalogPageUrl: 'https://awesome-dsh-plugin.com/p/acme/alpha-audio/',
      stars: 1,
      downloads: 1,
    })
    const zulu = plugin({
      name: 'Zulu Audio',
      repositoryName: 'zulu-audio',
      repositoryUrl: 'https://github.com/acme/zulu-audio',
      catalogPageUrl: 'https://awesome-dsh-plugin.com/p/acme/zulu-audio/',
      stars: 1_000_000,
      downloads: 1_000_000,
    })

    const ranked = rankCatalogCandidates(
      'transcribing meeting recordings',
      'en',
      [zulu, alpha],
      [],
      8,
      config,
    )

    expect(ranked.map(candidate => candidate.name)).toEqual(['Alpha Audio', 'Zulu Audio'])
    expect(ranked[0]?.evidence.matchedTerms).toEqual(expect.arrayContaining(['transcribe', 'meeting']))
    expect(ranked[0]?.evidence.matchedTerms).not.toContain('recorde')
    expect(ranked[1]?.evidence.stars).toBe(1_000_000)
  })

  it('matches both category labels and returns the requested localized label', () => {
    const ranked = rankCatalogCandidates('音频', 'zh', [plugin()], [], 8, config)

    expect(ranked).toHaveLength(1)
    expect(ranked[0]).toMatchObject({ category: '音频' })
    expect(ranked[0]?.evidence.matchedFields).toContain('category')
  })

  it('ranks speech-to-text intent above generic image text extraction', () => {
    const vision = plugin({
      name: 'Vision Text Helper',
      repositoryName: 'vision-text-helper',
      repositoryUrl: 'https://github.com/acme/vision-text-helper',
      catalogPageUrl: 'https://awesome-dsh-plugin.com/p/acme/vision-text-helper/',
      category: 'vision',
      categoryLabels: { en: 'Vision & Multimodal', zh: '视觉与多模态' },
      description: { en: 'Turn images into text', zh: '把图片转成文字并生成视觉内容' },
      npmPackage: '@acme/dsh-vision-text',
    })
    const voice = plugin({
      name: 'dsh-stt-input',
      repositoryName: 'dsh-stt-input',
      repositoryUrl: 'https://github.com/acme/dsh-stt-input',
      catalogPageUrl: 'https://awesome-dsh-plugin.com/p/acme/dsh-stt-input/',
      category: 'voice',
      categoryLabels: { en: 'Voice & Audio', zh: '语音与音频' },
      description: {
        en: 'Speech-to-text input transcribes audio into text.',
        zh: '语音转文字输入，识别音频并转写为文本。',
      },
      npmPackage: '@acme/dsh-stt-input',
    })
    const chatVoice = plugin({
      name: 'dsh-chatvoice',
      repositoryName: 'dsh-chatvoice',
      repositoryUrl: 'https://github.com/acme/dsh-chatvoice',
      catalogPageUrl: 'https://awesome-dsh-plugin.com/p/acme/dsh-chatvoice/',
      category: 'voice',
      categoryLabels: { en: 'Voice & Audio', zh: '语音与音频' },
      description: {
        en: 'Browser speech recognition input and read-aloud replies.',
        zh: '浏览器语音识别输入，并自动朗读回复。',
      },
      npmPackage: '@acme/dsh-chatvoice',
    })

    const ranked = rankCatalogCandidates(
      '我想把会议录音转成文字', 'zh', [vision, chatVoice, voice], [], 8, config,
    )

    expect(ranked.map(candidate => candidate.name)).toEqual(['dsh-stt-input', 'dsh-chatvoice'])
    expect(ranked[0]?.evidence.matchedTerms).toEqual(expect.arrayContaining(['语音', '音频', '转写']))
  })

  it('counts derived word forms as one query concept instead of independent coverage', () => {
    const recorder = plugin({
      name: 'Recording Recorder',
      repositoryName: 'recording-recorder',
      repositoryUrl: 'https://github.com/acme/recording-recorder',
      catalogPageUrl: 'https://awesome-dsh-plugin.com/p/acme/recording-recorder/',
      description: { en: 'Record and archive recordings', zh: '录制并归档录音' },
      npmPackage: '@acme/dsh-recording-recorder',
    })

    expect(rankCatalogCandidates(
      'recordings unrelated', 'en', [recorder], [], 8, config,
    )).toEqual([])
  })

  it('does not recommend capabilities for low-information requests', () => {
    const generic = plugin({
      name: 'Generic Plugin Tool',
      repositoryName: 'generic-plugin-tool',
      repositoryUrl: 'https://github.com/acme/generic-plugin-tool',
      catalogPageUrl: 'https://awesome-dsh-plugin.com/p/acme/generic-plugin-tool/',
      description: { en: 'Use data to do something', zh: '一个能用的插件工具' },
      npmPackage: '@acme/dsh-generic-plugin-tool',
    })
    const current: CurrentCapabilityObservation = {
      configuredPlugins: [],
      capabilities: [{ kind: 'tool', name: 'generic_tool', description: 'Use data to do something' }],
      skillsComplete: true,
    }

    for (const task of [
      'I need a plugin that can do something',
      'I need to use data',
      '我想找一个能用的插件',
    ]) {
      expect(rankCatalogCandidates(task, 'en', [generic], [], 8, config)).toEqual([])
      expect(rankPossibleCurrentMatches(task, current, [generic], config)).toEqual([])
    }
  })

  it('ranks financial market data above a competing plugin marketplace', () => {
    const finance = plugin({
      name: 'Financial Market Data',
      repositoryName: 'financial-market-data',
      repositoryUrl: 'https://github.com/acme/financial-market-data',
      catalogPageUrl: 'https://awesome-dsh-plugin.com/p/acme/financial-market-data/',
      category: 'finance',
      categoryLabels: { en: 'Finance & Markets', zh: '金融与市场' },
      description: { en: 'Stock quotes, prices, and OHLCV feeds', zh: '股票行情与价格数据' },
      npmPackage: '@acme/dsh-financial-market-data',
      stars: 0,
    })
    const marketplace = plugin({
      name: 'DSH Plugin Market',
      repositoryName: 'plugin-market',
      repositoryUrl: 'https://github.com/acme/plugin-market',
      catalogPageUrl: 'https://awesome-dsh-plugin.com/p/acme/plugin-market/',
      category: 'marketplace',
      categoryLabels: { en: 'Plugin Markets & Managers', zh: '插件市场与管理' },
      description: { en: 'Browse plugin catalog data and install extensions', zh: '浏览插件目录并安装扩展' },
      npmPackage: '@acme/dsh-plugin-market',
      stars: 1_000_000,
    })

    expect(rankCatalogCandidates(
      'I need market data', 'en', [marketplace, finance], [], 8, config,
    ).map(candidate => candidate.name)).toEqual([
      'Financial Market Data',
      'DSH Plugin Market',
    ])
  })

  it('does not count a generic live modifier as capability evidence', () => {
    const repeated = plugin({
      name: 'context-vista',
      repositoryName: 'context-vista',
      repositoryUrl: 'https://github.com/acme/context-vista',
      catalogPageUrl: 'https://awesome-dsh-plugin.com/p/acme/context-vista/',
      category: 'usage',
      categoryLabels: { en: 'Usage & Billing', zh: '用量与计费' },
      description: { en: 'A live panel for context token usage.', zh: '实时上下文用量面板。' },
      npmPackage: 'context-vista',
      stars: 1_000_000,
    })
    const covered = plugin({
      name: 'dsh-environment-context',
      repositoryName: 'dsh-environment-context',
      repositoryUrl: 'https://github.com/acme/dsh-environment-context',
      catalogPageUrl: 'https://awesome-dsh-plugin.com/p/acme/dsh-environment-context/',
      category: 'tools',
      categoryLabels: { en: 'Tools & Capabilities', zh: '工具与能力' },
      description: { en: 'Injects live time, weather, and device context.', zh: '注入实时天气与设备上下文。' },
      npmPackage: undefined,
      stars: 0,
    })

    const ranked = rankCatalogCandidates(
      'I want live weather context', 'en', [repeated, covered], [], 8, config,
    )

    expect(ranked.map(candidate => candidate.name)).toEqual(['dsh-environment-context'])
    expect(ranked[0]?.evidence.matchedTerms).toEqual(expect.arrayContaining(['weather', 'context']))
  })

  it('matches only the exact configured monorepo path', () => {
    const first = plugin({
      name: 'suite#first',
      repositoryName: 'suite',
      repositoryUrl: 'https://github.com/acme/suite/tree/main/packages/first',
      repositoryPath: 'packages/first',
      catalogPageUrl: 'https://awesome-dsh-plugin.com/p/acme/suite--packages-first/',
      npmPackage: undefined,
    })
    const second = plugin({
      name: 'suite#second',
      repositoryName: 'suite',
      repositoryUrl: 'https://github.com/acme/suite/tree/main/packages/second',
      repositoryPath: 'packages/second',
      catalogPageUrl: 'https://awesome-dsh-plugin.com/p/acme/suite--packages-second/',
      npmPackage: undefined,
    })
    const configured = [{
      entryId: 'first',
      moduleName: 'github:acme/suite#path:/packages/first',
      enabled: true,
    }]

    const candidates = rankCatalogCandidates(
      'transcribe meeting recordings', 'en', [first, second], configured, 8, config,
    )

    expect(candidates.map(candidate => candidate.name)).toEqual(['suite#second'])
  })

  it('bounds configured evidence copied into candidate output', () => {
    const ranked = rankCatalogCandidates(
      'transcribe meeting recordings',
      'en',
      [plugin()],
      [{
        entryId: 'e'.repeat(10_000),
        moduleName: `@acme/dsh-meeting-transcriber@${'x'.repeat(10_000)}`,
        enabled: false,
      }],
      8,
      config,
    )

    expect(Array.from(ranked[0]?.configured?.entryId ?? '')).toHaveLength(200)
    expect(Array.from(ranked[0]?.configured?.moduleName ?? '')).toHaveLength(512)
  })

  it('treats enabled configured plugins as current and filters only those candidates', () => {
    const enabled: CurrentCapabilityObservation = {
      configuredPlugins: [{
        entryId: 'meeting',
        moduleName: '@acme/dsh-meeting-transcriber',
        enabled: true,
      }],
      capabilities: [],
      skillsComplete: true,
    }
    const disabled: CurrentCapabilityObservation = {
      ...enabled,
      configuredPlugins: [{ ...enabled.configuredPlugins[0]!, enabled: false }],
    }

    expect(rankCatalogCandidates(
      'transcribe meeting recordings', 'en', [plugin()], enabled.configuredPlugins, 8, config,
    )).toEqual([])
    expect(rankPossibleCurrentMatches(
      'transcribe meeting recordings', enabled, [plugin()], config,
    )).toEqual([expect.objectContaining({ kind: 'plugin', name: 'Meeting Transcriber', enabled: true })])

    const disabledCandidates = rankCatalogCandidates(
      'transcribe meeting recordings', 'en', [plugin()], disabled.configuredPlugins, 8, config,
    )
    expect(disabledCandidates).toEqual([
      expect.objectContaining({
        configured: expect.objectContaining({ entryId: 'meeting', enabled: false }),
      }),
    ])
  })

  it('requires two unique matches for a multi-term current-capability inference', () => {
    const current: CurrentCapabilityObservation = {
      configuredPlugins: [{
        entryId: 'recorder',
        moduleName: '@deepseek-ai/dsh-llm-call-recorder',
        enabled: false,
      }],
      capabilities: [],
      skillsComplete: true,
    }

    expect(rankPossibleCurrentMatches(
      '我想把会议录音转成文字', current, [], config,
    )).toEqual([])
  })

  it('preserves an exact current-capability name match for a multi-term task', () => {
    const current: CurrentCapabilityObservation = {
      configuredPlugins: [],
      capabilities: [{ kind: 'tool', name: 'weather', description: '' }],
      skillsComplete: true,
    }

    expect(rankPossibleCurrentMatches(
      'weather context unrelated', current, [], config,
    )).toEqual([expect.objectContaining({ kind: 'tool', name: 'weather' })])
  })
})
