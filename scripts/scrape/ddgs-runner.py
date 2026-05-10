#!/usr/bin/env python3
"""
ddgs CLI runner — bridges the Python `ddgs` library (formerly
`duckduckgo-search`) to our Node provider router.

Reads JSON input on stdin, prints JSON output on stdout. This avoids
shell-arg escaping and makes the contract explicit. Stderr is reserved
for human-readable error output.

Input shape:
  {"query": str, "region": "wt-wt"|"au-en"|..., "max_results": int,
   "timelimit": "d"|"w"|"m"|"y"|null,
   "backend": "auto"|"html"|"lite"|"bing"|null}

Output shape:
  {"results": [{"position": int, "title": str, "url": str, "snippet": str}]}

Exits 0 on success, 1 on any error (with json error on stdout).
"""

import json
import sys

try:
    from ddgs import DDGS
except ImportError:
    print(json.dumps({"error": "ddgs package not installed; install via venv"}))
    sys.exit(1)


def main():
    try:
        params = json.loads(sys.stdin.read())
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"invalid stdin json: {e}"}))
        sys.exit(1)

    query = params.get("query")
    if not query:
        print(json.dumps({"error": "query is required"}))
        sys.exit(1)

    region = params.get("region") or "wt-wt"
    max_results = int(params.get("max_results") or 10)
    timelimit = params.get("timelimit") or None
    backend = params.get("backend") or "auto"

    try:
        with DDGS() as ddg:
            raw = list(ddg.text(
                query=query,
                region=region,
                max_results=max_results,
                timelimit=timelimit,
                backend=backend,
            ))
    except Exception as e:  # noqa: BLE001
        print(json.dumps({"error": f"ddgs.text failed: {type(e).__name__}: {e}"}))
        sys.exit(1)

    results = []
    for i, r in enumerate(raw, start=1):
        results.append({
            "position": i,
            "title": r.get("title", ""),
            "url": r.get("href", ""),
            "snippet": r.get("body", ""),
        })

    print(json.dumps({"results": results, "query": query, "region": region}))


if __name__ == "__main__":
    main()
