"use client";

import { useState } from "react";
import { ClipboardPaste } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sampleText } from "@/lib/extraction/providers";
import { slotInfo, slots, type Slot } from "@/lib/extraction/schema";

type Row = { id: number; slot: Slot; text: string };
type Result = { source: "sample" | "local"; model: string | null; text: string; gaps: string[] };
type Props = { mode: "sample" | "local"; maxChars: number; token?: string };

/**
 * Extraction preview. Everything here is untrusted suggestion text held in this component only:
 * nothing is saved, no event or task is created, and the schedule is never changed.
 */
export function ImportSchedule({ mode, maxChars, token }: Props) {
  const [text, setText] = useState(mode === "sample" ? sampleText : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [confirmed, setConfirmed] = useState(false);

  function reset() { setResult(null); setRows([]); setConfirmed(false); setError(""); }

  async function extract() {
    reset(); setBusy(true);
    try {
      const response = await fetch("/api/extract", {
        method: "POST", cache: "no-store",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ text }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Extraction failed.");
      setResult({ source: body.source, model: body.model, text: body.text, gaps: body.gaps });
      setRows((body.mentions as { slot: Slot; text: string }[]).map((m, id) => ({ id, ...m })));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Extraction failed.");
    } finally { setBusy(false); }
  }

  const grounded = (row: Row) => row.text.length > 0 && !!result && result.text.includes(row.text);
  const allGrounded = rows.length > 0 && rows.every(grounded);
  const update = (id: number, patch: Partial<Row>) => { setConfirmed(false); setRows(rows.map(r => r.id === id ? { ...r, ...patch } : r)); };

  return <section className="panel import" aria-labelledby="import-title">
    <div className="section-head">
      <div className="section-icon"><ClipboardPaste size={19} aria-hidden="true" /></div>
      <div><h2 id="import-title">Import schedule text</h2><p>Extraction preview · nothing is saved or scheduled</p></div>
    </div>
    <p className="import-mode">{mode === "sample"
      ? "Sample preview. This shows fixed example output for the built-in text. No model runs and nothing you type is analysed."
      : "Local model on this computer. Pasted text goes to a service on this machine only, never to Gemini or another hosted provider."}</p>
    <label htmlFor="import-text">Schedule text</label>
    <textarea id="import-text" value={text} maxLength={maxChars} disabled={busy}
      readOnly={mode === "sample"} onChange={event => { setText(event.target.value); reset(); }} />
    <div className="buttons">
      <Button variant="outline" disabled={busy || !text.trim()} onClick={() => void extract()}>{busy ? "Extracting…" : "Extract mentions"}</Button>
    </div>
    {error && <p className="error" role="alert">{error}</p>}

    {result && <div className="import-review">
      <p className="import-untrusted"><strong>Suggestions, not facts.</strong> {result.source === "sample" ? "Fixed sample output." : `Suggested by ${result.model ?? "the local model"}.`} Check each phrase against your message. Phrases must stay exactly as written in it.</p>
      {rows.length === 0 && <p>No schedule phrases were found.</p>}
      <ul className="mentions">
        {rows.map(row => <li key={row.id}>
          <label>Slot
            <select value={row.slot} onChange={event => update(row.id, { slot: event.target.value as Slot })}>
              {slots.map(slot => <option key={slot} value={slot}>{slotInfo[slot].label}</option>)}
            </select>
          </label>
          <label>Phrase
            <input value={row.text} onChange={event => update(row.id, { text: event.target.value })} aria-invalid={!grounded(row)} />
          </label>
          <small>{grounded(row) ? slotInfo[row.slot].note : "This phrase is not in your message. Fix it or remove it."}</small>
          <Button variant="ghost" onClick={() => { setRows(rows.filter(r => r.id !== row.id)); setConfirmed(false); }}>Remove</Button>
        </li>)}
      </ul>
      <div className="import-gaps">
        <strong>Still unresolved</strong>
        <ul>{result.gaps.map(gap => <li key={gap}>{gap}</li>)}</ul>
      </div>
      {!confirmed
        ? <Button disabled={!allGrounded} onClick={() => setConfirmed(true)}>Confirm reviewed mentions</Button>
        : <div className="notice" role="status">
          <strong>Reviewed mentions (preview only)</strong>
          <ul>{rows.map(row => <li key={row.id}>{slotInfo[row.slot].label}: “{row.text}”</li>)}</ul>
          <p>No event, task or schedule was created. Turning mentions into events needs a reference date, timezone and event association that ClearWeek does not store yet.</p>
          <Button variant="ghost" onClick={() => setConfirmed(false)}>Edit again</Button>
        </div>}
    </div>}
  </section>;
}
