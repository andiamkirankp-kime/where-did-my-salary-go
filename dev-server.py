#!/usr/bin/env python3
"""Run Salary Control locally: python3 dev-server.py, then open http://localhost:8000

The hosted app uses a small sign-in backend. This dev server serves the app files
and stubs the sign-in endpoints with a single local user, so you can try the app
without an account. All money data stays encrypted in your browser either way.
"""
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

LOCAL_USER = {"id": "local-dev", "name": "You", "email": "", "provider": "local"}


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                      ".mjs": "text/javascript", ".webmanifest": "application/manifest+json"}

    def send_json(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def route(self):
        path = self.path.split("?")[0]
        if path == "/api/auth/config":
            return self.send_json(200, {"googleEnabled": False, "preview": True})
        if path == "/api/account":
            return self.send_json(200, {"user": LOCAL_USER, "legacyAvailable": False})
        if path == "/api/legacy-money":
            return self.send_json(404, {"error": "Not available in local mode."})
        if path.startswith("/api/auth/logout"):
            self.send_response(302); self.send_header("Location", "/"); self.end_headers(); return True
        if path.startswith("/api/"):
            return self.send_json(404, {"error": "Not available in local mode."})
        return False

    def do_GET(self):
        if self.route() is False:
            super().do_GET()

    def do_PUT(self):
        if self.path.startswith("/api/account"):
            return self.send_json(200, LOCAL_USER)
        self.send_json(404, {"error": "Not found"})

    def do_DELETE(self):
        self.send_json(200, {"ok": True})


if __name__ == "__main__":
    print("Salary Control running at http://localhost:8000")
    ThreadingHTTPServer(("", 8000), Handler).serve_forever()
