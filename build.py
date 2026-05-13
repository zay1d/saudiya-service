#!/usr/bin/env python3
"""
Bundles index.html + styles.css + data.js + app.js + logo
into a single self-contained file `saudia-service.html`
that can be shared as one attachment.
"""

import base64
import re
from pathlib import Path

ROOT = Path(__file__).parent

def read(name):
    return (ROOT / name).read_text(encoding="utf-8")

def data_uri(path: Path, mime: str) -> str:
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode("ascii")


# (path_in_source, mime, repo_path)
INLINE_ASSETS = [
    ("assets/saudia-service-logo.png",   "image/png",  "assets/saudia-service-logo.png"),
    ("assets/backgrounds/kaaba-day.jpg",  "image/jpeg", "assets/backgrounds/kaaba-day.jpg"),
    ("assets/backgrounds/haram-night.jpg","image/jpeg", "assets/backgrounds/haram-night.jpg"),
    ("assets/backgrounds/nabawi.jpg",     "image/jpeg", "assets/backgrounds/nabawi.jpg"),
]


def main():
    html = read("index.html")
    css  = read("styles.css")
    data_js = read("data.js")
    app_js  = read("app.js")

    # Inline every referenced asset as a data: URI so the single-file bundle
    # has no external dependencies.
    for ref, mime, rel in INLINE_ASSETS:
        uri = data_uri(ROOT / rel, mime)
        for src in (data_js, app_js):
            pass
        data_js = data_js.replace(f'"{ref}"', f'"{uri}"')
        app_js  = app_js.replace(f'"{ref}"',  f'"{uri}"')
        html    = html.replace(f'src="{ref}"', f'src="{uri}"')

    # Replace <link rel="stylesheet" href="styles.css" /> with inline <style>
    html = re.sub(
        r'<link rel="stylesheet" href="styles\.css"\s*/?>',
        f"<style>\n{css}\n</style>",
        html,
    )

    # Replace <script src="data.js"></script> and <script src="app.js"></script>
    # with inline scripts (in the same order)
    html = html.replace(
        '<script src="data.js"></script>',
        f"<script>\n{data_js}\n</script>",
    )
    html = html.replace(
        '<script src="app.js"></script>',
        f"<script>\n{app_js}\n</script>",
    )

    out = ROOT / "saudia-service.html"
    out.write_text(html, encoding="utf-8")
    size_kb = out.stat().st_size / 1024
    print(f"Built {out.name} — {size_kb:.1f} KB")


if __name__ == "__main__":
    main()
