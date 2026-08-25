import { useId, type FormEvent, type ReactNode } from 'react'
import {
  Button,
  IconChevronDownOutline14,
  Pill,
  StateDot,
  writeClipboard,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  HostObservable,
  InjectFace,
  PropsLocale,
  PropsRuntime,
  PropsStore,
} from '@deepseek-ai/dsh-client-ui-slots'
import {
  CAPABILITY_CATALOG_URL,
  type CapabilityCandidateEvidence,
  type CapabilityMatchedField,
  type CapabilityResolution,
} from '../types.ts'
import { parseCanonicalCandidateLinks } from './api.ts'
import type { CapabilityResolverLocaleKey } from './locales.ts'
import type { CapabilityCandidate, CapabilityResolverView } from './model.ts'
import type { createCapabilityResolverViewStore } from './store.ts'
import css from './CapabilityResolverSettingsTab.module.css'

/** Registration-side business face bound by the slot renderer. */
export interface CapabilityResolverSettingsTabInjected {
  /** Browser-local state that survives Settings component remounts. */
  hooks: {
    resolver: HostObservable<CapabilityResolverView>
  }
  /** Start one read-only local resolution. */
  resolve: (task: string) => Promise<void>
  /** Retry the last admitted task. */
  retry: () => Promise<void>
  /** Cancel the active request. */
  cancel: () => void
}

/** Full props assembled for the capability discovery tab. */
export type CapabilityResolverSettingsTabProps =
  PropsRuntime<'settings.plugins.tab'>
  & PropsStore<ReturnType<typeof createCapabilityResolverViewStore>>
  & PropsLocale<'settings.capabilityResolver'>
  & InjectFace<CapabilityResolverSettingsTabInjected>

const FIELD_KEYS = {
  name: 'fieldName',
  owner: 'fieldOwner',
  category: 'fieldCategory',
  description: 'fieldDescription',
  npm: 'fieldNpm',
} as const satisfies Record<CapabilityMatchedField, CapabilityResolverLocaleKey>

const CURRENT_KIND_KEYS = {
  plugin: 'kindPlugin',
  tool: 'kindTool',
  skill: 'kindSkill',
} as const satisfies Record<
  CapabilityResolution['possibleCurrentMatches'][number]['kind'],
  CapabilityResolverLocaleKey
>

function EvidenceTerms({ terms, label }: { terms: readonly string[]; label: string }): ReactNode {
  if (terms.length === 0) return null
  return (
    <div>
      <dt>{label}</dt>
      <dd>{terms.join(' · ')}</dd>
    </div>
  )
}

/** Render Host-provided evidence without turning metadata into a trust claim. */
function Evidence({
  evidence,
  owner,
  t,
}: {
  evidence: CapabilityCandidateEvidence
  owner: string
  t: CapabilityResolverSettingsTabProps['t']
}): ReactNode {
  const links = parseCanonicalCandidateLinks(owner, evidence.repositoryUrl, evidence.catalogPageUrl)
  const repositoryUrl = links?.repositoryUrl
  const catalogPageUrl = links?.catalogPageUrl
  const catalogUrl = evidence.catalogUrl === CAPABILITY_CATALOG_URL ? CAPABILITY_CATALOG_URL : undefined
  return (
    <dl className={css.evidenceList}>
      <div>
        <dt>{t('provider')}</dt>
        <dd>{evidence.providerId}</dd>
      </div>
      <div>
        <dt>{t('matchedFields')}</dt>
        <dd>{evidence.matchedFields.map(field => t(FIELD_KEYS[field])).join(' · ')}</dd>
      </div>
      <EvidenceTerms terms={evidence.matchedTerms} label={t('matchedTerms')} />
      {repositoryUrl !== undefined ? (
        <div>
          <dt>{t('repository')}</dt>
          <dd><a href={repositoryUrl} target="_blank" rel="noopener noreferrer">{repositoryUrl}</a></dd>
        </div>
      ) : null}
      {catalogPageUrl !== undefined ? (
        <div>
          <dt>{t('catalogPage')}</dt>
          <dd><a href={catalogPageUrl} target="_blank" rel="noopener noreferrer">{catalogPageUrl}</a></dd>
        </div>
      ) : null}
      {catalogUrl !== undefined ? (
        <div>
          <dt>{t('catalogSource')}</dt>
          <dd><a href={catalogUrl} target="_blank" rel="noopener noreferrer">{catalogUrl}</a></dd>
        </div>
      ) : null}
      {evidence.stars !== undefined ? <div><dt>{t('stars')}</dt><dd>{evidence.stars}</dd></div> : null}
      {evidence.downloads !== undefined
        ? <div><dt>{t('downloads')}</dt><dd>{evidence.downloads}</dd></div>
        : null}
      {evidence.added !== undefined ? <div><dt>{t('added')}</dt><dd>{evidence.added}</dd></div> : null}
    </dl>
  )
}

