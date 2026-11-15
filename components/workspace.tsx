"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { ArrowRight, CalendarDays, Check, ChevronDown, CircleCheck, Clock3, FileText, Flag, History, LockKeyhole, TriangleAlert, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ScheduleView } from "@/lib/schedule-view";
import { applyAction, draft, editProposal, emptyState, normalizeWorkspace, provenanceLabel, type Action, type Proposal, type Workspace } from "@/lib/workflow";

const storageKey = "clearweek:oct23:v1";
type Props = { view: ScheduleView; privateMode: boolean; supabaseUrl?: string; publishableKey?: string };
type Pending = "prepare" | "approve" | "resolve" | "sign-in" | "sign-out";
type Problem = { where: "load" | "draft" | "resolve" | "sign-in" | "sign-out"; message: string };
type FocusTarget = "draft" | "saved" | "prepare" | "recorded";

async function api<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...options, cache: "no-store",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
  } catch {
    throw new Error("ClearWeek could not be reached. Check your connection, then try again.");
  }
  // A proxy or timeout page is not JSON; never show a parser error to the user.
  const body = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok || body === null) {
    throw Object.assign(new Error(body?.error ?? "The service did not answer properly. Try again in a moment."), { status: response.status });
  }
  return body as T;
}

export function WorkspaceView({ view, privateMode, supabaseUrl, publishableKey }: Props) {
  const { conflict } = view;
  const configured = Boolean(supabaseUrl && publishableKey);
  // The Supabase client is only needed when signed-in mode is on, so the open demo never downloads it.
  const [auth, setAuth] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<Workspace>(emptyState);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [reviewedProposal, setReviewedProposal] = useState<Proposal | null>(null);
  const [resolution, setResolution] = useState("");
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState<Pending | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [notice, setNotice] = useState("");
  const token = session?.access_token ?? "";
  const busy = pending !== null;
  const reviewed = proposal !== null && reviewedProposal?.version === proposal.version;

  // Focus follows whatever the last action just put on screen.
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const savedRef = useRef<HTMLAnchorElement>(null);
  const prepareRef = useRef<HTMLButtonElement>(null);
  const recordedRef = useRef<HTMLParagraphElement>(null);
  const focusNext = useRef<FocusTarget | null>(null);
  useEffect(() => {
    const target = focusNext.current;
    if (!target) return;
    const element = { draft: draftRef, saved: savedRef, prepare: prepareRef, recorded: recordedRef }[target].current;
    focusNext.current = null;
    element?.focus();
  });

  useEffect(() => {
    if (!supabaseUrl || !publishableKey) return;
    let active = true;
    import("@supabase/supabase-js")
      .then(({ createClient }) => { if (active) setAuth(createClient(supabaseUrl, publishableKey)); })
      .catch(() => { if (active) setProblem({ where: "sign-in", message: "Sign-in could not be loaded. Check your connection, then reload the page." }); });
    return () => { active = false; };
  }, [supabaseUrl, publishableKey]);

  useEffect(() => {
    if (!auth) return;
    const { data: { subscription } } = auth.auth.onAuthStateChange((_event, current) => {
      setSession(current);
    });
    return () => subscription.unsubscribe();
  }, [auth]);

  useEffect(() => {
    let active = true;
    async function load() {
      if (privateMode && !token) return;
      try {
        const saved = privateMode ? await api<unknown>("/api/workspace", token) : JSON.parse(localStorage.getItem(storageKey) ?? "null");
        if (active) { setState(normalizeWorkspace(saved)); setReady(true); setProblem(null); }
      } catch {
        if (active) setProblem({ where: "load", message: privateMode
          ? "The saved workspace could not be loaded."
          : "The demo data saved in this browser could not be read." });
      }
    }
    void load();
    return () => { active = false; };
  }, [privateMode, token, attempt]);

  // Leaving with an edited draft or a typed resolution would lose it; let the browser ask first.
  const unsaved = Boolean(proposal?.edited) || resolution.trim().length > 0;
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  async function run(kind: Pending, where: Problem["where"], operation: () => Promise<void>) {
    setProblem(null); setNotice(""); setPending(kind);
    try { await operation(); }
    catch (error) { setProblem({ where, message: error instanceof Error ? error.message : "Something went wrong. Try again." }); }
    finally { setPending(null); }
  }

  /** Demo mode only: clears unreadable saved data so the page works again. */
  function resetDemo() {
    try { localStorage.removeItem(storageKey); } catch { /* storage is unavailable; the in-memory state still works */ }
    setState(emptyState); setProposal(null); setReviewedProposal(null); setProblem(null); setReady(true);
    setNotice("Demo data reset");
  }

  function prepare() {
    void run("prepare", "draft", async () => {
      const next = privateMode
        ? await api<Proposal>("/api/proposal", token, { method: "POST" })
        : draft("demo", { framing: "coverage", details: ["swap", "availability"] });
      setProposal(next); setReviewedProposal(null); setNotice("Draft prepared");
      focusNext.current = "draft";
    });
  }

  async function save(action: Action) {
    await run(action.type, action.type === "approve" ? "draft" : "resolve", async () => {
      const had = state.tasks.length > 0;
      const read = () => normalizeWorkspace(JSON.parse(localStorage.getItem(storageKey) ?? "null"));
      let saved: Workspace;
      try {
        if (privateMode) {
          saved = normalizeWorkspace(await api<unknown>("/api/workspace", token, { method: "POST", body: JSON.stringify(action) }));
        } else {
          const persist = () => {
            const next = applyAction(read(), action);
            localStorage.setItem(storageKey, JSON.stringify(next));
            return next;
          };
          saved = navigator.locks ? await navigator.locks.request(storageKey, persist) : persist();
        }
      } catch (failure) {
        if ((failure as { status?: number }).status === 409) {
          // Show what is actually saved; the existing record is unchanged.
          setState(privateMode ? normalizeWorkspace(await api<unknown>("/api/workspace", token)) : read());
        }
        throw failure;
      }
      setState(saved);
      if (action.type === "approve") {
        setProposal(null); setReviewedProposal(null);
        setNotice(had ? "This follow-up was already saved" : "Task created");
        focusNext.current = "saved";
      } else {
        setResolution(""); setNotice("Resolution recorded");
        focusNext.current = "recorded";
      }
    });
  }

  function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    void run("sign-in", "sign-in", async () => {
      if (!auth) throw new Error("Signed-in workspace setup is incomplete.");
      const result = await auth.auth.signInWithPassword({ email: String(fields.get("email")), password: String(fields.get("password")) });
      if (result.error) throw new Error("Sign-in failed. Check your email and password.");
    });
  }

  function signOut() {
    void run("sign-out", "sign-out", async () => {
      const result = await auth?.auth.signOut();
      if (result?.error) throw new Error("Sign-out failed. Try again.");
      setReady(false); setState(emptyState); setProposal(null); setReviewedProposal(null); setResolution("");
    });
  }

  const task = state.tasks[0];
  const resolved = Boolean(state.resolution);
  const step = task ? 4 : !proposal ? 1 : reviewed ? 3 : 2;
  const history = [
    ...(task ? [{ label: "Follow-up approved and created", time: task.createdAt }] : []),
    ...(state.resolution ? [{ label: "Resolution recorded", time: state.resolution.createdAt }] : []),
  ].sort((a, b) => b.time.localeCompare(a.time));
  const problemAt = (where: Problem["where"]) => problem?.where === where ? problem.message : "";
  const resolutionShort = resolution.trim().length < 8;

  return <>
    <a className="skip" href="#main">Skip to schedule</a>
    <header className="topbar">
      <div className="top-inner">
        <Link className="brand" href="/" translate="no"><span><Waves size={22} aria-hidden="true" /></span>ClearWeek</Link>
        <nav aria-label="Workspace"><a href="#schedule">Schedule</a><a href="#follow-up">Follow-up</a></nav>
        <span className="mode"><i />{privateMode ? "Signed-in workspace" : "Open demo"}</span>
      </div>
    </header>

    <main id="main" className="shell">
      <div className="intro">
        <div>
          <div className="eyebrow"><CalendarDays size={15} aria-hidden="true" /> Sample data</div>
          <h1>Chloe’s Friday schedule</h1>
          <p>Friday, October 23, 2026 <span className="date-dot">·</span> America/Halifax</p>
        </div>
        <a className="jump" href="#conflict"><Flag size={15} aria-hidden="true" /> 1 conflict to review, <span className="nowrap">{conflict.range}</span></a>
      </div>

      {privateMode && !session && <section className="panel sign-in" aria-labelledby="sign-in-title">
        <h2 id="sign-in-title">Sign in</h2>
        <form onSubmit={signIn}>
          <label>Email<input type="email" name="email" autoComplete="username" spellCheck={false} required /></label>
          <label>Password<input type="password" name="password" autoComplete="current-password" required /></label>
          <Button type="submit" disabled={busy || !auth} pending={pending === "sign-in"}>{pending === "sign-in" ? "Signing in…" : "Sign in"}</Button>
        </form>
        {!configured && <p className="hint">Signed-in workspace setup is incomplete.</p>}
        {problemAt("sign-in") && <div className="error-block appear"><p className="error" role="alert">{problemAt("sign-in")}</p></div>}
      </section>}

      {privateMode && session && !ready && !problemAt("load") && <p className="loading" role="status"><span className="spinner" aria-hidden="true" /> Loading the saved workspace…</p>}
      {problemAt("load") && <div className="error-block appear" style={{ marginTop: 0, marginBottom: 16 }}>
        <p className="error" role="alert">{problemAt("load")}</p>
        <p className="hint">{privateMode ? "Nothing was changed. Loading again usually fixes this." : "Resetting clears the follow-up saved in this browser and starts the demo fresh."}</p>
        {privateMode
          ? <Button variant="outline" onClick={() => setAttempt(count => count + 1)}>Load again</Button>
          : <Button variant="outline" onClick={resetDemo}>Reset demo data</Button>}
      </div>}

      <div className="main-grid">
        <section id="schedule" className="panel schedule" aria-labelledby="schedule-title">
          <div className="section-head"><div className="section-icon"><CalendarDays size={20} aria-hidden="true" /></div><div><h2 id="schedule-title">Day schedule</h2><p>4 commitments</p></div></div>
          <ol className="events">
            {view.events.map(event => <li key={event.id} className={`event ${event.category.toLowerCase()}${event.overlaps ? " clash" : ""}`}>
              <div className="event-time">{event.time[0]} <span>–</span> {event.time[1]}</div>
              <h3>{event.title}</h3>
              <span className="category">{event.category}</span>
              {event.overlaps && <div className="event-note clash-note"><TriangleAlert size={12} aria-hidden="true" /> Overlaps {event.overlaps}</div>}
              {event.readOnly && <div className="event-note"><LockKeyhole size={12} aria-hidden="true" /> Work calendar · view only, cannot be edited here</div>}
            </li>)}
          </ol>
        </section>

        <div className="right-stack">
          <section id="conflict" className="panel conflict" aria-labelledby="conflict-title">
            <div className="section-head"><div className="section-icon amber"><Flag size={19} aria-hidden="true" /></div><div><h2 id="conflict-title">Schedule conflict</h2><p>Team travel and work</p></div><span className={`status ${resolved ? "done" : ""}`}>{resolved ? "Conflict resolved" : "Conflict open"}</span></div>
            <div className="overlap">
              <div><Clock3 size={18} aria-hidden="true" /><strong>{conflict.hours} hours overlap</strong></div>
              <span className="nowrap">{conflict.range}</span>
            </div>
            <div className="lanes" role="img" aria-label={conflict.lanes.label}>
              <div className="lane-rows">
                {conflict.lanes.bars.map(bar => <div className="lane" key={bar.id}><div className={`lane-bar${bar.work ? " work" : ""}`} style={{ left: bar.left, width: bar.width }}><span>{bar.title}</span></div></div>)}
                <div className="lane-overlap" style={conflict.lanes.overlap} />
              </div>
              <div className="lane-axis">{conflict.lanes.ticks.map(tick => <span key={tick.left} className={tick.mark ? "mark" : undefined} style={{ left: tick.left }}>{tick.label}</span>)}</div>
            </div>
            <p>The team bus leaves before Chloe’s shift starts. The swap request was declined, and the notification says she is still scheduled.</p>
            <details>
              <summary>View source evidence <ChevronDown size={16} aria-hidden="true" /></summary>
              <p className="source-doc">Chloe_Nguyen_Persona.docx</p>
              <ul className="sources">{conflict.sources.map(source => <li key={source.id}><strong>{source.title}</strong><span>{source.detail}</span><small>{source.reference}</small></li>)}</ul>
            </details>
            {!resolved && <details className="resolution">
              <summary>Record a resolution <ChevronDown size={16} aria-hidden="true" /></summary>
              <label htmlFor="resolution">Resolution evidence</label>
              <textarea id="resolution" name="resolution" autoComplete="off" value={resolution} readOnly={pending === "resolve"} aria-describedby="resolution-hint"
                onChange={event => setResolution(event.target.value)} maxLength={1000} placeholder="Example: Dana confirmed by text that the shift is covered…" />
              <p id="resolution-hint" className="hint">{resolutionShort ? "Write at least 8 characters, for example who confirmed the change." : "Saving marks this conflict resolved. It cannot be edited afterwards."}</p>
              <Button variant="outline" disabled={!ready || busy || resolutionShort} pending={pending === "resolve"} onClick={() => void save({ type: "resolve", evidence: resolution })}>{pending === "resolve" ? "Saving resolution…" : "Save resolution"}</Button>
            </details>}
            {problemAt("resolve") && <div className="error-block appear"><p className="error" role="alert">{problemAt("resolve")}</p></div>}
            {state.resolution && <p className="recorded appear" ref={recordedRef} tabIndex={-1}><strong>Recorded evidence</strong><br />{state.resolution.evidence}</p>}
          </section>

          <section className="panel action" aria-labelledby="action-title">
            <div className="section-head"><div className="section-icon"><FileText size={19} aria-hidden="true" /></div><div><h2 id="action-title">Suggested next step</h2><p>Ask Dana about approved shift coverage</p></div></div>
            {(task || proposal || !resolved) && <ol className="steps" aria-label="Follow-up steps">
              {["Prepare", "Review", "Approve"].map((name, index) => <li key={name} className={step > index + 1 ? "past" : undefined} aria-current={step === index + 1 ? "step" : undefined}>
                <b>{step > index + 1 ? <Check size={12} aria-label="Done:" /> : index + 1}</b>{name}
              </li>)}
            </ol>}
            {!proposal && !task && !resolved && <>
              <p>Prepare a message for review, then save a follow-up task for yourself.</p>
              <Button ref={prepareRef} disabled={!ready || busy} pending={pending === "prepare"} onClick={prepare}>{pending === "prepare" ? "Preparing draft…" : <>Prepare draft <ArrowRight size={16} aria-hidden="true" /></>}</Button>
            </>}
            {!proposal && !task && resolved && <p>This conflict is marked as resolved, so no follow-up is needed.</p>}
            {proposal && <div className="draft appear">
              <label htmlFor="draft-message">Draft message</label>
              <span className="draft-origin">{provenanceLabel(proposal, true)}</span>
              <textarea id="draft-message" name="draft-message" autoComplete="off" ref={draftRef} maxLength={1600} value={proposal.message} readOnly={busy} aria-describedby="draft-hint"
                onChange={event => { setReviewedProposal(null); setNotice(""); setProposal(editProposal(proposal, event.target.value)); }} />
              <p id="draft-hint">{reviewed ? "Draft reviewed. Approve to save a task in ClearWeek." : "Review this version before approving. ClearWeek saves the draft with the task."}</p>
              <div className="buttons">
                {!reviewed && <Button variant="outline" disabled={busy || !proposal.message.trim()} onClick={() => setReviewedProposal(proposal)}>Review draft</Button>}
                <Button disabled={!reviewed || busy} pending={pending === "approve"} aria-describedby="draft-hint" onClick={() => { if (reviewedProposal) void save({ type: "approve", proposal, reviewed: reviewedProposal }); }}>{pending === "approve" ? "Saving task…" : "Approve & create task"}</Button>
                <Button variant="ghost" disabled={busy} onClick={() => { setProposal(null); setReviewedProposal(null); setProblem(null); setNotice("Draft dismissed"); focusNext.current = "prepare"; }}>Dismiss</Button>
              </div>
            </div>}
            {task && !proposal && <>
              <div className="saved-note appear"><CircleCheck size={18} aria-hidden="true" /><div><strong>Follow-up saved in ClearWeek</strong><p>Nothing was sent. Chloe still contacts Dana herself.</p></div></div>
              <a className="task-link" href="#follow-up" ref={savedRef}>View saved follow-up <ArrowRight size={15} aria-hidden="true" /></a>
            </>}
            {problemAt("draft") && <div className="error-block appear"><p className="error" role="alert">{problemAt("draft")}</p></div>}
            <div role="status" className={notice ? (task && !proposal ? "notice quiet" : "notice appear") : undefined}>{notice}</div>
          </section>
        </div>
      </div>

      <div className="lower-grid">
        <section className="panel" id="follow-up" aria-labelledby="follow-title" tabIndex={-1}>
          <div className="section-head"><div className="section-icon"><CircleCheck size={19} aria-hidden="true" /></div><h2 id="follow-title">Follow-up tasks</h2></div>
          {task
            ? <div className="saved-task"><h3>Ask Dana about shift coverage</h3><p>{task.proposal.message}</p><small>{provenanceLabel(task.proposal, task.verified)}</small></div>
            : <p className="empty">No follow-up tasks yet.{!proposal && !resolved && <> <a className="inline-link" href="#action-title">Prepare a draft to create one.</a></>}</p>}
        </section>
        <section className="panel" aria-labelledby="history-title">
          <div className="section-head"><div className="section-icon"><History size={19} aria-hidden="true" /></div><h2 id="history-title">Action history</h2></div>
          {history.length ? <ul className="history">{history.map(entry => <li key={entry.label}><strong>{entry.label}</strong><time dateTime={entry.time}>{new Date(entry.time).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Halifax" })}</time></li>)}</ul> : <p className="empty">No actions recorded yet. Approving a follow-up or recording a resolution shows here.</p>}
        </section>
      </div>

      <footer><span>ClearWeek · Side Quest</span>
        <Link className="task-link" href="/adjacent">Try the adjacent example <ArrowRight size={15} aria-hidden="true" /></Link>
        {privateMode && session
        ? <Button variant="ghost" disabled={busy} pending={pending === "sign-out"} onClick={signOut}>{pending === "sign-out" ? "Signing out…" : "Sign out"}</Button>
        : <span>{privateMode ? "Sample data" : "Demo tasks are saved in this browser"}</span>}
        {problemAt("sign-out") && <p className="error" role="alert">{problemAt("sign-out")}</p>}
      </footer>
    </main>
  </>;
}
