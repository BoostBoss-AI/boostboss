#!/usr/bin/env python3
"""Insert auth-screen + small remaining translation keys (added in the
final audit pass) into both DASH_T dictionaries. Idempotent."""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

ADV_LANGS = {
    'en': {
        'auth.login': 'Login',
        'auth.signup': 'Sign Up',
        'auth.email': 'Email',
        'auth.email_ph': 'you@example.com',
        'auth.password': 'Password',
        'auth.company': 'Company Name',
        'auth.company_ph': 'Your company name',
        'detail.default_name': 'Campaign',
    },
    'zh': {
        'auth.login': '登录',
        'auth.signup': '注册',
        'auth.email': '邮箱',
        'auth.email_ph': 'you@example.com',
        'auth.password': '密码',
        'auth.company': '公司名称',
        'auth.company_ph': '您的公司名称',
        'detail.default_name': '广告',
    },
    'zh-TW': {
        'auth.login': '登入',
        'auth.signup': '註冊',
        'auth.email': '電子郵件',
        'auth.email_ph': 'you@example.com',
        'auth.password': '密碼',
        'auth.company': '公司名稱',
        'auth.company_ph': '您的公司名稱',
        'detail.default_name': '廣告',
    },
    'ja': {
        'auth.login': 'ログイン',
        'auth.signup': '新規登録',
        'auth.email': 'メール',
        'auth.email_ph': 'you@example.com',
        'auth.password': 'パスワード',
        'auth.company': '会社名',
        'auth.company_ph': 'あなたの会社名',
        'detail.default_name': 'キャンペーン',
    },
    'ko': {
        'auth.login': '로그인',
        'auth.signup': '회원가입',
        'auth.email': '이메일',
        'auth.email_ph': 'you@example.com',
        'auth.password': '비밀번호',
        'auth.company': '회사명',
        'auth.company_ph': '회사명을 입력하세요',
        'detail.default_name': '캠페인',
    },
    'vi': {
        'auth.login': 'Đăng nhập',
        'auth.signup': 'Đăng ký',
        'auth.email': 'Email',
        'auth.email_ph': 'you@example.com',
        'auth.password': 'Mật khẩu',
        'auth.company': 'Tên công ty',
        'auth.company_ph': 'Tên công ty của bạn',
        'detail.default_name': 'Chiến dịch',
    },
}

PUB_LANGS = {
    'en': {
        'auth.signin': 'Sign In',
        'auth.signin_sub': 'Sign in to track earnings and manage your AI app',
        'auth.signup': 'Sign Up',
        'auth.email_addr': 'Email Address',
        'auth.email_ph': 'you@example.com',
        'auth.password': 'Password',
        'auth.app_name': 'App Name',
        'auth.app_name_ph': 'MyAI App',
        'auth.have_key': 'Already have an API key? View your dashboard →',
        'auth.view_dashboard': 'View Dashboard',
        'common.loading': 'Loading...',
    },
    'zh': {
        'auth.signin': '登录',
        'auth.signin_sub': '登录以跟踪收益并管理您的 AI 应用',
        'auth.signup': '注册',
        'auth.email_addr': '邮箱地址',
        'auth.email_ph': 'you@example.com',
        'auth.password': '密码',
        'auth.app_name': '应用名称',
        'auth.app_name_ph': '我的 AI 应用',
        'auth.have_key': '已有 API 密钥？查看您的仪表盘 →',
        'auth.view_dashboard': '查看仪表盘',
        'common.loading': '加载中...',
    },
    'zh-TW': {
        'auth.signin': '登入',
        'auth.signin_sub': '登入以追蹤收益並管理您的 AI 應用',
        'auth.signup': '註冊',
        'auth.email_addr': '電子郵件地址',
        'auth.email_ph': 'you@example.com',
        'auth.password': '密碼',
        'auth.app_name': '應用名稱',
        'auth.app_name_ph': '我的 AI 應用',
        'auth.have_key': '已有 API 金鑰？查看您的儀表板 →',
        'auth.view_dashboard': '查看儀表板',
        'common.loading': '載入中...',
    },
    'ja': {
        'auth.signin': 'サインイン',
        'auth.signin_sub': 'サインインして収益の追跡と AI アプリの管理を行う',
        'auth.signup': '新規登録',
        'auth.email_addr': 'メールアドレス',
        'auth.email_ph': 'you@example.com',
        'auth.password': 'パスワード',
        'auth.app_name': 'アプリ名',
        'auth.app_name_ph': 'マイ AI アプリ',
        'auth.have_key': 'API キーをお持ちですか？ダッシュボードを表示 →',
        'auth.view_dashboard': 'ダッシュボードを表示',
        'common.loading': '読み込み中...',
    },
    'ko': {
        'auth.signin': '로그인',
        'auth.signin_sub': '로그인하여 수익을 추적하고 AI 앱을 관리하세요',
        'auth.signup': '회원가입',
        'auth.email_addr': '이메일 주소',
        'auth.email_ph': 'you@example.com',
        'auth.password': '비밀번호',
        'auth.app_name': '앱 이름',
        'auth.app_name_ph': '내 AI 앱',
        'auth.have_key': '이미 API 키가 있나요? 대시보드 보기 →',
        'auth.view_dashboard': '대시보드 보기',
        'common.loading': '로딩 중...',
    },
    'vi': {
        'auth.signin': 'Đăng nhập',
        'auth.signin_sub': 'Đăng nhập để theo dõi doanh thu và quản lý ứng dụng AI của bạn',
        'auth.signup': 'Đăng ký',
        'auth.email_addr': 'Địa chỉ Email',
        'auth.email_ph': 'you@example.com',
        'auth.password': 'Mật khẩu',
        'auth.app_name': 'Tên ứng dụng',
        'auth.app_name_ph': 'Ứng dụng AI của tôi',
        'auth.have_key': 'Đã có API key? Xem dashboard của bạn →',
        'auth.view_dashboard': 'Xem Dashboard',
        'common.loading': 'Đang tải...',
    },
}


def insert_keys(text: str, lang_code: str, keys: dict) -> tuple[str, int]:
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
