#!/usr/bin/env python3
"""Compare a local backend with the predictions the Colab run saved (adapter-test-predictions.jsonl).

Run after loading a real artifact, and again after any conversion or quantization. It reports how often the local
output is identical to Colab's, plus validity, exact-match and grounding against the gold labels. It does not decide
whether the model is good enough; read the evaluation metrics and the failures yourself.
"""
import argparse
import json
from pathlib import Path

SLOTS = {"event_date", "event_time", "event_location", "event_name", "available_start_time", "available_end_time"}


def parse(raw):
    raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        obj = json.loads(raw)
    except ValueError:
        return None
    if not isinstance(obj, dict) or set(obj) != {"mentions"} or not isinstance(obj["mentions"], list):
        return None
    for m in obj["mentions"]:
        if not isinstance(m, dict) or set(m) != {"slot", "text"} or m["slot"] not in SLOTS or not isinstance(m["text"], str) or not m["text"]:
            return None
    return obj


def compare(rows, generate):
    n = identical = valid = exact = ungrounded = 0
    differing = []
    for row in rows:
        n += 1
        raw = generate(row["text"])
        identical += raw == row["raw_prediction"]
        if raw != row["raw_prediction"]:
            differing.append({"text": row["text"], "colab": row["raw_prediction"], "local": raw})
        pred = parse(raw)
        valid += pred is not None
        pairs = {(m["slot"], m["text"]) for m in pred["mentions"]} if pred else set()
        gold = {(m["slot"], m["text"]) for m in row["target"]["mentions"]}
        exact += pred is not None and pairs == gold
        ungrounded += any(t not in row["text"] for _, t in pairs)
    return {"n": n, "identical_to_colab": identical / max(1, n), "json_valid": valid / max(1, n),
            "exact_set_match": exact / max(1, n), "ungrounded": ungrounded / max(1, n)}, differing


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--predictions", required=True, help="adapter-test-predictions.jsonl from the export")
    p.add_argument("--limit", type=int, default=100)
    p.add_argument("--show-diffs", type=int, default=5)
    p.add_argument("--adapter"); p.add_argument("--manifest"); p.add_argument("--system-prompt"); p.add_argument("--base-revision")
    p.add_argument("--backend", choices=["hf-peft"], default="hf-peft")
    args = p.parse_args()
    from hf_peft_backend import HfPeftBackend
    backend = HfPeftBackend(args.adapter, args.manifest, args.system_prompt, args.base_revision)
    rows = [json.loads(line) for line in Path(args.predictions).read_text().splitlines() if line.strip()][: args.limit]
    metrics, diffs = compare(rows, lambda text: backend.generate(text, 30.0))
    print(json.dumps({"backend": backend.label, **metrics}, indent=2))
    for d in diffs[: args.show_diffs]:
        print(json.dumps(d, ensure_ascii=False))


if __name__ == "__main__":
    main()
