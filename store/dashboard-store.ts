"use client";

import { create } from "zustand";
import { createContext, contextFromIntent } from "@/lib/dashboard/context";
import { buildDefaultSpec, selectedComponents } from "@/lib/dashboard/specs";
import type { AnalyticsArea, AnalyticsContext, CompositionDiagnostics, DashboardSpec } from "@/types/analytics";

type HistoryEntry = { context: AnalyticsContext; spec: DashboardSpec };

type DashboardState = {
  context: AnalyticsContext;
  spec: DashboardSpec;
  revision: number;
  lastIntent: string | null;
  history: HistoryEntry[];
  status: "idle" | "composing" | "error";
  error: string | null;
  developerMode: boolean;
  mobileNavOpen: boolean;
  commandOpen: boolean;
  diagnostics: CompositionDiagnostics;
  abortController: AbortController | null;
  navigate: (area: AnalyticsArea, segment?: AnalyticsContext["segment"]) => void;
  openCustomer: (id: string) => void;
  submitIntent: (intent: string, source: CompositionDiagnostics["source"]) => Promise<void>;
  cancelComposition: () => void;
  goBack: () => void;
  setDeveloperMode: (open: boolean) => void;
  setMobileNavOpen: (open: boolean) => void;
  setCommandOpen: (open: boolean) => void;
  removeElement: (id: string) => void;
  resizeElement: (id: string) => void;
  duplicateElement: (id: string) => void;
};

const initialContext = createContext("overview");
const initialSpec = buildDefaultSpec(initialContext);

function layoutOf(spec: DashboardSpec) {
  return spec.elements[spec.root]?.type ?? "Unknown";
}

