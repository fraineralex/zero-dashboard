"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, ArrowUpRight, CircleAlert, Command, LayoutGrid, Mic, Moon, RotateCcw, Send, Settings2, Sparkles, Sun, X } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { DashboardRenderer } from "@/components/dashboard/registry";
import { cn } from "@/lib/utils";
import { useVox } from "@/lib/voice/use-vox";
import { useDashboardStore } from "@/store/dashboard-store";

const viewGroups = [
  { label: "Financial statements", description: "Performance, margins and cash", items: ["Muéstrame el estado de resultados", "Compara ingresos, gastos y utilidad neta", "Evolución del saldo de caja"] },
  { label: "Working capital", description: "What is owed and what is due", items: ["Quiero ver cuentas por cobrar", "Compara cuentas por cobrar y cuentas por pagar", "Muéstrame las facturas vencidas"] },
  { label: "Operating intelligence", description: "Movement, drivers and signals", items: ["Muéstrame los 10 clientes que más han facturado este mes", "Quiero ver la entrada de dinero día a día", "Desglosa gastos por categoría", "Combina ingresos, clientes y churn en líneas"] },
];

function Wordmark() {
  return <div className="wordmark"><span className="wordmark-mark"><i /><i /></span><strong>Zero</strong><span>Canvas</span></div>;
}

const subscribeToTheme = (callback: () => void) => { window.addEventListener("zero-theme-change", callback); return () => window.removeEventListener("zero-theme-change", callback); };
const getTheme = (): "light" | "dark" => document.documentElement.dataset.theme === "light" ? "light" : "dark";

function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeToTheme, getTheme, () => "dark");
  useLayoutEffect(() => {
    const saved = window.localStorage.getItem("zero-theme");
    const resolved = saved === "light" || saved === "dark" ? saved : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.dataset.theme = resolved;
    window.dispatchEvent(new Event("zero-theme-change"));
  }, []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("zero-theme", next);
    window.dispatchEvent(new Event("zero-theme-change"));
  };
  const light = theme === "light";
  return <button className="icon-button theme-toggle" aria-label={light ? "Activate dark mode" : "Activate light mode"} title={light ? "Dark mode" : "Light mode"} onClick={toggle}>{light ? <Moon size={15} /> : <Sun size={15} />}</button>;
}

function DeveloperPanel() {
  const open = useDashboardStore((state) => state.developerMode);
  const setOpen = useDashboardStore((state) => state.setDeveloperMode);
  const diagnostics = useDashboardStore((state) => state.diagnostics);
  const context = useDashboardStore((state) => state.context);
  return <Dialog.Root open={open} onOpenChange={setOpen}><Dialog.Portal><Dialog.Overlay className="dialog-overlay subtle" /><Dialog.Content className="developer-panel"><Dialog.Description className="sr-only">Inspect composition mode, candidate count, selected components, context, and measured timings.</Dialog.Description><div className="developer-heading"><div><p>Composition inspector</p><Dialog.Title>Developer mode</Dialog.Title></div><Dialog.Close aria-label="Close developer mode"><X size={16} /></Dialog.Close></div><div className="developer-section"><span>Input source</span><strong>{diagnostics.source}</strong><span>Composition mode</span><strong>{diagnostics.mode}</strong><span>Layout</span><strong>{diagnostics.layout}</strong><span>Candidates resolved</span><strong>{diagnostics.candidateCount || "Deterministic default"}</strong>{diagnostics.uiMemory ? <><span>UI Memory decision</span><strong>{diagnostics.uiMemory.decision}</strong><span>Decision source</span><strong>{diagnostics.uiMemory.source}</strong>{diagnostics.uiMemory.recipeId ? <><span>Recipe</span><strong>{diagnostics.uiMemory.recipeId} v{diagnostics.uiMemory.recipeVersion}</strong></> : null}</> : null}</div><div className="developer-section"><p className="developer-label">Measured timings</p><span>Resolver</span><strong>{diagnostics.resolverMs} ms</strong><span>First valid spec</span><strong>{diagnostics.firstSpecMs} ms</strong><span>Total</span><strong>{diagnostics.totalMs} ms</strong></div><div className="developer-section"><p className="developer-label">Analytics context</p><pre>{JSON.stringify(context, null, 2)}</pre></div><div className="developer-components"><p>Selected components · {diagnostics.selectedComponents.length}</p><div>{diagnostics.selectedComponents.map((component, index) => <span key={`${component}-${index}`}>{component}</span>)}</div></div><p className="developer-note">One canvas is recomposed from approved, data-backed components. The model never generates arbitrary JSX or values.</p></Dialog.Content></Dialog.Portal></Dialog.Root>;
}

