#!/usr/bin/env python3
"""i18n tagger for /publish/bots."""
import json, os

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..'))
PAGE = os.path.join(ROOT, 'public', 'publish-bots.html')
I18N_DIR = os.path.join(ROOT, 'public', 'i18n')

EN = {
    "publish.bots.hero_eyebrow": "For AI Bot Developers",
    "publish.bots.hero_h1_html": "Turn your AI bot into a <span class=\"grad\">revenue-generating business</span>.",
    "publish.bots.hero_sub": "Lumi API for Bots — one REST call from your bot's response handler. Works with Discord, Telegram, Slack, and any platform your bot lives on. Any LLM. Any framework. Optional per-platform helper libraries available.",
    "publish.bots.hero_cta": "Start as a publisher →",

    "publish.bots.see_eyebrow": "See it appear",
    "publish.bots.see_h2_html": "Your bot replies first.<br>The sponsored message arrives right after.",
    "publish.bots.see_sub": "Same campaign renders natively on Discord, Telegram, and Slack — embed, card, or attachment, depending on the platform. Helper libs handle the formatting.",
    "publish.bots.see_caption": "Phone-shaped Telegram preview shown here. The same Lumi API for Bots response can be formatted as a Discord embed, Slack attachment, or Telegram card — see the static preview below for all three side-by-side.",

    "publish.bots.how_eyebrow": "How it works",
    "publish.bots.how_h2": "From API key to first ad in ten minutes.",
    "publish.bots.how1_h4": "Get your API key",
    "publish.bots.how1_p": "Sign up, copy your bearer token from the dashboard. One token works for any platform.",
    "publish.bots.how2_h4": "Call Boost Boss",
    "publish.bots.how2_p_html": "Hit <code>POST /v1/ad-request</code> from inside your bot's response handler with the user's query as context.",
    "publish.bots.how3_h4": "Format and send",
    "publish.bots.how3_p_html": "Use our helper libs (<code>lumi-discord</code>, <code>lumi-telegram</code>, <code>lumi-slack</code>) to convert the response to native message format.",

    "publish.bots.snippet_eyebrow": "Integration snippet",
    "publish.bots.snippet_h2": "A few lines, your existing handler.",
    "publish.bots.snippet_caption_html": "Optional helper libraries (<code>lumi-discord</code>, <code>lumi-telegram</code>, <code>lumi-slack</code>) are convenience wrappers around the Lumi API for Bots — they format the ad payload into each platform's native message type. Skip them and roll your own formatting if you'd rather not add a dependency. <a href=\"/docs/rest-api\">Full docs →</a>",
    "publish.bots.snippet_shot_caption_html": "Same campaign, three native message formats. The helper libs (<code>lumi-discord</code>, <code>lumi-telegram</code>, <code>lumi-slack</code>) handle the platform-specific formatting.",

    "publish.bots.who_eyebrow": "Who this is for",
    "publish.bots.who_h2": "If your bot lives in a chat platform, this is your path.",
    "publish.bots.who_li1": "You shipped an AI bot on Discord, Telegram, or Slack.",
    "publish.bots.who_li2": "Examples: research bots, summarization bots, image generation bots, productivity assistants, customer support bots.",
    "publish.bots.who_li3": "You want monetization that doesn't require a paywall — your community uses it free, you earn from ads.",
    "publish.bots.who_li4": "You're tired of \"tip me on Buy Me a Coffee\" being your only option.",

    "publish.bots.rev_eyebrow": "Revenue example",
    "publish.bots.rev_h2": "What 15,000 daily users can earn.",
    "publish.bots.rev_label": "Illustrative — not a guarantee",
    "publish.bots.rev_row1": "Daily active users",
    "publish.bots.rev_row2": "Ad impressions per user per day",
    "publish.bots.rev_row3": "Daily impressions",
    "publish.bots.rev_row4": "CPM (varies by platform)",
    "publish.bots.rev_row5": "Monthly publisher revenue",
    "publish.bots.rev_disclaimer": "Numbers are illustrative for a moderately-active community bot. CPMs vary widely by platform — Slack workplace audiences pay more, Telegram consumer audiences less. Vertical and language also matter; English-language productivity bots sit at the top of the range.",

    "publish.bots.faq_eyebrow": "Frequently asked",
    "publish.bots.faq_h2": "The questions every bot dev asks.",
    "publish.bots.faq1_q": "Will this violate Discord / Telegram / Slack ToS?",
    "publish.bots.faq1_a": "Lumi is designed for ToS compliance. Discord requires clear ad disclosure; we handle that with a \"Sponsored\" prefix and the disclosure label you configured in your dashboard. Telegram and Slack have looser policies but we follow best practices regardless.",
    "publish.bots.faq2_q": "Can I serve image ads, not just text?",
    "publish.bots.faq2_a": "Yes. Discord embeds support image fields; Telegram supports inline media; Slack blocks support image accessory components. The helper libraries map a single ad payload to whichever format your platform uses.",
    "publish.bots.faq3_q": "What about non-English bots?",
    "publish.bots.faq3_a": "Boost Boss serves ads in 40+ languages. CPMs vary by market — large EN, ES, JA markets pay best; smaller-language inventory still fills but at lower rates.",
    "publish.bots.faq4_q": "Do I need to handle click tracking myself?",
    "publish.bots.faq4_a_html": "No. Use the <code>click_url</code> we return in every ad response — tracking is built into that redirect. Same for impression tracking via <code>impression_url</code>.",
    "publish.bots.faq5_q": "What's the rate limit?",
    "publish.bots.faq5_a": "1,000 ad requests per minute per publisher on launch. We raise that for verified-volume publishers; tell us if you're approaching the cap.",

    "publish.bots.cta_h2": "Ready to monetize your bot?",
    "publish.bots.cta_p": "One REST call. Helper libraries included. Weekly payouts.",
    "publish.bots.cta_btn": "Apply as a Founding Publisher →",
}

