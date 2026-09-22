"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, BarChart3, Command, HelpCircle, LayoutDashboard, Menu, Mic, PanelRight, Search, Settings2, Sparkles, Users, X, CircleAlert } from "lucide-react";
import { type FormEvent, startTransition, useCallback, useEffect, useRef, useState } from "react";
import { DashboardRenderer } from "@/components/dashboard/registry";
import { breadcrumbFor, suggestionsFor } from "@/lib/dashboard/context";
import { cn } from "@/lib/utils";
import { useVox } from "@/lib/voice/use-vox";
import { useDashboardStore } from "@/store/dashboard-store";
import type { AnalyticsArea } from "@/types/analytics";

const navigation: { area: AnalyticsArea; label: string; icon: typeof LayoutDashboard }[] = [
  { area: "overview", label: "Overview", icon: LayoutDashboard },
  { area: "revenue", label: "Revenue", icon: BarChart3 },
  { area: "customers", label: "Customers", icon: Users },
  { area: "retention", label: "Retention", icon: PanelRight },
  { area: "acquisition", label: "Acquisition", icon: Sparkles },
];

function Wordmark() {
  return <div className="wordmark"><span className="wordmark-mark"><i /><i /></span><strong>Zero</strong><span>Dashboard</span></div>;
}

function Navigation({ mobile = false }: { mobile?: boolean }) {
  const area = useDashboardStore((state) => state.context.area);
  const navigate = useDashboardStore((state) => state.navigate);
  return <nav className={cn("primary-nav", mobile && "mobile-primary-nav")} aria-label="Analytics sections"><p className="nav-label">Analyze</p>{navigation.map((item) => { const Icon = item.icon; return <button key={item.area} aria-label={item.label} className={area === item.area ? "active" : undefined} onClick={() => startTransition(() => navigate(item.area))}><Icon size={16} /><span>{item.label}</span></button>; })}</nav>;
}

function CommandDialog() {
  const open = useDashboardStore((state) => state.commandOpen);
  const setOpen = useDashboardStore((state) => state.setCommandOpen);
  const submitIntent = useDashboardStore((state) => state.submitIntent);
  const status = useDashboardStore((state) => state.status);
  const [value, setValue] = useState("");
  const submit = (event: FormEvent) => { event.preventDefault(); if (!value.trim()) return; void submitIntent(value, "text"); setValue(""); };
  return <Dialog.Root open={open} onOpenChange={setOpen}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="command-dialog"><div className="command-title"><Search size={17} /><Dialog.Title>Ask the dashboard</Dialog.Title><Dialog.Close aria-label="Close command"><X size={16} /></Dialog.Close></div><Dialog.Description>Describe what you want to understand. The analytical canvas will reorganize around your intent.</Dialog.Description><form onSubmit={submit}><label className="sr-only" htmlFor="dashboard-command">Analytics question</label><input id="dashboard-command" autoFocus value={value} onChange={(event) => setValue(event.target.value)} placeholder="Show me why enterprise revenue dropped this month" maxLength={500} /><div className="command-footer"><span><kbd>Enter</kbd> compose</span><button type="submit" disabled={!value.trim() || status === "composing"}>Compose</button></div></form><div className="command-examples"><p>Try asking</p>{["Show enterprise performance", "Which customers are at risk?", "Compare Acme with similar customers"].map((example) => <button key={example} onClick={() => setValue(example)}>{example}</button>)}</div></Dialog.Content></Dialog.Portal></Dialog.Root>;
}

