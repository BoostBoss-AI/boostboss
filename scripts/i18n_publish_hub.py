#!/usr/bin/env python3
"""
i18n tagger for /publish (the hub overview page).

What it does:
1. Tags every translatable string in public/publish.html with data-i18n attributes
2. Adds a `publish.hub.*` section to all 6 language dictionaries
   (en, zh, zh-TW, ja, ko, vi)

Run once. Idempotent: if the page already has the attributes (because we ran
this before), the html-tagging step will be a no-op.
"""
import json
import os
import re
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..'))
PAGE = os.path.join(ROOT, 'public', 'publish.html')
I18N_DIR = os.path.join(ROOT, 'public', 'i18n')

# ---------------------------------------------------------------------------
# 1) The full English source-of-truth dictionary for this page.
#    Keys map onto data-i18n attributes added below. `*_html` keys carry
#    embedded HTML and use data-i18n-html mode.
# ---------------------------------------------------------------------------
EN = {
    # Sub-nav (shared with sub-pages — namespaced as "subnav" so we can reuse)
    "subnav.mcp": "MCP Servers",
    "subnav.ai_apps": "AI Apps",
    "subnav.extensions": "Extensions",
    "subnav.bots": "Bots",
    "subnav.no_code": "Custom GPTs",

    # Nav CTA (shared across all 5 sub-pages too)
    "publish.cta.start_earning": "Start earning",

    # Hero
    "publish.hub.hero_h1_html": "Monetize your AI product,<br><span class=\"grad\">your way.</span>",
    "publish.hub.hero_sub": "Boost Boss is the ad network built for AI-native surfaces. One backend, four integration paths plus a no-code waitlist — wherever your AI lives, we serve.",
    "publish.hub.hero_cta": "Start as a publisher →",

    # Router section
    "publish.hub.router_eyebrow": "Which one are you?",
    "publish.hub.router_h2": "Pick the path that matches what you've built.",
    "publish.hub.router_sub": "Each integration is the simplest possible code in that ecosystem's idiom — three lines via Lumi SDK for MCP, one script tag via Lumi SDK script tag, an npm package via Lumi SDK for browser extensions, or a REST call via Lumi API for Bots.",

    "publish.hub.card_mcp_h3": "I built an MCP server",
    "publish.hub.card_mcp_p": "Stripe-MCP, Postgres-MCP, Filesystem-MCP, anything called from Claude Desktop, Cursor, Cline. Earn per tool call.",
    "publish.hub.card_mcp_arrow": "For MCP Server Developers",

    "publish.hub.card_ai_h3": "I built an AI app or website",
    "publish.hub.card_ai_p_html": "LangChain, Vercel AI SDK, CrewAI, custom OpenAI wrappers, vertical AI tools, AI assistants, AI search. One async script tag in your <code>&lt;head&gt;</code>.",
    "publish.hub.card_ai_arrow": "For AI App Builders",

    "publish.hub.card_ext_h3": "I built a browser extension",
    "publish.hub.card_ext_p": "Writing assistants, AI sidebars, summarizers, translators, Gmail copilots — Chrome, Edge, Firefox. Manifest v3 native, React + Vue bindings.",
    "publish.hub.card_ext_arrow": "For Browser Extension Developers",

    "publish.hub.card_bots_h3": "I built an AI bot",
    "publish.hub.card_bots_p": "Research bots, summarization bots, support bots, image-gen bots. One REST call from your handler, optional helper libraries per platform.",
    "publish.hub.card_bots_arrow": "For AI Bot Developers",

    "publish.hub.card_nocode_h3": "I built a Custom GPT or no-code AI",
    "publish.hub.card_nocode_p": "OpenAI Custom GPTs, Poe bots, Perplexity Pages, Voiceflow / Botpress / Stack AI builds — anywhere you authored the AI but the platform owns the runtime. We're shipping no-code monetization next.",
    "publish.hub.card_nocode_arrow_html": "For Custom GPT &amp; No-Code Authors",

    # Anchor card
    "publish.hub.anchor_h3": "Every door, one publisher account",
    "publish.hub.anchor_p_html": "One <code>publisher_id</code>, one Stripe Connect account, one weekly payout — across whichever doors you ship through.",
    "publish.hub.anchor_stat1_label": "revshare",
    "publish.hub.anchor_stat2_value": "Weekly",
    "publish.hub.anchor_stat2_label": "payouts",
    "publish.hub.anchor_stat3_value": "10 min",
    "publish.hub.anchor_stat3_label": "to live",

    # Why section
    "publish.hub.why_h2": "Why Boost Boss",
    "publish.hub.why1_h4": "85/15 revenue split",
    "publish.hub.why1_p": "You keep 85% of every dollar. Industry-leading and publisher-favorable, no matter your scale.",
    "publish.hub.why2_h4": "Built for AI context",
    "publish.hub.why2_p": "Contextual targeting from the conversation itself — never surveillance, never cross-site tracking.",
    "publish.hub.why3_h4": "Three SDKs, one API, plus a no-code path on the way",
    "publish.hub.why3_p_html": "Lumi SDK for MCP, Lumi SDK script tag, Lumi SDK for browser extensions, Lumi API for Bots — and a no-code integration coming for Custom GPT &amp; Poe authors. Same backend, same publisher account, same payouts across all paths.",
    "publish.hub.why4_h4": "Transparent reporting",
    "publish.hub.why4_p": "Live dashboard with impression-, click-, and revenue-level detail. Weekly Stripe payouts.",
    "publish.hub.why5_h4": "No long-term contracts",
    "publish.hub.why5_p": "Integrate in five minutes, leave any time. We earn the relationship every payout cycle.",

    # Not-a-fit
    "publish.hub.notfit_eyebrow": "Honest section",
    "publish.hub.notfit_h2": "Not a fit for",
    "publish.hub.notfit_intro_html": "A short list of who Boost Boss is <em>not</em> built for, so you don't waste your time. We'd rather lose the lead than waste your week.",
    "publish.hub.notfit_li1": "Mobile native iOS / Android apps — we don't do mobile SDKs; AppLovin and Unity own that lane and we don't compete there.",
    "publish.hub.notfit_li2": "Gambling, adult, or affiliate-spam verticals — both demand and supply side are filtered out at policy review.",
    "publish.hub.notfit_li3": "Surveillance-based ad networks — we don't share publisher inventory with retargeting tags or behavioral cookie networks.",

    # Footer CTA
    "publish.hub.footer_cta_h2": "Still not sure where you fit?",
    "publish.hub.footer_cta_p": "Tell us what you've built — we'll point you at the right integration.",
    "publish.hub.footer_cta_primary": "Start as a publisher",
    "publish.hub.footer_cta_ghost": "Talk to us",

    # Site footer (shared across all 6 publish pages)
    "pubfoot.docs": "Docs",
    "pubfoot.trust": "Trust",
    "pubfoot.copy": "© 2026 Boost Boss",
}