ZH = {
    "publish.bots.hero_eyebrow": "面向 AI 机器人开发者",
    "publish.bots.hero_h1_html": "把你的 AI 机器人变成一个 <span class=\"grad\">能赚钱的业务</span>。",
    "publish.bots.hero_sub": "Lumi API for Bots — 在你 bot 的响应 handler 里调一次 REST。支持 Discord、Telegram、Slack,以及任何 bot 所在的平台。任何 LLM,任何框架。还有可选的平台专用 helper 库。",
    "publish.bots.hero_cta": "以发布商身份开始 →",

    "publish.bots.see_eyebrow": "看它出现",
    "publish.bots.see_h2_html": "先由你的 bot 回复。<br>赞助消息紧随其后。",
    "publish.bots.see_sub": "同一份广告在 Discord、Telegram、Slack 上原生渲染 — 视平台分别用 embed、card 或 attachment。helper 库负责格式转换。",
    "publish.bots.see_caption": "这里显示的是手机形态的 Telegram 预览。同一份 Lumi API for Bots 响应可以格式化为 Discord embed、Slack attachment 或 Telegram card — 下方的静态预览三种并排。",

    "publish.bots.how_eyebrow": "工作原理",
    "publish.bots.how_h2": "从拿 API 密钥到首条广告,十分钟。",
    "publish.bots.how1_h4": "获取你的 API 密钥",
    "publish.bots.how1_p": "注册,在面板里复制 bearer token。一个 token,所有平台通用。",
    "publish.bots.how2_h4": "调用 Boost Boss",
    "publish.bots.how2_p_html": "在你 bot 的响应 handler 里调 <code>POST /v1/ad-request</code>,把用户的查询当作上下文传过来。",
    "publish.bots.how3_h4": "格式化并发送",
    "publish.bots.how3_p_html": "用我们的 helper 库(<code>lumi-discord</code>、<code>lumi-telegram</code>、<code>lumi-slack</code>)把响应转成原生消息格式。",

    "publish.bots.snippet_eyebrow": "集成代码",
    "publish.bots.snippet_h2": "几行代码,你现有的 handler。",
    "publish.bots.snippet_caption_html": "可选的 helper 库(<code>lumi-discord</code>、<code>lumi-telegram</code>、<code>lumi-slack</code>)是 Lumi API for Bots 的便捷封装 — 把广告负载转成各平台的原生消息类型。如果你不想加依赖,跳过它们,自己写格式化逻辑也行。<a href=\"/docs/rest-api\">完整文档 →</a>",
    "publish.bots.snippet_shot_caption_html": "同一份广告,三种原生消息格式。helper 库(<code>lumi-discord</code>、<code>lumi-telegram</code>、<code>lumi-slack</code>)负责平台特定的格式化。",

    "publish.bots.who_eyebrow": "适合谁",
    "publish.bots.who_h2": "如果你的 bot 跑在聊天平台上,这就是你的路径。",
    "publish.bots.who_li1": "你做了一个 Discord、Telegram 或 Slack 上的 AI bot。",
    "publish.bots.who_li2": "示例:研究 bot、摘要 bot、图像生成 bot、生产力助手、客服 bot。",
    "publish.bots.who_li3": "你想要一种不需要 paywall 的变现方式 — 你的社群免费用,你从广告里赚钱。",
    "publish.bots.who_li4": "你受够了“在 Buy Me a Coffee 上打赏我”是你唯一的选项。",

    "publish.bots.rev_eyebrow": "收入示例",
    "publish.bots.rev_h2": "15,000 日活能赚多少。",
    "publish.bots.rev_label": "仅供示意 — 不构成保证",
    "publish.bots.rev_row1": "日活用户",
    "publish.bots.rev_row2": "每用户每日广告展示数",
    "publish.bots.rev_row3": "每日展示数",
    "publish.bots.rev_row4": "CPM(因平台而异)",
    "publish.bots.rev_row5": "每月发布商收入",
    "publish.bots.rev_disclaimer": "数字仅为示意,以活跃度中等的社群 bot 为基准。CPM 因平台差异很大 — Slack 的职场受众价格更高,Telegram 的消费受众更低。垂直领域和语言也有影响;英文生产力 bot 处在高端区间。",

    "publish.bots.faq_eyebrow": "常见问题",
    "publish.bots.faq_h2": "每个 bot 开发者都会问的问题。",
    "publish.bots.faq1_q": "这会违反 Discord / Telegram / Slack 的 ToS 吗?",
    "publish.bots.faq1_a": "Lumi 的设计就考虑了 ToS 合规。Discord 要求清晰的广告披露;我们用 “Sponsored” 前缀加上你在面板里配置的披露标签来处理。Telegram 和 Slack 的政策更宽松,但我们仍然遵循最佳实践。",
    "publish.bots.faq2_q": "我能投图片广告,而不只是文字吗?",
    "publish.bots.faq2_a": "可以。Discord embed 支持图片字段;Telegram 支持 inline 媒体;Slack block 支持 image accessory 组件。helper 库会把同一份广告负载映射到你所在平台用的那种格式。",
    "publish.bots.faq3_q": "非英文 bot 呢?",
    "publish.bots.faq3_a": "Boost Boss 服务于 40+ 语言的广告。CPM 因市场而异 — 大盘子的 EN、ES、JA 市场价格最好;小语种库存也能填上,只是价格低些。",
    "publish.bots.faq4_q": "我自己需要处理点击追踪吗?",
    "publish.bots.faq4_a_html": "不需要。用我们在每条广告响应里返回的 <code>click_url</code> — 追踪逻辑内置在那个重定向里。展示追踪用 <code>impression_url</code>,同理。",
    "publish.bots.faq5_q": "速率限制是多少?",
    "publish.bots.faq5_a": "上线时每个发布商每分钟 1,000 次广告请求。已验证体量的发布商可以放开;接近上限请告诉我们。",

    "publish.bots.cta_h2": "准备好让你的 bot 变现了吗?",
    "publish.bots.cta_p": "一次 REST 调用。helper 库随附。每周打款。",
    "publish.bots.cta_btn": "申请成为创始发布商 →",
}