function DeveloperPanel() {
  const open = useDashboardStore((state) => state.developerMode);
  const setOpen = useDashboardStore((state) => state.setDeveloperMode);
  const diagnostics = useDashboardStore((state) => state.diagnostics);
  const context = useDashboardStore((state) => state.context);
  return <Dialog.Root open={open} onOpenChange={setOpen}><Dialog.Portal><Dialog.Overlay className="dialog-overlay subtle" /><Dialog.Content className="developer-panel"><Dialog.Description className="sr-only">Inspect composition mode, candidate count, selected components, context, and measured timings.</Dialog.Description><div className="developer-heading"><div><p>Composition inspector</p><Dialog.Title>Developer mode</Dialog.Title></div><Dialog.Close aria-label="Close developer mode"><X size={16} /></Dialog.Close></div><div className="developer-section"><span>Input source</span><strong>{diagnostics.source}</strong><span>Composition mode</span><strong>{diagnostics.mode}</strong><span>Layout</span><strong>{diagnostics.layout}</strong><span>Candidates resolved</span><strong>{diagnostics.candidateCount || "Deterministic default"}</strong></div><div className="developer-section"><p className="developer-label">Measured timings</p><span>Resolver</span><strong>{diagnostics.resolverMs} ms</strong><span>First valid spec</span><strong>{diagnostics.firstSpecMs} ms</strong><span>Total</span><strong>{diagnostics.totalMs} ms</strong></div><div className="developer-section"><p className="developer-label">Analytics context</p><pre>{JSON.stringify(context, null, 2)}</pre></div><div className="developer-components"><p>Selected components · {diagnostics.selectedComponents.length}</p><div>{diagnostics.selectedComponents.map((component, index) => <span key={`${component}-${index}`}>{component}</span>)}</div></div><p className="developer-note">The evaluator selects configured candidates only. Raw transactions, CSS, and arbitrary JSX are never sent or generated.</p></Dialog.Content></Dialog.Portal></Dialog.Root>;
}

function MobileNavigation() {
  const open = useDashboardStore((state) => state.mobileNavOpen);
  const setOpen = useDashboardStore((state) => state.setMobileNavOpen);
  return <Dialog.Root open={open} onOpenChange={setOpen}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="mobile-nav-sheet"><div className="mobile-sheet-title"><Wordmark /><Dialog.Close aria-label="Close navigation"><X size={18} /></Dialog.Close></div><Dialog.Title className="sr-only">Navigation</Dialog.Title><Dialog.Description className="sr-only">Choose an analytics section.</Dialog.Description><Navigation mobile /></Dialog.Content></Dialog.Portal></Dialog.Root>;
}

function VoxSurface() {
  const submitIntent = useDashboardStore((state) => state.submitIntent);
  const status = useDashboardStore((state) => state.status);
  const cancelComposition = useDashboardStore((state) => state.cancelComposition);
  const onFinal = useCallback((text: string) => void submitIntent(text, "voice"), [submitIntent]);
  const vox = useVox(onFinal);
  const visible = vox.listening || Boolean(vox.transcript) || Boolean(vox.error) || status === "composing";
  return <><button className="vox-trigger" onClick={vox.start} aria-label="Start Vox voice command" disabled={vox.listening || status === "composing"}><Mic size={15} /><span>Vox</span></button>{visible ? <div className="vox-surface" role="status" aria-live="polite"><div className="vox-status"><span className={cn("vox-dot", vox.listening && "listening", status === "composing" && "composing")} />{vox.listening ? "Listening" : status === "composing" ? "Composing" : vox.error ? "Voice unavailable" : "Heard"}</div><p>{vox.error ?? vox.transcript ?? "Updating the analytical canvas…"}</p><button onClick={vox.listening ? vox.cancel : status === "composing" ? cancelComposition : vox.clearError}>{vox.listening || status === "composing" ? "Cancel" : "Dismiss"}</button></div> : null}{vox.supported === false ? <span className="sr-only">Voice recognition is unavailable; use typed commands.</span> : null}</>;
}

function Chevron() { return <span aria-hidden>›</span>; }

