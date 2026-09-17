#!/usr/bin/env python3
"""
Fish Audio TTS CORS Proxy
浏览器无法直接调用 Fish Audio API（CORS 限制），用这个轻量代理转发。
只代理 /v1/tts 一个端点，其他 404。
"""
import http.server
import urllib.request
import urllib.error
import json
import sys
import os

FISH_API_BASE = "https://api.fish.audio"
PORT = int(os.environ.get("PORT", "8787"))

class FishProxyHandler(http.server.BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        """CORS preflight"""
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def do_POST(self):
        """Forward POST /v1/tts to Fish Audio"""
        if not self.path.startswith("/v1/tts"):
            self.send_error(404, "Only /v1/tts is proxied")
            return

        # Read request body
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length > 0 else b""

        # Forward headers (strip hop-by-hop)
        forward_headers = {}
        for key in ["Authorization", "Content-Type", "model"]:
            val = self.headers.get(key)
            if val:
                forward_headers[key] = val
        if "Content-Type" not in forward_headers:
            forward_headers["Content-Type"] = "application/json"

        # Build request
        url = FISH_API_BASE + self.path
        req = urllib.request.Request(url, data=body, headers=forward_headers, method="POST")

        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                resp_body = resp.read()
                self.send_response(resp.status)
                # Forward content-type
                ct = resp.headers.get("Content-Type", "audio/mpeg")
                self.send_header("Content-Type", ct)
                self.send_header("Content-Length", str(len(resp_body)))
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(resp_body)
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            self.send_response(e.code)
            self.send_header("Content-Type", "application/json")
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"status": e.code, "message": err_body[:500]}).encode())
        except Exception as e:
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"status": 502, "message": str(e)}).encode())

    def do_GET(self):
        """Health check"""
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True, "service": "fish-tts-proxy"}).encode())
        else:
            self.send_error(404, "GET not supported. Use POST /v1/tts")

    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS, GET")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type, model")

    def log_message(self, format, *args):
        # Simple logging
        sys.stderr.write("[fish-proxy] %s - %s\n" % (self.address_string(), format % args))

def main():
    server = http.server.HTTPServer(("0.0.0.0", PORT), FishProxyHandler)
    print(f"🐟 Fish Audio TTS proxy listening on http://localhost:{PORT}")
    print(f"   POST http://localhost:{PORT}/v1/tts  →  {FISH_API_BASE}/v1/tts")
    print(f"   GET  http://localhost:{PORT}/health  (health check)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Shutting down...")
        server.shutdown()

if __name__ == "__main__":
    main()