# ---------------------------------------------------------------------------
# 2) Translations for the other 5 languages.
#    Style: Taiwan Mandarin in zh-TW (網路, 程式碼, 使用者...). Mainland in zh.
# ---------------------------------------------------------------------------
ZH = {
    "subnav.mcp": "MCP 服务器",
    "subnav.ai_apps": "AI 应用",
    "subnav.extensions": "浏览器扩展",
    "subnav.bots": "机器人",
    "subnav.no_code": "Custom GPTs",

    "publish.cta.start_earning": "开始变现",

    "publish.hub.hero_h1_html": "用你的方式,<br>为 <span class=\"grad\">AI 产品变现。</span>",
    "publish.hub.hero_sub": "Boost Boss 是为 AI 原生界面打造的广告网络。一套后端,四条集成路径加一条无代码候补 — 你的 AI 在哪里,我们就服务到哪里。",
    "publish.hub.hero_cta": "开始变现 →",

    "publish.hub.router_eyebrow": "你属于哪一类?",
    "publish.hub.router_h2": "选一条最匹配你已构建产品的路径。",
    "publish.hub.router_sub": "每种集成都是该生态内最简单的代码 — MCP 用 Lumi SDK 三行、AI 应用用一个 script 标签、浏览器扩展用 npm 包、Bots 用一次 REST 调用。",

    "publish.hub.card_mcp_h3": "我做了一个 MCP 服务器",
    "publish.hub.card_mcp_p": "Stripe-MCP、Postgres-MCP、Filesystem-MCP — 任何被 Claude Desktop、Cursor、Cline 调用的工具。按工具调用次数赚钱。",
    "publish.hub.card_mcp_arrow": "MCP 服务器开发者",

    "publish.hub.card_ai_h3": "我做了一个 AI 应用或网站",
    "publish.hub.card_ai_p_html": "LangChain、Vercel AI SDK、CrewAI、自研 OpenAI 包装、垂直 AI 工具、AI 助手、AI 搜索。在你的 <code>&lt;head&gt;</code> 里放一个异步 script 标签。",
    "publish.hub.card_ai_arrow": "AI 应用开发者",

    "publish.hub.card_ext_h3": "我做了一个浏览器扩展",
    "publish.hub.card_ext_p": "写作助手、AI 侧边栏、摘要工具、翻译工具、Gmail 副驾 — Chrome、Edge、Firefox。原生支持 Manifest v3,提供 React + Vue 绑定。",
    "publish.hub.card_ext_arrow": "浏览器扩展开发者",

    "publish.hub.card_bots_h3": "我做了一个 AI 机器人",
    "publish.hub.card_bots_p": "研究 bot、摘要 bot、客服 bot、图像生成 bot。从你的 handler 一次 REST 调用,各平台可选 helper 库。",
    "publish.hub.card_bots_arrow": "AI 机器人开发者",

    "publish.hub.card_nocode_h3": "我做了一个 Custom GPT 或无代码 AI",
    "publish.hub.card_nocode_p": "OpenAI Custom GPTs、Poe bots、Perplexity Pages、Voiceflow / Botpress / Stack AI — 由你创作但运行时归平台所有。我们正在为这类产品打造无代码变现方案。",
    "publish.hub.card_nocode_arrow_html": "Custom GPT &amp; 无代码作者",

    "publish.hub.anchor_h3": "每扇门,一个发布商账号",
    "publish.hub.anchor_p_html": "一个 <code>publisher_id</code>、一个 Stripe Connect 账户、每周一次打款 — 无论你接入哪几扇门。",
    "publish.hub.anchor_stat1_label": "分成",
    "publish.hub.anchor_stat2_value": "每周",
    "publish.hub.anchor_stat2_label": "打款",
    "publish.hub.anchor_stat3_value": "10 分钟",
    "publish.hub.anchor_stat3_label": "上线",

    "publish.hub.why_h2": "为什么选 Boost Boss",
    "publish.hub.why1_h4": "85/15 收入分成",
    "publish.hub.why1_p": "每一美元你拿 85%。行业领先、对发布商最有利的分成,不分体量。",
    "publish.hub.why2_h4": "为 AI 上下文而建",
    "publish.hub.why2_p": "定向来自对话本身的上下文 — 不监控、不跨站追踪。",
    "publish.hub.why3_h4": "三套 SDK、一个 API,还有一条无代码路径在路上",
    "publish.hub.why3_p_html": "Lumi SDK for MCP、Lumi SDK script tag、Lumi SDK for browser extensions、Lumi API for Bots — 加上即将上线、面向 Custom GPT &amp; Poe 作者的无代码集成。同一套后端、同一个发布商账户、所有路径共享同一份打款。",
    "publish.hub.why4_h4": "透明数据报告",
    "publish.hub.why4_p": "实时面板,展示、点击、收入级别明细全可见。每周 Stripe 打款。",
    "publish.hub.why5_h4": "无长期合约",
    "publish.hub.why5_p": "五分钟接入,随时退出。每个打款周期我们都重新赢得你的信任。",

    "publish.hub.notfit_eyebrow": "实话实说",
    "publish.hub.notfit_h2": "不适合的场景",
    "publish.hub.notfit_intro_html": "我们坦白列出 Boost Boss <em>不</em>适合服务的场景,以免你浪费时间。我们宁可错过 lead,也不愿浪费你一周。",
    "publish.hub.notfit_li1": "iOS / Android 原生移动 App — 我们不做移动 SDK;那是 AppLovin 和 Unity 的领地,我们不进去竞争。",
    "publish.hub.notfit_li2": "博彩、成人、联盟营销垃圾流量 — 需求侧和供给侧都会在政策审查中被过滤。",
    "publish.hub.notfit_li3": "基于监控的广告网络 — 我们不会把发布商库存与重定向标签或行为 cookie 网络共享。",

    "publish.hub.footer_cta_h2": "还不确定你属于哪一类?",
    "publish.hub.footer_cta_p": "告诉我们你做了什么 — 我们帮你指向正确的集成方式。",
    "publish.hub.footer_cta_primary": "以发布商身份开始",
    "publish.hub.footer_cta_ghost": "联系我们",

    "pubfoot.docs": "文档",
    "pubfoot.trust": "信任",
    "pubfoot.copy": "© 2026 Boost Boss",
}