function SuggestionsRail() {
  const context = useDashboardStore((state) => state.context);
  const submit = useDashboardStore((state) => state.submitIntent);
  const suggestions = suggestionsFor(context);
  return <aside className="suggestions-rail" aria-label="Contextual suggestions"><div className="suggestions-heading"><div><Sparkles size={15} /><span>Suggested</span></div><span>{suggestions.length}</span></div><p className="suggestions-context">Based on the current view and detected signals.</p><div className="suggestions-list">{suggestions.map((suggestion, index) => <button key={suggestion} onClick={() => void submit(suggestion, "suggestion")}><span>0{index + 1}</span><p>{suggestion}</p><Chevron /></button>)}</div>{context.area === "overview" || context.area === "revenue" ? <div className="rail-anomaly"><p>Suggested from your data</p><strong>Failed payments <span>+34%</span></strong><button onClick={() => void submit("Show failed payments", "suggestion")}>Investigate <Chevron /></button></div> : null}<div className="rail-help"><HelpCircle size={15} /><p><strong>Ask naturally</strong><span>Try “show”, “compare”, “why”, or “open”.</span></p></div></aside>;
}

export function DashboardApp() {
  const context = useDashboardStore((state) => state.context);
  const spec = useDashboardStore((state) => state.spec);
  const status = useDashboardStore((state) => state.status);
  const error = useDashboardStore((state) => state.error);
  const history = useDashboardStore((state) => state.history);
  const goBack = useDashboardStore((state) => state.goBack);
  const setCommandOpen = useDashboardStore((state) => state.setCommandOpen);
  const setDeveloperMode = useDashboardStore((state) => state.setDeveloperMode);
  const setMobileNavOpen = useDashboardStore((state) => state.setMobileNavOpen);
  const breadcrumbs = breadcrumbFor(context);
  const initializedHistory = useRef(false);
  const fromPopState = useRef(false);

  useEffect(() => { window.history.replaceState({ zeroDashboard: true }, ""); const onPopState = () => { fromPopState.current = true; goBack(); }; window.addEventListener("popstate", onPopState); return () => window.removeEventListener("popstate", onPopState); }, [goBack]);
  useEffect(() => { if (!initializedHistory.current) { initializedHistory.current = true; return; } if (fromPopState.current) { fromPopState.current = false; return; } window.history.pushState({ zeroDashboard: true }, ""); }, [context]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [context]);
  useEffect(() => { const onKeyDown = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setCommandOpen(true); } if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "d") { event.preventDefault(); setDeveloperMode(true); } }; window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown); }, [setCommandOpen, setDeveloperMode]);

  return <div className="app-shell"><header className="app-header"><button className="mobile-menu" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Menu size={18} /></button><Wordmark /><nav className="breadcrumb" aria-label="Current analytics context">{history.length ? <button onClick={goBack} aria-label="Go back"><ArrowLeft size={14} /></button> : null}{breadcrumbs.map((part, index) => <span key={part}>{index > 0 ? <i>/</i> : null}{part}</span>)}</nav><div className="header-actions"><button className="command-trigger" aria-label="Ask the dashboard" onClick={() => setCommandOpen(true)}><Command size={14} /><span>Ask the dashboard…</span><kbd>⌘ K</kbd></button><VoxSurface /><button className="icon-button developer-trigger" aria-label="Open developer mode" onClick={() => setDeveloperMode(true)}><Settings2 size={15} /></button></div></header><aside className="left-sidebar"><Navigation /><div className="sidebar-footer"><div className="workspace-avatar">ZS</div><p><strong>Zero Systems</strong><span>Production demo</span></p></div></aside><main className="analytics-canvas" aria-busy={status === "composing"}><div className={cn("composition-status", status === "composing" && "visible")}><span /><p>Composing</p></div>{error ? <div className="inline-error" role="alert"><CircleAlert size={15} /><span>{error}</span><button onClick={() => setCommandOpen(true)}>Try again</button></div> : null}<div className="spec-transition" key={`${context.area}-${context.segment}-${context.entityId}-${context.investigation}`}><DashboardRenderer spec={spec} loading={status === "composing"} /></div><div className="mobile-suggestions"><SuggestionsRail /></div></main><SuggestionsRail /><CommandDialog /><DeveloperPanel /><MobileNavigation /></div>;
}