function VoxControl() {
  const submitIntent = useDashboardStore((state) => state.submitIntent);
  const status = useDashboardStore((state) => state.status);
  const cancelComposition = useDashboardStore((state) => state.cancelComposition);
  const onFinal = useCallback((text: string) => void submitIntent(text, "voice"), [submitIntent]);
  const vox = useVox(onFinal);
  const visible = vox.listening || Boolean(vox.transcript) || Boolean(vox.error);
  return <><button type="button" className={cn("composer-voice", vox.listening && "active")} onClick={vox.start} aria-label="Describe a visualization with Vox" disabled={vox.listening || status === "composing"}><Mic size={15} /><span>{vox.listening ? "Listening" : "Vox"}</span></button>{visible ? <div className="vox-surface" role="status" aria-live="polite"><div className="vox-status"><span className={cn("vox-dot", vox.listening && "listening")} />{vox.listening ? "Listening" : vox.error ? "Voice unavailable" : "Heard"}</div><p>{vox.error ?? vox.transcript}</p><button onClick={vox.listening ? vox.cancel : status === "composing" ? cancelComposition : vox.clearError}>{vox.listening || status === "composing" ? "Cancel" : "Dismiss"}</button></div> : null}{vox.supported === false ? <span className="sr-only">Voice recognition is unavailable; use the text field.</span> : null}</>;
}

function HeaderComposer() {
  const submitIntent = useDashboardStore((state) => state.submitIntent);
  const cancelComposition = useDashboardStore((state) => state.cancelComposition);
  const status = useDashboardStore((state) => state.status);
  const setCommandOpen = useDashboardStore((state) => state.setCommandOpen);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const submit = (event: FormEvent) => { event.preventDefault(); const next = value.trim(); if (!next || status === "composing") return; void submitIntent(next, "text"); setValue(""); };
  useEffect(() => { const onKeyDown = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); inputRef.current?.focus(); } }; window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown); }, []);
  return <form className="header-composer" onSubmit={submit}><Command size={15} /><label className="sr-only" htmlFor="canvas-intent">Describe the analytical view</label><input ref={inputRef} id="canvas-intent" value={value} onChange={(event) => setValue(event.target.value)} placeholder="Ask to add, compare, focus or remove anything…" maxLength={500} autoComplete="off" /><button type="button" className="library-trigger" onClick={() => setCommandOpen(true)}><LayoutGrid size={14} /><span>Views</span></button><VoxControl />{status === "composing" ? <button type="button" className="header-submit cancel" onClick={cancelComposition}>Stop</button> : <button type="submit" className="header-submit" disabled={!value.trim()} aria-label="Rebuild canvas"><Send size={14} /></button>}</form>;
}