ZH_TW = {
    "subnav.mcp": "MCP 伺服器",
    "subnav.ai_apps": "AI 應用",
    "subnav.extensions": "瀏覽器擴充功能",
    "subnav.bots": "機器人",
    "subnav.no_code": "Custom GPTs",

    "publish.cta.start_earning": "開始變現",

    "publish.hub.hero_h1_html": "用你的方式,<br>為 <span class=\"grad\">AI 產品變現。</span>",
    "publish.hub.hero_sub": "Boost Boss 是為 AI 原生介面打造的廣告網路。一套後端,四條整合路徑加上一條無程式碼候補 — 你的 AI 在哪裡,我們就服務到哪裡。",
    "publish.hub.hero_cta": "以發布商身分開始 →",

    "publish.hub.router_eyebrow": "你屬於哪一類?",
    "publish.hub.router_h2": "選一條最契合你既有產品的路徑。",
    "publish.hub.router_sub": "每種整合都是該生態裡最簡單的程式碼 — MCP 用 Lumi SDK 三行、AI 應用用一個 script 標籤、瀏覽器擴充功能用 npm 套件、Bots 用一次 REST 呼叫。",

    "publish.hub.card_mcp_h3": "我做了一個 MCP 伺服器",
    "publish.hub.card_mcp_p": "Stripe-MCP、Postgres-MCP、Filesystem-MCP — 任何被 Claude Desktop、Cursor、Cline 呼叫的工具。依工具呼叫次數賺取收益。",
    "publish.hub.card_mcp_arrow": "MCP 伺服器開發者",

    "publish.hub.card_ai_h3": "我做了一個 AI 應用或網站",
    "publish.hub.card_ai_p_html": "LangChain、Vercel AI SDK、CrewAI、自製 OpenAI 包裝、垂直 AI 工具、AI 助理、AI 搜尋。在你的 <code>&lt;head&gt;</code> 裡放一個非同步 script 標籤。",
    "publish.hub.card_ai_arrow": "AI 應用開發者",

    "publish.hub.card_ext_h3": "我做了一個瀏覽器擴充功能",
    "publish.hub.card_ext_p": "寫作助手、AI 側邊欄、摘要工具、翻譯工具、Gmail 副駕 — Chrome、Edge、Firefox。原生支援 Manifest v3,提供 React + Vue 綁定。",
    "publish.hub.card_ext_arrow": "瀏覽器擴充功能開發者",

    "publish.hub.card_bots_h3": "我做了一個 AI 機器人",
    "publish.hub.card_bots_p": "研究機器人、摘要機器人、客服機器人、圖像生成機器人。從你的 handler 一次 REST 呼叫,各平台可選輔助函式庫。",
    "publish.hub.card_bots_arrow": "AI 機器人開發者",

    "publish.hub.card_nocode_h3": "我做了一個 Custom GPT 或無程式碼 AI",
    "publish.hub.card_nocode_p": "OpenAI Custom GPTs、Poe bots、Perplexity Pages、Voiceflow / Botpress / Stack AI — 由你撰寫但執行階段歸平台所有。我們正在為這類產品打造無程式碼變現方案。",
    "publish.hub.card_nocode_arrow_html": "Custom GPT &amp; 無程式碼作者",

    "publish.hub.anchor_h3": "每扇門,一個發布商帳號",
    "publish.hub.anchor_p_html": "一個 <code>publisher_id</code>、一個 Stripe Connect 帳戶、每週一次撥款 — 無論你接入哪幾扇門。",
    "publish.hub.anchor_stat1_label": "分潤",
    "publish.hub.anchor_stat2_value": "每週",
    "publish.hub.anchor_stat2_label": "撥款",
    "publish.hub.anchor_stat3_value": "10 分鐘",
    "publish.hub.anchor_stat3_label": "上線",

    "publish.hub.why_h2": "為什麼選 Boost Boss",
    "publish.hub.why1_h4": "85/15 收益分潤",
    "publish.hub.why1_p": "每一美元你拿 85%。產業領先、對發布商最有利的分潤,不論你的規模多大。",
    "publish.hub.why2_h4": "為 AI 情境而建",
    "publish.hub.why2_p": "定向源自對話本身的情境 — 不監控、不跨站追蹤。",
    "publish.hub.why3_h4": "三套 SDK、一個 API,還有一條無程式碼路徑在路上",
    "publish.hub.why3_p_html": "Lumi SDK for MCP、Lumi SDK script tag、Lumi SDK for browser extensions、Lumi API for Bots — 加上即將上線、面向 Custom GPT &amp; Poe 作者的無程式碼整合。同一套後端、同一個發布商帳號、所有路徑共享同一份撥款。",
    "publish.hub.why4_h4": "透明的數據報告",
    "publish.hub.why4_p": "即時儀表板,曝光、點擊、收益層級的明細皆可檢視。每週 Stripe 撥款。",
    "publish.hub.why5_h4": "沒有長期合約",
    "publish.hub.why5_p": "五分鐘整合、隨時退出。每個撥款週期我們都重新贏得你的信任。",

    "publish.hub.notfit_eyebrow": "實話實說",
    "publish.hub.notfit_h2": "不適合的場景",
    "publish.hub.notfit_intro_html": "我們坦白列出 Boost Boss <em>不</em>適合服務的場景,免得浪費你的時間。我們寧可放掉這個 lead,也不願浪費你一整週。",
    "publish.hub.notfit_li1": "iOS / Android 原生行動 App — 我們不做行動 SDK;那是 AppLovin 與 Unity 的領域,我們不進去競爭。",
    "publish.hub.notfit_li2": "博弈、成人、聯盟行銷垃圾流量 — 需求端與供給端皆會於政策審查時被過濾。",
    "publish.hub.notfit_li3": "以監控為基礎的廣告網路 — 我們不會把發布商版位分享給重定向標籤或行為 cookie 網路。",

    "publish.hub.footer_cta_h2": "還不確定你屬於哪一類?",
    "publish.hub.footer_cta_p": "告訴我們你做了什麼 — 我們幫你指向正確的整合方式。",
    "publish.hub.footer_cta_primary": "以發布商身分開始",
    "publish.hub.footer_cta_ghost": "聯絡我們",

    "pubfoot.docs": "文件",
    "pubfoot.trust": "信任",
    "pubfoot.copy": "© 2026 Boost Boss",
}

