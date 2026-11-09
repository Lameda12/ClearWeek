#!/usr/bin/env python3
"""ClearWeek local extraction service.

A separate process that holds the model. The Next.js app never loads weights; it calls this over loopback.
It binds to a loopback address only, limits input size and time, serves one request at a time, and never logs text.
It returns the model's RAW output. The app validates that output (schema + grounding) itself.

Backends:
  stub     Returns a fixed string. For wiring and tests. Not a model.
  hf-peft  Qwen3-1.7B base + PEFT LoRA adapter via transformers on Apple MPS (see hf_peft_backend.py).
           NOT yet run against real weights: no trained artifact exists yet.
"""
import argparse
import ipaddress
import json
import re
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MAX_BODY_BYTES = 8192
CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


class InputTooLong(Exception):
    """The prompt does not fit the context the adapter was trained with."""


class GenerationTimeout(Exception):
    pass


class StubBackend:
    label = "stub (not a model)"

    def __init__(self, output='{"mentions":[]}', delay=0.0):
        self.output, self.delay = output, delay

    def generate(self, text, max_seconds):
        if self.delay:
            if self.delay >= max_seconds:
                raise GenerationTimeout()
            import time
            time.sleep(self.delay)
        return self.output


def require_loopback(host):
    try:
        ok = host == "localhost" or ipaddress.ip_address(host).is_loopback
    except ValueError:
        ok = False
    if not ok:
        raise SystemExit(f"Refusing to bind {host!r}: this service only listens on loopback (127.0.0.1, ::1, localhost).")


def make_handler(backend, max_chars, max_seconds):
    busy = threading.Lock()

    class Handler(BaseHTTPRequestHandler):
        timeout = 10  # drop slow or stalled clients
        server_version = "ClearWeekExtractor"
        protocol_version = "HTTP/1.1"

        def log_message(self, fmt, *args):  # never log request bodies
            pass

        def _send(self, status, payload):
            body = json.dumps(payload).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("Connection", "close")
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if self.path == "/health":
                return self._send(200, {"status": "ok", "backend": backend.label, "max_chars": max_chars})
            self._send(404, {"error": "not found"})

        def do_POST(self):
            if self.path != "/extract":
                return self._send(404, {"error": "not found"})
            length = self.headers.get("Content-Length")
            if length is None or not length.isdigit():
                return self._send(411, {"error": "Content-Length required"})
            if int(length) > MAX_BODY_BYTES:
                return self._send(413, {"error": "body too large"})
            try:
                body = json.loads(self.rfile.read(int(length)))
            except ValueError:
                return self._send(400, {"error": "invalid JSON"})
            if not isinstance(body, dict) or set(body) != {"text"} or not isinstance(body["text"], str):
                return self._send(400, {"error": "send only a text string"})
            text = body["text"].strip()
            if not text or len(text) > max_chars or CONTROL_CHARS.search(text):
                return self._send(422, {"error": "text is empty, too long, or has control characters"})
            if not busy.acquire(blocking=False):
                return self._send(429, {"error": "busy"})
            try:
                raw = backend.generate(text, max_seconds)
            except InputTooLong:
                return self._send(422, {"error": "text does not fit the model context"})
            except GenerationTimeout:
                return self._send(504, {"error": "generation timed out"})
            except Exception:
                return self._send(500, {"error": "generation failed"})
            finally:
                busy.release()
            self._send(200, {"raw": raw, "model": backend.label})

    return Handler


def build_backend(args):
    if args.backend == "stub":
        return StubBackend(args.stub_output, args.stub_delay)
    from hf_peft_backend import HfPeftBackend  # imported lazily: needs torch, transformers, peft
    return HfPeftBackend(adapter_dir=args.adapter, manifest_path=args.manifest, system_prompt_path=args.system_prompt,
                         base_revision=args.base_revision)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--backend", choices=["stub", "hf-peft"], default="stub")
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=8765)
    p.add_argument("--max-chars", type=int, default=600)
    p.add_argument("--max-seconds", type=float, default=15.0)
    p.add_argument("--stub-output", default='{"mentions":[]}')
    p.add_argument("--stub-delay", type=float, default=0.0)
    p.add_argument("--adapter", help="PEFT adapter directory (from the Colab export)")
    p.add_argument("--manifest", help="manifest.json from the same export")
    p.add_argument("--system-prompt", help="system-prompt.txt from the same export (never reconstructed here)")
    p.add_argument("--base-revision", help="Qwen/Qwen3-1.7B revision recorded in manifest.json")
    args = p.parse_args()
    require_loopback(args.host)
    if args.backend == "hf-peft" and not all([args.adapter, args.manifest, args.system_prompt, args.base_revision]):
        p.error("hf-peft needs --adapter, --manifest, --system-prompt and --base-revision")
    backend = build_backend(args)
    server = ThreadingHTTPServer((args.host, args.port), make_handler(backend, args.max_chars, args.max_seconds))
    print(f"ClearWeek extractor ({backend.label}) on http://{args.host}:{args.port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