ZH_TW = {
    "publish.bots.hero_eyebrow": "面向 AI 機器人開發者",
    "publish.bots.hero_h1_html": "把你的 AI 機器人變成一個 <span class=\"grad\">能賺錢的事業</span>。",
    "publish.bots.hero_sub": "Lumi API for Bots — 在你 bot 的回應 handler 裡呼叫一次 REST。支援 Discord、Telegram、Slack,以及任何 bot 所在的平台。任何 LLM、任何框架。還有可選的平台專用 helper 函式庫。",
    "publish.bots.hero_cta": "以發布商身分開始 →",

    "publish.bots.see_eyebrow": "看看它出現的樣子",
    "publish.bots.see_h2_html": "先由你的 bot 回覆。<br>贊助訊息緊接而來。",
    "publish.bots.see_sub": "同一份廣告在 Discord、Telegram、Slack 上原生渲染 — 視平台分別使用 embed、card 或 attachment。helper 函式庫負責格式轉換。",
    "publish.bots.see_caption": "這裡顯示的是手機外型的 Telegram 預覽。同一份 Lumi API for Bots 回應可以格式化為 Discord embed、Slack attachment 或 Telegram card — 下方靜態預覽三種並排呈現。",

    "publish.bots.how_eyebrow": "運作方式",
    "publish.bots.how_h2": "從拿 API 金鑰到首則廣告,十分鐘。",
    "publish.bots.how1_h4": "取得你的 API 金鑰",
    "publish.bots.how1_p": "註冊,在儀表板複製 bearer token。一個 token,所有平台通用。",
    "publish.bots.how2_h4": "呼叫 Boost Boss",
    "publish.bots.how2_p_html": "在你 bot 的回應 handler 裡呼叫 <code>POST /v1/ad-request</code>,將使用者的查詢作為上下文傳入。",
    "publish.bots.how3_h4": "格式化並送出",
    "publish.bots.how3_p_html": "使用我們的 helper 函式庫(<code>lumi-discord</code>、<code>lumi-telegram</code>、<code>lumi-slack</code>)把回應轉成原生訊息格式。",

    "publish.bots.snippet_eyebrow": "整合程式碼",
    "publish.bots.snippet_h2": "幾行程式碼,你既有的 handler。",
    "publish.bots.snippet_caption_html": "可選的 helper 函式庫(<code>lumi-discord</code>、<code>lumi-telegram</code>、<code>lumi-slack</code>)是 Lumi API for Bots 的便捷封裝 — 把廣告內容轉成各平台原生訊息類型。若不想加依賴,可跳過它們、自行寫格式化邏輯。<a href=\"/docs/rest-api\">完整文件 →</a>",
    "publish.bots.snippet_shot_caption_html": "同一份廣告,三種原生訊息格式。helper 函式庫(<code>lumi-discord</code>、<code>lumi-telegram</code>、<code>lumi-slack</code>)負責平台特定的格式化。",

    "publish.bots.who_eyebrow": "適合誰",
    "publish.bots.who_h2": "如果你的 bot 活在聊天平台上,這就是你的路徑。",
    "publish.bots.who_li1": "你做了一個 Discord、Telegram 或 Slack 上的 AI bot。",
    "publish.bots.who_li2": "範例:研究 bot、摘要 bot、圖像生成 bot、生產力助手、客服 bot。",
    "publish.bots.who_li3": "你想要不需要 paywall 的變現方式 — 你的社群免費用,你從廣告賺取收益。",
    "publish.bots.who_li4": "你受夠了「請我在 Buy Me a Coffee 上喝杯咖啡」是唯一的選項。",

    "publish.bots.rev_eyebrow": "收益範例",
    "publish.bots.rev_h2": "15,000 日活躍能賺多少。",
    "publish.bots.rev_label": "僅供示意 — 不構成保證",
    "publish.bots.rev_row1": "日活躍使用者",
    "publish.bots.rev_row2": "每位使用者每日廣告曝光數",
    "publish.bots.rev_row3": "每日曝光數",
    "publish.bots.rev_row4": "CPM(依平台而異)",
    "publish.bots.rev_row5": "每月發布商收益",
    "publish.bots.rev_disclaimer": "數字僅為示意,以活躍度中等的社群 bot 為基準。CPM 因平台差異很大 — Slack 的職場受眾出價更高,Telegram 的消費受眾較低。垂直領域與語言也有影響;英文生產力 bot 位於高端區間。",

    "publish.bots.faq_eyebrow": "常見問題",
    "publish.bots.faq_h2": "每位 bot 開發者都會問的問題。",
    "publish.bots.faq1_q": "這會違反 Discord / Telegram / Slack 的 ToS 嗎?",
    "publish.bots.faq1_a": "Lumi 的設計就考量 ToS 合規。Discord 要求清楚的廣告揭露;我們以 「Sponsored」前綴搭配你在儀表板配置的揭露標籤處理。Telegram 與 Slack 政策較寬鬆,但我們仍依循最佳實踐。",
    "publish.bots.faq2_q": "我可以投放圖片廣告,而不只是文字嗎?",
    "publish.bots.faq2_a": "可以。Discord embed 支援圖片欄位;Telegram 支援 inline 媒體;Slack block 支援 image accessory 元件。helper 函式庫會將同一份廣告內容對應到你所在平台採用的格式。",
    "publish.bots.faq3_q": "非英文 bot 呢?",
    "publish.bots.faq3_a": "Boost Boss 提供 40+ 語言的廣告服務。CPM 因市場而異 — 大盤的 EN、ES、JA 市場出價最高;小語種庫存仍會填,只是價格較低。",
    "publish.bots.faq4_q": "我需要自己處理點擊追蹤嗎?",
    "publish.bots.faq4_a_html": "不需要。使用我們在每則廣告回應中回傳的 <code>click_url</code> — 追蹤邏輯內建於該重新導向之中。曝光追蹤透過 <code>impression_url</code>,同理。",
    "publish.bots.faq5_q": "速率限制是多少?",
    "publish.bots.faq5_a": "上線時每位發布商每分鐘 1,000 次廣告請求。已驗證量體的發布商可放寬;接近上限請告訴我們。",

    "publish.bots.cta_h2": "準備好讓你的 bot 變現了嗎?",
    "publish.bots.cta_p": "一次 REST 呼叫。helper 函式庫隨附。每週撥款。",
    "publish.bots.cta_btn": "申請成為創始發布商 →",
}

