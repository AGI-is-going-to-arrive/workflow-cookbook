/**
 * feedback-themes — turn a batch of feedback into ranked themes (parallel barrier).
 *
 * Loads a feedback file, summarizes each item in parallel, then clusters the
 * WHOLE set into ranked themes. The parallel() call is a genuine barrier:
 * clustering needs every summary at once — you cannot cluster one item on its
 * own — so this is a case where a barrier (not a pipeline) is the right call.
 *
 * Input is a clearly-labeled SAMPLE dataset (assets/samples/feedback-sample.csv);
 * the RUN — its Run ID, token usage, and clustered output — is real.
 * Run:  Workflow({ scriptPath: 'assets/examples/feedback-themes.js' })
 */

export const meta = {
  name: 'feedback-themes',
  description: 'Summarize a sample feedback batch in parallel, then cluster it into ranked themes',
  phases: [
    { title: 'Load' },
    { title: 'Summarize', detail: 'one agent per item', model: 'haiku' },
    { title: 'Cluster' },
  ],
}

const ITEMS = {
  type: 'object',
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'text'],
        properties: { id: { type: 'string' }, text: { type: 'string' } },
      },
    },
  },
}

const THEMES = {
  type: 'object',
  required: ['themes'],
  properties: {
    themes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['theme', 'count'],
        properties: {
          theme: { type: 'string' },
          count: { type: 'integer' },
          quote: { type: 'string' },
        },
      },
    },
  },
}

const SOURCE = 'assets/samples/feedback-sample.csv'

phase('Load')
const { items } = await agent(
  `Read ${SOURCE} (a CSV with columns id,text). Return every row as an item with its id and text.`,
  { label: 'load', phase: 'Load', schema: ITEMS },
)
log(`${items.length} feedback item(s) loaded`)

// Barrier on purpose: the next step clusters across the WHOLE set, so it needs
// all summaries together before it can run.
const summaries = await parallel(items.map(it => () =>
  agent(
    `Summarize this feedback in one sentence and name the single issue it is about.\nID ${it.id}: ${it.text}`,
    { label: `summarize:${it.id}`, phase: 'Summarize', model: 'haiku' },
  ).then(summary => ({ id: it.id, summary })),
))

const labelled = summaries.filter(Boolean)

phase('Cluster')
const { themes } = await agent(
  `Here are ${labelled.length} summarized feedback items. Cluster them into themes, count the items ` +
  `under each, pick one representative quote per theme, and rank the themes by count (descending).\n\n` +
  labelled.map(l => `- [${l.id}] ${l.summary}`).join('\n'),
  { label: 'cluster', phase: 'Cluster', schema: THEMES },
)

log(`${themes.length} theme(s) extracted from ${labelled.length} items`)
return { itemCount: labelled.length, themeCount: themes.length, themes }