JA = {
    "subnav.mcp": "MCP サーバー",
    "subnav.ai_apps": "AI アプリ",
    "subnav.extensions": "拡張機能",
    "subnav.bots": "ボット",
    "subnav.no_code": "Custom GPTs",

    "publish.cta.start_earning": "収益化を始める",

    "publish.hub.hero_h1_html": "あなたの AI プロダクトを、<br><span class=\"grad\">あなたのやり方で収益化。</span>",
    "publish.hub.hero_sub": "Boost Boss は AI ネイティブな環境向けに設計された広告ネットワーク。1 つのバックエンド、4 つの統合パスとノーコード待機リスト — あなたの AI が動く場所、どこでも配信します。",
    "publish.hub.hero_cta": "パブリッシャーとして始める →",

    "publish.hub.router_eyebrow": "あなたはどのタイプ?",
    "publish.hub.router_h2": "あなたが作ったものに合うパスを選んでください。",
    "publish.hub.router_sub": "各統合はその生態系で最もシンプルなコード — MCP は Lumi SDK で 3 行、AI アプリは 1 つの script タグ、ブラウザ拡張は npm パッケージ、Bots は 1 回の REST 呼び出しです。",

    "publish.hub.card_mcp_h3": "MCP サーバーを作った",
    "publish.hub.card_mcp_p": "Stripe-MCP、Postgres-MCP、Filesystem-MCP — Claude Desktop、Cursor、Cline から呼ばれるすべてのツール。ツール呼び出しごとに収益化。",
    "publish.hub.card_mcp_arrow": "MCP サーバー開発者向け",

    "publish.hub.card_ai_h3": "AI アプリまたは Web サイトを作った",
    "publish.hub.card_ai_p_html": "LangChain、Vercel AI SDK、CrewAI、独自の OpenAI ラッパー、垂直 AI ツール、AI アシスタント、AI 検索。<code>&lt;head&gt;</code> に非同期 script タグを 1 つ。",
    "publish.hub.card_ai_arrow": "AI アプリ開発者向け",

    "publish.hub.card_ext_h3": "ブラウザ拡張機能を作った",
    "publish.hub.card_ext_p": "ライティングアシスタント、AI サイドバー、要約ツール、翻訳ツール、Gmail コパイロット — Chrome、Edge、Firefox。Manifest v3 ネイティブ、React + Vue バインディング対応。",
    "publish.hub.card_ext_arrow": "ブラウザ拡張機能開発者向け",

    "publish.hub.card_bots_h3": "AI ボットを作った",
    "publish.hub.card_bots_p": "リサーチ bot、要約 bot、サポート bot、画像生成 bot。ハンドラから 1 回の REST 呼び出し、プラットフォーム別のヘルパーライブラリ(任意)。",
    "publish.hub.card_bots_arrow": "AI ボット開発者向け",

    "publish.hub.card_nocode_h3": "Custom GPT またはノーコード AI を作った",
    "publish.hub.card_nocode_p": "OpenAI Custom GPTs、Poe bots、Perplexity Pages、Voiceflow / Botpress / Stack AI — あなたが作ったがランタイムはプラットフォーム所有。ノーコード収益化を準備中です。",
    "publish.hub.card_nocode_arrow_html": "Custom GPT &amp; ノーコード作者向け",

    "publish.hub.anchor_h3": "どのドアも、1 つのパブリッシャーアカウント",
    "publish.hub.anchor_p_html": "1 つの <code>publisher_id</code>、1 つの Stripe Connect アカウント、週次 1 回の支払い — どのドアから出荷しても同じ。",
    "publish.hub.anchor_stat1_label": "レベニューシェア",
    "publish.hub.anchor_stat2_value": "週次",
    "publish.hub.anchor_stat2_label": "支払い",
    "publish.hub.anchor_stat3_value": "10 分",
    "publish.hub.anchor_stat3_label": "で稼働",

    "publish.hub.why_h2": "なぜ Boost Boss なのか",
    "publish.hub.why1_h4": "85/15 のレベニューシェア",
    "publish.hub.why1_p": "1 ドルにつき 85% はあなたのもの。業界最高水準、パブリッシャー優位、規模を問いません。",
    "publish.hub.why2_h4": "AI コンテキストのために設計",
    "publish.hub.why2_p": "ターゲティングは会話自体のコンテキストから — 監視も、クロスサイトトラッキングも不要。",
    "publish.hub.why3_h4": "3 つの SDK、1 つの API、そしてノーコードパスも近日公開",
    "publish.hub.why3_p_html": "Lumi SDK for MCP、Lumi SDK script tag、Lumi SDK for browser extensions、Lumi API for Bots — そして Custom GPT &amp; Poe 作者向けのノーコード統合も準備中。同じバックエンド、同じパブリッシャーアカウント、すべてのパスで同じ支払い。",
    "publish.hub.why4_h4": "透明なレポート",
    "publish.hub.why4_p": "リアルタイムダッシュボードでインプレッション・クリック・収益レベルの詳細が見られます。週次 Stripe 支払い。",
    "publish.hub.why5_h4": "長期契約なし",
    "publish.hub.why5_p": "5 分で統合、いつでも退会。私たちは支払いサイクルごとに信頼を再獲得します。",

    "publish.hub.notfit_eyebrow": "正直なセクション",
    "publish.hub.notfit_h2": "向いていないケース",
    "publish.hub.notfit_intro_html": "Boost Boss が<em>向いていない</em>ケースを正直に挙げます — あなたの時間を無駄にしないために。リードを失っても、あなたの一週間を無駄にする方が嫌です。",
    "publish.hub.notfit_li1": "iOS / Android のネイティブモバイルアプリ — モバイル SDK は提供しません。そこは AppLovin と Unity の領域で、私たちは競合しません。",
    "publish.hub.notfit_li2": "ギャンブル、アダルト、アフィリエイトスパム系 — 需要側・供給側ともにポリシー審査で除外されます。",
    "publish.hub.notfit_li3": "監視ベースの広告ネットワーク — パブリッシャー在庫をリターゲティングタグや行動 Cookie ネットワークと共有することはありません。",

    "publish.hub.footer_cta_h2": "自分がどこに当てはまるかまだ分からない?",
    "publish.hub.footer_cta_p": "あなたが作ったものを教えてください — 適切な統合方法をご案内します。",
    "publish.hub.footer_cta_primary": "パブリッシャーとして始める",
    "publish.hub.footer_cta_ghost": "お問い合わせ",

    "pubfoot.docs": "ドキュメント",
    "pubfoot.trust": "信頼",
    "pubfoot.copy": "© 2026 Boost Boss",
}

