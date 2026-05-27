#!/usr/bin/env python3
"""Bulk-tag publisher dashboard body elements with data-t attributes.

Idempotent: each pattern requires the absence of an existing data-t, so
re-running is safe. Run after a checkout to ensure all tags are present.

Usage:  python3 scripts/i18n_dashboard_body_tag.py
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEV = ROOT / 'public' / 'developer.html'

H4_STYLE = ('font-size: 13px; font-weight: 700; margin: 0 0 6px; '
            'color: #6B7280; letter-spacing: 0.04em; text-transform: uppercase;')


def add_h4_tag(text: str, key: str, label: str) -> tuple[str, int]:
    """Tag an <h4> with the integration step style, matching the label exactly."""
    pat = re.compile(
        r'(<h4 style="' + re.escape(H4_STYLE) + r'")(?! data-t)(>)' + re.escape(label) + r'</h4>'
    )
    return pat.subn(lambda m: f'{m.group(1)} data-t="{key}"{m.group(2)}{label}</h4>', text)


def add_copy_btn_tag(text: str) -> tuple[str, int]:
    """Tag all <button class="code-copy-btn">Copy</button> with common.copy."""
    pat = re.compile(
        r'(<button class="code-copy-btn" onclick="copyCode\(this, [^)]+\)")(?! data-t)>Copy</button>'
    )
    return pat.subn(r'\1 data-t="common.copy">Copy</button>', text)


def wrap_div_text(text: str, key: str, exact_text: str, surrounding_class_or_style_hint: str) -> tuple[str, int]:
    """Wrap the inner text of a <div> with a <span data-t='key'>. Anchor on a
    unique style fragment to keep the replacement localized."""
    # Match: <div style="…hint…">EXACT_TEXT</div>
    pat = re.compile(
        r'(<div style="[^"]*' + re.escape(surrounding_class_or_style_hint) + r'[^"]*">)\s*'
        + re.escape(exact_text) + r'\s*(</div>)'
    )
    return pat.subn(lambda m: f'{m.group(1)}<span data-t="{key}">{exact_text}</span>{m.group(2)}', text)


def main():
    text = DEV.read_text(encoding='utf-8')
    total = 0

    # ─── Install/step <h4> headers ───
    for key, label in [
        ('integ.step_js_head',       '1. Drop into your &lt;head&gt;'),
        ('integ.step_js_slots',      '2. Add slot divs where you want ads'),
        ('integ.step_install',       '1. Install'),
        ('integ.step_ext_render',    '2. Render in your content script / sidepanel'),
        ('integ.step_ext_react_vue', '2b. React or Vue?'),
        ('integ.step_rest_env',      '1. Add bearer token to env'),
        ('integ.step_rest_call',     '2. Direct REST call (Discord example)'),
        ('integ.step_rest_helper',   '2b. Optional: per-platform helper library'),
    ]:
        text, n = add_h4_tag(text, key, label)
        total += n

    # ─── All Copy buttons in code blocks ───
    text, n = add_copy_btn_tag(text)
    total += n

    # ─── Simple <div>-wrapped one-liner captions ───
    # These have a unique style="font-size: 12px; color: #6B7280; margin-top: 6px;"
    one_liners = [
        ('integ.cap_js_async',
         'Async, zero impact on first paint. The publisher ID above is your live key — already filled in.'),
        ('integ.cap_rest_env',
         'Server-side only — never ship the bearer to the browser. Use Vercel / Netlify / Render env-var settings.'),
    ]
    for key, exact in one_liners:
        pat = re.compile(
            r'(<div style="font-size: 12px; color: #6B7280; margin-top: 6px;"(?! data-t)>)\s*'
            + re.escape(exact) + r'\s*(</div>)'
        )
        new, n = pat.subn(lambda m, k=key, e=exact: f'<div style="font-size: 12px; color: #6B7280; margin-top: 6px;" data-t="{k}">{e}</div>', text)
        text, total = new, total + n

    DEV.write_text(text, encoding='utf-8')
    print(f'developer.html: {total} tags inserted')


if __name__ == '__main__':
    main()
