"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createClient, type Session } from "@supabase/supabase-js";
import { ArrowRight, CalendarDays, ChevronDown, CircleCheck, Clock3, FileText, Flag, History, LockKeyhole, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImportSchedule } from "@/components/import-schedule";
import { evidence, currentConflicts, formatTime, listEvents } from "@/lib/scenario";
import { applyAction, draft, editProposal, emptyState, normalizeWorkspace, provenanceLabel, type Action, type Proposal, type Workspace } from "@/lib/workflow";

const [conflict] = currentConflicts();
const sourceIds = [...conflict.sources, "swap", "availability"] as const;
const storageKey = "clearweek:oct23:v1";
type Props = { privateMode: boolean; supabaseUrl?: string; publishableKey?: string; extraction?: { mode: "sample" | "local"; maxChars: number } };

async function api<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options, cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const body = await response.json();
  if (!response.ok) throw Object.assign(new Error(body.error ?? "The request failed."), { status: response.status });
  return body;
}

export function WorkspaceView({ privateMode, supabaseUrl, publishableKey, extraction }: Props) {
  const auth = useMemo(() => supabaseUrl && publishableKey ? createClient(supabaseUrl, publishableKey) : null, [supabaseUrl, publishableKey]);
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<Workspace>(emptyState);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [reviewedProposal, setReviewedProposal] = useState<Proposal | null>(null);
  const [resolution, setResolution] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const token = session?.access_token ?? "";
  const reviewed = proposal !== null && reviewedProposal?.version === proposal.version;

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
        if (active) { setState(normalizeWorkspace(saved)); setReady(true); }
      } catch {
        if (active) setError("The saved workspace could not be loaded.");
      }
    }
    void load();
    return () => { active = false; };
  }, [privateMode, token]);

  async function run(operation: () => Promise<void>) {
    setError(""); setNotice(""); setBusy(true);
    try { await operation(); }
    catch (error) { setError(error instanceof Error ? error.message : "Something went wrong. Try again."); }
    finally { setBusy(false); }
  }

  function prepare() {
    void run(async () => {
      const next = privateMode
        ? await api<Proposal>("/api/proposal", token, { method: "POST" })
        : draft("demo", { framing: "coverage", details: ["swap", "availability"] });
      setProposal(next); setReviewedProposal(null); setNotice("Draft prepared");
    });
  }

  async function save(action: Action) {
    await run(async () => {
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
      } else { setNotice("Resolution recorded"); }
    });
  }

  function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    void run(async () => {
      if (!auth) throw new Error("Private workspace setup is incomplete.");
      const result = await auth.auth.signInWithPassword({ email: String(fields.get("email")), password: String(fields.get("password")) });
      if (result.error) throw new Error("Sign-in failed. Check your email and password.");
    });
  }

  const task = state.tasks[0];
  const resolved = Boolean(state.resolution);
  const history = [
    ...(task ? [{ label: "Follow-up approved and created", time: task.createdAt }] : []),
    ...(state.resolution ? [{ label: "Resolution recorded", time: state.resolution.createdAt }] : []),
  ].sort((a, b) => b.time.localeCompare(a.time));

  return <>
    <a className="skip" href="#main">Skip to schedule</a>
    <header className="topbar">
      <div className="top-inner">
        <Link className="brand" href="/"><span><Waves size={22} aria-hidden="true" /></span>ClearWeek</Link>
        <nav aria-label="Workspace"><a href="#schedule">Schedule</a><a href="#follow-up">Follow-up</a></nav>
        <span className="mode"><i />{privateMode ? "Private workspace" : "Offline demo"}</span>
      </div>
    </header>

    <main id="main" className="shell">
      <div className="intro">
        <div className="eyebrow"><CalendarDays size={15} aria-hidden="true" /> Historical sample</div>
        <h1>Chloe’s Friday schedule</h1>
        <p>Friday, October 23, 2026 <span className="date-dot">·</span> America/Halifax</p>
        <Link className="task-link" href="/adjacent">Try the adjacent example <ArrowRight size={15} aria-hidden="true" /></Link>
      </div>

      {privateMode && !session && <section className="panel sign-in" aria-labelledby="sign-in-title">
        <h2 id="sign-in-title">Sign in</h2>
        <form onSubmit={signIn}>
          <label>Email<input type="email" name="email" autoComplete="username" required /></label>
          <label>Password<input type="password" name="password" autoComplete="current-password" required /></label>
          <Button disabled={busy || !auth}>Sign in</Button>
        </form>
        {!auth && <p>Private workspace setup is incomplete.</p>}
      </section>}

      <div className="main-grid">
        <section id="schedule" className="panel schedule" aria-labelledby="schedule-title">
          <div className="section-head"><div className="section-icon"><CalendarDays size={20} aria-hidden="true" /></div><div><h2 id="schedule-title">Day schedule</h2><p>4 commitments</p></div></div>
          <ol className="events">
            {listEvents().map(event => <li key={event.id} className={`event ${event.category.toLowerCase()}`}>
              <div className="event-time">{formatTime(event.start)} <span>–</span> {formatTime(event.end)}</div>
              <div className="event-main"><h3>{event.title}</h3><span className="category">{event.category}</span></div>
              {event.readOnly && <div className="subscribed"><LockKeyhole size={12} aria-hidden="true" /> Subscribed calendar · read-only</div>}
            </li>)}
          </ol>
        </section>

        <div className="right-stack">
          <section className="panel conflict" aria-labelledby="conflict-title">
            <div className="section-head"><div className="section-icon amber"><Flag size={19} aria-hidden="true" /></div><div><h2 id="conflict-title">Schedule conflict</h2><p>Team travel and work</p></div><span className={`status ${resolved ? "done" : ""}`}>{resolved ? "Conflict resolved" : "Conflict open"}</span></div>
            <div className="overlap">
              <div><Clock3 size={18} aria-hidden="true" /><strong>{conflict.minutes / 60} hours overlap</strong></div>
              <span>{formatTime(conflict.start)} – {formatTime(conflict.end)}</span>
            </div>
            <p>The team bus leaves before Chloe’s shift starts. The swap request was declined, and the notification says she is still scheduled.</p>
            <details>
              <summary>View source evidence <ChevronDown size={16} aria-hidden="true" /></summary>
              <p className="source-doc">Chloe_Nguyen_Persona.docx</p>
              <ul className="sources">{sourceIds.map(id => <li key={id}><strong>{evidence[id].title}</strong><span>{evidence[id].detail}</span><small>{evidence[id].reference}</small></li>)}</ul>
            </details>
            {!resolved && <details className="resolution">
              <summary>Record a resolution <ChevronDown size={16} aria-hidden="true" /></summary>
              <label htmlFor="resolution">Resolution evidence</label>
              <textarea id="resolution" value={resolution} onChange={event => setResolution(event.target.value)} maxLength={1000} placeholder="Who confirmed the change, and what did they confirm?" />
              <Button variant="outline" disabled={!ready || busy || resolution.trim().length < 8} onClick={() => void save({ type: "resolve", evidence: resolution })}>Save resolution</Button>
            </details>}
            {state.resolution && <p className="recorded"><strong>Recorded evidence</strong><br />{state.resolution.evidence}</p>}
          </section>

          <section className="panel action" aria-labelledby="action-title">
            <div className="section-head"><div className="section-icon"><FileText size={19} aria-hidden="true" /></div><div><h2 id="action-title">Suggested next step</h2><p>Ask Dana about approved shift coverage</p></div></div>
            {!proposal && <p>Prepare a message for review, then save a follow-up task for yourself.</p>}
            {!proposal && !task && !resolved && <Button disabled={!ready || busy} onClick={prepare}>{busy ? "Working…" : "Prepare draft"} <ArrowRight size={16} aria-hidden="true" /></Button>}
            {proposal && <div className="draft">
              <label htmlFor="draft-message">Draft message</label>
              <span className="draft-origin">{provenanceLabel(proposal, true)}</span>
              <textarea id="draft-message" maxLength={1600} value={proposal.message} disabled={busy}
                onChange={event => { setReviewedProposal(null); setNotice(""); setProposal(editProposal(proposal, event.target.value)); }} />
              <p>{reviewed ? "Draft reviewed. Approve to save a task in ClearWeek." : "Review this version before approving. ClearWeek saves the draft with the task."}</p>
              <div className="buttons">
                {!reviewed && <Button variant="outline" disabled={busy || !proposal.message.trim()} onClick={() => setReviewedProposal(proposal)}>Review draft</Button>}
                <Button disabled={!reviewed || busy} onClick={() => { if (reviewedProposal) void save({ type: "approve", proposal, reviewed: reviewedProposal }); }}>Approve &amp; create task</Button>
                <Button variant="ghost" disabled={busy} onClick={() => { setProposal(null); setReviewedProposal(null); setNotice("Draft dismissed"); }}>Dismiss</Button>
              </div>
            </div>}
            {task && !proposal && <a className="task-link" href="#follow-up">View saved follow-up <ArrowRight size={15} aria-hidden="true" /></a>}
            <div role="status" className={notice ? "notice" : undefined}>{notice}</div>
          </section>
        </div>
      </div>
      {error && <p className="error" role="alert">{error}</p>}

      <div className="lower-grid">
        <section className="panel" id="follow-up" aria-labelledby="follow-title">
          <div className="section-head"><div className="section-icon"><CircleCheck size={19} aria-hidden="true" /></div><h2 id="follow-title">Follow-up tasks</h2></div>
          {task ? <div className="saved-task"><h3>Ask Dana about shift coverage</h3><p>{task.proposal.message}</p><small>{provenanceLabel(task.proposal, task.verified)}</small></div> : <p>No follow-up tasks yet.</p>}
        </section>
        <section className="panel" aria-labelledby="history-title">
          <div className="section-head"><div className="section-icon"><History size={19} aria-hidden="true" /></div><h2 id="history-title">Action history</h2></div>
          {history.length ? <ul className="history">{history.map(entry => <li key={entry.label}><strong>{entry.label}</strong><time dateTime={entry.time}>{new Date(entry.time).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Halifax" })}</time></li>)}</ul> : <p>No actions recorded yet.</p>}
        </section>
      </div>

      {extraction && (!privateMode || session) && <ImportSchedule mode={extraction.mode} maxChars={extraction.maxChars} token={privateMode ? token : undefined} />}

      <footer><span>ClearWeek · Side Quest</span>{privateMode && session ? <Button variant="ghost" disabled={busy} onClick={() => void run(async () => {
        const result = await auth?.auth.signOut();
        if (result?.error) throw new Error("Sign-out failed. Try again.");
        setReady(false); setState(emptyState); setProposal(null); setReviewedProposal(null); setResolution("");
      })}>Sign out</Button> : <span>{privateMode ? "Historical sample" : "Demo tasks are saved in this browser"}</span>}</footer>
    </main>
  </>;
}
