#!/usr/bin/env python3
"""Expand the inline DASH_T dictionary in public/developer.html (publisher
dashboard) and public/advertiser.html (advertiser dashboard, future) with
the Settings-section body strings — Account, Payouts, API, Brand safety,
Notifications, Security — across all six supported languages.

Idempotent: regenerates DASH_T from scratch using TRANSLATIONS below
without disturbing the rest of the file. Re-run any time you tweak a
string and want consistent updates across all 6 languages.

Usage:  python3 scripts/i18n_dashboard_settings.py
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# ─── canonical translation strings ────────────────────────────────────
# Keys are flat. English is the source of truth; every other language
# below must define the same keys (the script validates parity).
EN = {
    # chrome (unchanged from current shipping set)
    'chrome.back': 'Back to Lumi SDK', 'chrome.dashboard': 'Dashboard', 'chrome.search_actions': 'Search actions',
    'chrome.account': 'Account', 'chrome.notif_tip': 'Notifications', 'chrome.notif_title': 'Notifications',
    'chrome.notif_mark_all': 'Mark all read', 'chrome.notif_recent': 'Only showing last 7 days',
    'chrome.settings_tip': 'Account Settings', 'chrome.logout': 'Logout',
    'modal.title': 'Settings', 'modal.close': 'Close', 'modal.save': 'Save changes',
    'nav.account': 'Account', 'nav.payouts': 'Payouts', 'nav.api': 'API & Integration',
    'nav.brand': 'Brand safety', 'nav.notifs': 'Notifications', 'nav.language': 'Language', 'nav.security': 'Security',
    'common.copy': 'Copy', 'common.show': 'Show', 'common.hide': 'Hide', 'common.saved': '✓ Saved',
    'language.label': 'Dashboard language',
    'language.hint': 'Applies only to the publisher dashboard. Marketing pages on boostboss.ai have their own language toggle in the top nav. Settings translate immediately; other surfaces are being rolled out.',
    # ─── Account section ───
    'account.app_name': 'App name',
    'account.app_name_hint': 'Shown to advertisers and on your publisher profile.',
    'account.email': 'Contact email',
    'account.email_hint': 'Used for payout and account notifications.',
    'account.dev_id': 'Developer ID',
    'account.revenue': 'Revenue share',
    'account.revenue_value': 'You keep 85% · Boost Boss takes 15%',
    'account.revenue_hint': 'Applied to every cleared impression on your inventory.',
    # ─── Payouts section ───
    'payouts.how_title': 'How payouts work',
    'payouts.how_body_html': 'Earn at least <strong>$25</strong> in publisher accruals, connect Stripe, and the next Friday cron pays you automatically — no manual request needed.',
    'payouts.threshold': 'Payout threshold',
    'payouts.threshold_value': '$25.00 minimum',
    'payouts.schedule': 'Schedule',
    'payouts.schedule_value': 'Weekly · every Friday',
    'payouts.manage_btn': 'Manage Stripe connection & payouts →',
    'payouts.manage_hint': 'Opens the full Payout Settings panel on your dashboard.',
    # ─── API section ───
    'api.key': 'Lumi SDK API key',
    'api.key_hint': 'Authenticates every ad request from your integration. Keep it secret.',
    'api.app_id': 'App ID',
    'api.mcp_endpoint': 'MCP endpoint',
    'api.regen_title': 'Regenerate API key',
    'api.regen_hint': 'Issues a new key and immediately invalidates the old one. Update your integration right after.',
    'api.regen_btn': 'Regenerate key',
    # ─── Brand safety section ───
    'brand.cats_label': 'Blocked advertiser categories',
    'brand.cats_hint': 'Ads from these categories will never serve on any of your inventory.',
    'brand.doms_label': 'Blocked advertiser domains',
    'brand.doms_hint': 'One domain per line. Any ad whose advertiser domain matches is blocked from your inventory.',
    'brand.save_btn': 'Save brand safety',
    'brand.iab1':  'Arts & Entertainment',
    'brand.iab3':  'Business',
    'brand.iab4':  'Careers',
    'brand.iab5':  'Education',
    'brand.iab7':  'Health & Fitness',
    'brand.iab13': 'Personal Finance',
    'brand.iab17': 'Sports',
    'brand.iab19': 'Technology',
    'brand.iab20': 'Travel',
    'brand.iab22': 'Shopping',
    # ─── Notifications section ───
    'notifs.intro':              'Email me when…',
    'notifs.payout_sent_title':  'A payout is sent',
    'notifs.payout_sent_desc':   'Confirmation each time a payout reaches your Stripe account.',
    'notifs.payout_failed_title':'A payout fails',
    'notifs.payout_failed_desc': 'Alerts if a payout could not be completed so you can fix it fast.',
    'notifs.monthly_title':      'Monthly earnings summary',
    'notifs.monthly_desc':       'A once-a-month recap of impressions, fill rate, and earnings.',
    'notifs.product_title':      'Product updates',
    'notifs.product_desc':       'Occasional news on new Boost Boss features and ad formats.',
    # ─── Security section ───
    'security.cur_pw':       'Current password',
    'security.new_pw':       'New password',
    'security.new_pw_hint':  'At least 8 characters.',
    'security.confirm_pw':   'Confirm new password',
    'security.change_btn':   'Change password',
    'security.changing':     'Changing…',
    'security.err_required': 'Enter your current and new password.',
    'security.err_short':    'New password must be at least 8 characters.',
    'security.err_mismatch': 'New passwords do not match.',
    'security.ok_changed':   'Password changed successfully.',
    'security.err_generic':  'Could not change password',
    # ─── Toasts ───
    'toast.copied':       'Copied',
    'toast.brand_saved':  'Brand safety saved',
    'toast.pw_changed':   'Password changed',
}

ZH = {
    'chrome.back': '返回 Lumi SDK', 'chrome.dashboard': '面板', 'chrome.search_actions': '搜索操作',
    'chrome.account': '账户', 'chrome.notif_tip': '通知', 'chrome.notif_title': '通知',
    'chrome.notif_mark_all': '全部标为已读', 'chrome.notif_recent': '仅显示最近 7 天',
    'chrome.settings_tip': '账户设置', 'chrome.logout': '退出登录',
    'modal.title': '设置', 'modal.close': '关闭', 'modal.save': '保存更改',
    'nav.account': '账户', 'nav.payouts': '打款', 'nav.api': 'API 与集成',
    'nav.brand': '品牌安全', 'nav.notifs': '通知', 'nav.language': '语言', 'nav.security': '安全',
    'common.copy': '复制', 'common.show': '显示', 'common.hide': '隐藏', 'common.saved': '✓ 已保存',
    'language.label': '面板语言',
    'language.hint': '仅作用于发布商面板。boostboss.ai 营销页面有自己的语言切换在顶部导航。设置立即翻译,其他界面正在逐步推出。',
    'account.app_name': '应用名称',
    'account.app_name_hint': '显示给广告主和您的发布商档案。',
    'account.email': '联系邮箱',
    'account.email_hint': '用于打款和账户通知。',
    'account.dev_id': '开发者 ID',
    'account.revenue': '收入分成',
    'account.revenue_value': '您获得 85% · Boost Boss 收取 15%',
    'account.revenue_hint': '应用于您库存中每一次结算曝光。',
    'payouts.how_title': '打款如何运作',
    'payouts.how_body_html': '累计至少 <strong>$25</strong> 的发布商收益,连接 Stripe,下一个周五的定时任务将自动向您打款 — 无需手动申请。',
    'payouts.threshold': '打款门槛',
    'payouts.threshold_value': '最低 $25.00',
    'payouts.schedule': '打款周期',
    'payouts.schedule_value': '每周 · 每个周五',
    'payouts.manage_btn': '管理 Stripe 连接和打款 →',
    'payouts.manage_hint': '打开面板上完整的打款设置区域。',
    'api.key': 'Lumi SDK API 密钥',
    'api.key_hint': '验证您集成的每一次广告请求。请妥善保密。',
    'api.app_id': '应用 ID',
    'api.mcp_endpoint': 'MCP 端点',
    'api.regen_title': '重新生成 API 密钥',
    'api.regen_hint': '生成新密钥并立即作废旧密钥。请立刻更新您的集成。',
    'api.regen_btn': '重新生成密钥',
    'brand.cats_label': '屏蔽的广告主类目',
    'brand.cats_hint': '这些类目的广告永远不会在您的任何库存上展示。',
    'brand.doms_label': '屏蔽的广告主域名',
    'brand.doms_hint': '每行一个域名。任何广告主域名匹配的广告都会被屏蔽。',
    'brand.save_btn': '保存品牌安全',
    'brand.iab1':  '艺术与娱乐',
    'brand.iab3':  '商业',
    'brand.iab4':  '职业',
    'brand.iab5':  '教育',
    'brand.iab7':  '健康与健身',
    'brand.iab13': '个人理财',
    'brand.iab17': '体育',
    'brand.iab19': '科技',
    'brand.iab20': '旅游',
    'brand.iab22': '购物',
    'notifs.intro':              '在以下情况给我发邮件…',
    'notifs.payout_sent_title':  '已发出打款',
    'notifs.payout_sent_desc':   '每次打款到达您的 Stripe 账户时的确认邮件。',
    'notifs.payout_failed_title':'打款失败',
    'notifs.payout_failed_desc': '如果打款无法完成,会发送提醒以便您快速处理。',
    'notifs.monthly_title':      '月度收益摘要',
    'notifs.monthly_desc':       '每月一次的曝光量、填充率和收益回顾。',
    'notifs.product_title':      '产品更新',
    'notifs.product_desc':       '关于 Boost Boss 新功能和广告形式的不定期资讯。',
    'security.cur_pw':       '当前密码',
    'security.new_pw':       '新密码',
    'security.new_pw_hint':  '至少 8 个字符。',
    'security.confirm_pw':   '确认新密码',
    'security.change_btn':   '修改密码',
    'security.changing':     '正在修改…',
    'security.err_required': '请输入当前密码和新密码。',
    'security.err_short':    '新密码至少 8 个字符。',
    'security.err_mismatch': '两次输入的新密码不一致。',
    'security.ok_changed':   '密码修改成功。',
    'security.err_generic':  '无法修改密码',
    'toast.copied':       '已复制',
    'toast.brand_saved':  '品牌安全已保存',
    'toast.pw_changed':   '密码已修改',
}

ZH_TW = {
    'chrome.back': '返回 Lumi SDK', 'chrome.dashboard': '儀表板', 'chrome.search_actions': '搜尋動作',
    'chrome.account': '帳號', 'chrome.notif_tip': '通知', 'chrome.notif_title': '通知',
    'chrome.notif_mark_all': '全部標為已讀', 'chrome.notif_recent': '僅顯示最近 7 天',
    'chrome.settings_tip': '帳號設定', 'chrome.logout': '登出',
    'modal.title': '設定', 'modal.close': '關閉', 'modal.save': '儲存變更',
    'nav.account': '帳號', 'nav.payouts': '撥款', 'nav.api': 'API 與整合',
    'nav.brand': '品牌安全', 'nav.notifs': '通知', 'nav.language': '語言', 'nav.security': '安全',
    'common.copy': '複製', 'common.show': '顯示', 'common.hide': '隱藏', 'common.saved': '✓ 已儲存',
    'language.label': '儀表板語言',
    'language.hint': '僅作用於發布商儀表板。boostboss.ai 行銷頁面有自己的語言切換在頂部導覽。設定立即翻譯,其他介面正逐步推出。',
    'account.app_name': '應用程式名稱',
    'account.app_name_hint': '顯示給廣告主和您的發布商檔案。',
    'account.email': '聯絡 Email',
    'account.email_hint': '用於撥款和帳號通知。',
    'account.dev_id': '開發者 ID',
    'account.revenue': '收益分潤',
    'account.revenue_value': '您獲得 85% · Boost Boss 收取 15%',
    'account.revenue_hint': '套用於您庫存中每一次結算的曝光。',
    'payouts.how_title': '撥款如何運作',
    'payouts.how_body_html': '累計至少 <strong>$25</strong> 的發布商收益,連接 Stripe,下一個週五的排程任務會自動撥款給您 — 無需手動申請。',
    'payouts.threshold': '撥款門檻',
    'payouts.threshold_value': '最低 $25.00',
    'payouts.schedule': '撥款週期',
    'payouts.schedule_value': '每週 · 每個週五',
    'payouts.manage_btn': '管理 Stripe 連接與撥款 →',
    'payouts.manage_hint': '開啟儀表板上完整的撥款設定區。',
    'api.key': 'Lumi SDK API 金鑰',
    'api.key_hint': '驗證您整合的每一次廣告請求。請妥善保密。',
    'api.app_id': '應用程式 ID',
    'api.mcp_endpoint': 'MCP 端點',
    'api.regen_title': '重新產生 API 金鑰',
    'api.regen_hint': '產生新金鑰並立即作廢舊金鑰。請立刻更新您的整合。',
    'api.regen_btn': '重新產生金鑰',
    'brand.cats_label': '封鎖的廣告主類別',
    'brand.cats_hint': '這些類別的廣告永遠不會在您的任何庫存上播放。',
    'brand.doms_label': '封鎖的廣告主網域',
    'brand.doms_hint': '每行一個網域。任何廣告主網域相符的廣告都會被封鎖。',
    'brand.save_btn': '儲存品牌安全',
    'brand.iab1':  '藝術與娛樂',
    'brand.iab3':  '商業',
    'brand.iab4':  '職涯',
    'brand.iab5':  '教育',
    'brand.iab7':  '健康與健身',
    'brand.iab13': '個人理財',
    'brand.iab17': '運動',
    'brand.iab19': '科技',
    'brand.iab20': '旅遊',
    'brand.iab22': '購物',
    'notifs.intro':              '在以下情況寄 Email 給我…',
    'notifs.payout_sent_title':  '撥款已寄出',
    'notifs.payout_sent_desc':   '每次撥款到達您的 Stripe 帳戶時的確認 Email。',
    'notifs.payout_failed_title':'撥款失敗',
    'notifs.payout_failed_desc': '如果撥款無法完成,會發送提醒以便您快速處理。',
    'notifs.monthly_title':      '月度收益摘要',
    'notifs.monthly_desc':       '每月一次的曝光、填充率和收益回顧。',
    'notifs.product_title':      '產品更新',
    'notifs.product_desc':       '關於 Boost Boss 新功能和廣告版位的不定期消息。',
    'security.cur_pw':       '目前密碼',
    'security.new_pw':       '新密碼',
    'security.new_pw_hint':  '至少 8 個字元。',
    'security.confirm_pw':   '確認新密碼',
    'security.change_btn':   '變更密碼',
    'security.changing':     '正在變更…',
    'security.err_required': '請輸入目前密碼和新密碼。',
    'security.err_short':    '新密碼至少 8 個字元。',
    'security.err_mismatch': '兩次輸入的新密碼不一致。',
    'security.ok_changed':   '密碼變更成功。',
    'security.err_generic':  '無法變更密碼',
    'toast.copied':       '已複製',
    'toast.brand_saved':  '品牌安全已儲存',
    'toast.pw_changed':   '密碼已變更',
}

JA = {
    'chrome.back': 'Lumi SDK に戻る', 'chrome.dashboard': 'ダッシュボード', 'chrome.search_actions': 'アクション検索',
    'chrome.account': 'アカウント', 'chrome.notif_tip': '通知', 'chrome.notif_title': '通知',
    'chrome.notif_mark_all': 'すべて既読にする', 'chrome.notif_recent': '過去 7 日間のみ表示',
    'chrome.settings_tip': 'アカウント設定', 'chrome.logout': 'ログアウト',
    'modal.title': '設定', 'modal.close': '閉じる', 'modal.save': '変更を保存',
    'nav.account': 'アカウント', 'nav.payouts': '支払い', 'nav.api': 'API・統合',
    'nav.brand': 'ブランドセーフティ', 'nav.notifs': '通知', 'nav.language': '言語', 'nav.security': 'セキュリティ',
    'common.copy': 'コピー', 'common.show': '表示', 'common.hide': '非表示', 'common.saved': '✓ 保存しました',
    'language.label': 'ダッシュボード言語',
    'language.hint': 'パブリッシャー ダッシュボードにのみ適用されます。boostboss.ai のマーケティングページには独自の言語切替がトップナビにあります。設定は即時翻訳、他のサーフェスは順次展開中です。',
    'account.app_name': 'アプリ名',
    'account.app_name_hint': '広告主とパブリッシャー プロフィールに表示されます。',
    'account.email': '連絡先メール',
    'account.email_hint': '支払いとアカウント通知に使用されます。',
    'account.dev_id': 'デベロッパー ID',
    'account.revenue': 'レベニューシェア',
    'account.revenue_value': 'あなたが 85% を獲得 · Boost Boss が 15% を取得',
    'account.revenue_hint': 'インベントリ上のすべての確定インプレッションに適用されます。',
    'payouts.how_title': '支払いの仕組み',
    'payouts.how_body_html': 'パブリッシャー残高で少なくとも <strong>$25</strong> を稼ぎ、Stripe を接続すれば、次の金曜日の自動処理であなたに自動的に支払われます — 手動申請は不要です。',
    'payouts.threshold': '支払いしきい値',
    'payouts.threshold_value': '$25.00 最低',
    'payouts.schedule': 'スケジュール',
    'payouts.schedule_value': '毎週 · 毎週金曜日',
    'payouts.manage_btn': 'Stripe 接続と支払いを管理 →',
    'payouts.manage_hint': 'ダッシュボードの完全な支払い設定パネルを開きます。',
    'api.key': 'Lumi SDK API キー',
    'api.key_hint': '統合からのすべての広告リクエストを認証します。秘密にしてください。',
    'api.app_id': 'アプリ ID',
    'api.mcp_endpoint': 'MCP エンドポイント',
    'api.regen_title': 'API キーを再生成',
    'api.regen_hint': '新しいキーを発行し、古いキーを即座に無効化します。直後に統合を更新してください。',
    'api.regen_btn': 'キーを再生成',
    'brand.cats_label': 'ブロック対象の広告主カテゴリ',
    'brand.cats_hint': 'これらのカテゴリの広告は、あなたのインベントリでは決して配信されません。',
    'brand.doms_label': 'ブロック対象の広告主ドメイン',
    'brand.doms_hint': '1 行に 1 ドメイン。広告主ドメインが一致する広告はインベントリから除外されます。',
    'brand.save_btn': 'ブランドセーフティを保存',
    'brand.iab1':  'アート・エンタメ',
    'brand.iab3':  'ビジネス',
    'brand.iab4':  'キャリア',
    'brand.iab5':  '教育',
    'brand.iab7':  'ヘルス・フィットネス',
    'brand.iab13': '個人金融',
    'brand.iab17': 'スポーツ',
    'brand.iab19': 'テクノロジー',
    'brand.iab20': '旅行',
    'brand.iab22': 'ショッピング',
    'notifs.intro':              '次の場合にメール通知…',
    'notifs.payout_sent_title':  '支払いが送信された',
    'notifs.payout_sent_desc':   '支払いが Stripe アカウントに届くたびに送信される確認メール。',
    'notifs.payout_failed_title':'支払いに失敗した',
    'notifs.payout_failed_desc': '支払いが完了できなかった場合、迅速に対処できるよう通知します。',
    'notifs.monthly_title':      '月次収益サマリー',
    'notifs.monthly_desc':       '月 1 回のインプレッション・フィルレート・収益の総括。',
    'notifs.product_title':      'プロダクト アップデート',
    'notifs.product_desc':       'Boost Boss の新機能や広告フォーマットに関する不定期ニュース。',
    'security.cur_pw':       '現在のパスワード',
    'security.new_pw':       '新しいパスワード',
    'security.new_pw_hint':  '少なくとも 8 文字以上。',
    'security.confirm_pw':   '新しいパスワードを確認',
    'security.change_btn':   'パスワードを変更',
    'security.changing':     '変更中…',
    'security.err_required': '現在のパスワードと新しいパスワードを入力してください。',
    'security.err_short':    '新しいパスワードは 8 文字以上にしてください。',
    'security.err_mismatch': '新しいパスワードが一致しません。',
    'security.ok_changed':   'パスワードを変更しました。',
    'security.err_generic':  'パスワードを変更できませんでした',
    'toast.copied':       'コピーしました',
    'toast.brand_saved':  'ブランドセーフティを保存しました',
    'toast.pw_changed':   'パスワードを変更しました',
}

KO = {
    'chrome.back': 'Lumi SDK로 돌아가기', 'chrome.dashboard': '대시보드', 'chrome.search_actions': '작업 검색',
    'chrome.account': '계정', 'chrome.notif_tip': '알림', 'chrome.notif_title': '알림',
    'chrome.notif_mark_all': '모두 읽음으로 표시', 'chrome.notif_recent': '최근 7일만 표시',
    'chrome.settings_tip': '계정 설정', 'chrome.logout': '로그아웃',
    'modal.title': '설정', 'modal.close': '닫기', 'modal.save': '변경 저장',
    'nav.account': '계정', 'nav.payouts': '정산', 'nav.api': 'API 및 통합',
    'nav.brand': '브랜드 안전', 'nav.notifs': '알림', 'nav.language': '언어', 'nav.security': '보안',
    'common.copy': '복사', 'common.show': '표시', 'common.hide': '숨기기', 'common.saved': '✓ 저장됨',
    'language.label': '대시보드 언어',
    'language.hint': '퍼블리셔 대시보드에만 적용됩니다. boostboss.ai 마케팅 페이지는 상단 내비에 자체 언어 토글이 있습니다. 설정은 즉시 번역되고 다른 표면은 점진적으로 적용됩니다.',
    'account.app_name': '앱 이름',
    'account.app_name_hint': '광고주와 퍼블리셔 프로필에 표시됩니다.',
    'account.email': '연락 이메일',
    'account.email_hint': '정산 및 계정 알림에 사용됩니다.',
    'account.dev_id': '개발자 ID',
    'account.revenue': '수익 분배',
    'account.revenue_value': '귀하 85% · Boost Boss 15%',
    'account.revenue_hint': '인벤토리의 모든 정산 노출에 적용됩니다.',
    'payouts.how_title': '정산 작동 방식',
    'payouts.how_body_html': '퍼블리셔 적립금으로 최소 <strong>$25</strong>을 벌고 Stripe를 연결하면, 다음 금요일 cron이 자동으로 정산해 드립니다 — 수동 요청 불필요.',
    'payouts.threshold': '정산 임계값',
    'payouts.threshold_value': '$25.00 최소',
    'payouts.schedule': '일정',
    'payouts.schedule_value': '매주 · 매주 금요일',
    'payouts.manage_btn': 'Stripe 연결 및 정산 관리 →',
    'payouts.manage_hint': '대시보드의 전체 정산 설정 패널을 엽니다.',
    'api.key': 'Lumi SDK API 키',
    'api.key_hint': '통합에서 오는 모든 광고 요청을 인증합니다. 비밀로 유지하세요.',
    'api.app_id': '앱 ID',
    'api.mcp_endpoint': 'MCP 엔드포인트',
    'api.regen_title': 'API 키 재생성',
    'api.regen_hint': '새 키를 발급하고 이전 키를 즉시 무효화합니다. 직후 통합을 업데이트하세요.',
    'api.regen_btn': '키 재생성',
    'brand.cats_label': '차단된 광고주 카테고리',
    'brand.cats_hint': '이 카테고리의 광고는 어떤 인벤토리에서도 절대 노출되지 않습니다.',
    'brand.doms_label': '차단된 광고주 도메인',
    'brand.doms_hint': '한 줄에 도메인 하나. 광고주 도메인이 일치하는 광고는 인벤토리에서 차단됩니다.',
    'brand.save_btn': '브랜드 안전 저장',
    'brand.iab1':  '예술 및 엔터테인먼트',
    'brand.iab3':  '비즈니스',
    'brand.iab4':  '커리어',
    'brand.iab5':  '교육',
    'brand.iab7':  '건강 및 피트니스',
    'brand.iab13': '개인 금융',
    'brand.iab17': '스포츠',
    'brand.iab19': '기술',
    'brand.iab20': '여행',
    'brand.iab22': '쇼핑',
    'notifs.intro':              '다음 경우 이메일 알림…',
    'notifs.payout_sent_title':  '정산이 전송됨',
    'notifs.payout_sent_desc':   '정산이 Stripe 계정에 도달할 때마다 확인 이메일이 전송됩니다.',
    'notifs.payout_failed_title':'정산 실패',
    'notifs.payout_failed_desc': '정산이 완료되지 않으면 빠르게 조치할 수 있도록 알립니다.',
    'notifs.monthly_title':      '월간 수익 요약',
    'notifs.monthly_desc':       '월 1회 노출수, 채움률, 수익의 요약.',
    'notifs.product_title':      '제품 업데이트',
    'notifs.product_desc':       'Boost Boss의 새 기능과 광고 형식에 대한 가끔의 소식.',
    'security.cur_pw':       '현재 비밀번호',
    'security.new_pw':       '새 비밀번호',
    'security.new_pw_hint':  '8자 이상.',
    'security.confirm_pw':   '새 비밀번호 확인',
    'security.change_btn':   '비밀번호 변경',
    'security.changing':     '변경 중…',
    'security.err_required': '현재 비밀번호와 새 비밀번호를 입력하세요.',
    'security.err_short':    '새 비밀번호는 8자 이상이어야 합니다.',
    'security.err_mismatch': '새 비밀번호가 일치하지 않습니다.',
    'security.ok_changed':   '비밀번호가 성공적으로 변경되었습니다.',
    'security.err_generic':  '비밀번호를 변경할 수 없습니다',
    'toast.copied':       '복사됨',
    'toast.brand_saved':  '브랜드 안전 저장됨',
    'toast.pw_changed':   '비밀번호 변경됨',
}

VI = {
    'chrome.back': 'Quay lại Lumi SDK', 'chrome.dashboard': 'Dashboard', 'chrome.search_actions': 'Tìm hành động',
    'chrome.account': 'Tài khoản', 'chrome.notif_tip': 'Thông báo', 'chrome.notif_title': 'Thông báo',
    'chrome.notif_mark_all': 'Đánh dấu tất cả đã đọc', 'chrome.notif_recent': 'Chỉ hiển thị 7 ngày gần nhất',
    'chrome.settings_tip': 'Cài đặt tài khoản', 'chrome.logout': 'Đăng xuất',
    'modal.title': 'Cài đặt', 'modal.close': 'Đóng', 'modal.save': 'Lưu thay đổi',
    'nav.account': 'Tài khoản', 'nav.payouts': 'Thanh toán', 'nav.api': 'API & Tích hợp',
    'nav.brand': 'An toàn thương hiệu', 'nav.notifs': 'Thông báo', 'nav.language': 'Ngôn ngữ', 'nav.security': 'Bảo mật',
    'common.copy': 'Sao chép', 'common.show': 'Hiện', 'common.hide': 'Ẩn', 'common.saved': '✓ Đã lưu',
    'language.label': 'Ngôn ngữ dashboard',
    'language.hint': 'Chỉ áp dụng cho dashboard publisher. Trang marketing boostboss.ai có toggle ngôn ngữ riêng ở top nav. Settings dịch ngay, các bề mặt khác đang triển khai dần.',
    'account.app_name': 'Tên ứng dụng',
    'account.app_name_hint': 'Hiển thị cho nhà quảng cáo và trên hồ sơ publisher của bạn.',
    'account.email': 'Email liên hệ',
    'account.email_hint': 'Dùng cho thanh toán và thông báo tài khoản.',
    'account.dev_id': 'ID nhà phát triển',
    'account.revenue': 'Chia sẻ doanh thu',
    'account.revenue_value': 'Bạn giữ 85% · Boost Boss lấy 15%',
    'account.revenue_hint': 'Áp dụng cho mọi impression đã thanh toán trên kho của bạn.',
    'payouts.how_title': 'Thanh toán hoạt động thế nào',
    'payouts.how_body_html': 'Kiếm tối thiểu <strong>$25</strong> trong tích lũy publisher, kết nối Stripe, và cron thứ Sáu kế tiếp sẽ thanh toán tự động — không cần yêu cầu thủ công.',
    'payouts.threshold': 'Ngưỡng thanh toán',
    'payouts.threshold_value': 'Tối thiểu $25.00',
    'payouts.schedule': 'Lịch trình',
    'payouts.schedule_value': 'Hàng tuần · mỗi thứ Sáu',
    'payouts.manage_btn': 'Quản lý kết nối Stripe & thanh toán →',
    'payouts.manage_hint': 'Mở bảng Cài đặt Thanh toán đầy đủ trên dashboard.',
    'api.key': 'Khóa API Lumi SDK',
    'api.key_hint': 'Xác thực mọi yêu cầu quảng cáo từ tích hợp của bạn. Giữ bí mật.',
    'api.app_id': 'App ID',
    'api.mcp_endpoint': 'MCP endpoint',
    'api.regen_title': 'Tạo lại khóa API',
    'api.regen_hint': 'Phát hành khóa mới và lập tức vô hiệu hóa khóa cũ. Cập nhật tích hợp ngay sau đó.',
    'api.regen_btn': 'Tạo lại khóa',
    'brand.cats_label': 'Danh mục quảng cáo bị chặn',
    'brand.cats_hint': 'Quảng cáo của các danh mục này sẽ không bao giờ phục vụ trên bất kỳ kho nào của bạn.',
    'brand.doms_label': 'Tên miền nhà quảng cáo bị chặn',
    'brand.doms_hint': 'Mỗi dòng một tên miền. Bất kỳ quảng cáo nào có tên miền nhà quảng cáo trùng khớp sẽ bị chặn.',
    'brand.save_btn': 'Lưu an toàn thương hiệu',
    'brand.iab1':  'Nghệ thuật & Giải trí',
    'brand.iab3':  'Kinh doanh',
    'brand.iab4':  'Nghề nghiệp',
    'brand.iab5':  'Giáo dục',
    'brand.iab7':  'Sức khỏe & Thể hình',
    'brand.iab13': 'Tài chính cá nhân',
    'brand.iab17': 'Thể thao',
    'brand.iab19': 'Công nghệ',
    'brand.iab20': 'Du lịch',
    'brand.iab22': 'Mua sắm',
    'notifs.intro':              'Gửi email cho tôi khi…',
    'notifs.payout_sent_title':  'Đã gửi thanh toán',
    'notifs.payout_sent_desc':   'Email xác nhận mỗi lần thanh toán đến tài khoản Stripe của bạn.',
    'notifs.payout_failed_title':'Thanh toán thất bại',
    'notifs.payout_failed_desc': 'Cảnh báo nếu thanh toán không thể hoàn tất để bạn xử lý nhanh.',
    'notifs.monthly_title':      'Tóm tắt doanh thu hàng tháng',
    'notifs.monthly_desc':       'Bản tóm tắt impressions, fill rate và doanh thu hàng tháng.',
    'notifs.product_title':      'Cập nhật sản phẩm',
    'notifs.product_desc':       'Tin tức không thường xuyên về tính năng mới và định dạng quảng cáo của Boost Boss.',
    'security.cur_pw':       'Mật khẩu hiện tại',
    'security.new_pw':       'Mật khẩu mới',
    'security.new_pw_hint':  'Ít nhất 8 ký tự.',
    'security.confirm_pw':   'Xác nhận mật khẩu mới',
    'security.change_btn':   'Đổi mật khẩu',
    'security.changing':     'Đang đổi…',
    'security.err_required': 'Nhập mật khẩu hiện tại và mật khẩu mới.',
    'security.err_short':    'Mật khẩu mới phải có ít nhất 8 ký tự.',
    'security.err_mismatch': 'Mật khẩu mới không khớp.',
    'security.ok_changed':   'Đã đổi mật khẩu thành công.',
    'security.err_generic':  'Không thể đổi mật khẩu',
    'toast.copied':       'Đã sao chép',
    'toast.brand_saved':  'Đã lưu an toàn thương hiệu',
    'toast.pw_changed':   'Đã đổi mật khẩu',
}

LANGS = [
    ('en',    EN),
    ('zh',    ZH),
    ('zh-TW', ZH_TW),
    ('ja',    JA),
    ('ko',    KO),
    ('vi',    VI),
]


def validate_parity():
    en_keys = set(EN.keys())
    for code, d in LANGS:
        missing = en_keys - set(d.keys())
        extra   = set(d.keys()) - en_keys
        if missing:
            print(f"!! {code} is missing keys: {sorted(missing)}", file=sys.stderr)
            sys.exit(1)
        if extra:
            print(f"!! {code} has extra keys not in EN: {sorted(extra)}", file=sys.stderr)
            sys.exit(1)


def escape_js_string(s: str) -> str:
    # JS single-quoted string: escape backslashes and single quotes.
    return s.replace('\\', '\\\\').replace("'", "\\'")


def render_dash_t() -> str:
    """Return the JS source for `const DASH_T = { … };` (no leading indent)."""
    lines = ["const DASH_T = {"]
    for code, d in LANGS:
        lines.append(f"                '{code}': {{")
        for key in EN.keys():  # iterate in EN's insertion order for stability
            val = escape_js_string(d[key])
            lines.append(f"                    '{key}': '{val}',")
        lines.append("                },")
    lines.append("            };")
    return "\n            ".join(lines)


PATTERN = re.compile(
    r"const DASH_T = \{.*?\n            \};",
    re.DOTALL,
)


def patch_file(path: Path):
    text = path.read_text(encoding='utf-8')
    new_block = render_dash_t()
    new_text, n = PATTERN.subn(new_block, text, count=1)
    if n != 1:
        print(f"!! Could not locate DASH_T block in {path}", file=sys.stderr)
        sys.exit(1)
    if new_text == text:
        print(f"-- {path.name}: no change")
        return
    path.write_text(new_text, encoding='utf-8')
    print(f"++ {path.name}: DASH_T regenerated ({len(EN)} keys × {len(LANGS)} languages)")


def main():
    validate_parity()
    patch_file(ROOT / 'public' / 'developer.html')
    # advertiser.html ships its own DASH_T; expansion will land in a follow-up
    # commit once we audit which keys are shared vs advertiser-specific.


if __name__ == '__main__':
    main()
