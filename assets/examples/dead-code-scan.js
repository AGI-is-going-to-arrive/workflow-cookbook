/**
 * dead-code-scan — loop-until-dry hunt for unreferenced symbols (REPORT ONLY).
 *
 * Each round, one finder scans the target for symbols that look unreferenced.
 * Unlike a destructive sweep, this demo NEVER edits or removes code — it only
 * reports, so it is safe to run against a live repo. The loop stops after two
 * clean rounds in a row, because confirming one symbol dead can clarify others.
 *
 * Real target: index.html (the SPA's inline vanilla JS).
 * Run:  Workflow({ scriptPath: 'assets/examples/dead-code-scan.js' })
 */

export const meta = {
  name: 'dead-code-scan',
  description: 'Find (report-only, non-destructive) unreferenced symbols round by round until a clean sweep',
  phases: [{ title: 'Find' }],
}

const DEAD = {
  type: 'object',
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        required: ['symbol', 'evidence'],
        properties: {
          symbol: { type: 'string' },
          kind: { type: 'string', enum: ['function', 'variable', 'event-handler', 'css-class', 'other'] },
          evidence: { type: 'string' },
        },
      },
    },
  },
}

const DRY_STREAK = 2 // stop after this many empty rounds in a row
const MAX_ROUNDS = 5 // hard cap so the loop always terminates
const TARGET = 'index.html'

const found = []
let emptyRounds = 0
let round = 0

while (emptyRounds < DRY_STREAK && round < MAX_ROUNDS) {
  round++
  phase('Find')
  const { items } = await agent(
    `Round ${round}. Read ${TARGET} and search the same file for references. List vanilla-JS symbols ` +
    `(functions, const/let bindings, event handlers) that are DEFINED but never REFERENCED anywhere in the file. ` +
    `Report only — do NOT edit any file. Ignore anything already reported: ` +
    `${found.map(r => r.symbol).join(', ') || 'nothing yet'}.`,
    { label: `find:round-${round}`, phase: 'Find', schema: DEAD },
  )

  if (items.length === 0) {
    emptyRounds++
    log(`Round ${round}: clean (${emptyRounds}/${DRY_STREAK} empty rounds)`)
    continue
  }

  emptyRounds = 0
  found.push(...items)
  log(`Round ${round}: ${items.length} candidate(s); ${found.length} total`)
}

return { rounds: round, candidateCount: found.length, candidates: found }
