# Schedule-text extraction (preparation)

**Status, November 9, 2026:** the interface, validation, review UI, mock/sample providers and a local service skeleton exist. **No Qwen model has been trained, downloaded, loaded or run here.** Every extraction test uses mocked output or a stub that returns a fixed string. Nothing below is a claim about model quality. Gemini draft generation is unchanged and separate; extraction never calls Gemini or any hosted provider.

## What it does and does not do

Paste text → candidate mentions → review and correct → explicit confirm. Mentions are a flat list of `{slot, text}` with exact source phrases. The model does not decide which event a phrase belongs to, resolve "Friday" to a date, work out durations or timezones, find overlaps, or authorize anything.

**It is a preview only.** Confirming shows the reviewed list and saves nothing. The current storage cannot hold arbitrary events: `clearweek_actions` is limited by a check constraint to `conflict_id = 'bus:shift'` with one approve and one resolve row, and the schedule is the fixed Chloe constant in `lib/scenario.ts`. Turning mentions into events needs a new design (event identity, reference date, timezone, association, duration, and a new migration). That is deliberately not attempted.

## Training facts from the notebook

Read from both notebooks in `~/Downloads`; they are **not identical**. `ClearWeek_Calendar_Extraction_Colab_fixed.ipynb` is the reference.

| | Original | Fixed (used here) |
| --- | --- | --- |
| Train / eval limits | 2000 / 100 | 4000 / 600 |
| `parse_prediction` | strict JSON | also strips a Markdown fence before parsing |
| `TrainingArguments` | no `label_names` | `label_names=['labels']` |
| Metrics | no positive-only metric | adds `n_positive`, `exact_set_match_positive` |
| Imports | no `sys` | adds `sys` (the install cell already used it) |

Same in both: base `Qwen/Qwen3-1.7B` at a revision the run records; LoRA r=16, alpha=32, dropout 0.05 on q/k/v/o/gate/up/down projections; 2 epochs, lr 1e-4, batch 2 × accumulation 8, cosine; seed 42; `MAX_LEN=768` (examples longer than that are excluded from training); dataset Google SGD, revision `e852981ae34990f4358979625854259302feaa78` (CC BY-SA 4.0). Training is 4-bit QLoRA on GPUs under 20 GB, BF16 LoRA otherwise, so **the manifest's `4bit` field matters for how faithfully a bf16 local load reproduces training**.

- **Slots (confirmed from the pinned upstream `Calendar_1` schema):** `event_date` ("Date of event or for checking availability"), `event_time` ("Start time of event"), `event_location`, `event_name`, `available_start_time`, `available_end_time` ("Ending time of available time slot"). `available_end_time` is the end of a free window, **not** an event end time. There is no slot for an event end, duration, timezone or swap status.
- **Output:** `{"mentions":[{"slot":"...","text":"..."}]}`, text an exact substring, no normalization, deduplicated, ordered by appearance then slot, empty list if none.
- **Prompt:** a system message embedding the slot descriptions, then the user text, through Qwen's chat template with `enable_thinking=False`. The notebook saves it as `system-prompt.txt`. The expected prompt (reconstructed from the pinned schema, **not** from an artifact) is 726 characters with SHA-256 `a3de2986713ed36016c5a87e538e14c6a9f1d07877e605a2e50dc60ff4132903`. Compare the exported file against this; a mismatch means the prompt changed.
- **Decoding in evaluation:** greedy, `max_new_tokens=256`, prompt over 768 tokens raises an error.
- **Export:** a ZIP containing a **PEFT LoRA adapter** (`adapter/` with its tokenizer), `manifest.json`, `system-prompt.txt`, metrics and predictions JSONL, `comparison.json`, `pip-freeze.txt`, license and attribution files. It is **not** merged, MLX or GGUF. The base weights are not included.
- **Limits stated by the notebook:** simulated dialogues, a custom dialogue-disjoint split (not official SGD scores), no ClearWeek-specific data (declined swaps, multiple events, relative dates), GPU training not run by its author, no accuracy promised.

## Validation in the app

`lib/extraction/schema.ts` validates every response with Zod (strict objects, six slots, at most 24 mentions of at most 200 characters) and checks **grounding**: each `text` must occur exactly, case-sensitively, in the submitted text. Any failure rejects the whole response (malformed JSON, unknown slot, extra field, text not in the source). Identical slot/text pairs are merged; a Markdown fence is tolerated, as in the notebook's evaluation.

Grounding is not correctness. A real phrase under the wrong slot, or attached to the wrong event, passes. That is why the UI labels candidates as suggestions, lets you change the slot, edit or remove a phrase (edits must still be in your message), lists what stays unresolved, and requires an explicit confirm.

## Modes and safety

| `CLEARWEEK_EXTRACTION` | Behaviour |
| --- | --- |
| `off` (default, also any unknown value) | No UI, `POST /api/extract` returns 404. Current demo behaviour is unchanged. |
| `sample` | Shows a fixed, labelled illustration for one built-in sentence. No model, no network, no Gemini. Other text gets 422. Safe on the public Vercel demo if you choose to turn it on. |
| `local` | Calls the service in `local-extractor/` on loopback. Requires private mode (owner sign-in, same checks as other endpoints) or `CLEARWEEK_EXTRACTION_UNAUTHENTICATED_LOCAL=true` (loudly named; for your own laptop only). **Forced off when `VERCEL` is set.** |