JA = {
    "publish.bots.hero_eyebrow": "AI ボット開発者向け",
    "publish.bots.hero_h1_html": "あなたの AI ボットを <span class=\"grad\">収益を生むビジネス</span> に。",
    "publish.bots.hero_sub": "Lumi API for Bots — ボットの応答ハンドラから 1 回の REST 呼び出し。Discord、Telegram、Slack、そしてボットが住むあらゆるプラットフォームで動作。任意の LLM、任意のフレームワーク。プラットフォーム別ヘルパーライブラリも任意で利用可。",
    "publish.bots.hero_cta": "パブリッシャーとして始める →",

    "publish.bots.see_eyebrow": "実際の見え方",
    "publish.bots.see_h2_html": "あなたのボットがまず返信。<br>スポンサーメッセージはその直後に届きます。",
    "publish.bots.see_sub": "同じキャンペーンが Discord、Telegram、Slack でネイティブに描画 — プラットフォームに応じて embed、card、attachment。ヘルパーライブラリが整形を担当します。",
    "publish.bots.see_caption": "ここではスマホ型の Telegram プレビューを表示。同じ Lumi API for Bots レスポンスを Discord embed、Slack attachment、Telegram card に整形可能 — 下の静的プレビューで 3 つを横並びで確認できます。",

    "publish.bots.how_eyebrow": "仕組み",
    "publish.bots.how_h2": "API キー取得から初回広告まで 10 分。",
    "publish.bots.how1_h4": "API キーを取得",
    "publish.bots.how1_p": "登録して、ダッシュボードから bearer トークンをコピー。1 つのトークンで任意のプラットフォームに対応。",
    "publish.bots.how2_h4": "Boost Boss を呼ぶ",
    "publish.bots.how2_p_html": "ボットの応答ハンドラから <code>POST /v1/ad-request</code> を呼び、ユーザーのクエリをコンテキストとして渡します。",
    "publish.bots.how3_h4": "整形して送信",
    "publish.bots.how3_p_html": "ヘルパーライブラリ(<code>lumi-discord</code>、<code>lumi-telegram</code>、<code>lumi-slack</code>)を使ってレスポンスをネイティブメッセージ形式に変換。",

    "publish.bots.snippet_eyebrow": "統合スニペット",
    "publish.bots.snippet_h2": "数行で、既存ハンドラに。",
    "publish.bots.snippet_caption_html": "任意のヘルパーライブラリ(<code>lumi-discord</code>、<code>lumi-telegram</code>、<code>lumi-slack</code>)は Lumi API for Bots の便利ラッパー — 広告ペイロードを各プラットフォームのネイティブメッセージ型に整形します。依存を増やしたくなければスキップして、自前で整形しても OK。<a href=\"/docs/rest-api\">完全ドキュメント →</a>",
    "publish.bots.snippet_shot_caption_html": "同じキャンペーン、3 つのネイティブメッセージ形式。ヘルパーライブラリ(<code>lumi-discord</code>、<code>lumi-telegram</code>、<code>lumi-slack</code>)がプラットフォーム固有の整形を担当します。",

    "publish.bots.who_eyebrow": "向いている人",
    "publish.bots.who_h2": "ボットがチャットプラットフォームに住んでいるなら、これがあなたの道です。",
    "publish.bots.who_li1": "Discord、Telegram、Slack のいずれかで AI ボットを出している。",
    "publish.bots.who_li2": "例: リサーチボット、要約ボット、画像生成ボット、生産性アシスタント、カスタマーサポートボット。",
    "publish.bots.who_li3": "ペイウォール不要のマネタイズを望む — コミュニティは無料で使い、あなたは広告で稼ぐ。",
    "publish.bots.who_li4": "「Buy Me a Coffee でチップください」しか選択肢がないのにうんざりしている。",

    "publish.bots.rev_eyebrow": "収益例",
    "publish.bots.rev_h2": "1 日 15,000 ユーザーで得られる収益。",
    "publish.bots.rev_label": "あくまで例 — 保証ではありません",
    "publish.bots.rev_row1": "日次アクティブユーザー",
    "publish.bots.rev_row2": "1 ユーザー 1 日あたりの広告インプレッション",
    "publish.bots.rev_row3": "日次インプレッション",
    "publish.bots.rev_row4": "CPM(プラットフォーム別)",
    "publish.bots.rev_row5": "月間パブリッシャー収益",
    "publish.bots.rev_disclaimer": "数値は中程度に活発なコミュニティボットを想定した例示です。CPM はプラットフォーム差が大きく — Slack の職場オーディエンスは高く、Telegram の消費者オーディエンスは低め。分野と言語も影響します; 英語の生産性ボットはレンジの上端に位置します。",

    "publish.bots.faq_eyebrow": "よくある質問",
    "publish.bots.faq_h2": "ボット開発者が必ず聞く質問。",
    "publish.bots.faq1_q": "Discord / Telegram / Slack の ToS に違反しますか?",
    "publish.bots.faq1_a": "Lumi は ToS 準拠を前提に設計されています。Discord は明確な広告開示を要求しており、我々は「Sponsored」プレフィックスと、ダッシュボードで設定した開示ラベルで対応します。Telegram と Slack のポリシーはより緩いですが、我々は変わらずベストプラクティスに従います。",
    "publish.bots.faq2_q": "テキストだけでなく画像広告も配信できますか?",
    "publish.bots.faq2_a": "はい。Discord embed は画像フィールドをサポート; Telegram は inline メディア; Slack の block は image accessory コンポーネントをサポート。ヘルパーライブラリが 1 つの広告ペイロードを使うプラットフォームの形式へマッピングします。",
    "publish.bots.faq3_q": "英語以外のボットはどうですか?",
    "publish.bots.faq3_a": "Boost Boss は 40 以上の言語で広告を配信。CPM は市場で異なり — 大規模な EN、ES、JA 市場は最も高く支払われ; マイナー言語の在庫もフィルされますが、レートは低めです。",
    "publish.bots.faq4_q": "クリックトラッキングは自分で実装する必要がありますか?",
    "publish.bots.faq4_a_html": "いいえ。各広告レスポンスで返す <code>click_url</code> を使ってください — そのリダイレクトにトラッキングが組み込まれています。インプレッショントラッキングは <code>impression_url</code> で同様です。",
    "publish.bots.faq5_q": "レートリミットは?",
    "publish.bots.faq5_a": "ローンチ時はパブリッシャーあたり 1 分間に 1,000 広告リクエスト。検証済みボリュームのパブリッシャーには引き上げ可; 上限が近づいたら教えてください。",

    "publish.bots.cta_h2": "ボットで収益化する準備はできましたか?",
    "publish.bots.cta_p": "1 回の REST 呼び出し。ヘルパーライブラリ付属。週次支払い。",
    "publish.bots.cta_btn": "ファウンディングパブリッシャーとして申し込む →",
}

