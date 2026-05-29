#!/usr/bin/env python3
"""Insert shell.nav.* + shell.role.* translation keys into the inline
DASH_T dictionaries in both developer.html and advertiser.html across
all 6 supported languages.

Idempotent: re-runs are no-ops once all keys are present.
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

LANGS = {
    'en': {
        'shell.nav.home':         'Home',
        'shell.nav.performance':  'Performance',
        'shell.nav.integrations': 'Integrations',
        'shell.nav.placements':   'Placements',
        'shell.nav.payouts':      'Payouts',
        'shell.nav.campaigns':    'Campaigns',
        'shell.nav.billing':      'Billing',
        'shell.nav.setup':        'Setup',
        'shell.nav.settings':     'Settings',
        'shell.role.publisher':   'Publisher',
        'shell.role.advertiser':  'Advertiser',
    },
    'zh': {
        'shell.nav.home':         '首页',
        'shell.nav.performance':  '效果',
        'shell.nav.integrations': '集成',
        'shell.nav.placements':   '版位',
        'shell.nav.payouts':      '打款',
        'shell.nav.campaigns':    '广告',
        'shell.nav.billing':      '账单',
        'shell.nav.setup':        '设置向导',
        'shell.nav.settings':     '设置',
        'shell.role.publisher':   '发布商',
        'shell.role.advertiser':  '广告主',
    },
    'zh-TW': {
        'shell.nav.home':         '首頁',
        'shell.nav.performance':  '效果',
        'shell.nav.integrations': '整合',
        'shell.nav.placements':   '版位',
        'shell.nav.payouts':      '撥款',
        'shell.nav.campaigns':    '廣告',
        'shell.nav.billing':      '帳單',
        'shell.nav.setup':        '設定精靈',
        'shell.nav.settings':     '設定',
        'shell.role.publisher':   '發布商',
        'shell.role.advertiser':  '廣告主',
    },
    'ja': {
        'shell.nav.home':         'ホーム',
        'shell.nav.performance':  'パフォーマンス',
        'shell.nav.integrations': '統合',
        'shell.nav.placements':   '配置',
        'shell.nav.payouts':      '支払い',
        'shell.nav.campaigns':    'キャンペーン',
        'shell.nav.billing':      '請求',
        'shell.nav.setup':        'セットアップ',
        'shell.nav.settings':     '設定',
        'shell.role.publisher':   'パブリッシャー',
        'shell.role.advertiser':  '広告主',
    },
    'ko': {
        'shell.nav.home':         '홈',
        'shell.nav.performance':  '성과',
        'shell.nav.integrations': '통합',
        'shell.nav.placements':   '위치',
        'shell.nav.payouts':      '정산',
        'shell.nav.campaigns':    '캠페인',
        'shell.nav.billing':      '결제',
        'shell.nav.setup':        '설정',
        'shell.nav.settings':     '환경설정',
        'shell.role.publisher':   '퍼블리셔',
        'shell.role.advertiser':  '광고주',
    },
    'vi': {
        'shell.nav.home':         'Trang chủ',
        'shell.nav.performance':  'Hiệu suất',
        'shell.nav.integrations': 'Tích hợp',
        'shell.nav.placements':   'Vị trí',
        'shell.nav.payouts':      'Thanh toán',
        'shell.nav.campaigns':    'Chiến dịch',
        'shell.nav.billing':      'Hóa đơn',
        'shell.nav.setup':        'Thiết lập',
        'shell.nav.settings':     'Cài đặt',
        'shell.role.publisher':   'Publisher',
        'shell.role.advertiser':  'Advertiser',
    },
}


def insert_keys(text: str, lang_code: str, keys: dict) -> tuple[str, int]:
    """Scan the language block (`'<lang>': { ... },`) and insert any missing
    keys before its closing `},`. Skips dups so re-runs are no-ops."""
    pat = re.compile(
        rf"('{re.escape(lang_code)}': \{{)([\s\S]*?)(\n\s+\}},)",
        re.MULTILINE,
    )
    m = pat.search(text)
    if not m:
        print(f"  !! Could not locate '{lang_code}' block.")
        return text, 0
    head, body, tail = m.group(1), m.group(2), m.group(3)
    inserted = 0
    additions = []
    for k, v in keys.items():
        if f"'{k}':" in body:
            continue
        v_js = v.replace('\\', '\\\\').replace("'", "\\'")
        additions.append(f"                    '{k}': '{v_js}',")
        inserted += 1
    if not additions:
        return text, 0
    new_body = body.rstrip('\n') + '\n' + '\n'.join(additions)
    return text[:m.start()] + head + new_body + tail + text[m.end():], inserted


def patch_file(path: Path):
    text = path.read_text(encoding='utf-8')
    total = 0
    for lang_code, keys in LANGS.items():
        text, n = insert_keys(text, lang_code, keys)
        if n:
            print(f'  {path.name} [{lang_code}]: +{n} keys')
        total += n
    if total:
        path.write_text(text, encoding='utf-8')
    print(f'  → {path.name}: +{total} total')


def main():
    print('developer.html (publisher dashboard):')
    patch_file(ROOT / 'public' / 'developer.html')
    print('advertiser.html (advertiser dashboard):')
    patch_file(ROOT / 'public' / 'advertiser.html')


if __name__ == '__main__':
    main()