The route reads the service address from server configuration only, refuses anything that is not an `http` loopback address, rejects any other request field (400), limits the body to 4 KB and the text to `CLEARWEEK_EXTRACTION_MAX_CHARS` (default 600, max 1000), times out at `CLEARWEEK_EXTRACTOR_TIMEOUT_MS` (default 20 s), allows one extraction at a time per process, refuses redirects and oversized replies, never writes to the database and never touches Gemini. The service itself binds loopback only (it exits otherwise), caps bodies at 8 KB, serves one request at a time, enforces its own timeout, and does not log request text.

## Local inference path (Apple Silicon, 24 GB)

Found on this Mac: `uv`, `llama-server` and `llama-cli` (llama.cpp, Homebrew), `ollama`, Python 3.14. Not installed: PyTorch, transformers, peft, mlx-lm. Nothing was installed.

**Recommended first: `hf-peft`** (`local-extractor/hf_peft_backend.py`). It loads the base model at the recorded revision and the adapter with `peft`, uses the notebook's tokenizer handling, template and decoding, and needs no conversion, so it is the most faithful to what was evaluated. A 1.7B model in bf16 is roughly 3.4 GB, comfortable in 24 GB (an estimate, not measured). Use Python 3.12 via `uv`; PyTorch support for the system Python 3.14 is unchecked. **This backend is written from the notebook and has never run against real weights.**

Alternatives, not chosen yet: **llama.cpp** (already installed; converting a PEFT adapter to GGUF is a documented path but I have not tried it for this adapter, and a quantized base would differ from training, so it needs the regression check below); **MLX** (`mlx-lm` not installed, PEFT-to-MLX adapter conversion unverified); **Ollama** (adapter import for this architecture unverified). Faster runtimes are worth trying only after the faithful path works, and only with regression checks.

### Run the service

```sh
cd local-extractor
python3 -m unittest            # contract tests with the stub backend (no model)
python3 server.py              # stub backend on 127.0.0.1:8765, returns an empty list
# Real artifact, once you have one (hf-peft):
uv venv --python 3.12 && source .venv/bin/activate && uv pip install -r requirements.txt
python3 server.py --backend hf-peft --adapter EXPORT/adapter --manifest EXPORT/manifest.json \
  --system-prompt EXPORT/system-prompt.txt --base-revision <model_revision from manifest.json>
# Then, in .env.local for ClearWeek: CLEARWEEK_EXTRACTION=local plus the opt-in or private mode.
```

Regression check against the predictions Colab saved (also after any conversion or quantization):

```sh
python3 regress.py --predictions EXPORT/adapter-test-predictions.jsonl --limit 100 \
  --adapter EXPORT/adapter --manifest EXPORT/manifest.json --system-prompt EXPORT/system-prompt.txt --base-revision <rev>
```

It reports how often local output is byte-identical to Colab's, plus validity, exact-match and grounding. It does not say whether the model is good enough.

## What was tested

| Check | Kind |
| --- | --- |
| `tests/extraction.test.ts` (36 tests): valid, empty, malformed, unknown slot, extra field, fabricated text, case mismatch, grounded-but-wrong slot, ambiguous dates, multiple events, prompt-injection text, unavailable service, timeout, bad replies, loopback-only address, mode gating, Vercel refusal, size limits, one-at-a-time, owner-only in private mode | **Mocked** providers and mocked `fetch` |
| `e2e/import.spec.ts`: off by default, sample extract → correct → confirm, nothing saved, other text refused | Browser against a `sample`-mode server. **No model.** |
| `local-extractor/test_server.py` (8 tests) | Real HTTP to the service with the **stub** backend |
| Cross-process smoke test (stub service ↔ `next start`) | Real HTTP between processes. The stub returns a fixed string. |

**Not tested:** any real model output, the `hf-peft` backend, adapter loading, MPS performance, memory use, accuracy on ClearWeek text.

## Handoff checklist: what I need when Colab finishes

1. **Location of the export:** the Hugging Face repo id and **exact revision (commit SHA)**, or the local ZIP path. Say whether the repo is private or gated and how access works.
2. **Which notebook ran:** original or fixed (they differ). If neither, the exact cell changes.
3. **Base revision:** `model_revision` from `manifest.json`, and whether the run used 4-bit (`4bit`) or BF16.
4. **Adapter files:** `adapter_config.json` and weights as exported; confirm it is a PEFT LoRA and not merged, MLX or GGUF.
5. **Tokenizer and prompt:** the tokenizer saved in `adapter/` and the exported `system-prompt.txt` (I will compare its SHA-256 with the value above).
6. **Evaluation results:** `comparison.json`, `*-metrics.json` and `training-log.json`, for base and adapter, dev and test, including `ungrounded_text_example_rate`, `json_schema_valid_rate`, positive-only exact match and median latency (and what GPU produced it).
7. **Example predictions:** `adapter-test-predictions.jsonl`, plus any failures you spotted. Ideally a handful of real ClearWeek-style messages (shifts, swaps, several events) to see where the SGD-trained model breaks.
8. **Run details:** `pip-freeze.txt`, the dataset revision and `DATA_ATTRIBUTION.md`.
9. **Your decision on conversion:** stay on `hf-peft`, or try llama.cpp/MLX afterwards.

Only after these: I verify the repo and revision, load base and adapter together with the matching prompt, run `regress.py`, read the evaluation before recommending adoption, and then say whether live integration is justified. The CC BY-SA 4.0 attribution applies if the adapted dataset files are ever redistributed.
