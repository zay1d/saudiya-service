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

def logo_data_uri():
    data = (ROOT / "assets" / "saudia-service-logo.png").read_bytes()
    return "data:image/png;base64," + base64.b64encode(data).decode("ascii")


def main():
    html = read("index.html")
    css  = read("styles.css")
    data_js = read("data.js")
    app_js  = read("app.js")
    logo = logo_data_uri()

    # Inline the logo into the JS (it references "assets/saudia-service-logo.png")
    data_js = data_js.replace(
        '"assets/saudia-service-logo.png"',
        f'"{logo}"',
    )
    app_js = app_js.replace(
        '"assets/saudia-service-logo.png"',
        f'"{logo}"',
    )

    # Inline the logo into the static fallback inside index.html as well
    html = html.replace(
        'src="assets/saudia-service-logo.png"',
        f'src="{logo}"',
    )

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