function CommandCenter() {
  const open = useDashboardStore((state) => state.commandOpen);
  const setOpen = useDashboardStore((state) => state.setCommandOpen);
  const submitIntent = useDashboardStore((state) => state.submitIntent);
  const status = useDashboardStore((state) => state.status);
  const [value, setValue] = useState("");
  const submit = (intent: string) => { const next = intent.trim(); if (!next || status === "composing") return; void submitIntent(next, "suggestion"); setValue(""); };
  return <Dialog.Root open={open} onOpenChange={setOpen}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="view-library"><div className="library-heading"><div><span><Sparkles size={12} /> Accounting intelligence</span><Dialog.Title>Compose a view</Dialog.Title><Dialog.Description>Start broad, drill into individual records, or combine both on the same canvas.</Dialog.Description></div><Dialog.Close aria-label="Close view library"><X size={17} /></Dialog.Close></div><form className="library-composer" onSubmit={(event) => { event.preventDefault(); submit(value); }}><Command size={16} /><input autoFocus value={value} onChange={(event) => setValue(event.target.value)} placeholder="Describe any financial question or visual…" /><button disabled={!value.trim()}><span>Build view</span><ArrowUpRight size={14} /></button></form><div className="view-groups">{viewGroups.map((group, index) => <section key={group.label}><span>0{index + 1}</span><div><h3>{group.label}</h3><p>{group.description}</p></div><div className="view-options">{group.items.map((item) => <button key={item} onClick={() => submit(item)}><span>{item}</span><ArrowUpRight size={13} /></button>)}</div></section>)}</div><footer className="library-footer"><span>Every view remains editable on the canvas.</span><span>Remove · duplicate · resize · recombine</span></footer></Dialog.Content></Dialog.Portal></Dialog.Root>;
}

export function DashboardApp() {
  const spec = useDashboardStore((state) => state.spec);
  const revision = useDashboardStore((state) => state.revision);
  const status = useDashboardStore((state) => state.status);
  const error = useDashboardStore((state) => state.error);
  const history = useDashboardStore((state) => state.history);
  const lastIntent = useDashboardStore((state) => state.lastIntent);
  const goBack = useDashboardStore((state) => state.goBack);
  const navigate = useDashboardStore((state) => state.navigate);
  const setDeveloperMode = useDashboardStore((state) => state.setDeveloperMode);
  const setCommandOpen = useDashboardStore((state) => state.setCommandOpen);
  const blockCount = spec.elements[spec.root]?.children?.length ?? 0;
  const rememberedRecipe = spec.state?.uiMemory as { recipeName?: string; recipeVersion?: number } | undefined;
  useEffect(() => { const onKeyDown = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "d") { event.preventDefault(); setDeveloperMode(true); } }; window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown); }, [setDeveloperMode]);

  return <div className="app-shell single-canvas"><header className="app-header"><Wordmark /><HeaderComposer /><div className="header-actions">{history.length ? <button className="header-text-action" aria-label="Undo last canvas change" onClick={goBack}><ArrowLeft size={14} /><span>Undo</span></button> : null}<button className="header-text-action" aria-label="Reset canvas" onClick={() => navigate("overview")}><RotateCcw size={14} /><span>Reset</span></button><ThemeToggle /><button className="icon-button" aria-label="Open developer mode" onClick={() => setDeveloperMode(true)}><Settings2 size={15} /></button></div></header><main className="analytics-canvas" aria-busy={status === "composing"}><div className="canvas-controlbar"><div><span className={cn("live-dot", status === "composing" && "working")} /><strong>{blockCount} live blocks</strong>{rememberedRecipe ? <span className="memory-badge"><Sparkles size={11} />Reused {rememberedRecipe.recipeName} v{rememberedRecipe.recipeVersion}</span> : lastIntent ? <p title={lastIntent}>{lastIntent}</p> : <p>General overview · hover any block to shape it</p>}</div><button onClick={() => setCommandOpen(true)}><LayoutGrid size={14} />Explore views</button></div>{error ? <div className="inline-error" role="alert"><CircleAlert size={15} /><span>{error}</span><button onClick={() => navigate("overview")}>Restore overview</button></div> : null}<div className={cn("composition-status", status === "composing" && "visible")}><span /><p>Recomposing measures and detail</p></div><div className="spec-transition" key={revision}><DashboardRenderer spec={spec} loading={status === "composing"} /></div></main><CommandCenter /><DeveloperPanel /></div>;
}
