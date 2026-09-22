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
      AnalyticsContext
            ↓
     candidate resolver
   (10–20 configured options)
            ↓
        Jev decision
            ↓
      json-render Spec
            ↓
  approved React registry
            ↓
  shadcn-style analytics UI
```

Application code owns every value, component, chart, layout, and action. Jev
selects and arranges configured candidates; it cannot produce JSX, CSS, raw
HTML, Tailwind classes, or business data. Revenue and explanations are
calculated before candidate selection.

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

Without an AI Gateway credential, deterministic dashboards, all navigation,
typed commands, and Vox transcript capture continue to work. The endpoint marks
this response as `development-fallback` in Developer Mode; it does not silently
pretend that Jev selected the composition.

## Deterministic dataset and analytics

`lib/dataset/seed.ts` creates 2,481 reproducible SaaS customers with 12 months
of MRR and usage history, plans, segments, countries, acquisition sources,
payments, seats, and customer health. Acme Corp, Meridian Systems, Northstar
Labs, Helix Health, and Atlas Commerce carry intentional, testable storylines.

The analytics engine derives current and previous revenue, plan/country/segment
breakdowns, MRR movement, churn, net retention, acquisition conversion, risk,
loss contributors, and peer comparisons. Jev never receives the raw dataset.

## Vox architecture

Vox uses browser-native `SpeechRecognition` with the
`webkitSpeechRecognition` fallback:

- `continuous = false`
- `interimResults = true`
- locale `en-US`
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
demo context transitions, and candidate-set bounds.

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
