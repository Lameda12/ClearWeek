"""Contract tests for the service HTTP layer using the stub backend. These do not load or test any model."""
import json
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

from server import GenerationTimeout, StubBackend, make_handler, require_loopback
import regress


def serve(backend, max_chars=50, max_seconds=1.0):
    server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(backend, max_chars, max_seconds))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://127.0.0.1:{server.server_address[1]}"


def call(url, path, body=None, raw=None, headers=None):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    request = urllib.request.Request(url + path, data=data, headers=headers or {}, method="POST" if data is not None else "GET")
    try:
        with urllib.request.urlopen(request, timeout=5) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


class ServiceTests(unittest.TestCase):
    def setUp(self):
        self.server, self.url = serve(StubBackend('{"mentions":[]}'))
        self.addCleanup(self.server.shutdown)

    def test_health_and_extract(self):
        self.assertEqual(call(self.url, "/health")[1]["status"], "ok")
        status, body = call(self.url, "/extract", {"text": "Friday at 2 PM"})
        self.assertEqual((status, body["raw"]), (200, '{"mentions":[]}'))

    def test_rejects_bad_input(self):
        for body, expected in [({"text": ""}, 422), ({"text": "x" * 51}, 422), ({"text": "a\x00b"}, 422),
                               ({"text": "ok", "url": "http://example.com"}, 400), ({"text": 5}, 400), ([], 400)]:
            self.assertEqual(call(self.url, "/extract", body)[0], expected, body)
        self.assertEqual(call(self.url, "/extract", raw=b"not json")[0], 400)
        self.assertEqual(call(self.url, "/extract", raw=b"x" * 9000)[0], 413)
        self.assertEqual(call(self.url, "/other", {"text": "ok"})[0], 404)

    def test_requires_content_length(self):
        import socket
        host, port = self.url.removeprefix("http://").split(":")
        with socket.create_connection((host, int(port)), timeout=5) as s:
            s.sendall(b"POST /extract HTTP/1.1\r\nHost: x\r\n\r\n")
            self.assertIn(b" 411 ", s.recv(200))

    def test_timeout_maps_to_504(self):
        server, url = serve(StubBackend(delay=5.0), max_seconds=0.5)
        self.addCleanup(server.shutdown)
        self.assertEqual(call(url, "/extract", {"text": "ok"})[0], 504)

    def test_one_request_at_a_time(self):
        class Slow(StubBackend):
            gate = threading.Event()
            def generate(self, text, max_seconds):
                self.gate.wait(2)
                return self.output
        backend = Slow()
        server, url = serve(backend)
        self.addCleanup(server.shutdown)
        results = []
        first = threading.Thread(target=lambda: results.append(call(url, "/extract", {"text": "ok"})[0]))
        first.start()
        import time; time.sleep(0.2)
        self.assertEqual(call(url, "/extract", {"text": "ok"})[0], 429)
        backend.gate.set(); first.join()
        self.assertEqual(results, [200])

    def test_backend_failure_is_generic(self):
        class Broken(StubBackend):
            def generate(self, text, max_seconds):
                raise RuntimeError("secret internal detail")
        server, url = serve(Broken())
        self.addCleanup(server.shutdown)
        status, body = call(url, "/extract", {"text": "ok"})
        self.assertEqual((status, body), (500, {"error": "generation failed"}))

    def test_refuses_non_loopback_binding(self):
        for host in ["0.0.0.0", "192.168.1.5", "example.com", "::"]:
            with self.assertRaises(SystemExit):
                require_loopback(host)
        for host in ["127.0.0.1", "localhost", "::1"]:
            require_loopback(host)


class RegressionHelperTests(unittest.TestCase):
    def test_compare_reports_agreement_and_grounding(self):
        rows = [
            {"text": "Friday at 2 PM", "target": {"mentions": [{"slot": "event_date", "text": "Friday"}]},
             "raw_prediction": '{"mentions":[{"slot":"event_date","text":"Friday"}]}'},
            {"text": "nothing here", "target": {"mentions": []}, "raw_prediction": '{"mentions":[]}'},
        ]
        outputs = {"Friday at 2 PM": '{"mentions":[{"slot":"event_date","text":"Monday"}]}', "nothing here": '{"mentions":[]}'}
        metrics, diffs = regress.compare(rows, outputs.__getitem__)
        self.assertEqual(metrics["identical_to_colab"], 0.5)
        self.assertEqual(metrics["ungrounded"], 0.5)
        self.assertEqual(metrics["exact_set_match"], 0.5)
        self.assertEqual(len(diffs), 1)


if __name__ == "__main__":
    unittest.main()