KO = {
    "subnav.mcp": "MCP 서버",
    "subnav.ai_apps": "AI 앱",
    "subnav.extensions": "확장 프로그램",
    "subnav.bots": "봇",
    "subnav.no_code": "Custom GPTs",

    "publish.cta.start_earning": "수익화 시작",

    "publish.hub.hero_h1_html": "당신만의 방식으로,<br><span class=\"grad\">AI 제품을 수익화하세요.</span>",
    "publish.hub.hero_sub": "Boost Boss는 AI 네이티브 환경을 위해 만들어진 광고 네트워크입니다. 하나의 백엔드, 네 가지 통합 경로 + 노코드 대기열 — 당신의 AI가 있는 곳 어디든 서비스합니다.",
    "publish.hub.hero_cta": "퍼블리셔로 시작하기 →",

    "publish.hub.router_eyebrow": "어디에 속하나요?",
    "publish.hub.router_h2": "당신이 만든 것과 가장 잘 맞는 경로를 고르세요.",
    "publish.hub.router_sub": "각 통합은 해당 생태계에서 가장 간단한 코드입니다 — MCP는 Lumi SDK 3줄, AI 앱은 script 태그 한 줄, 브라우저 확장은 npm 패키지, Bots는 REST 호출 한 번.",

    "publish.hub.card_mcp_h3": "MCP 서버를 만들었어요",
    "publish.hub.card_mcp_p": "Stripe-MCP, Postgres-MCP, Filesystem-MCP — Claude Desktop, Cursor, Cline에서 호출되는 모든 도구. 툴 콜마다 수익을 얻습니다.",
    "publish.hub.card_mcp_arrow": "MCP 서버 개발자",

    "publish.hub.card_ai_h3": "AI 앱이나 웹사이트를 만들었어요",
    "publish.hub.card_ai_p_html": "LangChain, Vercel AI SDK, CrewAI, 자체 OpenAI 래퍼, 버티컬 AI 도구, AI 어시스턴트, AI 검색. <code>&lt;head&gt;</code>에 async script 태그 하나면 끝.",
    "publish.hub.card_ai_arrow": "AI 앱 개발자",

    "publish.hub.card_ext_h3": "브라우저 확장 프로그램을 만들었어요",
    "publish.hub.card_ext_p": "글쓰기 어시스턴트, AI 사이드바, 요약 도구, 번역 도구, Gmail 코파일럿 — Chrome, Edge, Firefox. Manifest v3 네이티브, React + Vue 바인딩.",
    "publish.hub.card_ext_arrow": "브라우저 확장 개발자",

    "publish.hub.card_bots_h3": "AI 봇을 만들었어요",
    "publish.hub.card_bots_p": "리서치 봇, 요약 봇, 지원 봇, 이미지 생성 봇. 핸들러에서 REST 호출 한 번, 플랫폼별 헬퍼 라이브러리(선택).",
    "publish.hub.card_bots_arrow": "AI 봇 개발자",

    "publish.hub.card_nocode_h3": "Custom GPT나 노코드 AI를 만들었어요",
    "publish.hub.card_nocode_p": "OpenAI Custom GPTs, Poe 봇, Perplexity Pages, Voiceflow / Botpress / Stack AI — 당신이 만들었지만 런타임은 플랫폼이 소유한 경우. 노코드 수익화 솔루션을 곧 출시합니다.",
    "publish.hub.card_nocode_arrow_html": "Custom GPT &amp; 노코드 작성자",

    "publish.hub.anchor_h3": "어느 문이든, 하나의 퍼블리셔 계정",
    "publish.hub.anchor_p_html": "하나의 <code>publisher_id</code>, 하나의 Stripe Connect 계정, 주간 1회 정산 — 어느 문으로 출고하든 동일합니다.",
    "publish.hub.anchor_stat1_label": "수익 배분",
    "publish.hub.anchor_stat2_value": "주간",
    "publish.hub.anchor_stat2_label": "정산",
    "publish.hub.anchor_stat3_value": "10분",
    "publish.hub.anchor_stat3_label": "내 운영 시작",

    "publish.hub.why_h2": "왜 Boost Boss인가",
    "publish.hub.why1_h4": "85/15 수익 배분",
    "publish.hub.why1_p": "1달러당 85%는 당신의 몫. 업계 최고 수준, 퍼블리셔 우선, 규모와 관계없음.",
    "publish.hub.why2_h4": "AI 컨텍스트를 위해 설계",
    "publish.hub.why2_p": "타겟팅은 대화 컨텍스트 자체에서 — 감시 없음, 사이트 간 추적 없음.",
    "publish.hub.why3_h4": "3개의 SDK, 1개의 API, 그리고 곧 노코드 경로",
    "publish.hub.why3_p_html": "Lumi SDK for MCP, Lumi SDK script tag, Lumi SDK for browser extensions, Lumi API for Bots — 그리고 Custom GPT &amp; Poe 작성자를 위한 노코드 통합도 준비 중. 같은 백엔드, 같은 퍼블리셔 계정, 모든 경로에서 같은 정산.",
    "publish.hub.why4_h4": "투명한 리포팅",
    "publish.hub.why4_p": "실시간 대시보드에서 임프레션·클릭·수익 수준의 상세 데이터 확인. 주간 Stripe 정산.",
    "publish.hub.why5_h4": "장기 계약 없음",
    "publish.hub.why5_p": "5분 만에 통합, 언제든 떠나기. 정산 주기마다 신뢰를 다시 얻습니다.",

    "publish.hub.notfit_eyebrow": "솔직한 섹션",
    "publish.hub.notfit_h2": "맞지 않는 경우",
    "publish.hub.notfit_intro_html": "Boost Boss가 <em>맞지 않는</em> 경우를 솔직히 알려드립니다 — 당신의 시간을 낭비하지 않기 위해서요. 리드를 놓치더라도 당신의 한 주를 낭비시키지 않겠습니다.",
    "publish.hub.notfit_li1": "iOS / Android 네이티브 모바일 앱 — 모바일 SDK는 제공하지 않습니다. 그 영역은 AppLovin과 Unity의 몫이고, 우리는 거기서 경쟁하지 않습니다.",
    "publish.hub.notfit_li2": "도박, 성인, 어필리에이트 스팸 분야 — 수요·공급 양쪽 모두 정책 검토에서 걸러집니다.",
    "publish.hub.notfit_li3": "감시 기반 광고 네트워크 — 퍼블리셔 인벤토리를 리타게팅 태그나 행동 쿠키 네트워크와 공유하지 않습니다.",

    "publish.hub.footer_cta_h2": "아직 어디에 속하는지 모르겠나요?",
    "publish.hub.footer_cta_p": "당신이 만든 것을 알려주세요 — 적합한 통합 방식을 안내해드립니다.",
    "publish.hub.footer_cta_primary": "퍼블리셔로 시작하기",
    "publish.hub.footer_cta_ghost": "문의하기",

    "pubfoot.docs": "문서",
    "pubfoot.trust": "신뢰",
    "pubfoot.copy": "© 2026 Boost Boss",
}

