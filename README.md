# Zero Dashboard

Zero Dashboard is an analytics product whose central canvas adapts to the
question being investigated. It starts as a useful, deterministic SaaS
dashboard and supports semantic drill-down through navigation, configured
suggestions, typed commands, and browser-native voice input.

The application is not a chatbot beside a dashboard. The dashboard itself is
the answer. The shell stays stable while only the analytical canvas is
recomposed.

## Architecture

```text
click / suggestion / text / voice
            ↓
  read-only question plan
  (fast semantic plan or Luna)
            ↓
  whitelisted ERP fields + period
            ↓
  query execution + fidelity check
            ↓
  responsive json-render Spec
            ↓
  approved React registry
            ↓
  shadcn-style analytics UI
```

Application code owns every value, component, chart, layout, and action. For
business questions the model may propose a declarative plan, but only the
server executes whitelisted, read-only fields. It cannot produce JSX, CSS,
SQL, arbitrary Odoo calls, or business numbers. Known requests use the same
executor without model latency. The renderer chooses compact metric, chart,
and record blocks from the approved registry, not a fixed dashboard page.

The ERP provider is currently a **simulated Dominican company**, not a live
Odoo connection. It includes dated invoices and credit notes so questions
about today's billing and this month's credit-note consumption can be
demonstrated without substituting unrelated SaaS MRR. Production use requires
an authenticated, company-scoped provider for each exposed model plus
permissions on every queried record. A missing period or unsupported
operation must produce an explicit unavailable/empty result, never another
period's numbers.

Top-level navigation and known drill-downs are immediate and deterministic.
Large analytical changes start a new batched composition. Narrow refinements
may provide the current spec as `initialSpec`.

## Stack

- Next.js 16.3.5, App Router, React 19, and TypeScript
- Tailwind CSS 4 with a restrained Geist-based visual system
- shadcn Charts conventions over Recharts (`ChartContainer`, `ChartTooltip`,
  `ChartTooltipContent`, semantic chart tokens, and legends)
- json-render catalog, registry, renderer, and experimental Jev composer
- Jev (`typesafe-ai/jev`) through Vercel AI Gateway
- Zustand for the interactive analytics context and history
- Web Speech API for Vox
- Vitest for deterministic logic

## json-render and Jev revision

The official json-render documentation still described the Jev composer as
unreleased when this project was built. The project therefore follows the
official source-build path and pins both local packages to the same repository
revision:

```text
json-render commit: 3ad381881194e7011ad3ccd6d668033495a06c29
@json-render/core: 0.21.0 source tarball
@json-render/react: 0.21.0 source tarball
```

The tarballs and provenance note live in `vendor/`. No caret or tilde range is
used for either experimental package. Review json-render release notes and
rebuild both packages together before changing this revision.

The server route uses the current experimental APIs:

- `experimental_composeSpec`
- `experimental_createEvaluator`
- model `typesafe-ai/jev`

The evaluator and `AI_GATEWAY_API_KEY` remain server-only.

## Local setup

Requirements: Node.js 20 or newer and pnpm 9.

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

For real Jev composition, copy `.env.example` to `.env.local` and set:

```text
AI_GATEWAY_API_KEY=...
```

The Vercel AI Gateway team must allow the `typesafe-ai` provider. There is no
`OPENAI_API_KEY` requirement and no voice-service API key.

Without an AI Gateway credential, deterministic dashboards, supported typed
questions, navigation, and Vox transcript capture continue to work. A new
question that requires Luna planning returns an explicit unavailable response
until a credential is configured; it does not silently substitute a generic
dashboard. The endpoint marks that path as `development-fallback`.

## Deterministic dataset and analytics

`lib/dataset/seed.ts` creates 2,481 reproducible SaaS customers with 12 months
of MRR and usage history, plans, segments, countries, acquisition sources,
payments, seats, and customer health. Acme Corp, Meridian Systems, Northstar
Labs, Helix Health, and Atlas Commerce carry intentional, testable storylines.

The analytics engine derives current and previous revenue, plan/country/segment
breakdowns, MRR movement, churn, net retention, acquisition conversion, risk,
loss contributors, and peer comparisons. Jev never receives the raw dataset.

The separate ERP demo provider exposes purchase orders, sales orders/lines,
invoices, credit notes, POS tickets, expense entries, payroll runs and taxes,
stock, attendance, and journal entries. `lib/erp/business-question.ts` contains
the validated query contract, execution, and view composition. ERP questions
that are not covered by a prepared plan go to a bounded, model-generated query
plan. Unsupported periods or missing records are explicit rather than replaced
by SaaS revenue. Adding a real module means registering its read-only
fields/date semantics, an authorized provider, and request/result fidelity
cases. Merely adding a component is not sufficient.

The demo is **not connected to Odoo**. Its sample records cannot answer every
business question. Real deployment needs authenticated, company-scoped Odoo
adapters; accounting definitions agreed per company; and persistent,
versioned recipe storage before newly generated recipes can be reused across
users. The current in-code recipe registry is curated, not a durable shared
memory. The model creates validated specifications from available fields; it
does not execute generated JSX, SQL, or arbitrary Odoo RPC.
See [AUDIT.md](./AUDIT.md) for the verified question matrix and remaining gaps.

## Vox architecture

Vox uses browser-native `SpeechRecognition` with the
`webkitSpeechRecognition` fallback:

- `continuous = false`
- `interimResults = true`
- locale `es-DO`
- interim results update only the live transcript
- one final transcript enters the same intent pipeline as typed input
- cancel calls `abort()` and does not alter the dashboard
- permission denial, no-speech, missing microphone, and unsupported browsers
  preserve the current canvas and keep typed commands available

No paid speech-to-text service is used. Browser support and recognition service
availability vary; Chromium-based browsers provide the target experience.

## Performance model

- The Overview is deterministic and prerenderable; it is never hidden behind an
  AI request.
- Navigation uses precomputed specs and avoids AI calls.
- The local dataset is generated from a fixed seed and analytics are computed
  once per runtime module.
- Candidate payloads contain configured aggregates, not transactions.
- Jev creation defaults to batched composition and streams full validated spec
  snapshots as NDJSON.
- The current dashboard stays visible with a small `aria-busy` composing state
  until a valid replacement arrives.
- The compose route uses the Node.js runtime, a 30-second Fluid Compute-compatible
  duration, input validation, cancellation, and a lightweight request limiter.

## Developer Mode

Open the small settings control in the header or press `Ctrl/Cmd + Shift + D`.
It shows the real input source, composition mode, candidate count, selected
components, chosen layout, resolver time, first-spec time, total time, and the
typed analytics context.

## Tests and quality checks

```bash
pnpm test
pnpm lint
pnpm build
```

The logic tests cover deterministic generation, analytics invariants, the exact
demo context transitions, candidate-set bounds, payroll growth formulas,
credit-note reconciliation, today's named invoices, POS grouping, and exact
ticket limits.

## Demo flow

1. Load Overview.
2. Click **Revenue**.
3. Click **Enterprise** in Segment performance.
4. Ask or say: “Show me why enterprise revenue dropped this month.”
5. Ask: “Which customers are responsible for most of that decline?”
6. Ask: “Open Acme.”
7. Ask: “Compare Acme with similar customers.”
8. Open Developer Mode to inspect the real composition diagnostics.

The same journey works with typed input on browsers that do not implement the
Web Speech API.

## Experimental caveats

Jev composition APIs can change without a major release. A valid composed spec
does not guarantee analytical relevance, so the candidate descriptions and
deterministic fallback are covered by tests. If composition errors, times out,
or returns no usable root, the last valid dashboard remains visible.
