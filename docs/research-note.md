# Research note: small-model schedule-text extraction

*November 9, 2026. An experiment, not part of the ClearWeek app. The extraction code lives on the separate branch [`feature/schedule-extraction`](https://github.com/Lameda12/ClearWeek/tree/feature/schedule-extraction), is off by default, and is not deployed. No model weights, adapter files or datasets are in this repository.*

## Question

Can a small open model, fine-tuned on public calendar dialogue data, extract the exact schedule phrases from a pasted message so a person can review them? Extraction only: the model would not decide which event a phrase belongs to, resolve "Friday" to a date, calculate overlaps or authorize anything. Gemini draft generation is separate and unchanged.

## What was run

`Qwen/Qwen3-1.7B` (revision `70d244cc86ccca08cf5af4e1e306ecf908b1ad5e`) fine-tuned with LoRA (r=16) for 2 epochs in Google Colab (NVIDIA L4, bf16) on the Calendar part of Google's Schema-Guided Dialogue data (3,824 training examples after filtering). Output is a flat list of `{slot, text}` mentions over six slots: `event_date`, `event_time` (a start time), `event_location`, `event_name`, `available_start_time`, `available_end_time` (the end of a free window, not an event end).

## Strong results on a custom SGD split

The split is dialogue-disjoint and was built by the notebook; these are **not official SGD benchmark scores**. Test n=558 (188 with at least one mention); dev n=535 (198 with at least one mention). Most examples are empty, so the positive-only numbers are the ones that matter. Plain exact match is shown last because it flatters every model.

| Metric | Base dev | Adapter dev | Base test | Adapter test |
| --- | --- | --- | --- | --- |
| exact_set_match_positive | 0.162 | **0.965** | 0.133 | **0.973** |
| span_micro_f1 | 0.357 | **0.968** | 0.333 | **0.987** |
| span precision / recall | 0.671 / 0.244 | 0.966 / 0.970 | 0.598 / 0.231 | 0.996 / 0.978 |
| json_schema_valid_rate | 0.983 | 1.000 | 0.988 | 1.000 |
| ungrounded_text_example_rate | 0.0037 | 0.0019 | 0.0072 | 0.0000 |
| exact_set_match (all examples) | 0.688 | 0.983 | 0.703 | 0.991 |
| median seconds on the L4 | 0.26 | 0.43 | 0.28 | 0.43 |

With 188 positive test examples these figures are noisy. Remaining errors on the split were mostly span-boundary and annotation-granularity differences, location versus name confusion, and missed spelled-out times.

## Local inference reproduced

On an Apple Silicon Mac (24 GB, PyTorch MPS, bf16) the adapter was loaded onto the base model at the recorded revision and run on 60 test examples (30 with mentions, 30 empty): **all 60 outputs were byte-identical to the Colab outputs**. After warm-up, latency was a median of 0.57 s (p90 1.37 s). Memory was about 3.3 GiB on the GPU and **about 1.9 GiB peak process memory**. This shows the artifact loads and reproduces. It says nothing about the app.

## Insufficient reliability on ClearWeek-style messages

Ten hand-written ClearWeek-style messages (shift swaps, a declined swap, relative dates, availability, two events, an empty message, an embedded instruction) were run once each. This was a small informal probe, not an evaluation, and none of it was labelled in advance. It showed:

- **Wrong slots:** ranges such as "4 to 10" and "4 PM to 10 PM" filed as an event *start* time; "Saturday morning" as a location; "after 6" as an event time rather than availability; a return time ("6 PM") as a start time; a date and time merged into one phrase.
- **Omissions:** "at 9", "8:35" and "I can't do Friday" were dropped.
- **No event structure:** two events came out as one flat list. Nothing represents a declined swap, a cancellation or who is available when.
- **Copying error:** "The 23rd or the 24th" came back as "the 23rd or the 24th", which an exact-substring grounding check rejects.
- Plain shift text with a location and an empty "thanks" message worked, and an embedded instruction was ignored (one sample, not a robustness test).

The training data has no shifts, swaps, declines, several events per message or relative-date handling, so this is expected. The model is a reasonable phrase finder on plain, SGD-style text and is **not reliable enough for ClearWeek messages**. A validator that requires every returned phrase to occur in the source checks grounding only; it cannot detect a real phrase under the wrong slot.

## What is not tested

- The Next.js route and review UI **with the real model**. App tests use mocked output or a stub service.
- Other runtimes (llama.cpp, MLX, Ollama), behaviour under load, and any reviewed ClearWeek-specific test set. None exists.

## Attribution and licenses

- Dataset: [Google Schema-Guided Dialogue](https://github.com/google-research-datasets/dstc8-schema-guided-dialogue), revision `e852981ae34990f4358979625854259302feaa78`, **CC BY-SA 4.0**. Adapted files (the notebook's filtered, re-split JSONL) carry the same license and were not added here.
- Model: [Qwen/Qwen3-1.7B](https://huggingface.co/Qwen/Qwen3-1.7B), **Apache 2.0**.
- Method: LoRA via Hugging Face PEFT and Transformers.
