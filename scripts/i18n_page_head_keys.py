#!/usr/bin/env python3
"""Insert page.* (Phase 3 route page-head) translation keys into the
inline DASH_T dictionaries in both developer.html and advertiser.html
across all 6 supported languages.

Idempotent: re-runs are no-ops once all keys are present.
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Advertiser dashboard page-head keys (6 keys × 6 languages = 36 entries).
ADV_LANGS = {
    'en': {
        'page.home.title':      'Overview',
        'page.home.sub':        'Account performance and balance',
        'page.campaigns.sub':   'Manage your active campaigns, creatives, and pacing',
        'page.billing.title':   'Billing',
        'page.billing.sub':     'Account funding and transaction history',
    },
    'zh': {
        'page.home.title':      '概览',
        'page.home.sub':        '账户表现与余额',
        'page.campaigns.sub':   '管理您的活跃广告、创意和节奏',
        'page.billing.title':   '账单',
        'page.billing.sub':     '账户充值与交易记录',
    },
    'zh-TW': {
        'page.home.title':      '概覽',
        'page.home.sub':        '帳戶表現與餘額',
        'page.campaigns.sub':   '管理您的活躍廣告、創意與節奏',
        'page.billing.title':   '帳單',
        'page.billing.sub':     '帳戶儲值與交易紀錄',
    },
    'ja': {
        'page.home.title':      '概要',
        'page.home.sub':        'アカウントのパフォーマンスと残高',
        'page.campaigns.sub':   '配信中のキャンペーン、クリエイティブ、配信ペースを管理',
        'page.billing.title':   '請求',
        'page.billing.sub':     'アカウント入金と取引履歴',
    },
    'ko': {
        'page.home.title':      '개요',
        'page.home.sub':        '계정 실적 및 잔액',
        'page.campaigns.sub':   '진행 중인 캠페인, 크리에이티브, 페이싱 관리',
        'page.billing.title':   '결제',
        'page.billing.sub':     '계정 충전 및 거래 내역',
    },
    'vi': {
        'page.home.title':      'Tổng quan',
        'page.home.sub':        'Hiệu suất và số dư tài khoản',
        'page.campaigns.sub':   'Quản lý chiến dịch đang chạy, creative và tốc độ phân phối',
        'page.billing.title':   'Thanh toán',
        'page.billing.sub':     'Nạp tiền tài khoản và lịch sử giao dịch',
    },
}

# Publisher dashboard page-head keys (10 keys × 6 languages = 60 entries).
PUB_LANGS = {
    'en': {
        'page.home.title':        'Overview',
        'page.home.sub':          'Earnings, impressions, and revenue trends',
        'page.perf.title':        'Performance',
        'page.perf.sub':          'Mediation, waterfall, and Benna auto-order',
        'page.integ.title':       'Integrations',
        'page.integ.sub':         'Four doors, one publisher account — pick your install',
        'page.placements.title':  'Placements',
        'page.placements.sub':    'Ad slots, API keys, and per-slot economics',
        'page.payouts.title':     'Payouts',
        'page.payouts.sub':       'Earnings history and payout settings',
    },
    'zh': {
        'page.home.title':        '概览',
        'page.home.sub':          '收益、展示次数与营收趋势',
        'page.perf.title':        '效果',
        'page.perf.sub':          '中介、瀑布流与 Benna 自动排序',
        'page.integ.title':       '集成',
        'page.integ.sub':         '四个入口，一个发布商账户 — 选择您的安装方式',
        'page.placements.title':  '版位',
        'page.placements.sub':    '广告位、API 密钥与每个广告位的经济数据',
        'page.payouts.title':     '打款',
        'page.payouts.sub':       '收益记录与打款设置',
    },
    'zh-TW': {
        'page.home.title':        '概覽',
        'page.home.sub':          '收益、展示次數與營收趨勢',
        'page.perf.title':        '效果',
        'page.perf.sub':          '中介、瀑布流與 Benna 自動排序',
        'page.integ.title':       '整合',
        'page.integ.sub':         '四個入口，一個發布商帳戶 — 選擇您的安裝方式',
        'page.placements.title':  '版位',
        'page.placements.sub':    '廣告版位、API 金鑰與每個版位的經濟數據',
        'page.payouts.title':     '撥款',
        'page.payouts.sub':       '收益紀錄與撥款設定',
    },
    'ja': {
        'page.home.title':        '概要',
        'page.home.sub':          '収益、インプレッション、収益トレンド',
        'page.perf.title':        'パフォーマンス',
        'page.perf.sub':          'メディエーション、ウォーターフォール、Benna 自動オーダー',
        'page.integ.title':       '統合',
        'page.integ.sub':         '4 つのドア、1 つのパブリッシャーアカウント — お好きな方法でインストール',
        'page.placements.title':  '配置',
        'page.placements.sub':    '広告スロット、API キー、スロットごとの経済情報',
        'page.payouts.title':     '支払い',
        'page.payouts.sub':       '収益履歴と支払い設定',
    },
    'ko': {
        'page.home.title':        '개요',
        'page.home.sub':          '수익, 노출, 매출 추이',
        'page.perf.title':        '성과',
        'page.perf.sub':          '미디에이션, 워터폴, Benna 자동 정렬',
        'page.integ.title':       '통합',
        'page.integ.sub':         '네 개의 입구, 하나의 퍼블리셔 계정 — 설치 방법을 선택하세요',
        'page.placements.title':  '위치',
        'page.placements.sub':    '광고 슬롯, API 키, 슬롯별 경제 지표',
        'page.payouts.title':     '정산',
        'page.payouts.sub':       '수익 내역 및 정산 설정',
    },
    'vi': {
        'page.home.title':        'Tổng quan',
        'page.home.sub':          'Doanh thu, số lần hiển thị và xu hướng doanh thu',
        'page.perf.title':        'Hiệu suất',
        'page.perf.sub':          'Mediation, waterfall và Benna tự động sắp xếp',
        'page.integ.title':       'Tích hợp',
        'page.integ.sub':         'Bốn cửa, một tài khoản publisher — chọn cách cài đặt',
        'page.placements.title':  'Vị trí',
        'page.placements.sub':    'Vị trí quảng cáo, API key và kinh tế từng vị trí',
        'page.payouts.title':     'Thanh toán',
        'page.payouts.sub':       'Lịch sử doanh thu và cài đặt thanh toán',
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


def patch_file(path: Path, langs: dict):
    text = path.read_text(encoding='utf-8')
    total = 0
    for lang_code, keys in langs.items():
        text, n = insert_keys(text, lang_code, keys)
        if n:
            print(f'  {path.name} [{lang_code}]: +{n} keys')
        total += n
    if total:
        path.write_text(text, encoding='utf-8')
    print(f'  → {path.name}: +{total} total')


def main():
    print('developer.html (publisher dashboard):')
    patch_file(ROOT / 'public' / 'developer.html', PUB_LANGS)
    print('advertiser.html (advertiser dashboard):')
    patch_file(ROOT / 'public' / 'advertiser.html', ADV_LANGS)


if __name__ == '__main__':
    main()
