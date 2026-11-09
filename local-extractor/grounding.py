"""Conservative grounding of a model-returned phrase in its source text (mirror of groundPhrase in lib/extraction/schema.ts).

1. Exact substring: accepted.
2. Otherwise a case-insensitive match is accepted only if it finds exactly ONE span (overlapping spans count), and the
   source's own spelling is returned. re.IGNORECASE on the escaped phrase; no casefold (it can change string length).
Nothing else: no fuzzy matching, no punctuation stripping, no word substitution, no Unicode normalization.
This repairs copying errors only. It cannot fix a wrong slot or a phrase attached to the wrong event.
"""
import re


def ground(source: str, phrase: str) -> dict:
    if phrase and phrase in source:
        return {"status": "exact", "text": phrase}
    if not phrase:
        return {"status": "absent"}
    # A lookahead with a capture group lets finditer report overlapping matches.
    spans = [(m.start(1), m.end(1)) for m in re.finditer("(?=(" + re.escape(phrase) + "))", source, re.IGNORECASE)]
    if not spans:
        return {"status": "absent"}
    if len(spans) > 1:
        return {"status": "ambiguous"}
    start, end = spans[0]
    return {"status": "recovered", "text": source[start:end], "from": phrase}


def ground_all(source: str, pairs):
    """Raw vs recovered grounding for a list of (slot, text). Returns (raw_ok, recovered_ok, details)."""
    statuses = [ground(source, text) for _, text in pairs]
    raw_ok = all(s["status"] == "exact" for s in statuses)
    recovered_ok = all(s["status"] in ("exact", "recovered") for s in statuses)
    return raw_ok, recovered_ok, statuses