function withCanvasEdit(state: DashboardState, spec: DashboardSpec, intent: string) {
  return {
    spec,
    revision: state.revision + 1,
    lastIntent: intent,
    history: [...state.history, { context: state.context, spec: state.spec }].slice(-20),
    status: "idle" as const,
    error: null,
    diagnostics: {
      ...state.diagnostics,
      source: "text" as const,
      mode: "deterministic" as const,
      selectedComponents: selectedComponents(spec),
      layout: layoutOf(spec),
    },
  };
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  context: initialContext,
  spec: initialSpec,
  revision: 0,
  lastIntent: null,
  history: [],
  status: "idle",
  error: null,
  developerMode: false,
  mobileNavOpen: false,
  commandOpen: false,
  abortController: null,
  diagnostics: {
    source: "navigation",
    mode: "deterministic",
    candidateCount: 0,
    selectedComponents: selectedComponents(initialSpec),
    layout: layoutOf(initialSpec),
    resolverMs: 0,
    firstSpecMs: 0,
    totalMs: 0,
  },
  navigate: (area, segment) => {
    const previous = get();
    const context = { ...createContext(area), ...(segment ? { segment } : {}) };
    const spec = buildDefaultSpec(context);
    set({
      context,
      spec,
      revision: previous.revision + 1,
      lastIntent: area === "overview" ? null : `Show ${area}`,
      history: [...previous.history, { context: previous.context, spec: previous.spec }].slice(-20),
      status: "idle",
      error: null,
      mobileNavOpen: false,
      diagnostics: {
        source: "navigation",
        mode: "deterministic",
        candidateCount: 0,
        selectedComponents: selectedComponents(spec),
        layout: layoutOf(spec),
        resolverMs: 0,
        firstSpecMs: 0,
        totalMs: 0,
      },
    });
  },
  openCustomer: (id) => {
    const previous = get();
    const context: AnalyticsContext = { ...createContext("customers"), entityType: "customer", entityId: id, investigation: "customer_risk" };
    const spec = buildDefaultSpec(context);
    set({ context, spec, revision: previous.revision + 1, lastIntent: `Open ${id}`, history: [...previous.history, { context: previous.context, spec: previous.spec }].slice(-20), status: "idle", error: null });
  },
  submitIntent: async (intent, source) => {
    const trimmed = intent.trim().slice(0, 500);
    if (!trimmed || get().status === "composing") return;
    const previous = get();
    const nextContext = contextFromIntent(trimmed, previous.context);
    const controller = new AbortController();
    const startedAt = performance.now();
    let firstSpecAt = 0;
    set({ status: "composing", error: null, abortController: controller, commandOpen: false });
    try {
      const response = await fetch("/api/compose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intent: trimmed, context: nextContext, source, initialSpec: previous.spec }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error("Composition service is unavailable.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let latestSpec = previous.spec;
      let latestDiagnostics: Partial<CompositionDiagnostics> = {};
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as { type: string; spec?: DashboardSpec; diagnostics?: Partial<CompositionDiagnostics>; message?: string };
          if (event.spec) {
            latestSpec = event.spec;
            if (!firstSpecAt) firstSpecAt = performance.now();
            set((state) => ({ spec: latestSpec, context: nextContext, revision: state.revision + 1, lastIntent: trimmed }));
          }
          if (event.diagnostics) latestDiagnostics = { ...latestDiagnostics, ...event.diagnostics };
          if (event.type === "error") throw new Error(event.message ?? "Composition failed.");
        }
      }
      const finishedAt = performance.now();
      set({
        context: nextContext,
        spec: latestSpec,
        lastIntent: trimmed,
        history: [...previous.history, { context: previous.context, spec: previous.spec }].slice(-20),
        status: "idle",
        abortController: null,
        diagnostics: {
          source,
          mode: latestDiagnostics.mode ?? "development-fallback",
          candidateCount: latestDiagnostics.candidateCount ?? 0,
          selectedComponents: selectedComponents(latestSpec),
          layout: layoutOf(latestSpec),
          resolverMs: latestDiagnostics.resolverMs ?? 0,
          firstSpecMs: Math.round(firstSpecAt ? firstSpecAt - startedAt : finishedAt - startedAt),
          totalMs: Math.round(finishedAt - startedAt),
          stopReason: latestDiagnostics.stopReason,
          uiMemory: latestDiagnostics.uiMemory,
        },
      });
    } catch (error) {
      if (controller.signal.aborted) {
        set({ status: "idle", abortController: null });
        return;
      }
      set({ status: "error", error: error instanceof Error ? error.message : "Composition failed.", abortController: null });
    }
  },
  cancelComposition: () => {
    get().abortController?.abort();
    set({ status: "idle", abortController: null });
  },
  goBack: () => {
    const history = get().history;
    const previous = history.at(-1);
    if (!previous) return;
    set((state) => ({ context: previous.context, spec: previous.spec, revision: state.revision + 1, lastIntent: null, history: history.slice(0, -1), status: "idle", error: null }));
  },
  setDeveloperMode: (developerMode) => set({ developerMode }),
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  removeElement: (id) => {
    const state = get();
    const root = state.spec.elements[state.spec.root];
    if (!root?.children?.includes(id)) return;
    const elements = { ...state.spec.elements };
    delete elements[id];
    const spec = { ...state.spec, elements: { ...elements, [state.spec.root]: { ...root, children: root.children.filter((child) => child !== id) } } };
    set(withCanvasEdit(state, spec, "Removed a block"));
  },
  resizeElement: (id) => {
    const state = get();
    const element = state.spec.elements[id];
    if (!element) return;
    const current = element.props.span;
    const next = current === "wide" ? "half" : current === "half" ? "hero" : "wide";
    const spec = { ...state.spec, elements: { ...state.spec.elements, [id]: { ...element, props: { ...element.props, span: next } } } };
    set(withCanvasEdit(state, spec, `Resized ${String(element.props.title ?? element.props.label ?? "block")}`));
  },
  duplicateElement: (id) => {
    const state = get();
    const root = state.spec.elements[state.spec.root];
    const element = state.spec.elements[id];
    if (!root?.children?.includes(id) || !element) return;
    let copyId = `${id}-copy`;
    let suffix = 2;
    while (state.spec.elements[copyId]) copyId = `${id}-copy-${suffix++}`;
    const index = root.children.indexOf(id);
    const children = [...root.children];
    children.splice(index + 1, 0, copyId);
    const spec = { ...state.spec, elements: { ...state.spec.elements, [copyId]: { ...element, props: { ...element.props } }, [state.spec.root]: { ...root, children } } };
    set(withCanvasEdit(state, spec, `Duplicated ${String(element.props.title ?? element.props.label ?? "block")}`));
  },
}));
