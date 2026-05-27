#!/usr/bin/env python3
"""Inject the i18n preload snippet right after <head> in every translated page.

The snippet:
  1. Runs the saved-language redirect synchronously (no English flash before
     redirect to /zh-TW/...).
  2. Adds .bb-i18n-loading to <html> if the URL has a non-default locale,
     which hides the body via visibility:hidden until i18n.js apply() removes
     the class. Eliminates the English-then-Chinese flash.
  3. Has a 2s safety timeout — page will reveal even if i18n.js never runs
     (broken script, JSON 404, etc.) so we never leave users with a blank page.

Idempotent: re-running detects the BB_I18N_PRELOAD marker and skips.
"""
import os

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..'))
PUBLIC = os.path.join(ROOT, 'public')

PAGES = [
    'index.html',
    'publish.html',
    'publish-mcp.html',
    'publish-ai-apps.html',
    'publish-extensions.html',
    'publish-bots.html',
    'publish-no-code.html',
    'ads.html',
]

# Keep this in sync with i18n.js — SUPPORTED, DEFAULT, LOCALIZED_PATHS.
PRELOAD = '''<!-- BB_I18N_PRELOAD: zero-flash language preference. Mirrors i18n.js. Do not edit by hand — run scripts/i18n_inject_preload.py. -->
<style>html.bb-i18n-loading{visibility:hidden}</style>
<script>(function(){var S=['en','zh','zh-TW','ja','ko','vi'],D='en',L={'/publish':1,'/publish/mcp':1,'/publish/ai-apps':1,'/publish/extensions':1,'/publish/bots':1,'/publish/no-code':1,'/ads':1};var p=location.pathname,seg=p.split('/')[1]||'',has=S.indexOf(seg)!==-1;if(!has){try{var sv=localStorage.getItem('bb_lang');if(sv&&S.indexOf(sv)!==-1&&sv!==D){var pp=p.split('?')[0].split('#')[0];if(pp.length>1&&pp.charAt(pp.length-1)==='/')pp=pp.slice(0,-1);if(L[pp]){location.replace('/'+sv+pp+(location.search||'')+(location.hash||''));return}}}catch(e){}}if(has&&seg!==D){var r=document.documentElement;r.classList.add('bb-i18n-loading');setTimeout(function(){r.classList.remove('bb-i18n-loading')},2000);}})();</script>
<!-- /BB_I18N_PRELOAD -->
'''

MARKER = 'BB_I18N_PRELOAD'


def inject(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        html = f.read()
    if MARKER in html:
        return 'skipped (already present)'
    # Inject right after the <head> opening tag. Match either <head> or <head ...>
    import re
    # Find first <head> opening (case-insensitive)
    m = re.search(r'<head[^>]*>', html, re.IGNORECASE)
    if not m:
        return 'no <head> tag found'
    insert_at = m.end()
    new_html = html[:insert_at] + '\n' + PRELOAD + html[insert_at:]
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_html)
    return 'injected'


def main():
    for page in PAGES:
        fp = os.path.join(PUBLIC, page)
        if not os.path.exists(fp):
            print(f'  ? {page}: not found')
            continue
        print(f'  {inject(fp):>10s}  {page}')


if __name__ == '__main__':
    main()