KO = {
    "publish.bots.hero_eyebrow": "AI 봇 개발자용",
    "publish.bots.hero_h1_html": "당신의 AI 봇을 <span class=\"grad\">수익을 만드는 비즈니스</span>로.",
    "publish.bots.hero_sub": "Lumi API for Bots — 봇의 응답 핸들러에서 REST 호출 한 번. Discord, Telegram, Slack 그리고 봇이 사는 모든 플랫폼에서 작동. 어떤 LLM이든, 어떤 프레임워크든. 플랫폼별 헬퍼 라이브러리는 선택 사항.",
    "publish.bots.hero_cta": "퍼블리셔로 시작하기 →",

    "publish.bots.see_eyebrow": "이렇게 보입니다",
    "publish.bots.see_h2_html": "당신의 봇이 먼저 답합니다.<br>스폰서 메시지는 바로 뒤따라옵니다.",
    "publish.bots.see_sub": "동일한 캠페인이 Discord, Telegram, Slack에서 네이티브로 렌더링 — 플랫폼에 따라 embed, card 또는 attachment. 헬퍼 라이브러리가 포맷팅을 처리합니다.",
    "publish.bots.see_caption": "여기서는 폰 형태의 Telegram 미리보기를 보여줍니다. 동일한 Lumi API for Bots 응답을 Discord embed, Slack attachment 또는 Telegram card로 포맷팅 가능 — 아래 정적 미리보기에서 세 가지를 나란히 확인할 수 있습니다.",

    "publish.bots.how_eyebrow": "동작 방식",
    "publish.bots.how_h2": "API 키부터 첫 광고까지 10분.",
    "publish.bots.how1_h4": "API 키 받기",
    "publish.bots.how1_p": "가입하고 대시보드에서 bearer 토큰을 복사. 토큰 하나로 모든 플랫폼에서 작동.",
    "publish.bots.how2_h4": "Boost Boss 호출",
    "publish.bots.how2_p_html": "봇의 응답 핸들러 안에서 <code>POST /v1/ad-request</code>를 호출하고 사용자의 쿼리를 컨텍스트로 전달.",
    "publish.bots.how3_h4": "포맷팅해서 전송",
    "publish.bots.how3_p_html": "헬퍼 라이브러리(<code>lumi-discord</code>, <code>lumi-telegram</code>, <code>lumi-slack</code>)로 응답을 네이티브 메시지 포맷으로 변환.",

    "publish.bots.snippet_eyebrow": "통합 스니펫",
    "publish.bots.snippet_h2": "몇 줄, 기존 핸들러에 추가.",
    "publish.bots.snippet_caption_html": "선택 사항인 헬퍼 라이브러리(<code>lumi-discord</code>, <code>lumi-telegram</code>, <code>lumi-slack</code>)는 Lumi API for Bots를 감싸는 편의 래퍼 — 광고 페이로드를 각 플랫폼의 네이티브 메시지 타입으로 포맷팅합니다. 의존성을 추가하기 싫다면 건너뛰고 직접 포맷팅해도 됩니다. <a href=\"/docs/rest-api\">전체 문서 →</a>",
    "publish.bots.snippet_shot_caption_html": "동일한 캠페인, 세 가지 네이티브 메시지 포맷. 헬퍼 라이브러리(<code>lumi-discord</code>, <code>lumi-telegram</code>, <code>lumi-slack</code>)가 플랫폼별 포맷팅을 담당합니다.",

    "publish.bots.who_eyebrow": "이런 분에게 맞습니다",
    "publish.bots.who_h2": "봇이 채팅 플랫폼에 산다면 이게 경로입니다.",
    "publish.bots.who_li1": "Discord, Telegram 또는 Slack에 AI 봇을 배포했다.",
    "publish.bots.who_li2": "예: 리서치 봇, 요약 봇, 이미지 생성 봇, 생산성 어시스턴트, 고객 지원 봇.",
    "publish.bots.who_li3": "페이월 없이 수익화하고 싶다 — 커뮤니티는 무료로 쓰고, 당신은 광고로 번다.",
    "publish.bots.who_li4": "\"Buy Me a Coffee에서 팁 주세요\"가 유일한 옵션인 것에 지쳤다.",

    "publish.bots.rev_eyebrow": "수익 예시",
    "publish.bots.rev_h2": "일 15,000 사용자가 벌 수 있는 금액.",
    "publish.bots.rev_label": "예시일 뿐 — 보장이 아닙니다",
    "publish.bots.rev_row1": "일일 활성 사용자",
    "publish.bots.rev_row2": "사용자당 일일 광고 임프레션",
    "publish.bots.rev_row3": "일일 임프레션",
    "publish.bots.rev_row4": "CPM(플랫폼에 따라 다름)",
    "publish.bots.rev_row5": "월간 퍼블리셔 수익",
    "publish.bots.rev_disclaimer": "수치는 중간 정도 활동성을 가진 커뮤니티 봇을 가정한 예시입니다. CPM은 플랫폼별로 차이가 큽니다 — Slack 직장 오디언스는 더 높고, Telegram 소비자 오디언스는 낮은 편. 버티컬과 언어도 중요하며, 영어 생산성 봇이 상단에 위치합니다.",

    "publish.bots.faq_eyebrow": "자주 묻는 질문",
    "publish.bots.faq_h2": "모든 봇 개발자가 묻는 질문.",
    "publish.bots.faq1_q": "이게 Discord / Telegram / Slack의 ToS를 위반하나요?",
    "publish.bots.faq1_a": "Lumi는 ToS 준수를 전제로 설계됐습니다. Discord는 명확한 광고 공개를 요구하며, 우리는 \"Sponsored\" 접두사와 당신이 대시보드에서 설정한 공개 라벨로 이를 처리합니다. Telegram과 Slack의 정책은 더 느슨하지만 우리는 똑같이 베스트 프랙티스를 따릅니다.",
    "publish.bots.faq2_q": "텍스트 외에 이미지 광고도 가능한가요?",
    "publish.bots.faq2_a": "네. Discord embed는 이미지 필드를 지원하고, Telegram은 인라인 미디어를 지원하며, Slack block은 image accessory 컴포넌트를 지원합니다. 헬퍼 라이브러리가 단일 광고 페이로드를 당신 플랫폼이 쓰는 형식으로 매핑해줍니다.",
    "publish.bots.faq3_q": "영어가 아닌 봇은요?",
    "publish.bots.faq3_a": "Boost Boss는 40여 개 언어로 광고를 제공합니다. CPM은 시장별로 다르며 — 큰 EN, ES, JA 시장이 가장 높은 단가; 소언어 인벤토리도 채워지지만 단가는 낮은 편.",
    "publish.bots.faq4_q": "클릭 트래킹을 직접 처리해야 하나요?",
    "publish.bots.faq4_a_html": "아니요. 모든 광고 응답에서 반환되는 <code>click_url</code>을 쓰세요 — 트래킹이 그 리다이렉트에 내장돼 있습니다. 임프레션 트래킹은 <code>impression_url</code>로 동일하게 처리됩니다.",
    "publish.bots.faq5_q": "Rate limit은 어떻게 되나요?",
    "publish.bots.faq5_a": "런치 시점에 퍼블리셔당 분당 1,000건의 광고 요청. 검증된 볼륨의 퍼블리셔에게는 상향 — 한계에 가까워지면 알려주세요.",

    "publish.bots.cta_h2": "봇으로 수익화할 준비가 되셨나요?",
    "publish.bots.cta_p": "REST 호출 한 번. 헬퍼 라이브러리 포함. 주간 정산.",
    "publish.bots.cta_btn": "파운딩 퍼블리셔로 신청하기 →",
}