VI = {
    "subnav.mcp": "MCP Server",
    "subnav.ai_apps": "Ứng dụng AI",
    "subnav.extensions": "Tiện ích mở rộng",
    "subnav.bots": "Bot",
    "subnav.no_code": "Custom GPTs",

    "publish.cta.start_earning": "Bắt đầu kiếm tiền",

    "publish.hub.hero_h1_html": "Kiếm tiền từ sản phẩm AI của bạn,<br><span class=\"grad\">theo cách của bạn.</span>",
    "publish.hub.hero_sub": "Boost Boss là mạng quảng cáo được xây dựng cho các bề mặt AI-native. Một backend, bốn đường tích hợp cộng thêm danh sách chờ no-code — AI của bạn ở đâu, chúng tôi phục vụ ở đó.",
    "publish.hub.hero_cta": "Bắt đầu với tư cách publisher →",

    "publish.hub.router_eyebrow": "Bạn thuộc loại nào?",
    "publish.hub.router_h2": "Chọn đường phù hợp nhất với những gì bạn đã xây.",
    "publish.hub.router_sub": "Mỗi tích hợp đều là đoạn code đơn giản nhất trong hệ sinh thái đó — ba dòng với Lumi SDK for MCP, một script tag cho ứng dụng AI, npm package cho tiện ích trình duyệt, hoặc một REST call cho Bots.",

    "publish.hub.card_mcp_h3": "Tôi đã xây MCP server",
    "publish.hub.card_mcp_p": "Stripe-MCP, Postgres-MCP, Filesystem-MCP — bất kỳ thứ gì được gọi từ Claude Desktop, Cursor, Cline. Kiếm tiền theo mỗi lần gọi công cụ.",
    "publish.hub.card_mcp_arrow": "Dành cho nhà phát triển MCP Server",

    "publish.hub.card_ai_h3": "Tôi đã xây ứng dụng hoặc website AI",
    "publish.hub.card_ai_p_html": "LangChain, Vercel AI SDK, CrewAI, OpenAI wrapper tùy biến, công cụ AI chuyên ngành, AI assistant, AI search. Một script tag async trong <code>&lt;head&gt;</code> của bạn.",
    "publish.hub.card_ai_arrow": "Dành cho nhà phát triển ứng dụng AI",

    "publish.hub.card_ext_h3": "Tôi đã xây tiện ích trình duyệt",
    "publish.hub.card_ext_p": "Trợ lý viết, AI sidebar, công cụ tóm tắt, công cụ dịch, copilot Gmail — Chrome, Edge, Firefox. Hỗ trợ native Manifest v3, có binding React + Vue.",
    "publish.hub.card_ext_arrow": "Dành cho nhà phát triển tiện ích trình duyệt",

    "publish.hub.card_bots_h3": "Tôi đã xây bot AI",
    "publish.hub.card_bots_p": "Bot nghiên cứu, bot tóm tắt, bot hỗ trợ, bot tạo ảnh. Một REST call từ handler, thư viện helper tùy chọn theo từng platform.",
    "publish.hub.card_bots_arrow": "Dành cho nhà phát triển bot AI",

    "publish.hub.card_nocode_h3": "Tôi đã xây Custom GPT hoặc AI no-code",
    "publish.hub.card_nocode_p": "OpenAI Custom GPTs, Poe bots, Perplexity Pages, Voiceflow / Botpress / Stack AI — nơi bạn là tác giả AI nhưng platform sở hữu runtime. Chúng tôi đang chuẩn bị monetization no-code cho nhóm này.",
    "publish.hub.card_nocode_arrow_html": "Dành cho tác giả Custom GPT &amp; no-code",

    "publish.hub.anchor_h3": "Mọi cánh cửa, một tài khoản publisher",
    "publish.hub.anchor_p_html": "Một <code>publisher_id</code>, một tài khoản Stripe Connect, một lần thanh toán hàng tuần — bất kể bạn ship qua cửa nào.",
    "publish.hub.anchor_stat1_label": "chia doanh thu",
    "publish.hub.anchor_stat2_value": "Hàng tuần",
    "publish.hub.anchor_stat2_label": "thanh toán",
    "publish.hub.anchor_stat3_value": "10 phút",
    "publish.hub.anchor_stat3_label": "để lên sóng",

    "publish.hub.why_h2": "Vì sao chọn Boost Boss",
    "publish.hub.why1_h4": "Chia doanh thu 85/15",
    "publish.hub.why1_p": "Bạn giữ 85% mỗi đô. Mức chia hàng đầu ngành, ưu tiên publisher, không phân biệt quy mô.",
    "publish.hub.why2_h4": "Thiết kế cho ngữ cảnh AI",
    "publish.hub.why2_p": "Targeting dựa trên ngữ cảnh hội thoại — không giám sát, không tracking xuyên site.",
    "publish.hub.why3_h4": "Ba SDK, một API, cộng thêm đường no-code đang trên đường",
    "publish.hub.why3_p_html": "Lumi SDK for MCP, Lumi SDK script tag, Lumi SDK for browser extensions, Lumi API for Bots — cộng tích hợp no-code sắp ra mắt cho tác giả Custom GPT &amp; Poe. Cùng backend, cùng tài khoản publisher, cùng cách thanh toán trên mọi đường.",
    "publish.hub.why4_h4": "Báo cáo minh bạch",
    "publish.hub.why4_p": "Dashboard thời gian thực với chi tiết theo impression, click và revenue. Thanh toán Stripe hàng tuần.",
    "publish.hub.why5_h4": "Không hợp đồng dài hạn",
    "publish.hub.why5_p": "Tích hợp trong năm phút, rời bất cứ lúc nào. Mỗi chu kỳ thanh toán là một lần chúng tôi giành lại niềm tin.",

    "publish.hub.notfit_eyebrow": "Phần thẳng thắn",
    "publish.hub.notfit_h2": "Không phù hợp với",
    "publish.hub.notfit_intro_html": "Danh sách ngắn những ai Boost Boss <em>không</em> được xây cho, để bạn không tốn thời gian. Chúng tôi thà mất lead còn hơn lãng phí cả tuần của bạn.",
    "publish.hub.notfit_li1": "App mobile native iOS / Android — chúng tôi không làm mobile SDK; AppLovin và Unity thống trị mảng đó, chúng tôi không cạnh tranh.",
    "publish.hub.notfit_li2": "Cờ bạc, người lớn, hoặc spam affiliate — cả phía cầu lẫn phía cung đều bị lọc ở khâu kiểm duyệt chính sách.",
    "publish.hub.notfit_li3": "Mạng quảng cáo dựa trên giám sát — chúng tôi không chia sẻ inventory của publisher với retargeting tag hay mạng cookie hành vi.",

    "publish.hub.footer_cta_h2": "Vẫn chưa chắc bạn thuộc nhóm nào?",
    "publish.hub.footer_cta_p": "Hãy cho chúng tôi biết bạn đã xây gì — chúng tôi sẽ chỉ bạn cách tích hợp đúng.",
    "publish.hub.footer_cta_primary": "Bắt đầu với tư cách publisher",
    "publish.hub.footer_cta_ghost": "Liên hệ với chúng tôi",

    "pubfoot.docs": "Tài liệu",
    "pubfoot.trust": "Niềm tin",
    "pubfoot.copy": "© 2026 Boost Boss",
}

DICTS = {"en": EN, "zh": ZH, "zh-TW": ZH_TW, "ja": JA, "ko": KO, "vi": VI}