/** Render one ranked candidate and its explicitly unverified evidence. */
function CandidateCard({
  candidate,
  index,
  open,
  copyFeedback,
  onToggle,
  onCopy,
  t,
}: {
  candidate: CapabilityCandidate
  index: number
  open: boolean
  copyFeedback: { readonly candidateId: string; readonly ok: boolean } | null
  onToggle: () => void
  onCopy: (candidateId: string, packageName: string) => void
  t: CapabilityResolverSettingsTabProps['t']
}): ReactNode {
  const detailId = useId()
  const candidateId = `${candidate.owner}/${candidate.name}:${index}`
  const copied = copyFeedback?.candidateId === candidateId ? copyFeedback.ok : undefined
  const installSpec = candidate.installSpec
  return (
    <article className={css.card} data-recommended={index === 0 ? 'true' : undefined}>
      <div className={css.cardHeader}>
        <Pill active={index === 0}>{t(index === 0 ? 'recommended' : 'alternative')}</Pill>
        <span className={css.category}>{t('category')} · {candidate.category}</span>
      </div>
      <h4 className={css.cardTitle}>{candidate.name}</h4>
      <p className={css.owner}>{t('owner')} · {candidate.owner}</p>
      <p className={css.description}>{candidate.description}</p>
      {candidate.configured !== undefined ? (
        <div className={css.candidateConfigured}>
          <Pill active={candidate.configured.enabled}>
            {t(candidate.configured.enabled ? 'candidateConfiguredEnabled' : 'candidateConfiguredDisabled')}
          </Pill>
          <code>{candidate.configured.moduleName}</code>
        </div>
      ) : null}
      <ul className={css.warningList} aria-label={t('unverifiedChecks')}>
        <li>{t('warningCompatibility')}</li>
        <li>{t('warningSecurity')}</li>
        <li>{t('warningSource')}</li>
      </ul>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={css.disclosure}
        aria-expanded={open}
        aria-controls={detailId}
        onClick={onToggle}
      >
        {t(open ? 'hideEvidence' : 'showEvidence')}
        <IconChevronDownOutline14 className={open ? css.chevronOpen : css.chevron} aria-hidden="true" />
      </Button>
      {open ? (
        <div className={css.details} id={detailId}>
          <h5>{t('evidenceTitle')}</h5>
          <Evidence evidence={candidate.evidence} owner={candidate.owner} t={t} />
          <div className={css.installSpec}>
            <h5>{t('installSpecTitle')}</h5>
            {installSpec === undefined ? <p>{t('noInstallSpec')}</p> : (
              <>
                <code>{installSpec.packageName}</code>
                <p>{t('installSpecBody')}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { onCopy(candidateId, installSpec.packageName) }}
                >
                  {t('copyInstallSpec')}
                </Button>
                {copied !== undefined ? (
                  <span className={copied ? css.copySuccess : css.copyFailure} role="status" aria-live="polite">
                    {t(copied ? 'copied' : 'copyFailed')}
                  </span>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}
    </article>
  )
}

/** Render point-in-time catalog freshness and provider observations. */
function CatalogState({
  catalog,
  t,
}: {
  catalog: CapabilityResolution['catalog']
  t: CapabilityResolverSettingsTabProps['t']
}): ReactNode {
  const headingId = useId()
  const hasWarning = catalog.warning !== undefined
    || catalog.sources.some(source => source.warning !== undefined)
  return (
    <section className={css.catalogState} aria-labelledby={headingId}>
      <div className={css.sourceHeading}>
        <StateDot state={!catalog.complete ? 'error' : catalog.stale ? 'warning' : 'done'} />
        <h4 id={headingId}>{t('sourceTitle')}</h4>
        <Pill>{t(catalog.complete ? 'sourceComplete' : 'sourcePartial')}</Pill>
        <Pill>{t(catalog.stale ? 'sourceStale' : 'sourceFresh')}</Pill>
      </div>
      {hasWarning ? <p className={css.sourceWarning}>{t('sourceWarning')}</p> : null}
      {catalog.sources.length > 0 ? (
        <ul className={css.sources}>
          {catalog.sources.map(source => (
            <li key={source.providerId}>
              <strong>{source.providerId}</strong>
              {source.updatedAt !== undefined ? <span>{t('sourceUpdated', { time: source.updatedAt })}</span> : null}
              {source.fetchedAt !== undefined ? <span>{t('sourceFetched', { time: source.fetchedAt })}</span> : null}
              {source.invalidEntryCount !== undefined && source.invalidEntryCount > 0
                ? <span>{t('sourceInvalidEntries', { count: source.invalidEntryCount })}</span>
                : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

/** Render current plugin, tool, and skill matches without calling them installed. */
function CurrentMatches({
  resolution,
  t,
}: {
  resolution: CapabilityResolution
  t: CapabilityResolverSettingsTabProps['t']
}): ReactNode {
  if (resolution.possibleCurrentMatches.length === 0 && resolution.currentSkillsComplete) return null
  return (
    <section className={css.configured}>
      <h4>{t('currentMatchesTitle')}</h4>
      {!resolution.currentSkillsComplete ? (
        <p className={css.currentSkillsWarning}>{t('currentSkillsIncomplete')}</p>
      ) : null}
      {resolution.possibleCurrentMatches.length > 0 ? (
        <ul>
          {resolution.possibleCurrentMatches.map((match, index) => (
            <li key={`${match.kind}:${match.name}:${index}`}>
              <div className={css.configuredRow}>
                <code>{match.name}</code>
                <Pill>{t(CURRENT_KIND_KEYS[match.kind])}</Pill>
                {match.enabled !== undefined ? (
                  <Pill active={match.enabled}>
                    {t(match.enabled ? 'configuredEnabled' : 'configuredDisabled')}
                  </Pill>
                ) : null}
              </div>
              {match.description !== undefined ? (
                <span>{match.description}</span>
              ) : null}
              {match.matchedTerms.length > 0 ? (
                <span>{t('matchedTerms')} · {match.matchedTerms.join(' · ')}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function decisionCopy(
  resolution: CapabilityResolution,
  t: CapabilityResolverSettingsTabProps['t'],
): { readonly title: string; readonly body: string } {
  switch (resolution.decision) {
    case 'use-existing': return { title: t('existingTitle'), body: t('existingBody') }
    case 'consider-plugin': return { title: t('candidatesTitle'), body: t('candidatesBody') }
    case 'no-match': return { title: t('noMatchTitle'), body: t('noMatchBody') }
    case 'unavailable': return { title: t('unavailableTitle'), body: t('unavailableBody') }
  }
}

/** Render the Host decision, configured matches, candidates, and catalog state. */
function ResolutionResult({
  task,
  resolution,
  expandedCandidateId,
  copyFeedback,
  onToggleCandidate,
  onCopyCandidate,
  t,
}: {
  task: string
  resolution: CapabilityResolution
  expandedCandidateId: string | null
  copyFeedback: { readonly candidateId: string; readonly ok: boolean } | null
  onToggleCandidate: (candidateId: string) => void
  onCopyCandidate: (candidateId: string, packageName: string) => void
  t: CapabilityResolverSettingsTabProps['t']
}): ReactNode {
  const copy = decisionCopy(resolution, t)
  return (
    <div className={css.result} aria-live="polite">
      <div className={css.resultHeading}>
        <div>
          <p className={css.resultTask}>{t('resultFor', { task })}</p>
          <h3>{copy.title}</h3>
        </div>
        {resolution.candidates.length > 0
          ? <Pill>{t('candidateCount', { count: resolution.candidates.length })}</Pill>
          : null}
      </div>
      <p className={css.resultIntro}>{copy.body}</p>
      <CurrentMatches resolution={resolution} t={t} />
      {resolution.candidates.length > 0 ? (
        <section aria-label={t('candidatesTitle')}>
          <ul className={css.candidates}>
            {resolution.candidates.map((candidate, index) => {
              const id = `${candidate.owner}/${candidate.name}:${index}`
              return (
                <li key={id}>
                  <CandidateCard
                    candidate={candidate}
                    index={index}
                    open={expandedCandidateId === id}
                    copyFeedback={copyFeedback}
                    onToggle={() => { onToggleCandidate(id) }}
                    onCopy={onCopyCandidate}
                    t={t}
                  />
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
      <CatalogState catalog={resolution.catalog} t={t} />
    </div>
  )
}

/** Render the read-only, need-first capability discovery tab. */
export function CapabilityResolverSettingsTab({
  actions,
  cancel,
  resolve,
  retry,
  t,
  useResolver,
  useStore,
}: CapabilityResolverSettingsTabProps): ReactNode {
  const taskDraft = useStore(state => state.taskDraft)
  const expandedCandidateId = useStore(state => state.expandedCandidateId)
  const copyFeedback = useStore(state => state.copyFeedback)
  const view = useResolver(state => state)
  const busy = view.status === 'resolving'
  const submit = (event: FormEvent): void => {
    event.preventDefault()
    const task = taskDraft.trim()
    if (task.length === 0 || busy) return
    actions.resetResultUi()
    void resolve(task)
  }
  const copyCandidate = (candidateId: string, packageName: string): void => {
    void writeClipboard(packageName).then((ok) => {
      actions.setCopyFeedback(candidateId, ok)
    })
  }

  return (
    <div className={css.section} aria-busy={busy} data-capability-resolver>
      <header className={css.pageHeader}>
        <h3>{t('title')}</h3>
        <p>{t('intro')}</p>
      </header>
      <form className={css.form} onSubmit={submit}>
        <label htmlFor="capability-resolver-task">{t('taskLabel')}</label>
        <textarea
          id="capability-resolver-task"
          rows={3}
          maxLength={500}
          value={taskDraft}
          placeholder={t('taskPlaceholder')}
          aria-describedby="capability-resolver-privacy-copy"
          disabled={busy}
          onChange={(event) => { actions.setTaskDraft(event.currentTarget.value) }}
        />
        <div className={css.formActions}>
          <Button variant="primary" type="submit" disabled={busy || taskDraft.trim().length === 0}>
            {t('submit')}
          </Button>
          {busy ? (
            <Button type="button" variant="outline" onClick={cancel}>{t('cancel')}</Button>
          ) : null}
        </div>
      </form>
      <aside className={css.privacy} aria-labelledby="capability-resolver-privacy">
        <strong id="capability-resolver-privacy">{t('privacyTitle')}</strong>
        <p id="capability-resolver-privacy-copy">{t('privacy')}</p>
      </aside>
      {view.status === 'idle' ? (
        <section className={css.emptyState}>
          <h3>{t('idleTitle')}</h3>
          <p>{t('idleBody')}</p>
        </section>
      ) : null}
      {view.status === 'resolving' ? (
        <div className={css.progress} role="status" aria-live="polite">
          <StateDot state="ongoing" />
          <span>{t('resolving')}</span>
        </div>
      ) : null}
      {view.status === 'error' ? (
        <div className={css.failure} role="alert">
          <p>{t('error')}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => { void retry() }}>{t('retry')}</Button>
        </div>
      ) : null}
      {view.status === 'ready' ? (
        <ResolutionResult
          task={view.task}
          resolution={view.resolution}
          expandedCandidateId={expandedCandidateId}
          copyFeedback={copyFeedback}
          onToggleCandidate={actions.toggleCandidate}
          onCopyCandidate={copyCandidate}
          t={t}
        />
      ) : null}
    </div>
  )
}
