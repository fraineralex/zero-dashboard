"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, CircleAlert, Command, Mic, RotateCcw, Send, Settings2, Sparkles, X } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { DashboardRenderer } from "@/components/dashboard/registry";
import { suggestionsFor } from "@/lib/dashboard/context";
import { cn } from "@/lib/utils";
import { useVox } from "@/lib/voice/use-vox";
import { useDashboardStore } from "@/store/dashboard-store";

function Wordmark() {
  return <div className="wordmark"><span className="wordmark-mark"><i /><i /></span><strong>Zero</strong><span>Canvas</span></div>;
}

function DeveloperPanel() {
  const open = useDashboardStore((state) => state.developerMode);
  const setOpen = useDashboardStore((state) => state.setDeveloperMode);
  const diagnostics = useDashboardStore((state) => state.diagnostics);
  const context = useDashboardStore((state) => state.context);
  return <Dialog.Root open={open} onOpenChange={setOpen}><Dialog.Portal><Dialog.Overlay className="dialog-overlay subtle" /><Dialog.Content className="developer-panel"><Dialog.Description className="sr-only">Inspect composition mode, candidate count, selected components, context, and measured timings.</Dialog.Description><div className="developer-heading"><div><p>Composition inspector</p><Dialog.Title>Developer mode</Dialog.Title></div><Dialog.Close aria-label="Close developer mode"><X size={16} /></Dialog.Close></div><div className="developer-section"><span>Input source</span><strong>{diagnostics.source}</strong><span>Composition mode</span><strong>{diagnostics.mode}</strong><span>Layout</span><strong>{diagnostics.layout}</strong><span>Candidates resolved</span><strong>{diagnostics.candidateCount || "Deterministic default"}</strong></div><div className="developer-section"><p className="developer-label">Measured timings</p><span>Resolver</span><strong>{diagnostics.resolverMs} ms</strong><span>First valid spec</span><strong>{diagnostics.firstSpecMs} ms</strong><span>Total</span><strong>{diagnostics.totalMs} ms</strong></div><div className="developer-section"><p className="developer-label">Analytics context</p><pre>{JSON.stringify(context, null, 2)}</pre></div><div className="developer-components"><p>Selected components · {diagnostics.selectedComponents.length}</p><div>{diagnostics.selectedComponents.map((component, index) => <span key={`${component}-${index}`}>{component}</span>)}</div></div><p className="developer-note">One canvas is recomposed from approved, data-backed components. The model never generates arbitrary JSX or values.</p></Dialog.Content></Dialog.Portal></Dialog.Root>;
}

function VoxControl() {
  const submitIntent = useDashboardStore((state) => state.submitIntent);
  const status = useDashboardStore((state) => state.status);
  const cancelComposition = useDashboardStore((state) => state.cancelComposition);
  const onFinal = useCallback((text: string) => void submitIntent(text, "voice"), [submitIntent]);
  const vox = useVox(onFinal);
  const visible = vox.listening || Boolean(vox.transcript) || Boolean(vox.error);
  return <><button type="button" className={cn("composer-voice", vox.listening && "active")} onClick={vox.start} aria-label="Describe a visualization with Vox" disabled={vox.listening || status === "composing"}><Mic size={16} /><span>{vox.listening ? "Listening" : "Vox"}</span></button>{visible ? <div className="vox-surface" role="status" aria-live="polite"><div className="vox-status"><span className={cn("vox-dot", vox.listening && "listening")} />{vox.listening ? "Listening" : vox.error ? "Voice unavailable" : "Heard"}</div><p>{vox.error ?? vox.transcript}</p><button onClick={vox.listening ? vox.cancel : status === "composing" ? cancelComposition : vox.clearError}>{vox.listening || status === "composing" ? "Cancel" : "Dismiss"}</button></div> : null}{vox.supported === false ? <span className="sr-only">Voice recognition is unavailable; use the text field.</span> : null}</>;
}