# ---------------------------------------------------------------------------
# 3) HTML tagging — list of (key, exact_old_html, new_html_with_attr) tuples.
#    We use string replace so each entry MUST be uniquely identifiable.
# ---------------------------------------------------------------------------
HTML_PATCHES = [
    # Sub-nav links (5)
    ('<a href="/publish/mcp">MCP Servers</a>',
     '<a href="/publish/mcp" data-i18n="subnav.mcp">MCP Servers</a>'),
    ('<a href="/publish/ai-apps">AI Apps</a>',
     '<a href="/publish/ai-apps" data-i18n="subnav.ai_apps">AI Apps</a>'),
    ('<a href="/publish/extensions">Extensions</a>',
     '<a href="/publish/extensions" data-i18n="subnav.extensions">Extensions</a>'),
    ('<a href="/publish/bots">Bots</a>',
     '<a href="/publish/bots" data-i18n="subnav.bots">Bots</a>'),
    ('<a href="/publish/no-code">Custom GPTs</a>',
     '<a href="/publish/no-code" data-i18n="subnav.no_code">Custom GPTs</a>'),

    # Start earning button in nav
    ('<a class="btn btn-primary" href="/publish/signup">Start earning</a>',
     '<a class="btn btn-primary" href="/publish/signup" data-i18n="publish.cta.start_earning">Start earning</a>'),

    # Hero
    ('<h1>Monetize your AI product,<br><span class="grad">your way.</span></h1>',
     '<h1 data-i18n="publish.hub.hero_h1_html" data-i18n-html>Monetize your AI product,<br><span class="grad">your way.</span></h1>'),
    ('<p class="sub">Boost Boss is the ad network built for AI-native surfaces. One backend, four integration paths plus a no-code waitlist — wherever your AI lives, we serve.</p>',
     '<p class="sub" data-i18n="publish.hub.hero_sub">Boost Boss is the ad network built for AI-native surfaces. One backend, four integration paths plus a no-code waitlist — wherever your AI lives, we serve.</p>'),
    ('<a class="btn btn-primary btn-lg" href="/publish/signup">Start as a publisher →</a>',
     '<a class="btn btn-primary btn-lg" href="/publish/signup" data-i18n="publish.hub.hero_cta">Start as a publisher →</a>'),

    # Router
    ('<span class="router-eyebrow">Which one are you?</span>',
     '<span class="router-eyebrow" data-i18n="publish.hub.router_eyebrow">Which one are you?</span>'),
    ('<h2 class="router-h2">Pick the path that matches what you\'ve built.</h2>',
     '<h2 class="router-h2" data-i18n="publish.hub.router_h2">Pick the path that matches what you\'ve built.</h2>'),
    ('<p class="router-sub">Each integration is the simplest possible code in that ecosystem\'s idiom — three lines via Lumi SDK for MCP, one script tag via Lumi SDK script tag, an npm package via Lumi SDK for browser extensions, or a REST call via Lumi API for Bots.</p>',
     '<p class="router-sub" data-i18n="publish.hub.router_sub">Each integration is the simplest possible code in that ecosystem\'s idiom — three lines via Lumi SDK for MCP, one script tag via Lumi SDK script tag, an npm package via Lumi SDK for browser extensions, or a REST call via Lumi API for Bots.</p>'),

    # Card MCP
    ('<h3>I built an MCP server</h3>',
     '<h3 data-i18n="publish.hub.card_mcp_h3">I built an MCP server</h3>'),
    ('<p>Stripe-MCP, Postgres-MCP, Filesystem-MCP, anything called from Claude Desktop, Cursor, Cline. Earn per tool call.</p>',
     '<p data-i18n="publish.hub.card_mcp_p">Stripe-MCP, Postgres-MCP, Filesystem-MCP, anything called from Claude Desktop, Cursor, Cline. Earn per tool call.</p>'),
    ('<span class="arrow">For MCP Server Developers </span>',
     '<span class="arrow" data-i18n="publish.hub.card_mcp_arrow">For MCP Server Developers </span>'),

    # Card AI
    ('<h3>I built an AI app or website</h3>',
     '<h3 data-i18n="publish.hub.card_ai_h3">I built an AI app or website</h3>'),
    ('<p>LangChain, Vercel AI SDK, CrewAI, custom OpenAI wrappers, vertical AI tools, AI assistants, AI search. One async script tag in your <code>&lt;head&gt;</code>.</p>',
     '<p data-i18n="publish.hub.card_ai_p_html" data-i18n-html>LangChain, Vercel AI SDK, CrewAI, custom OpenAI wrappers, vertical AI tools, AI assistants, AI search. One async script tag in your <code>&lt;head&gt;</code>.</p>'),
    ('<span class="arrow">For AI App Builders </span>',
     '<span class="arrow" data-i18n="publish.hub.card_ai_arrow">For AI App Builders </span>'),

    # Card Extensions
    ('<h3>I built a browser extension</h3>',
     '<h3 data-i18n="publish.hub.card_ext_h3">I built a browser extension</h3>'),
    ('<p>Writing assistants, AI sidebars, summarizers, translators, Gmail copilots — Chrome, Edge, Firefox. Manifest v3 native, React + Vue bindings.</p>',
     '<p data-i18n="publish.hub.card_ext_p">Writing assistants, AI sidebars, summarizers, translators, Gmail copilots — Chrome, Edge, Firefox. Manifest v3 native, React + Vue bindings.</p>'),
    ('<span class="arrow">For Browser Extension Developers </span>',
     '<span class="arrow" data-i18n="publish.hub.card_ext_arrow">For Browser Extension Developers </span>'),

    # Card Bots
    ('<h3>I built an AI bot</h3>',
     '<h3 data-i18n="publish.hub.card_bots_h3">I built an AI bot</h3>'),
    ('<p>Research bots, summarization bots, support bots, image-gen bots. One REST call from your handler, optional helper libraries per platform.</p>',
     '<p data-i18n="publish.hub.card_bots_p">Research bots, summarization bots, support bots, image-gen bots. One REST call from your handler, optional helper libraries per platform.</p>'),
    ('<span class="arrow">For AI Bot Developers </span>',
     '<span class="arrow" data-i18n="publish.hub.card_bots_arrow">For AI Bot Developers </span>'),

    # Card No-code
    ('<h3>I built a Custom GPT or no-code AI</h3>',
     '<h3 data-i18n="publish.hub.card_nocode_h3">I built a Custom GPT or no-code AI</h3>'),
    ('<p>OpenAI Custom GPTs, Poe bots, Perplexity Pages, Voiceflow / Botpress / Stack AI builds — anywhere you authored the AI but the platform owns the runtime. We\'re shipping no-code monetization next.</p>',
     '<p data-i18n="publish.hub.card_nocode_p">OpenAI Custom GPTs, Poe bots, Perplexity Pages, Voiceflow / Botpress / Stack AI builds — anywhere you authored the AI but the platform owns the runtime. We\'re shipping no-code monetization next.</p>'),
    ('<span class="arrow">For Custom GPT &amp; No-Code Authors </span>',
     '<span class="arrow" data-i18n="publish.hub.card_nocode_arrow_html" data-i18n-html>For Custom GPT &amp; No-Code Authors </span>'),

    # Anchor
    ('<h3>Every door, one publisher account</h3>',
     '<h3 data-i18n="publish.hub.anchor_h3">Every door, one publisher account</h3>'),
    ('<p>One <code>publisher_id</code>, one Stripe Connect account, one weekly payout — across whichever doors you ship through.</p>',
     '<p data-i18n="publish.hub.anchor_p_html" data-i18n-html>One <code>publisher_id</code>, one Stripe Connect account, one weekly payout — across whichever doors you ship through.</p>'),
    ('<div class="anchor-stat"><strong>85%</strong><span>revshare</span></div>',
     '<div class="anchor-stat"><strong>85%</strong><span data-i18n="publish.hub.anchor_stat1_label">revshare</span></div>'),
    ('<div class="anchor-stat"><strong>Weekly</strong><span>payouts</span></div>',
     '<div class="anchor-stat"><strong data-i18n="publish.hub.anchor_stat2_value">Weekly</strong><span data-i18n="publish.hub.anchor_stat2_label">payouts</span></div>'),
    ('<div class="anchor-stat"><strong>10 min</strong><span>to live</span></div>',
     '<div class="anchor-stat"><strong data-i18n="publish.hub.anchor_stat3_value">10 min</strong><span data-i18n="publish.hub.anchor_stat3_label">to live</span></div>'),

    # Why section
    ('<h2>Why Boost Boss</h2>',
     '<h2 data-i18n="publish.hub.why_h2">Why Boost Boss</h2>'),
    ('<h4>85/15 revenue split</h4>',
     '<h4 data-i18n="publish.hub.why1_h4">85/15 revenue split</h4>'),
    ('<p>You keep 85% of every dollar. Industry-leading and publisher-favorable, no matter your scale.</p>',
     '<p data-i18n="publish.hub.why1_p">You keep 85% of every dollar. Industry-leading and publisher-favorable, no matter your scale.</p>'),
    ('<h4>Built for AI context</h4>',
     '<h4 data-i18n="publish.hub.why2_h4">Built for AI context</h4>'),
    ('<p>Contextual targeting from the conversation itself — never surveillance, never cross-site tracking.</p>',
     '<p data-i18n="publish.hub.why2_p">Contextual targeting from the conversation itself — never surveillance, never cross-site tracking.</p>'),
    ('<h4>Three SDKs, one API, plus a no-code path on the way</h4>',
     '<h4 data-i18n="publish.hub.why3_h4">Three SDKs, one API, plus a no-code path on the way</h4>'),
    ('<p>Lumi SDK for MCP, Lumi SDK script tag, Lumi SDK for browser extensions, Lumi API for Bots — and a no-code integration coming for Custom GPT &amp; Poe authors. Same backend, same publisher account, same payouts across all paths.</p>',
     '<p data-i18n="publish.hub.why3_p_html" data-i18n-html>Lumi SDK for MCP, Lumi SDK script tag, Lumi SDK for browser extensions, Lumi API for Bots — and a no-code integration coming for Custom GPT &amp; Poe authors. Same backend, same publisher account, same payouts across all paths.</p>'),
    ('<h4>Transparent reporting</h4>',
     '<h4 data-i18n="publish.hub.why4_h4">Transparent reporting</h4>'),
    ('<p>Live dashboard with impression-, click-, and revenue-level detail. Weekly Stripe payouts.</p>',
     '<p data-i18n="publish.hub.why4_p">Live dashboard with impression-, click-, and revenue-level detail. Weekly Stripe payouts.</p>'),
    ('<h4>No long-term contracts</h4>',
     '<h4 data-i18n="publish.hub.why5_h4">No long-term contracts</h4>'),
    ('<p>Integrate in five minutes, leave any time. We earn the relationship every payout cycle.</p>',
     '<p data-i18n="publish.hub.why5_p">Integrate in five minutes, leave any time. We earn the relationship every payout cycle.</p>'),

    # Not-fit
    ('<span class="notfit-eyebrow">Honest section</span>',
     '<span class="notfit-eyebrow" data-i18n="publish.hub.notfit_eyebrow">Honest section</span>'),
    ('<h2>Not a fit for</h2>',
     '<h2 data-i18n="publish.hub.notfit_h2">Not a fit for</h2>'),
    ('<p class="intro">A short list of who Boost Boss is <em>not</em> built for, so you don\'t waste your time. We\'d rather lose the lead than waste your week.</p>',
     '<p class="intro" data-i18n="publish.hub.notfit_intro_html" data-i18n-html>A short list of who Boost Boss is <em>not</em> built for, so you don\'t waste your time. We\'d rather lose the lead than waste your week.</p>'),
    ('<li>Mobile native iOS / Android apps — we don\'t do mobile SDKs; AppLovin and Unity own that lane and we don\'t compete there.</li>',
     '<li data-i18n="publish.hub.notfit_li1">Mobile native iOS / Android apps — we don\'t do mobile SDKs; AppLovin and Unity own that lane and we don\'t compete there.</li>'),
    ('<li>Gambling, adult, or affiliate-spam verticals — both demand and supply side are filtered out at policy review.</li>',
     '<li data-i18n="publish.hub.notfit_li2">Gambling, adult, or affiliate-spam verticals — both demand and supply side are filtered out at policy review.</li>'),
    ('<li>Surveillance-based ad networks — we don\'t share publisher inventory with retargeting tags or behavioral cookie networks.</li>',
     '<li data-i18n="publish.hub.notfit_li3">Surveillance-based ad networks — we don\'t share publisher inventory with retargeting tags or behavioral cookie networks.</li>'),

    # Footer CTA
    ('<h2>Still not sure where you fit?</h2>',
     '<h2 data-i18n="publish.hub.footer_cta_h2">Still not sure where you fit?</h2>'),
    ('<p>Tell us what you\'ve built — we\'ll point you at the right integration.</p>',
     '<p data-i18n="publish.hub.footer_cta_p">Tell us what you\'ve built — we\'ll point you at the right integration.</p>'),
    ('<a class="btn btn-primary btn-lg" href="/publish/signup">Start as a publisher</a>',
     '<a class="btn btn-primary btn-lg" href="/publish/signup" data-i18n="publish.hub.footer_cta_primary">Start as a publisher</a>'),
    ('<a class="btn btn-ghost btn-lg" href="mailto:hello@boostboss.ai">Talk to us</a>',
     '<a class="btn btn-ghost btn-lg" href="mailto:hello@boostboss.ai" data-i18n="publish.hub.footer_cta_ghost">Talk to us</a>'),

    # Site footer
    ('<a href="/publish/mcp">MCP</a>',
     '<a href="/publish/mcp" data-i18n="subnav.mcp">MCP</a>'),
    ('<a href="/publish/ai-apps">AI Apps</a>',
     '<a href="/publish/ai-apps" data-i18n="subnav.ai_apps">AI Apps</a>'),  # 2nd occurrence; .replace handles per-occurrence
    ('<a href="/publish/extensions">Extensions</a>',
     '<a href="/publish/extensions" data-i18n="subnav.extensions">Extensions</a>'),
    ('<a href="/publish/bots">Bots</a>',
     '<a href="/publish/bots" data-i18n="subnav.bots">Bots</a>'),
    ('<a href="/publish/no-code">Custom GPTs</a>',
     '<a href="/publish/no-code" data-i18n="subnav.no_code">Custom GPTs</a>'),
    ('<a href="/docs">Docs</a>',
     '<a href="/docs" data-i18n="pubfoot.docs">Docs</a>'),
    ('<a href="/trust">Trust</a>',
     '<a href="/trust" data-i18n="pubfoot.trust">Trust</a>'),
    ('<div class="footer-copy">© 2026 Boost Boss</div>',
     '<div class="footer-copy" data-i18n="pubfoot.copy">© 2026 Boost Boss</div>'),
]


