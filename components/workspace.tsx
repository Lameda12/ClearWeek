"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { CircleCheck } from "lucide-react";
import { DayRuler } from "@/components/day-ruler";
import { Evidence } from "@/components/evidence";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Textarea, fieldClass } from "@/components/ui/textarea";
import { demoStates, type DemoState } from "@/lib/demo-state";
import { readDraft, writeDraft } from "@/lib/draft-store";
import type { ScheduleView } from "@/lib/schedule-view";
import { applyAction, draft, editProposal, emptyState, normalizeWorkspace, provenanceLabel, type Action, type Proposal, type Workspace } from "@/lib/workflow";

const storageKey = "clearweek:oct23:v1";
type Props = { view: ScheduleView; privateMode: boolean; demoState?: DemoState; supabaseUrl?: string; publishableKey?: string };
type Pending = "prepare" | "approve" | "resolve" | "sign-in" | "sign-out";
type Problem = { where: "load" | "prepare" | "approve" | "resolve" | "sign-in" | "sign-out"; message: string; status?: number };
type FocusTarget = "draft" | "saved" | "prepare" | "recorded";

const small = "text-[length:var(--text-small)] leading-5";
const heading = "m-0 text-[length:var(--text-h2)] leading-6 font-bold tracking-[-0.01em] font-stretch-[87.5%] [text-wrap:wrap]";
const errorBox = "rounded-[var(--r-control)] border border-[var(--danger-line)] bg-[var(--danger-wash)] p-3 text-[length:var(--text-body)] leading-6 text-[var(--danger)]";
const number = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
// Shown when the task could not be saved. A 409 is different: something else changed, so its own message is kept.
const notCreated = "The task was not created. Your draft is still here. Select Approve & create task to try again.";

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

/** The label under "Draft message". Drafts no AI wrote say so plainly. */
const originLabel = (p: Proposal, template: boolean) => p.edited ? provenanceLabel(p, true) : template ? "Template draft, no AI used" : ({ demo: "Open demo draft, no AI used", fallback: "Template draft, no AI used", gemini: provenanceLabel(p, true) })[p.source];