function IntentComposer() {
  const submitIntent = useDashboardStore((state) => state.submitIntent);
  const cancelComposition = useDashboardStore((state) => state.cancelComposition);
  const status = useDashboardStore((state) => state.status);
  const lastIntent = useDashboardStore((state) => state.lastIntent);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const submit = (event: FormEvent) => { event.preventDefault(); const next = value.trim(); if (!next || status === "composing") return; void submitIntent(next, "text"); setValue(""); };
  useEffect(() => { const onKeyDown = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); inputRef.current?.focus(); } }; window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown); }, []);
  return <section className="composer-stage" aria-label="Reconfigure analytical canvas"><div className="composer-copy"><span><Sparkles size={13} /> Generative analytics</span><h1>Ask for the view you need.</h1><p>Combine measures, change the time grain, compare segments, or describe a chart in plain language.</p></div><form className="intent-composer" onSubmit={submit}><Command size={17} /><label className="sr-only" htmlFor="canvas-intent">Describe the analytical view</label><input ref={inputRef} id="canvas-intent" value={value} onChange={(event) => setValue(event.target.value)} placeholder="Try: Quiero ver la entrada de dinero día a día…" maxLength={500} autoComplete="off" /><kbd>⌘ K</kbd><VoxControl />{status === "composing" ? <button type="button" className="composer-submit cancel" onClick={cancelComposition}>Cancel</button> : <button type="submit" className="composer-submit" disabled={!value.trim()}><span>Rebuild</span><Send size={14} /></button>}</form>{lastIntent ? <p className="applied-intent"><span>Applied</span>{lastIntent}</p> : null}</section>;
}

function SuggestionStrip() {
  const context = useDashboardStore((state) => state.context);
  const submit = useDashboardStore((state) => state.submitIntent);
  const suggestions = ["Combina ingresos, clientes y churn en líneas", "Quiero ver la entrada de dinero día a día", ...suggestionsFor(context)].slice(0, 6);
  return <section className="suggestions-strip" aria-label="Suggested canvas transformations"><span><Sparkles size={13} /> Try a transformation</span><div>{suggestions.map((suggestion) => <button key={suggestion} onClick={() => void submit(suggestion, "suggestion")}>{suggestion}</button>)}</div></section>;
}

export function DashboardApp() {
  const spec = useDashboardStore((state) => state.spec);
  const revision = useDashboardStore((state) => state.revision);
  const status = useDashboardStore((state) => state.status);
  const error = useDashboardStore((state) => state.error);
  const history = useDashboardStore((state) => state.history);
  const goBack = useDashboardStore((state) => state.goBack);
  const navigate = useDashboardStore((state) => state.navigate);
  const setDeveloperMode = useDashboardStore((state) => state.setDeveloperMode);
  useEffect(() => { const onKeyDown = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "d") { event.preventDefault(); setDeveloperMode(true); } }; window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown); }, [setDeveloperMode]);

  return <div className="app-shell single-canvas"><header className="app-header"><Wordmark /><div className="header-context"><span className={cn("live-dot", status === "composing" && "working")} /><strong>{status === "composing" ? "Rebuilding canvas" : "Live analytical canvas"}</strong><span>No pages. One adaptive workspace.</span></div><div className="header-actions">{history.length ? <button className="header-text-action" onClick={goBack}><ArrowLeft size={14} />Undo</button> : null}<button className="header-text-action" onClick={() => navigate("overview")}><RotateCcw size={14} />Reset</button><button className="icon-button" aria-label="Open developer mode" onClick={() => setDeveloperMode(true)}><Settings2 size={15} /></button></div></header><main className="analytics-canvas" aria-busy={status === "composing"}><IntentComposer /><SuggestionStrip />{error ? <div className="inline-error" role="alert"><CircleAlert size={15} /><span>{error}</span><button onClick={() => navigate("overview")}>Restore overview</button></div> : null}<div className={cn("composition-status", status === "composing" && "visible")}><span /><p>Recomposing modules and series</p></div><div className="spec-transition" key={revision}><DashboardRenderer spec={spec} loading={status === "composing"} /></div></main><DeveloperPanel /></div>;
}