VI = {
    "publish.bots.hero_eyebrow": "Dành cho nhà phát triển bot AI",
    "publish.bots.hero_h1_html": "Biến bot AI của bạn thành <span class=\"grad\">một mảng kinh doanh có doanh thu</span>.",
    "publish.bots.hero_sub": "Lumi API for Bots — một REST call từ response handler của bot. Hoạt động với Discord, Telegram, Slack và mọi platform bot của bạn ở. Bất kỳ LLM nào. Bất kỳ framework nào. Helper library theo platform là tùy chọn.",
    "publish.bots.hero_cta": "Bắt đầu với tư cách publisher →",

    "publish.bots.see_eyebrow": "Xem nó xuất hiện",
    "publish.bots.see_h2_html": "Bot của bạn trả lời trước.<br>Tin nhắn sponsored đến ngay sau.",
    "publish.bots.see_sub": "Cùng một campaign render native trên Discord, Telegram và Slack — embed, card hoặc attachment, tùy platform. Helper libs xử lý formatting.",
    "publish.bots.see_caption": "Đây là preview hình điện thoại của Telegram. Cùng một response Lumi API for Bots có thể format thành Discord embed, Slack attachment hoặc Telegram card — xem preview tĩnh bên dưới có cả ba cạnh nhau.",

    "publish.bots.how_eyebrow": "Cách hoạt động",
    "publish.bots.how_h2": "Từ API key đến quảng cáo đầu tiên trong mười phút.",
    "publish.bots.how1_h4": "Lấy API key của bạn",
    "publish.bots.how1_p": "Đăng ký, sao chép bearer token từ dashboard. Một token chạy được với mọi platform.",
    "publish.bots.how2_h4": "Gọi Boost Boss",
    "publish.bots.how2_p_html": "Gọi <code>POST /v1/ad-request</code> từ trong response handler của bot, truyền query của user làm context.",
    "publish.bots.how3_h4": "Format và gửi",
    "publish.bots.how3_p_html": "Dùng helper libs của chúng tôi (<code>lumi-discord</code>, <code>lumi-telegram</code>, <code>lumi-slack</code>) để chuyển response sang định dạng tin nhắn native.",

    "publish.bots.snippet_eyebrow": "Đoạn code tích hợp",
    "publish.bots.snippet_h2": "Vài dòng, handler hiện có của bạn.",
    "publish.bots.snippet_caption_html": "Helper library tùy chọn (<code>lumi-discord</code>, <code>lumi-telegram</code>, <code>lumi-slack</code>) là wrapper tiện lợi quanh Lumi API for Bots — format payload quảng cáo theo loại tin nhắn native của từng platform. Bỏ qua chúng và tự viết formatting nếu bạn không muốn thêm dependency. <a href=\"/docs/rest-api\">Tài liệu đầy đủ →</a>",
    "publish.bots.snippet_shot_caption_html": "Cùng campaign, ba định dạng tin nhắn native. Helper libs (<code>lumi-discord</code>, <code>lumi-telegram</code>, <code>lumi-slack</code>) xử lý formatting đặc thù từng platform.",

    "publish.bots.who_eyebrow": "Dành cho ai",
    "publish.bots.who_h2": "Nếu bot của bạn sống trong nền tảng chat, đây là đường của bạn.",
    "publish.bots.who_li1": "Bạn đã ship một bot AI trên Discord, Telegram hoặc Slack.",
    "publish.bots.who_li2": "Ví dụ: bot nghiên cứu, bot tóm tắt, bot tạo ảnh, trợ lý năng suất, bot hỗ trợ khách hàng.",
    "publish.bots.who_li3": "Bạn muốn cách kiếm tiền không cần paywall — community dùng miễn phí, bạn kiếm từ quảng cáo.",
    "publish.bots.who_li4": "Bạn mệt mỏi vì \"tip tôi trên Buy Me a Coffee\" là lựa chọn duy nhất.",

    "publish.bots.rev_eyebrow": "Ví dụ doanh thu",
    "publish.bots.rev_h2": "15,000 người dùng mỗi ngày có thể kiếm được bao nhiêu.",
    "publish.bots.rev_label": "Chỉ mang tính minh họa — không phải cam kết",
    "publish.bots.rev_row1": "Người dùng hoạt động mỗi ngày",
    "publish.bots.rev_row2": "Impression quảng cáo trên mỗi người dùng mỗi ngày",
    "publish.bots.rev_row3": "Impression mỗi ngày",
    "publish.bots.rev_row4": "CPM (khác nhau theo platform)",
    "publish.bots.rev_row5": "Doanh thu publisher hàng tháng",
    "publish.bots.rev_disclaimer": "Con số mang tính minh họa cho bot community hoạt động ở mức trung bình. CPM khác nhau lớn theo platform — audience workplace Slack trả cao hơn, audience tiêu dùng Telegram thấp hơn. Vertical và ngôn ngữ cũng có ảnh hưởng; bot năng suất tiếng Anh ở đầu khoảng giá.",

    "publish.bots.faq_eyebrow": "Câu hỏi thường gặp",
    "publish.bots.faq_h2": "Những câu mà mọi dev bot đều hỏi.",
    "publish.bots.faq1_q": "Cái này có vi phạm ToS của Discord / Telegram / Slack không?",
    "publish.bots.faq1_a": "Lumi được thiết kế để tuân thủ ToS. Discord yêu cầu công khai quảng cáo rõ ràng; chúng tôi xử lý bằng tiền tố \"Sponsored\" và nhãn công khai bạn cấu hình trong dashboard. Telegram và Slack có chính sách lỏng hơn nhưng chúng tôi vẫn tuân thủ best practice.",
    "publish.bots.faq2_q": "Tôi có thể chạy quảng cáo hình ảnh, không chỉ text không?",
    "publish.bots.faq2_a": "Có. Discord embed hỗ trợ trường ảnh; Telegram hỗ trợ inline media; Slack block hỗ trợ component image accessory. Helper library map cùng một payload quảng cáo sang định dạng mà platform của bạn dùng.",
    "publish.bots.faq3_q": "Bot không phải tiếng Anh thì sao?",
    "publish.bots.faq3_a": "Boost Boss phục vụ quảng cáo bằng hơn 40 ngôn ngữ. CPM khác nhau theo thị trường — thị trường lớn EN, ES, JA trả cao nhất; inventory tiếng nhỏ vẫn lấp đầy nhưng giá thấp hơn.",
    "publish.bots.faq4_q": "Tôi có cần tự xử lý click tracking không?",
    "publish.bots.faq4_a_html": "Không. Dùng <code>click_url</code> mà chúng tôi trả về trong mỗi response quảng cáo — tracking được tích hợp sẵn trong redirect đó. Impression tracking qua <code>impression_url</code>, tương tự.",
    "publish.bots.faq5_q": "Rate limit là bao nhiêu?",
    "publish.bots.faq5_a": "Khi launch, 1,000 ad request mỗi phút trên mỗi publisher. Chúng tôi nâng lên cho publisher đã verify volume; báo chúng tôi nếu bạn sắp chạm giới hạn.",

    "publish.bots.cta_h2": "Sẵn sàng kiếm tiền từ bot của bạn?",
    "publish.bots.cta_p": "Một REST call. Helper library kèm theo. Thanh toán hàng tuần.",
    "publish.bots.cta_btn": "Đăng ký làm Founding Publisher →",
}

DICTS = {"en": EN, "zh": ZH, "zh-TW": ZH_TW, "ja": JA, "ko": KO, "vi": VI}

