/**
 * review-spa — multi-dimension review of this book's SPA, with adversarial verify.
 *
 * Fans out one reviewer per dimension (bugs / security / a11y) over index.html.
 * The moment a dimension's review returns, each finding it raised is verified in
 * parallel by a cheap agent that tries to REFUTE it — only findings that survive
 * refutation are kept. pipeline() means a finding verifies as soon as ITS review
 * is done, with no wait for the slowest reviewer.
 *
 * Real target: the cookbook's own index.html (a ~600-line vanilla-JS SPA).
 * Run:  Workflow({ scriptPath: 'assets/examples/review-spa.js' })
 */

export const meta = {
  name: 'review-spa',
  description: "Review the book's SPA (index.html) across dimensions, then adversarially verify each finding",
  whenToUse: 'A real-run demo of fan-out review + adversarial verification',
  phases: [
    { title: 'Review', detail: 'one reviewer per dimension' },
    { title: 'Verify', detail: 'try to refute each finding', model: 'haiku' },
  ],
}

// Each reviewer must return findings in this exact shape (validated at the tool-call layer).
const FINDINGS = {
  type: 'object',
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'evidence', 'severity'],
        properties: {
          title: { type: 'string' },
          evidence: { type: 'string' },
          severity: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
      },
    },
  },
}

const VERDICT = {
  type: 'object',
  required: ['isReal'],
  properties: {
    isReal: { type: 'boolean' },
    reason: { type: 'string' },
  },
}

const TARGET = 'index.html'
const DIMENSIONS = [
  { key: 'bugs',     prompt: `Read ${TARGET} and find real logic bugs in its vanilla JS (hash router, markdown rendering, theme/language toggles, the slugify/anchor logic). Cite concrete line ranges.` },
  { key: 'security', prompt: `Read ${TARGET} and find real security issues (XSS via innerHTML, unsanitized markdown/HTML injection, unsafe external URLs). Cite concrete line ranges.` },
  { key: 'a11y',     prompt: `Read ${TARGET} and find real accessibility issues (missing alt/aria, keyboard navigation, focus management, color contrast). Cite concrete line ranges.` },
]

const reviewed = await pipeline(
  DIMENSIONS,
  // Stage 1 — review one dimension.
  d => agent(d.prompt, { label: `review:${d.key}`, phase: 'Review', schema: FINDINGS }),
  // Stage 2 — verify every finding from that dimension, in parallel.
  (review, d) => parallel(
    (review?.findings ?? []).map(f => () =>
      agent(
        `Adversarially verify this finding about ${TARGET}. Read the cited lines and try hard to refute it; ` +
        `if you cannot, it is real.\nTitle: ${f.title}\nEvidence: ${f.evidence}\nSeverity: ${f.severity}`,
        { label: `verify:${d.key}`, phase: 'Verify', model: 'haiku', schema: VERDICT },
      ).then(v => ({ ...f, dimension: d.key, verdict: v })),
    ),
  ),
)

// pipeline() returns one array per dimension → flatten, drop null slots, keep only confirmed.
const confirmed = reviewed.flat().filter(Boolean).filter(f => f.verdict?.isReal)
log(`${confirmed.length} confirmed finding(s) across ${DIMENSIONS.length} dimensions`)

return { confirmedCount: confirmed.length, confirmed }