def deep_set(d, dotted_key, value):
    """Set d['a']['b']['c'] = value for key 'a.b.c'. Creates dicts as needed."""
    parts = dotted_key.split('.')
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
    for key, value in entries.items():
        deep_set(data, key, value)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')


def patch_html():
    with open(PAGE, 'r', encoding='utf-8') as f:
        html = f.read()
    applied = 0
    skipped = []
    for old, new in HTML_PATCHES:
        if new in html:
            # Already tagged — idempotent.
            continue
        if old not in html:
            skipped.append(old[:80])
            continue
        # First occurrence only — replace once.
        # Some entries (sub-nav repeats) need multi-replace because both the
        # top nav AND the footer have <a href="/publish/mcp">MCP</a>-style
        # links. We use count=1 here; second occurrence will be handled by the
        # rerun in a follow-up patch if needed.
        html = html.replace(old, new, 1)
        applied += 1
    with open(PAGE, 'w', encoding='utf-8') as f:
        f.write(html)
    return applied, skipped


def main():
    print(f"Patching {PAGE} ...")
    applied, skipped = patch_html()
    print(f"  applied: {applied}  skipped (not found): {len(skipped)}")
    for s in skipped:
        print(f"    !! not found: {s}")

    for lang, entries in DICTS.items():
        update_dictionary(lang, entries)
        print(f"  updated /i18n/{lang}.json (+{len(entries)} keys)")

    print("Done.")


if __name__ == '__main__':
    main()
