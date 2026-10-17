#!/usr/bin/env python3
"""Serve the static poster gallery on localhost only."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=3037)
    args = parser.parse_args()
    docs = Path(__file__).resolve().parents[2] / "docs"
    server = ThreadingHTTPServer(("127.0.0.1", args.port), partial(SimpleHTTPRequestHandler, directory=str(docs)))
    print(f"Gallery: http://127.0.0.1:{args.port}/web-showcase.html", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