HTML_PATCHES = [
    ('<a href="/publish/mcp">MCP Servers</a>',
     '<a href="/publish/mcp" data-i18n="subnav.mcp">MCP Servers</a>'),
    ('<a href="/publish/ai-apps">AI Apps</a>',
     '<a href="/publish/ai-apps" data-i18n="subnav.ai_apps">AI Apps</a>'),
    ('<a href="/publish/extensions">Extensions</a>',
     '<a href="/publish/extensions" data-i18n="subnav.extensions">Extensions</a>'),
    ('<a href="/publish/bots" class="active">Bots</a>',
     '<a href="/publish/bots" class="active" data-i18n="subnav.bots">Bots</a>'),
    ('<a href="/publish/no-code">Custom GPTs</a>',
     '<a href="/publish/no-code" data-i18n="subnav.no_code">Custom GPTs</a>'),
    ('<a class="btn btn-primary" href="/publish/signup">Start earning</a>',
     '<a class="btn btn-primary" href="/publish/signup" data-i18n="publish.cta.start_earning">Start earning</a>'),

    ('<span class="eyebrow">For AI Bot Developers</span>',
     '<span class="eyebrow" data-i18n="publish.bots.hero_eyebrow">For AI Bot Developers</span>'),
    ('<h1>Turn your AI bot into a <span class="grad">revenue-generating business</span>.</h1>',
     '<h1 data-i18n="publish.bots.hero_h1_html" data-i18n-html>Turn your AI bot into a <span class="grad">revenue-generating business</span>.</h1>'),
    ('<p class="sub">Lumi API for Bots — one REST call from your bot\'s response handler. Works with Discord, Telegram, Slack, and any platform your bot lives on. Any LLM. Any framework. Optional per-platform helper libraries available.</p>',
     '<p class="sub" data-i18n="publish.bots.hero_sub">Lumi API for Bots — one REST call from your bot\'s response handler. Works with Discord, Telegram, Slack, and any platform your bot lives on. Any LLM. Any framework. Optional per-platform helper libraries available.</p>'),
    ('<a class="btn btn-primary btn-lg" href="/publish/signup">Start as a publisher →</a>',
     '<a class="btn btn-primary btn-lg" href="/publish/signup" data-i18n="publish.bots.hero_cta">Start as a publisher →</a>'),

    ('<span class="section-eyebrow">See it appear</span>',
     '<span class="section-eyebrow" data-i18n="publish.bots.see_eyebrow">See it appear</span>'),
    ('<h2 class="section-h">Your bot replies first.<br>The sponsored message arrives right after.</h2>',
     '<h2 class="section-h" data-i18n="publish.bots.see_h2_html" data-i18n-html>Your bot replies first.<br>The sponsored message arrives right after.</h2>'),
    ('<p class="section-sub">Same campaign renders natively on Discord, Telegram, and Slack — embed, card, or attachment, depending on the platform. Helper libs handle the formatting.</p>',
     '<p class="section-sub" data-i18n="publish.bots.see_sub">Same campaign renders natively on Discord, Telegram, and Slack — embed, card, or attachment, depending on the platform. Helper libs handle the formatting.</p>'),
    ('<div class="stage-caption">Phone-shaped Telegram preview shown here. The same Lumi API for Bots response can be formatted as a Discord embed, Slack attachment, or Telegram card — see the static preview below for all three side-by-side.</div>',
     '<div class="stage-caption" data-i18n="publish.bots.see_caption">Phone-shaped Telegram preview shown here. The same Lumi API for Bots response can be formatted as a Discord embed, Slack attachment, or Telegram card — see the static preview below for all three side-by-side.</div>'),

    ('<span class="section-eyebrow">How it works</span>',
     '<span class="section-eyebrow" data-i18n="publish.bots.how_eyebrow">How it works</span>'),
    ('<h2 class="section-h">From API key to first ad in ten minutes.</h2>',
     '<h2 class="section-h" data-i18n="publish.bots.how_h2">From API key to first ad in ten minutes.</h2>'),
    ('<h4>Get your API key</h4>',
     '<h4 data-i18n="publish.bots.how1_h4">Get your API key</h4>'),
    ('<p>Sign up, copy your bearer token from the dashboard. One token works for any platform.</p>',
     '<p data-i18n="publish.bots.how1_p">Sign up, copy your bearer token from the dashboard. One token works for any platform.</p>'),
    ('<h4>Call Boost Boss</h4>',
     '<h4 data-i18n="publish.bots.how2_h4">Call Boost Boss</h4>'),
    ('<p>Hit <code>POST /v1/ad-request</code> from inside your bot\'s response handler with the user\'s query as context.</p>',
     '<p data-i18n="publish.bots.how2_p_html" data-i18n-html>Hit <code>POST /v1/ad-request</code> from inside your bot\'s response handler with the user\'s query as context.</p>'),
    ('<h4>Format and send</h4>',
     '<h4 data-i18n="publish.bots.how3_h4">Format and send</h4>'),
    ('<p>Use our helper libs (<code>lumi-discord</code>, <code>lumi-telegram</code>, <code>lumi-slack</code>) to convert the response to native message format.</p>',
     '<p data-i18n="publish.bots.how3_p_html" data-i18n-html>Use our helper libs (<code>lumi-discord</code>, <code>lumi-telegram</code>, <code>lumi-slack</code>) to convert the response to native message format.</p>'),

    ('<span class="section-eyebrow">Integration snippet</span>',
     '<span class="section-eyebrow" data-i18n="publish.bots.snippet_eyebrow">Integration snippet</span>'),
    ('<h2 class="section-h">A few lines, your existing handler.</h2>',
     '<h2 class="section-h" data-i18n="publish.bots.snippet_h2">A few lines, your existing handler.</h2>'),
    ('<p class="code-caption">Optional helper libraries (<code>lumi-discord</code>, <code>lumi-telegram</code>, <code>lumi-slack</code>) are convenience wrappers around the Lumi API for Bots — they format the ad payload into each platform\'s native message type. Skip them and roll your own formatting if you\'d rather not add a dependency. <a href="/docs/rest-api">Full docs →</a></p>',
     '<p class="code-caption" data-i18n="publish.bots.snippet_caption_html" data-i18n-html>Optional helper libraries (<code>lumi-discord</code>, <code>lumi-telegram</code>, <code>lumi-slack</code>) are convenience wrappers around the Lumi API for Bots — they format the ad payload into each platform\'s native message type. Skip them and roll your own formatting if you\'d rather not add a dependency. <a href="/docs/rest-api">Full docs →</a></p>'),
    ('<div class="shot-caption">Same campaign, three native message formats. The helper libs (<code>lumi-discord</code>, <code>lumi-telegram</code>, <code>lumi-slack</code>) handle the platform-specific formatting.</div>',
     '<div class="shot-caption" data-i18n="publish.bots.snippet_shot_caption_html" data-i18n-html>Same campaign, three native message formats. The helper libs (<code>lumi-discord</code>, <code>lumi-telegram</code>, <code>lumi-slack</code>) handle the platform-specific formatting.</div>'),

    ('<span class="section-eyebrow">Who this is for</span>',
     '<span class="section-eyebrow" data-i18n="publish.bots.who_eyebrow">Who this is for</span>'),
    ('<h2 class="section-h">If your bot lives in a chat platform, this is your path.</h2>',
     '<h2 class="section-h" data-i18n="publish.bots.who_h2">If your bot lives in a chat platform, this is your path.</h2>'),
    ('<li><span class="check">✓</span><span>You shipped an AI bot on Discord, Telegram, or Slack.</span></li>',
     '<li><span class="check">✓</span><span data-i18n="publish.bots.who_li1">You shipped an AI bot on Discord, Telegram, or Slack.</span></li>'),
    ('<li><span class="check">✓</span><span>Examples: research bots, summarization bots, image generation bots, productivity assistants, customer support bots.</span></li>',
     '<li><span class="check">✓</span><span data-i18n="publish.bots.who_li2">Examples: research bots, summarization bots, image generation bots, productivity assistants, customer support bots.</span></li>'),
    ('<li><span class="check">✓</span><span>You want monetization that doesn\'t require a paywall — your community uses it free, you earn from ads.</span></li>',
     '<li><span class="check">✓</span><span data-i18n="publish.bots.who_li3">You want monetization that doesn\'t require a paywall — your community uses it free, you earn from ads.</span></li>'),
    ('<li><span class="check">✓</span><span>You\'re tired of "tip me on Buy Me a Coffee" being your only option.</span></li>',
     '<li><span class="check">✓</span><span data-i18n="publish.bots.who_li4">You\'re tired of "tip me on Buy Me a Coffee" being your only option.</span></li>'),

    ('<span class="section-eyebrow">Revenue example</span>',
     '<span class="section-eyebrow" data-i18n="publish.bots.rev_eyebrow">Revenue example</span>'),
    ('<h2 class="section-h">What 15,000 daily users can earn.</h2>',
     '<h2 class="section-h" data-i18n="publish.bots.rev_h2">What 15,000 daily users can earn.</h2>'),
    ('<span class="label">Illustrative — not a guarantee</span>',
     '<span class="label" data-i18n="publish.bots.rev_label">Illustrative — not a guarantee</span>'),
    ('<div class="rev-row"><span>Daily active users</span><span class="v">15,000</span></div>',
     '<div class="rev-row"><span data-i18n="publish.bots.rev_row1">Daily active users</span><span class="v">15,000</span></div>'),
    ('<div class="rev-row"><span>Ad impressions per user per day</span><span class="v">~1.5</span></div>',
     '<div class="rev-row"><span data-i18n="publish.bots.rev_row2">Ad impressions per user per day</span><span class="v">~1.5</span></div>'),
    ('<div class="rev-row"><span>Daily impressions</span><span class="v">22,500</span></div>',
     '<div class="rev-row"><span data-i18n="publish.bots.rev_row3">Daily impressions</span><span class="v">22,500</span></div>'),
    ('<div class="rev-row"><span>CPM (varies by platform)</span><span class="v">$2</span></div>',
     '<div class="rev-row"><span data-i18n="publish.bots.rev_row4">CPM (varies by platform)</span><span class="v">$2</span></div>'),
    ('<div class="rev-row"><span>Monthly publisher revenue</span><span class="v">~$1,350</span></div>',
     '<div class="rev-row"><span data-i18n="publish.bots.rev_row5">Monthly publisher revenue</span><span class="v">~$1,350</span></div>'),
    ('<p class="disclaimer">Numbers are illustrative for a moderately-active community bot. CPMs vary widely by platform — Slack workplace audiences pay more, Telegram consumer audiences less. Vertical and language also matter; English-language productivity bots sit at the top of the range.</p>',
     '<p class="disclaimer" data-i18n="publish.bots.rev_disclaimer">Numbers are illustrative for a moderately-active community bot. CPMs vary widely by platform — Slack workplace audiences pay more, Telegram consumer audiences less. Vertical and language also matter; English-language productivity bots sit at the top of the range.</p>'),

    ('<span class="section-eyebrow">Frequently asked</span>',
     '<span class="section-eyebrow" data-i18n="publish.bots.faq_eyebrow">Frequently asked</span>'),
    ('<h2 class="section-h">The questions every bot dev asks.</h2>',
     '<h2 class="section-h" data-i18n="publish.bots.faq_h2">The questions every bot dev asks.</h2>'),
    ('<h4>Will this violate Discord / Telegram / Slack ToS?</h4>',
     '<h4 data-i18n="publish.bots.faq1_q">Will this violate Discord / Telegram / Slack ToS?</h4>'),
    ('<p>Lumi is designed for ToS compliance. Discord requires clear ad disclosure; we handle that with a "Sponsored" prefix and the disclosure label you configured in your dashboard. Telegram and Slack have looser policies but we follow best practices regardless.</p>',
     '<p data-i18n="publish.bots.faq1_a">Lumi is designed for ToS compliance. Discord requires clear ad disclosure; we handle that with a "Sponsored" prefix and the disclosure label you configured in your dashboard. Telegram and Slack have looser policies but we follow best practices regardless.</p>'),
    ('<h4>Can I serve image ads, not just text?</h4>',
     '<h4 data-i18n="publish.bots.faq2_q">Can I serve image ads, not just text?</h4>'),
    ('<p>Yes. Discord embeds support image fields; Telegram supports inline media; Slack blocks support image accessory components. The helper libraries map a single ad payload to whichever format your platform uses.</p>',
     '<p data-i18n="publish.bots.faq2_a">Yes. Discord embeds support image fields; Telegram supports inline media; Slack blocks support image accessory components. The helper libraries map a single ad payload to whichever format your platform uses.</p>'),
    ('<h4>What about non-English bots?</h4>',
     '<h4 data-i18n="publish.bots.faq3_q">What about non-English bots?</h4>'),
    ('<p>Boost Boss serves ads in 40+ languages. CPMs vary by market — large EN, ES, JA markets pay best; smaller-language inventory still fills but at lower rates.</p>',
     '<p data-i18n="publish.bots.faq3_a">Boost Boss serves ads in 40+ languages. CPMs vary by market — large EN, ES, JA markets pay best; smaller-language inventory still fills but at lower rates.</p>'),
    ('<h4>Do I need to handle click tracking myself?</h4>',
     '<h4 data-i18n="publish.bots.faq4_q">Do I need to handle click tracking myself?</h4>'),
    ('<p>No. Use the <code>click_url</code> we return in every ad response — tracking is built into that redirect. Same for impression tracking via <code>impression_url</code>.</p>',
     '<p data-i18n="publish.bots.faq4_a_html" data-i18n-html>No. Use the <code>click_url</code> we return in every ad response — tracking is built into that redirect. Same for impression tracking via <code>impression_url</code>.</p>'),
    ('<h4>What\'s the rate limit?</h4>',
     '<h4 data-i18n="publish.bots.faq5_q">What\'s the rate limit?</h4>'),
    ('<p>1,000 ad requests per minute per publisher on launch. We raise that for verified-volume publishers; tell us if you\'re approaching the cap.</p>',
     '<p data-i18n="publish.bots.faq5_a">1,000 ad requests per minute per publisher on launch. We raise that for verified-volume publishers; tell us if you\'re approaching the cap.</p>'),

    ('<h2>Ready to monetize your bot?</h2>',
     '<h2 data-i18n="publish.bots.cta_h2">Ready to monetize your bot?</h2>'),
    ('<p>One REST call. Helper libraries included. Weekly payouts.</p>',
     '<p data-i18n="publish.bots.cta_p">One REST call. Helper libraries included. Weekly payouts.</p>'),
    ('<a class="btn btn-primary btn-lg" href="/publish/signup">Apply as a Founding Publisher →</a>',
     '<a class="btn btn-primary btn-lg" href="/publish/signup" data-i18n="publish.bots.cta_btn">Apply as a Founding Publisher →</a>'),

    # Footer
    ('<a href="/publish">Publishers</a>',
     '<a href="/publish" data-i18n="pubfoot.publishers">Publishers</a>'),
    ('<a href="/publish/mcp">MCP</a>',
     '<a href="/publish/mcp" data-i18n="subnav.mcp">MCP</a>'),
    ('<a href="/docs">Docs</a>',
     '<a href="/docs" data-i18n="pubfoot.docs">Docs</a>'),
    ('<a href="/trust">Trust</a>',
     '<a href="/trust" data-i18n="pubfoot.trust">Trust</a>'),
    ('<div class="footer-copy">© 2026 Boost Boss</div>',
     '<div class="footer-copy" data-i18n="pubfoot.copy">© 2026 Boost Boss</div>'),
]


def deep_set(d, dotted, value):
    parts = dotted.split('.')
    cur = d
    for p in parts[:-1]:
        if p not in cur or not isinstance(cur[p], dict):
            cur[p] = {}
        cur = cur[p]
    cur[parts[-1]] = value


def update_dictionary(lang, entries):
    path = os.path.join(I18N_DIR, f'{lang}.json')
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    for k, v in entries.items():
        deep_set(data, k, v)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')


def patch_html():
    with open(PAGE, 'r', encoding='utf-8') as f:
        html = f.read()
    applied, skipped = 0, []
    for old, new in HTML_PATCHES:
        if new in html:
            continue
        if old not in html:
            skipped.append(old[:80])
            continue
        html = html.replace(old, new, 1)
        applied += 1
    with open(PAGE, 'w', encoding='utf-8') as f:
        f.write(html)
    return applied, skipped


def main():
    applied, skipped = patch_html()
    print(f"{PAGE}: applied={applied} skipped={len(skipped)}")
    for s in skipped:
        print(f"  !! not found: {s}")
    for lang, entries in DICTS.items():
        update_dictionary(lang, entries)
        print(f"  + /i18n/{lang}.json (+{len(entries)} keys)")


if __name__ == '__main__':
    main()