export function WorkspaceView({ view, privateMode, demoState, supabaseUrl, publishableKey }: Props) {
  const { conflict, day } = view;
  const configured = Boolean(supabaseUrl && publishableKey);
  // The Supabase client is only needed when signed-in mode is on, so the open demo never downloads it.
  const [auth, setAuth] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<Workspace>(emptyState);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [reviewedProposal, setReviewedProposal] = useState<Proposal | null>(null);
  const [resolution, setResolution] = useState("");
  const [ready, setReady] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
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
  const resumed = useRef(false);
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
        // A demo state link starts the demo over, so the draft, error and empty screens can be shown after a task was saved.
        if (demoState && !privateMode) localStorage.removeItem(storageKey);
        const saved = privateMode ? await api<unknown>("/api/workspace", token) : JSON.parse(localStorage.getItem(storageKey) ?? "null");
        const next = normalizeWorkspace(saved);
        if (!active) return;
        setState(next); setReady(true); setProblem(null);
        // A draft in progress survives a reload of this tab. It resumes once, and only if no task has been saved since:
        // a finished follow-up leaves nothing to resume.
        if (!resumed.current) {
          resumed.current = true;
          const draftInProgress = demoState ? null : next.tasks.length === 0 ? readDraft() : null;
          // A demo state link replaces whatever draft this tab had, so each link shows exactly its screen.
          if (demoState && next.tasks.length === 0 && ["draft", "template", "error"].includes(demoState)) {
            const seeded = draft("demo", { framing: "coverage", details: ["swap", "availability"] });
            setProposal(seeded);
            if (demoState === "error") { setReviewedProposal(seeded); setProblem({ where: "approve", message: notCreated }); }
          }
          if (draftInProgress) { setProposal(draftInProgress.proposal); setReviewedProposal(draftInProgress.reviewed ? draftInProgress.proposal : null); }
          setDraftLoaded(true);
        }
      } catch {
        if (active) setProblem({ where: "load", message: privateMode
          ? "The saved workspace could not be loaded."
          : "The demo data saved in this browser could not be read." });
      }
    }
    void load();
    return () => { active = false; };
  }, [privateMode, token, attempt, demoState]);

  // The draft in progress is saved for this tab as it changes, once the saved workspace (and any resumed draft) is known.
  useEffect(() => {
    if (draftLoaded) writeDraft(proposal ? { proposal, reviewed } : null);
  }, [draftLoaded, proposal, reviewed]);

  // A typed resolution is not kept anywhere, so leaving would lose it; let the browser ask first.
  const unsaved = resolution.trim().length > 0;
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  async function run(kind: Pending, where: Problem["where"] | null, operation: () => Promise<void>) {
    setProblem(null); setNotice(""); setPending(kind);
    try { await operation(); }
    catch (error) {
      const status = (error as { status?: number } | null)?.status;
      if (where) setProblem({ where, status, message: error instanceof Error ? error.message : "Something went wrong. Try again." });
    }
    finally { setPending(null); }
  }

  /** Demo mode only: clears unreadable saved data so the page works again. */
  function resetDemo() {
    try { localStorage.removeItem(storageKey); } catch { /* storage is unavailable; the in-memory state still works */ }
    setState(emptyState); setProposal(null); setReviewedProposal(null); setProblem(null); setReady(true);
    setNotice("Demo data reset");
  }

  function prepare() {
    void run("prepare", "prepare", async () => {
      // The server always returns a draft: Gemini's, or its labelled template when Gemini cannot be asked.
      // Only a hard failure (network, 5xx, expired sign-in) reaches the catch in run() and shows as an error.
      const next = privateMode
        ? await api<Proposal>("/api/proposal", token, { method: "POST" })
        : draft("demo", { framing: "coverage", details: ["swap", "availability"] });
      setProposal(next); setReviewedProposal(null);
      focusNext.current = "draft";
    });
  }

  async function save(action: Action) {
    await run(action.type, action.type === "approve" ? "approve" : "resolve", async () => {
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
      writeDraft(null);
      resumed.current = false; setReady(false); setDraftLoaded(false); setState(emptyState); setProposal(null); setReviewedProposal(null); setResolution("");
    });
  }

  const task = state.tasks[0];
  const resolved = Boolean(state.resolution);
  const loading = demoState === "loading" || (privateMode && Boolean(session) && !ready && !(problem?.where === "load"));
  const history = [
    ...(task ? [{ label: "Follow-up approved and created", time: task.createdAt }] : []),
    ...(state.resolution ? [{ label: "Resolution recorded", time: state.resolution.createdAt }] : []),
  ].sort((a, b) => b.time.localeCompare(a.time));
  const problemAt = (where: Problem["where"]) => problem?.where === where ? problem : null;
  const resolutionShort = resolution.trim().length < 8;
  const approveProblem = problemAt("approve");

  const followUp = <section id="follow-up" tabIndex={-1} aria-labelledby="follow-title" className="flex scroll-mt-4 flex-col gap-2 border-t border-[var(--line)] pt-4">
    <h2 id="follow-title" className={heading}>Follow-up tasks</h2>
    {task
      ? <div className="flex flex-col gap-1 rounded-[var(--r-control)] bg-[var(--ok-wash)] p-3">
        <h3 className="text-[length:var(--text-body)] font-semibold text-[var(--ink)]">Ask Dana about shift coverage</h3>
        <p className="text-[var(--ink)] [overflow-wrap:anywhere]">{task.proposal.message}</p>
        <p className={`${small} text-[var(--ok)]`}>{provenanceLabel(task.proposal, task.verified)}</p>
      </div>
      : <p className="text-[var(--muted)]">No follow-up tasks yet.</p>}
  </section>;
  const actions = <section aria-labelledby="history-title" className="flex flex-col gap-2 border-t border-[var(--line)] pt-4">
    <h2 id="history-title" className={heading}>Action history</h2>
    {history.length
      ? <ul className="m-0 flex list-none flex-col gap-2 p-0">{history.map(entry => <li key={entry.label} className="flex flex-col">
        <strong className="font-semibold">{entry.label}</strong>
        <time className={`${small} text-[var(--muted)]`} dateTime={entry.time}>{new Date(entry.time).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Halifax" })}</time>
      </li>)}</ul>
      : <p className="text-[var(--muted)]">No actions recorded yet. Approving a follow-up or recording a resolution shows here.</p>}
  </section>;

  return <>
    <SiteHeader privateMode={privateMode} />
    <main>
      <Container className="flex flex-col gap-6 pb-10 pt-6 md:gap-10 md:py-10">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-[length:var(--text-h1)] leading-[34px] [text-wrap:wrap] font-bold tracking-[-0.02em] font-stretch-[87.5%]">Chloe’s Friday schedule</h1>
          <p className="text-[var(--muted)]">Friday, October 23, 2026, Halifax time</p>
        </div>

        {privateMode && !session && <section className="rounded-[var(--r-panel)] border border-[var(--line)] bg-[var(--surface)] p-4 md:p-6" aria-labelledby="sign-in-title">
          <h2 id="sign-in-title" className={heading}>Sign in</h2>
          <form onSubmit={signIn} className="mt-3 flex flex-wrap items-end gap-3">
            <label className={`${small} flex-[1_1_14rem] font-semibold`}>Email<input className={`${fieldClass} mt-1 min-h-11 font-normal`} type="email" name="email" autoComplete="username" spellCheck={false} required /></label>
            <label className={`${small} flex-[1_1_14rem] font-semibold`}>Password<input className={`${fieldClass} mt-1 min-h-11 font-normal`} type="password" name="password" autoComplete="current-password" required /></label>
            <Button type="submit" disabled={busy || !auth} pending={pending === "sign-in"}>{pending === "sign-in" ? "Signing in…" : "Sign in"}</Button>
          </form>
          {!configured && <p className={`${small} mt-3 text-[var(--muted)]`}>Signed-in workspace setup is incomplete.</p>}
          {problemAt("sign-in") && <p className={`${errorBox} appear mt-3`} role="alert">{problemAt("sign-in")?.message}</p>}
        </section>}

        {problemAt("load") && <div className={`${errorBox} appear flex flex-col items-start gap-2`}>
          <p className="font-semibold" role="alert">{problemAt("load")?.message}</p>
          <p className={`${small} text-[var(--muted)]`}>{privateMode ? "Nothing was changed. Loading again usually fixes this." : "Resetting clears the follow-up saved in this browser and starts the demo fresh."}</p>
          {privateMode
            ? <Button variant="outline" onClick={() => setAttempt(count => count + 1)}>Load again</Button>
            : <Button variant="outline" onClick={resetDemo}>Reset demo data</Button>}
        </div>}

        {loading ? <LoadingSkeleton /> : <>
          {conflict
            ? <div className="grid gap-x-12 gap-y-1 md:grid-cols-[auto_1fr] md:items-end">
              <p className={`${small} font-semibold text-[var(--danger)] md:col-start-2 md:row-start-1`}>Swap declined</p>
              <h2 className="m-0 text-[length:var(--text-display)] leading-[50px] [text-wrap:wrap] font-bold tracking-[-0.02em] font-stretch-[87.5%] text-[var(--flag)] md:col-start-1 md:row-span-2 md:row-start-1 md:whitespace-nowrap">
                {conflict.hours} {conflict.hours === 1 ? "hour" : "hours"} overlap
              </h2>
              <p className="md:col-start-2 md:row-start-2">{conflict.titles[0]} and {conflict.titles[1]} overlap from {conflict.start} to {conflict.end}.</p>
            </div>
            : <div className="flex flex-col gap-1">
              <h2 className="m-0 text-[length:var(--text-h1)] leading-[34px] [text-wrap:wrap] font-bold tracking-[-0.02em] font-stretch-[87.5%]">No conflicts on Friday</h2>
              <p>Your {number[day.lanes.length] ?? day.lanes.length} commitments do not overlap.</p>
            </div>}

          <DayRuler day={day} conflict={conflict} />

          {conflict
            ? <>
              <p>The team bus leaves before Chloe’s shift starts. The swap request was declined, and the notification says she is still scheduled.</p>
              <div className="grid gap-6 md:grid-cols-[minmax(0,620fr)_minmax(0,472fr)] md:gap-x-12 md:gap-y-4">
                <div className="flex flex-col gap-3 md:col-start-1">
                  <section aria-labelledby="action-title" className="flex flex-col gap-3 rounded-[var(--r-panel)] border border-[var(--line)] bg-[var(--surface)] px-4 py-6 md:p-6">
                    {proposal && <p className={`${small} font-semibold text-[var(--water)]`}>Step 2 of 3: Review</p>}
                    <h2 id="action-title" className={heading}>Ask Dana about approved shift coverage</h2>

                    {!proposal && !task && !resolved && <>
                      <p>Prepare a message for review, then save a follow-up task for yourself.</p>
                      <p className={`${small} text-[var(--muted)]`}>Optional suggestion. You can edit it or skip it. Nothing is saved until you approve.</p>
                      <Button ref={prepareRef} className="w-full md:w-auto md:self-start" disabled={!ready || busy} pending={pending === "prepare"} onClick={prepare}>{pending === "prepare" ? "Preparing draft…" : "Prepare draft"}</Button>
                      {problemAt("prepare") && <p className={`${errorBox} appear`} role="alert">{problemAt("prepare")?.message}</p>}
                    </>}
                    {!proposal && !task && resolved && <p>This conflict is marked as resolved, so no follow-up is needed.</p>}

                    {proposal && <div className="appear flex flex-col gap-3">
                      {proposal.source === "fallback" || (demoState === "template" && !proposal.edited)
                        ? <p role="status" className="rounded-[var(--r-control)] bg-[var(--water-wash)] p-3 text-[var(--ink)]">Template draft. The AI suggestion was not available, so this is a standard message.</p>
                        : <p role="status" className={`${small} rounded-[var(--r-control)] bg-[var(--water-wash)] px-3 py-2 font-semibold text-[var(--water-deep)]`}>Draft prepared</p>}
                      <label htmlFor="draft-message" className={`${small} font-semibold`}>Draft message</label>
                      <p className={`${small} text-[var(--muted)]`}>{originLabel(proposal, demoState === "template")}</p>
                      <Textarea id="draft-message" name="draft-message" grow autoComplete="off" ref={draftRef} maxLength={1600} value={proposal.message} readOnly={busy} aria-describedby="draft-hint"
                        onChange={event => {
                          setReviewedProposal(null); setNotice("");
                          setProposal(editProposal(proposal, event.target.value));
                        }} />
                      <p id="draft-hint" className={`${small} text-[var(--muted)]`}>
                        {"Review this version before approving. ClearWeek saves the draft with the task. Your draft is kept if you reload this page."}
                      </p>
                      {approveProblem && <p className={`${errorBox} appear`} role="alert">{approveProblem.status === 409 || approveProblem.status === 401 ? approveProblem.message : notCreated}</p>}
                      <div className="flex flex-col gap-2 md:flex-row md:items-center [&>button]:w-full md:[&>button]:w-auto">
                        {!reviewed && <Button disabled={busy || !proposal.message.trim()} onClick={() => setReviewedProposal(proposal)}>Review draft</Button>}
                        <Button disabled={!reviewed || busy} pending={pending === "approve"} aria-describedby="draft-hint" onClick={() => { if (reviewedProposal) void save({ type: "approve", proposal, reviewed: reviewedProposal }); }}>{pending === "approve" ? "Saving task…" : "Approve & create task"}</Button>
                        <Button variant="ghost" disabled={busy} onClick={() => { setProposal(null); setReviewedProposal(null); setProblem(null); setNotice("Draft dismissed"); focusNext.current = "prepare"; }}>Dismiss</Button>
                      </div>
                    </div>}

                    {task && !proposal && <>
                      <div className="appear flex items-start gap-2.5 rounded-[var(--r-control)] bg-[var(--ok-wash)] p-3 text-[var(--ok)]">
                        <CircleCheck size={18} className="mt-0.5 flex-none" aria-hidden="true" />
                        <div><strong>Follow-up saved in ClearWeek</strong><p className={`${small} text-inherit`}>Nothing was sent. Chloe still contacts Dana herself.</p></div>
                      </div>
                      <a className={`${small} inline-flex min-h-[var(--tap)] items-center self-start font-semibold text-[var(--water)] underline-offset-4 hover:underline`} href="#follow-up" ref={savedRef}>View saved follow-up</a>
                    </>}
                                      </section>
                  <div role="status" className={notice ? `${small} appear rounded-[var(--r-control)] bg-[var(--ok-wash)] px-3 py-2.5 font-semibold text-[var(--ok)]` : "sr-only"}>{notice}</div>
                </div>

                {state.resolution
                  ? <p className="appear rounded-[var(--r-control)] bg-[var(--ok-wash)] p-3 text-[var(--ok)] [overflow-wrap:anywhere] md:col-start-1" ref={recordedRef} tabIndex={-1}><strong>Conflict resolved</strong><br />{state.resolution.evidence}</p>
                  : <div className="md:col-start-1">
                    <details className="group border-t border-[var(--line)]">
                      <summary className={`${small} flex min-h-12 cursor-pointer items-center justify-between font-semibold text-[var(--water)] underline-offset-4 hover:underline`}>
                        Note how this was sorted out
                        <Image src="/v2/chevron-down.svg" alt="" width={20} height={20} unoptimized className="transition-transform duration-[var(--reveal)] group-open:rotate-180 md:hidden" />
                      </summary>
                      <div className="flex flex-col gap-2 pb-4">
                        <label htmlFor="resolution" className={`${small} font-semibold`}>Resolution evidence</label>
                        <Textarea id="resolution" name="resolution" autoComplete="off" value={resolution} readOnly={pending === "resolve"} aria-describedby="resolution-hint"
                          onChange={event => setResolution(event.target.value)} maxLength={1000} placeholder="Example: Dana confirmed by text that the shift is covered…" />
                        <p id="resolution-hint" className={`${small} text-[var(--muted)]`}>{resolutionShort ? "Write at least 8 characters, for example who confirmed the change." : "Saving marks this conflict resolved. It cannot be edited afterwards."}</p>
                        <Button variant="outline" className="w-full md:w-auto md:self-start" disabled={!ready || busy || resolutionShort} pending={pending === "resolve"} onClick={() => void save({ type: "resolve", evidence: resolution })}>{pending === "resolve" ? "Saving resolution…" : "Save resolution"}</Button>
                        {problemAt("resolve") && <p className={`${errorBox} appear`} role="alert">{problemAt("resolve")?.message}</p>}
                      </div>
                    </details>
                  </div>}

                <div className="md:col-start-2 md:row-span-4 md:row-start-1"><Evidence sources={conflict.sources} /></div>
                <div className="md:col-start-1">{followUp}</div>
                <div className="md:col-start-1">{actions}</div>
              </div>
            </>
            : <div className="grid gap-4 md:grid-cols-2 md:gap-x-12">{followUp}{actions}</div>}
        </>}

        {!privateMode && <nav aria-label="Demo states" className={`${small} flex flex-wrap items-center gap-x-4`}>
          <span className="text-[var(--muted)]">Demo states</span>
          {demoStates.map(item => <a key={item.id} href={item.id === "default" ? "/?state=default" : `/?state=${item.id}`} aria-current={(demoState ?? "default") === item.id ? "page" : undefined}
            className="inline-flex min-h-[var(--tap)] items-center font-semibold text-[var(--water)] underline-offset-4 hover:underline aria-[current=page]:underline">{item.label}</a>)}
        </nav>}

        <footer className={`${small} flex min-h-[var(--tap)] flex-wrap items-center justify-between gap-2`}>
          <Link className="inline-flex min-h-[var(--tap)] items-center font-semibold text-[var(--water)] underline-offset-4 hover:underline" href="/adjacent">Try the adjacent example</Link>
          {privateMode
            ? session && <Button variant="ghost" disabled={busy} pending={pending === "sign-out"} onClick={signOut}>{pending === "sign-out" ? "Signing out…" : "Sign out"}</Button>
            : <p className="hidden text-[var(--muted)] md:block">Demo tasks are saved in this browser</p>}
          {problemAt("sign-out") && <p className="w-full font-semibold text-[var(--danger)]" role="alert">{problemAt("sign-out")?.message}</p>}
        </footer>
      </Container>
    </main>
  </>;
}
