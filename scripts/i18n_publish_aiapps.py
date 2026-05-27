#!/usr/bin/env python3
"""i18n tagger for /publish/ai-apps."""
import json, os

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..'))
PAGE = os.path.join(ROOT, 'public', 'publish-ai-apps.html')
I18N_DIR = os.path.join(ROOT, 'public', 'i18n')

EN = {
    "publish.aiapps.hero_eyebrow": "For AI App Builders",
    "publish.aiapps.hero_h1_html": "Add ad revenue to your AI app in <span class=\"grad\">under 5 minutes</span>.",
    "publish.aiapps.hero_sub_html": "Lumi SDK script tag — one async <code>&lt;script&gt;</code> in your <code>&lt;head&gt;</code>. Works with OpenAI, Anthropic, Gemini, open-source models, and any agent framework (LangChain, Vercel AI SDK, CrewAI, custom orchestration). No backend changes required.",
    "publish.aiapps.hero_cta": "Start as a publisher →",

    "publish.aiapps.see_eyebrow": "See it appear",
    "publish.aiapps.see_h2_html": "Drop a slot. Watch the ad render in.<br>Style stays yours.",
    "publish.aiapps.see_sub_html": "A <code>&lt;div data-lumi-slot&gt;</code> placed wherever you want it. Lumi only renders the inner card — your typography, spacing, and chrome carry through.",
    "publish.aiapps.see_caption": "The card renders inline with your chat layout. You control the slot position, the surrounding spacing, and what comes after — Lumi just fills in the bordered card with the sponsored content.",

    "publish.aiapps.how_eyebrow": "How it works",
    "publish.aiapps.how_h2": "Sign up. Paste. Earn.",
    "publish.aiapps.how1_h4": "Sign up",
    "publish.aiapps.how1_p": "Copy your snippet from the dashboard. One publisher ID, ready to paste.",
    "publish.aiapps.how2_h4_html": "Paste into your <code>&lt;head&gt;</code>",
    "publish.aiapps.how2_p": "Async, lazy-loaded, zero impact on first paint. Works in Next.js, Nuxt, Remix, Vite, plain HTML.",
    "publish.aiapps.how3_h4": "Place ad slots",
    "publish.aiapps.how3_p_html": "Drop a <code>&lt;div data-lumi-slot&gt;</code> wherever you want ads. Boost Boss renders the rest.",

    "publish.aiapps.snippet_eyebrow": "Integration snippet",
    "publish.aiapps.snippet_h2": "One snippet. Any AI stack.",
    "publish.aiapps.snippet_caption_html": "That's the entire integration. Same snippet for OpenAI, Anthropic, Gemini, LangChain, Vercel AI SDK, CrewAI — Lumi works at the rendering surface, not the agent logic. <a href=\"/docs/js-snippet\">Full docs →</a>",
    "publish.aiapps.snippet_shot_caption_html": "A <code>&lt;div data-lumi-slot&gt;</code> placed below an answer. Style it to match your app — Lumi only renders the inner card.",

    "publish.aiapps.who_eyebrow": "Who this is for",
    "publish.aiapps.who_h2": "If you ship AI in a browser, this is your path.",
    "publish.aiapps.who_li1": "You shipped an AI chat app, AI assistant, or AI tool with a web UI.",
    "publish.aiapps.who_li2": "You use any LLM provider — we don't care which.",
    "publish.aiapps.who_li3": "You built with LangChain, Vercel AI SDK, CrewAI, LlamaIndex, AutoGen, Mastra, or rolled your own.",
    "publish.aiapps.who_li4": "You're tired of subscription churn as your only monetization.",

    "publish.aiapps.rev_eyebrow": "Revenue example",
    "publish.aiapps.rev_h2": "What 5,000 daily users can earn.",
    "publish.aiapps.rev_label": "Illustrative — not a guarantee",
    "publish.aiapps.rev_row1": "Daily active users",
    "publish.aiapps.rev_row2": "Ad impressions per user per day",
    "publish.aiapps.rev_row3": "Daily impressions",
    "publish.aiapps.rev_row4": "Blended CPM",
    "publish.aiapps.rev_row5": "Monthly publisher revenue",
    "publish.aiapps.rev_disclaimer": "Numbers are illustrative for an AI app with conversational UX. Actual revenue depends on session length, slot placement, fill rate, and audience. Verticals with stronger commercial intent (developer tooling, finance, B2B SaaS) typically run higher CPMs.",

    "publish.aiapps.faq_eyebrow": "Frequently asked",
    "publish.aiapps.faq_h2": "The questions every AI app builder asks.",
    "publish.aiapps.faq1_q": "Does this work with my agent framework?",
    "publish.aiapps.faq1_a": "Yes. Lumi is framework-agnostic. We integrate at the rendering surface, not the agent logic — so LangChain, Vercel AI SDK, CrewAI, LlamaIndex, AutoGen, Mastra, or your own custom orchestration all work the same way.",
    "publish.aiapps.faq2_q": "Will ads slow down my app?",
    "publish.aiapps.faq2_a": "No. The script is async and lazy-loaded — zero impact on first paint, no blocking on your bundle. Ad slots render after your AI surface is interactive.",
    "publish.aiapps.faq3_q": "What if I'm using Server-Sent Events for streaming?",
    "publish.aiapps.faq3_a": "Lumi works alongside SSE. Ads render in your UI separately from your model's stream — you don't need to interleave anything. The ad slot is a sibling element, not a stream consumer.",
    "publish.aiapps.faq4_q": "Can I theme the ads to match my UI?",
    "publish.aiapps.faq4_a_html": "Yes. Lumi reads your CSS variables for color and typography (<code>--lumi-primary</code>, <code>--lumi-text</code>, <code>--lumi-radius</code>, etc.). The default look is neutral; the themed look matches your brand.",
    "publish.aiapps.faq5_q": "Can I run my own ads alongside Boost Boss?",
    "publish.aiapps.faq5_a_html": "Yes. We don't lock down inventory. Boost Boss renders only in slots you explicitly tag with <code>data-lumi-slot</code> — everything else is yours.",

    "publish.aiapps.cta_h2": "Ready to monetize your AI app?",
    "publish.aiapps.cta_p": "One snippet. Five minutes. Weekly payouts.",
    "publish.aiapps.cta_btn": "Apply as a Founding Publisher →",
}

ZH = {
    "publish.aiapps.hero_eyebrow": "面向 AI 应用开发者",
    "publish.aiapps.hero_h1_html": "在 <span class=\"grad\">5 分钟内</span> 给你的 AI 应用加上广告收入。",
    "publish.aiapps.hero_sub_html": "Lumi SDK script 标签 — 在你的 <code>&lt;head&gt;</code> 里放一个异步 <code>&lt;script&gt;</code>。支持 OpenAI、Anthropic、Gemini、开源模型,以及任何 agent 框架(LangChain、Vercel AI SDK、CrewAI、自研编排)。无需任何后端改动。",
    "publish.aiapps.hero_cta": "以发布商身份开始 →",

    "publish.aiapps.see_eyebrow": "看它出现",
    "publish.aiapps.see_h2_html": "放一个 slot。看着广告在里面渲染。<br>样式还是你的。",
    "publish.aiapps.see_sub_html": "把 <code>&lt;div data-lumi-slot&gt;</code> 放在你想要的位置。Lumi 只渲染内部卡片 — 你的字体、间距和外观全部保留。",
    "publish.aiapps.see_caption": "卡片与你的聊天版式内联渲染。slot 位置、四周间距、后面接什么 — 都由你控制。Lumi 只负责在带边框的卡片里填入赞助内容。",

    "publish.aiapps.how_eyebrow": "工作原理",
    "publish.aiapps.how_h2": "注册。粘贴。开始赚钱。",
    "publish.aiapps.how1_h4": "注册",
    "publish.aiapps.how1_p": "在面板里复制你的代码片段。一个 publisher ID,直接可贴。",
    "publish.aiapps.how2_h4_html": "贴进你的 <code>&lt;head&gt;</code>",
    "publish.aiapps.how2_p": "异步、懒加载,对首次绘制零影响,不阻塞你的打包。支持 Next.js、Nuxt、Remix、Vite、纯 HTML。",
    "publish.aiapps.how3_h4": "放置广告 slot",
    "publish.aiapps.how3_p_html": "把 <code>&lt;div data-lumi-slot&gt;</code> 放在你想出现广告的位置。Boost Boss 负责其余。",

    "publish.aiapps.snippet_eyebrow": "集成代码",
    "publish.aiapps.snippet_h2": "一段代码,任何 AI 技术栈。",
    "publish.aiapps.snippet_caption_html": "整个集成就这些。OpenAI、Anthropic、Gemini、LangChain、Vercel AI SDK、CrewAI — 同一段代码。Lumi 工作在渲染层,不是 agent 逻辑层。<a href=\"/docs/js-snippet\">完整文档 →</a>",
    "publish.aiapps.snippet_shot_caption_html": "在一条回答下方放置 <code>&lt;div data-lumi-slot&gt;</code>。把它调成你的应用风格 — Lumi 只渲染内部卡片。",

    "publish.aiapps.who_eyebrow": "适合谁",
    "publish.aiapps.who_h2": "如果你在浏览器里发布 AI,这就是你的路径。",
    "publish.aiapps.who_li1": "你做了一个带网页 UI 的 AI 聊天应用、AI 助手或 AI 工具。",
    "publish.aiapps.who_li2": "你用任何 LLM 服务商 — 我们不在乎是哪家。",
    "publish.aiapps.who_li3": "你用 LangChain、Vercel AI SDK、CrewAI、LlamaIndex、AutoGen、Mastra,或者自己写的编排。",
    "publish.aiapps.who_li4": "你受够了只靠订阅留存来变现。",

    "publish.aiapps.rev_eyebrow": "收入示例",
    "publish.aiapps.rev_h2": "5,000 日活能赚多少。",
    "publish.aiapps.rev_label": "仅供示意 — 不构成保证",
    "publish.aiapps.rev_row1": "日活用户",
    "publish.aiapps.rev_row2": "每用户每日广告展示数",
    "publish.aiapps.rev_row3": "每日展示数",
    "publish.aiapps.rev_row4": "综合 CPM",
    "publish.aiapps.rev_row5": "每月发布商收入",
    "publish.aiapps.rev_disclaimer": "数字仅为示意,基于带对话式体验的 AI 应用估算。实际收入取决于会话长度、slot 摆放、填充率和受众。商业意图较强的垂直领域(开发者工具、金融、B2B SaaS)通常 CPM 更高。",

    "publish.aiapps.faq_eyebrow": "常见问题",
    "publish.aiapps.faq_h2": "每个 AI 应用开发者都会问的问题。",
    "publish.aiapps.faq1_q": "这能配合我的 agent 框架吗?",
    "publish.aiapps.faq1_a": "可以。Lumi 与框架无关。我们在渲染层接入,不是 agent 逻辑层 — 所以 LangChain、Vercel AI SDK、CrewAI、LlamaIndex、AutoGen、Mastra,或者你自己写的编排,工作方式完全一样。",
    "publish.aiapps.faq2_q": "广告会拖慢我的应用吗?",
    "publish.aiapps.faq2_a": "不会。脚本是异步、懒加载 — 对首屏零影响,不阻塞你的打包。广告 slot 在你的 AI 界面可交互之后才渲染。",
    "publish.aiapps.faq3_q": "如果我用 Server-Sent Events 做流式响应呢?",
    "publish.aiapps.faq3_a": "Lumi 与 SSE 并行工作。广告在你的 UI 中与模型流分开渲染 — 你不需要把它们交错。广告 slot 是一个兄弟元素,不是流的消费者。",
    "publish.aiapps.faq4_q": "我可以把广告调成自己的 UI 风格吗?",
    "publish.aiapps.faq4_a_html": "可以。Lumi 会读取你的 CSS 变量来配色和字体(<code>--lumi-primary</code>、<code>--lumi-text</code>、<code>--lumi-radius</code> 等)。默认外观偏中性;主题化后会匹配你的品牌。",
    "publish.aiapps.faq5_q": "我可以在 Boost Boss 之外同时跑自己的广告吗?",
    "publish.aiapps.faq5_a_html": "可以。我们不锁定库存。Boost Boss 只在你明确用 <code>data-lumi-slot</code> 标记的位置渲染 — 其他位置都还是你的。",

    "publish.aiapps.cta_h2": "准备好让你的 AI 应用变现了吗?",
    "publish.aiapps.cta_p": "一段代码。五分钟。每周打款。",
    "publish.aiapps.cta_btn": "申请成为创始发布商 →",
}

ZH_TW = {
    "publish.aiapps.hero_eyebrow": "面向 AI 應用開發者",
    "publish.aiapps.hero_h1_html": "在 <span class=\"grad\">5 分鐘內</span> 為你的 AI 應用加上廣告收益。",
    "publish.aiapps.hero_sub_html": "Lumi SDK script 標籤 — 在你的 <code>&lt;head&gt;</code> 裡放一個非同步 <code>&lt;script&gt;</code>。支援 OpenAI、Anthropic、Gemini、開源模型,以及任何 agent 框架(LangChain、Vercel AI SDK、CrewAI、自製編排)。完全不需要動到後端。",
    "publish.aiapps.hero_cta": "以發布商身分開始 →",

    "publish.aiapps.see_eyebrow": "看看它出現的樣子",
    "publish.aiapps.see_h2_html": "放一個 slot。看廣告在裡面渲染。<br>樣式仍然是你的。",
    "publish.aiapps.see_sub_html": "把 <code>&lt;div data-lumi-slot&gt;</code> 放在你想要的位置。Lumi 只渲染內部卡片 — 你的字型、間距與外觀都保留。",
    "publish.aiapps.see_caption": "卡片與你的聊天版面內聯渲染。slot 位置、四周間距、後面接什麼 — 都由你決定。Lumi 只負責在帶邊框的卡片裡填入贊助內容。",

    "publish.aiapps.how_eyebrow": "運作方式",
    "publish.aiapps.how_h2": "註冊。貼上。賺取收益。",
    "publish.aiapps.how1_h4": "註冊",
    "publish.aiapps.how1_p": "在儀表板複製你的程式碼片段。一個 publisher ID,直接可貼。",
    "publish.aiapps.how2_h4_html": "貼進你的 <code>&lt;head&gt;</code>",
    "publish.aiapps.how2_p": "非同步、延遲載入,對首次繪製零影響,不會阻塞你的打包。支援 Next.js、Nuxt、Remix、Vite、純 HTML。",
    "publish.aiapps.how3_h4": "放置廣告 slot",
    "publish.aiapps.how3_p_html": "把 <code>&lt;div data-lumi-slot&gt;</code> 放在你想出現廣告的位置。Boost Boss 處理其餘部分。",

    "publish.aiapps.snippet_eyebrow": "整合程式碼",
    "publish.aiapps.snippet_h2": "一段程式碼,任何 AI 技術堆疊。",
    "publish.aiapps.snippet_caption_html": "整個整合就這些。OpenAI、Anthropic、Gemini、LangChain、Vercel AI SDK、CrewAI — 同一段程式碼。Lumi 在渲染層運作,而非 agent 邏輯層。<a href=\"/docs/js-snippet\">完整文件 →</a>",
    "publish.aiapps.snippet_shot_caption_html": "在一則回應下方放置 <code>&lt;div data-lumi-slot&gt;</code>。把它調成你的應用風格 — Lumi 只渲染內部卡片。",

    "publish.aiapps.who_eyebrow": "適合誰",
    "publish.aiapps.who_h2": "如果你在瀏覽器裡發布 AI,這就是你的路徑。",
    "publish.aiapps.who_li1": "你做了一個帶網頁 UI 的 AI 聊天應用、AI 助理或 AI 工具。",
    "publish.aiapps.who_li2": "你用任何 LLM 服務商 — 我們不在意是哪一家。",
    "publish.aiapps.who_li3": "你用 LangChain、Vercel AI SDK、CrewAI、LlamaIndex、AutoGen、Mastra,或自己寫的編排。",
    "publish.aiapps.who_li4": "你受夠了只靠訂閱留存來變現。",

    "publish.aiapps.rev_eyebrow": "收益範例",
    "publish.aiapps.rev_h2": "5,000 日活躍能賺多少。",
    "publish.aiapps.rev_label": "僅供示意 — 不構成保證",
    "publish.aiapps.rev_row1": "日活躍使用者",
    "publish.aiapps.rev_row2": "每位使用者每日廣告曝光數",
    "publish.aiapps.rev_row3": "每日曝光數",
    "publish.aiapps.rev_row4": "綜合 CPM",
    "publish.aiapps.rev_row5": "每月發布商收益",
    "publish.aiapps.rev_disclaimer": "數字僅為示意,以具備對話式體驗的 AI 應用為基準。實際收益取決於工作階段長度、slot 擺放、填充率與受眾。商業意圖較強的垂直領域(開發者工具、金融、B2B SaaS)CPM 通常較高。",

    "publish.aiapps.faq_eyebrow": "常見問題",
    "publish.aiapps.faq_h2": "每位 AI 應用開發者都會問的問題。",
    "publish.aiapps.faq1_q": "這能搭配我的 agent 框架嗎?",
    "publish.aiapps.faq1_a": "可以。Lumi 與框架無關。我們在渲染層接入,而非 agent 邏輯層 — 所以 LangChain、Vercel AI SDK、CrewAI、LlamaIndex、AutoGen、Mastra,或你自己寫的編排,運作方式完全相同。",
    "publish.aiapps.faq2_q": "廣告會拖慢我的應用嗎?",
    "publish.aiapps.faq2_a": "不會。腳本是非同步、延遲載入的 — 對首屏零影響,不會阻塞你的打包。廣告 slot 在你的 AI 介面可互動之後才渲染。",
    "publish.aiapps.faq3_q": "如果我用 Server-Sent Events 做串流呢?",
    "publish.aiapps.faq3_a": "Lumi 可與 SSE 並行運作。廣告在你的 UI 中與模型串流分開渲染 — 你不需要交錯處理。廣告 slot 是一個並列元素,而非串流的消費者。",
    "publish.aiapps.faq4_q": "我可以把廣告主題調成自己的 UI 嗎?",
    "publish.aiapps.faq4_a_html": "可以。Lumi 會讀取你的 CSS 變數來決定顏色與字型(<code>--lumi-primary</code>、<code>--lumi-text</code>、<code>--lumi-radius</code> 等)。預設外觀偏中性;主題化後會契合你的品牌。",
    "publish.aiapps.faq5_q": "我可以在 Boost Boss 之外同時跑自己的廣告嗎?",
    "publish.aiapps.faq5_a_html": "可以。我們不鎖定版位。Boost Boss 只在你明確以 <code>data-lumi-slot</code> 標記的位置渲染 — 其他位置仍然是你的。",

    "publish.aiapps.cta_h2": "準備好讓你的 AI 應用變現了嗎?",
    "publish.aiapps.cta_p": "一段程式碼。五分鐘。每週撥款。",
    "publish.aiapps.cta_btn": "申請成為創始發布商 →",
}

JA = {
    "publish.aiapps.hero_eyebrow": "AI アプリビルダー向け",
    "publish.aiapps.hero_h1_html": "AI アプリに広告収益を <span class=\"grad\">5 分以内</span> で追加。",
    "publish.aiapps.hero_sub_html": "Lumi SDK script タグ — <code>&lt;head&gt;</code> に非同期 <code>&lt;script&gt;</code> を 1 つ。OpenAI、Anthropic、Gemini、オープンソースモデル、そして任意の agent フレームワーク(LangChain、Vercel AI SDK、CrewAI、独自オーケストレーション)で動作します。バックエンドの変更は不要。",
    "publish.aiapps.hero_cta": "パブリッシャーとして始める →",

    "publish.aiapps.see_eyebrow": "実際の見え方",
    "publish.aiapps.see_h2_html": "スロットを置く。広告がそこにレンダリングされる。<br>スタイルはあなたのまま。",
    "publish.aiapps.see_sub_html": "好きな場所に置いた <code>&lt;div data-lumi-slot&gt;</code>。Lumi は中のカードだけを描画 — あなたのタイポグラフィ、スペーシング、見た目はすべて引き継がれます。",
    "publish.aiapps.see_caption": "カードはあなたのチャットレイアウトとインラインで描画されます。スロットの位置、周囲のスペース、その後に続く内容 — すべてあなたが制御。Lumi は枠付きカードの中にスポンサー内容を埋めるだけ。",

    "publish.aiapps.how_eyebrow": "仕組み",
    "publish.aiapps.how_h2": "登録。貼り付け。収益化。",
    "publish.aiapps.how1_h4": "登録",
    "publish.aiapps.how1_p": "ダッシュボードからスニペットをコピー。パブリッシャー ID 1 つで貼り付け準備完了。",
    "publish.aiapps.how2_h4_html": "<code>&lt;head&gt;</code> に貼り付け",
    "publish.aiapps.how2_p": "非同期、遅延読み込み、初回描画への影響ゼロ、バンドルをブロックしません。Next.js、Nuxt、Remix、Vite、プレーン HTML で動作。",
    "publish.aiapps.how3_h4": "広告スロットを配置",
    "publish.aiapps.how3_p_html": "<code>&lt;div data-lumi-slot&gt;</code> を広告を出したい場所に。残りは Boost Boss が描画します。",

    "publish.aiapps.snippet_eyebrow": "統合スニペット",
    "publish.aiapps.snippet_h2": "1 つのスニペット、任意の AI スタック。",
    "publish.aiapps.snippet_caption_html": "統合はこれですべて。OpenAI、Anthropic、Gemini、LangChain、Vercel AI SDK、CrewAI — 同じスニペット。Lumi は描画面で動作し、agent ロジックには触れません。<a href=\"/docs/js-snippet\">完全ドキュメント →</a>",
    "publish.aiapps.snippet_shot_caption_html": "回答の下に <code>&lt;div data-lumi-slot&gt;</code> を配置。あなたのアプリに合わせてスタイル — Lumi は中のカードだけを描画します。",

    "publish.aiapps.who_eyebrow": "向いている人",
    "publish.aiapps.who_h2": "ブラウザで AI を提供しているなら、これがあなたの道です。",
    "publish.aiapps.who_li1": "ウェブ UI 付きの AI チャットアプリ、AI アシスタント、AI ツールを出している。",
    "publish.aiapps.who_li2": "どの LLM プロバイダでも構わない — 我々は気にしません。",
    "publish.aiapps.who_li3": "LangChain、Vercel AI SDK、CrewAI、LlamaIndex、AutoGen、Mastra、または独自のオーケストレーションで構築。",
    "publish.aiapps.who_li4": "サブスクリプションのチャーンだけが収益化手段なのにうんざりしている。",

    "publish.aiapps.rev_eyebrow": "収益例",
    "publish.aiapps.rev_h2": "1 日 5,000 ユーザーで得られる収益。",
    "publish.aiapps.rev_label": "あくまで例 — 保証ではありません",
    "publish.aiapps.rev_row1": "日次アクティブユーザー",
    "publish.aiapps.rev_row2": "1 ユーザー 1 日あたりの広告インプレッション",
    "publish.aiapps.rev_row3": "日次インプレッション",
    "publish.aiapps.rev_row4": "ブレンド CPM",
    "publish.aiapps.rev_row5": "月間パブリッシャー収益",
    "publish.aiapps.rev_disclaimer": "数値は会話 UX を持つ AI アプリを想定した例示です。実際の収益はセッション長、スロット配置、フィル率、オーディエンスに左右されます。商用意図の強い分野(開発者ツール、金融、B2B SaaS)は通常 CPM が高くなります。",

    "publish.aiapps.faq_eyebrow": "よくある質問",
    "publish.aiapps.faq_h2": "AI アプリビルダーが必ず聞く質問。",
    "publish.aiapps.faq1_q": "私の agent フレームワークで動きますか?",
    "publish.aiapps.faq1_a": "はい。Lumi はフレームワーク非依存です。描画面で統合し、agent ロジックには触れません — なので LangChain、Vercel AI SDK、CrewAI、LlamaIndex、AutoGen、Mastra、独自オーケストレーションすべて同じように動きます。",
    "publish.aiapps.faq2_q": "広告でアプリが遅くなりませんか?",
    "publish.aiapps.faq2_a": "なりません。スクリプトは非同期で遅延読み込み — 初回描画への影響はゼロ、バンドルをブロックしません。広告スロットは AI 画面が操作可能になった後に描画されます。",
    "publish.aiapps.faq3_q": "ストリーミングで Server-Sent Events を使っている場合は?",
    "publish.aiapps.faq3_a": "Lumi は SSE と並行して動きます。広告は UI 上でモデルのストリームとは別に描画されます — 交互配置の必要はありません。広告スロットは兄弟要素であり、ストリームの消費者ではありません。",
    "publish.aiapps.faq4_q": "広告を UI に合わせてテーマ化できますか?",
    "publish.aiapps.faq4_a_html": "はい。Lumi は色とタイポグラフィの CSS 変数(<code>--lumi-primary</code>、<code>--lumi-text</code>、<code>--lumi-radius</code> など)を読み取ります。デフォルトは中立的、テーマ化するとブランドに合わせた見た目になります。",
    "publish.aiapps.faq5_q": "Boost Boss と自前の広告を併用できますか?",
    "publish.aiapps.faq5_a_html": "はい。在庫をロックしません。Boost Boss は <code>data-lumi-slot</code> でタグ付けしたスロットだけに描画します — それ以外はすべてあなたのものです。",

    "publish.aiapps.cta_h2": "AI アプリで収益化する準備はできましたか?",
    "publish.aiapps.cta_p": "1 スニペット。5 分。週次支払い。",
    "publish.aiapps.cta_btn": "ファウンディングパブリッシャーとして申し込む →",
}

KO = {
    "publish.aiapps.hero_eyebrow": "AI 앱 빌더용",
    "publish.aiapps.hero_h1_html": "AI 앱에 광고 수익을 <span class=\"grad\">5분 안에</span> 추가하세요.",
    "publish.aiapps.hero_sub_html": "Lumi SDK 스크립트 태그 — <code>&lt;head&gt;</code>에 비동기 <code>&lt;script&gt;</code> 하나면 끝. OpenAI, Anthropic, Gemini, 오픈소스 모델, 그리고 모든 에이전트 프레임워크(LangChain, Vercel AI SDK, CrewAI, 자체 오케스트레이션)와 동작합니다. 백엔드 변경 불필요.",
    "publish.aiapps.hero_cta": "퍼블리셔로 시작하기 →",

    "publish.aiapps.see_eyebrow": "이렇게 보입니다",
    "publish.aiapps.see_h2_html": "슬롯을 놓으세요. 광고가 거기서 렌더링됩니다.<br>스타일은 그대로.",
    "publish.aiapps.see_sub_html": "원하는 위치에 놓은 <code>&lt;div data-lumi-slot&gt;</code>. Lumi는 안쪽 카드만 렌더링 — 당신의 타이포그래피, 간격, 외관은 그대로 유지됩니다.",
    "publish.aiapps.see_caption": "카드는 당신의 채팅 레이아웃에 인라인으로 렌더링됩니다. 슬롯 위치, 주변 간격, 이후 콘텐츠는 모두 당신이 제어 — Lumi는 테두리 있는 카드 안에 스폰서 콘텐츠를 채울 뿐입니다.",

    "publish.aiapps.how_eyebrow": "동작 방식",
    "publish.aiapps.how_h2": "가입. 붙여넣기. 수익화.",
    "publish.aiapps.how1_h4": "가입",
    "publish.aiapps.how1_p": "대시보드에서 스니펫을 복사. 퍼블리셔 ID 하나로 붙여넣기 준비 완료.",
    "publish.aiapps.how2_h4_html": "<code>&lt;head&gt;</code>에 붙여넣기",
    "publish.aiapps.how2_p": "비동기, 지연 로드, 첫 페인트 영향 0, 번들 블로킹 없음. Next.js, Nuxt, Remix, Vite, 일반 HTML에서 작동.",
    "publish.aiapps.how3_h4": "광고 슬롯 배치",
    "publish.aiapps.how3_p_html": "<code>&lt;div data-lumi-slot&gt;</code>을 광고를 원하는 위치에 놓으세요. 나머지는 Boost Boss가 처리합니다.",

    "publish.aiapps.snippet_eyebrow": "통합 스니펫",
    "publish.aiapps.snippet_h2": "스니펫 하나, 모든 AI 스택.",
    "publish.aiapps.snippet_caption_html": "통합은 이게 전부입니다. OpenAI, Anthropic, Gemini, LangChain, Vercel AI SDK, CrewAI — 동일한 스니펫. Lumi는 렌더링 표면에서 작동하고 에이전트 로직은 건드리지 않습니다. <a href=\"/docs/js-snippet\">전체 문서 →</a>",
    "publish.aiapps.snippet_shot_caption_html": "답변 아래에 <code>&lt;div data-lumi-slot&gt;</code>을 배치. 앱에 맞게 스타일링 — Lumi는 안쪽 카드만 렌더링합니다.",

    "publish.aiapps.who_eyebrow": "이런 분에게 맞습니다",
    "publish.aiapps.who_h2": "브라우저에서 AI를 제공한다면 이 경로입니다.",
    "publish.aiapps.who_li1": "웹 UI를 갖춘 AI 채팅 앱, AI 어시스턴트 또는 AI 도구를 배포했다.",
    "publish.aiapps.who_li2": "어떤 LLM 프로바이더든 사용 — 우리는 상관 없습니다.",
    "publish.aiapps.who_li3": "LangChain, Vercel AI SDK, CrewAI, LlamaIndex, AutoGen, Mastra 또는 직접 만든 오케스트레이션을 사용한다.",
    "publish.aiapps.who_li4": "구독 이탈만 유일한 수익화 수단인 것에 지쳤다.",

    "publish.aiapps.rev_eyebrow": "수익 예시",
    "publish.aiapps.rev_h2": "일 5,000 사용자가 벌 수 있는 금액.",
    "publish.aiapps.rev_label": "예시일 뿐 — 보장이 아닙니다",
    "publish.aiapps.rev_row1": "일일 활성 사용자",
    "publish.aiapps.rev_row2": "사용자당 일일 광고 임프레션",
    "publish.aiapps.rev_row3": "일일 임프레션",
    "publish.aiapps.rev_row4": "블렌드 CPM",
    "publish.aiapps.rev_row5": "월간 퍼블리셔 수익",
    "publish.aiapps.rev_disclaimer": "수치는 대화형 UX를 가진 AI 앱을 가정한 예시입니다. 실제 수익은 세션 길이, 슬롯 배치, 채움률, 오디언스에 따라 달라집니다. 상업적 의도가 강한 버티컬(개발자 도구, 금융, B2B SaaS)은 보통 CPM이 더 높습니다.",

    "publish.aiapps.faq_eyebrow": "자주 묻는 질문",
    "publish.aiapps.faq_h2": "모든 AI 앱 빌더가 묻는 질문.",
    "publish.aiapps.faq1_q": "내 에이전트 프레임워크에서 작동하나요?",
    "publish.aiapps.faq1_a": "네. Lumi는 프레임워크에 종속되지 않습니다. 렌더링 표면에서 통합하므로 에이전트 로직은 건드리지 않습니다 — LangChain, Vercel AI SDK, CrewAI, LlamaIndex, AutoGen, Mastra 또는 자체 오케스트레이션 모두 동일하게 작동합니다.",
    "publish.aiapps.faq2_q": "광고가 앱을 느리게 만들지 않나요?",
    "publish.aiapps.faq2_a": "아니요. 스크립트는 비동기에 지연 로드 — 첫 페인트 영향 0, 번들 블로킹 없음. 광고 슬롯은 AI 표면이 상호작용 가능해진 후에 렌더링됩니다.",
    "publish.aiapps.faq3_q": "스트리밍에 Server-Sent Events를 쓰고 있다면요?",
    "publish.aiapps.faq3_a": "Lumi는 SSE와 함께 작동합니다. 광고는 모델 스트림과 별도로 UI에 렌더링됩니다 — 인터리브할 필요가 없습니다. 광고 슬롯은 형제 요소이지 스트림 소비자가 아닙니다.",
    "publish.aiapps.faq4_q": "UI에 맞게 광고를 테마링할 수 있나요?",
    "publish.aiapps.faq4_a_html": "네. Lumi는 색상과 타이포그래피 CSS 변수(<code>--lumi-primary</code>, <code>--lumi-text</code>, <code>--lumi-radius</code> 등)를 읽습니다. 기본 모양은 중립적이며, 테마링하면 브랜드에 맞춥니다.",
    "publish.aiapps.faq5_q": "Boost Boss와 자체 광고를 함께 운영할 수 있나요?",
    "publish.aiapps.faq5_a_html": "네. 인벤토리를 잠그지 않습니다. Boost Boss는 <code>data-lumi-slot</code>으로 명시적으로 태그한 슬롯에서만 렌더링합니다 — 나머지는 모두 당신의 것입니다.",

    "publish.aiapps.cta_h2": "AI 앱으로 수익화할 준비가 되셨나요?",
    "publish.aiapps.cta_p": "스니펫 하나. 5분. 주간 정산.",
    "publish.aiapps.cta_btn": "파운딩 퍼블리셔로 신청하기 →",
}

VI = {
    "publish.aiapps.hero_eyebrow": "Dành cho nhà phát triển ứng dụng AI",
    "publish.aiapps.hero_h1_html": "Thêm doanh thu quảng cáo vào ứng dụng AI của bạn trong <span class=\"grad\">chưa đến 5 phút</span>.",
    "publish.aiapps.hero_sub_html": "Lumi SDK script tag — một <code>&lt;script&gt;</code> async trong <code>&lt;head&gt;</code>. Hoạt động với OpenAI, Anthropic, Gemini, model open-source và mọi framework agent (LangChain, Vercel AI SDK, CrewAI, orchestration tự viết). Không cần đổi backend.",
    "publish.aiapps.hero_cta": "Bắt đầu với tư cách publisher →",

    "publish.aiapps.see_eyebrow": "Xem nó xuất hiện",
    "publish.aiapps.see_h2_html": "Đặt một slot. Xem quảng cáo render vào.<br>Style vẫn của bạn.",
    "publish.aiapps.see_sub_html": "Một <code>&lt;div data-lumi-slot&gt;</code> đặt ở chỗ bạn muốn. Lumi chỉ render thẻ bên trong — typography, spacing và giao diện của bạn được giữ nguyên.",
    "publish.aiapps.see_caption": "Thẻ render inline với layout chat của bạn. Vị trí slot, khoảng cách xung quanh, nội dung phía sau — đều do bạn kiểm soát. Lumi chỉ điền vào thẻ có viền nội dung sponsored.",

    "publish.aiapps.how_eyebrow": "Cách hoạt động",
    "publish.aiapps.how_h2": "Đăng ký. Paste. Kiếm tiền.",
    "publish.aiapps.how1_h4": "Đăng ký",
    "publish.aiapps.how1_p": "Sao chép snippet từ dashboard. Một publisher ID, sẵn sàng paste.",
    "publish.aiapps.how2_h4_html": "Paste vào <code>&lt;head&gt;</code>",
    "publish.aiapps.how2_p": "Async, lazy-load, tác động first paint bằng 0, không block bundle. Hoạt động trong Next.js, Nuxt, Remix, Vite, HTML thuần.",
    "publish.aiapps.how3_h4": "Đặt slot quảng cáo",
    "publish.aiapps.how3_p_html": "Đặt <code>&lt;div data-lumi-slot&gt;</code> nơi bạn muốn quảng cáo. Boost Boss xử lý phần còn lại.",

    "publish.aiapps.snippet_eyebrow": "Đoạn code tích hợp",
    "publish.aiapps.snippet_h2": "Một snippet. Bất kỳ stack AI nào.",
    "publish.aiapps.snippet_caption_html": "Toàn bộ tích hợp chỉ vậy. OpenAI, Anthropic, Gemini, LangChain, Vercel AI SDK, CrewAI — cùng một snippet. Lumi hoạt động ở tầng render, không phải tầng logic agent. <a href=\"/docs/js-snippet\">Tài liệu đầy đủ →</a>",
    "publish.aiapps.snippet_shot_caption_html": "Đặt <code>&lt;div data-lumi-slot&gt;</code> dưới một câu trả lời. Style nó theo app của bạn — Lumi chỉ render thẻ bên trong.",

    "publish.aiapps.who_eyebrow": "Dành cho ai",
    "publish.aiapps.who_h2": "Nếu bạn ship AI trong trình duyệt, đây là đường của bạn.",
    "publish.aiapps.who_li1": "Bạn đã ship một AI chat app, AI assistant hoặc AI tool có UI web.",
    "publish.aiapps.who_li2": "Bạn dùng bất kỳ LLM provider nào — chúng tôi không quan tâm cái nào.",
    "publish.aiapps.who_li3": "Bạn xây bằng LangChain, Vercel AI SDK, CrewAI, LlamaIndex, AutoGen, Mastra hoặc tự viết.",
    "publish.aiapps.who_li4": "Bạn mệt mỏi vì subscription churn là cách kiếm tiền duy nhất.",

    "publish.aiapps.rev_eyebrow": "Ví dụ doanh thu",
    "publish.aiapps.rev_h2": "5,000 người dùng mỗi ngày có thể kiếm được bao nhiêu.",
    "publish.aiapps.rev_label": "Chỉ mang tính minh họa — không phải cam kết",
    "publish.aiapps.rev_row1": "Người dùng hoạt động mỗi ngày",
    "publish.aiapps.rev_row2": "Impression quảng cáo trên mỗi người dùng mỗi ngày",
    "publish.aiapps.rev_row3": "Impression mỗi ngày",
    "publish.aiapps.rev_row4": "CPM gộp",
    "publish.aiapps.rev_row5": "Doanh thu publisher hàng tháng",
    "publish.aiapps.rev_disclaimer": "Con số mang tính minh họa cho ứng dụng AI có UX hội thoại. Doanh thu thực tế tùy vào độ dài phiên, vị trí slot, fill rate và audience. Các ngành có ý định thương mại cao (developer tooling, tài chính, B2B SaaS) thường có CPM cao hơn.",

    "publish.aiapps.faq_eyebrow": "Câu hỏi thường gặp",
    "publish.aiapps.faq_h2": "Những câu mà mọi nhà phát triển ứng dụng AI đều hỏi.",
    "publish.aiapps.faq1_q": "Cái này có hoạt động với framework agent của tôi không?",
    "publish.aiapps.faq1_a": "Có. Lumi không phụ thuộc framework. Chúng tôi tích hợp ở tầng render, không phải logic agent — nên LangChain, Vercel AI SDK, CrewAI, LlamaIndex, AutoGen, Mastra hay orchestration tự viết đều chạy như nhau.",
    "publish.aiapps.faq2_q": "Quảng cáo có làm chậm ứng dụng không?",
    "publish.aiapps.faq2_a": "Không. Script là async và lazy-load — tác động first paint bằng 0, không block bundle. Slot quảng cáo render sau khi UI AI đã tương tác được.",
    "publish.aiapps.faq3_q": "Nếu tôi dùng Server-Sent Events cho streaming thì sao?",
    "publish.aiapps.faq3_a": "Lumi chạy song song SSE. Quảng cáo render trong UI tách biệt với stream của model — bạn không cần interleave. Slot quảng cáo là phần tử sibling, không phải consumer của stream.",
    "publish.aiapps.faq4_q": "Tôi có thể theme quảng cáo theo UI của tôi không?",
    "publish.aiapps.faq4_a_html": "Có. Lumi đọc CSS variables của bạn cho màu và typography (<code>--lumi-primary</code>, <code>--lumi-text</code>, <code>--lumi-radius</code>, v.v.). Default look trung tính; theme look thì khớp với brand của bạn.",
    "publish.aiapps.faq5_q": "Tôi có thể chạy quảng cáo riêng cùng Boost Boss không?",
    "publish.aiapps.faq5_a_html": "Có. Chúng tôi không khóa inventory. Boost Boss chỉ render ở các slot bạn tag tường minh với <code>data-lumi-slot</code> — mọi thứ khác là của bạn.",

    "publish.aiapps.cta_h2": "Sẵn sàng kiếm tiền từ ứng dụng AI của bạn?",
    "publish.aiapps.cta_p": "Một snippet. Năm phút. Thanh toán hàng tuần.",
    "publish.aiapps.cta_btn": "Đăng ký làm Founding Publisher →",
}

DICTS = {"en": EN, "zh": ZH, "zh-TW": ZH_TW, "ja": JA, "ko": KO, "vi": VI}

HTML_PATCHES = [
    ('<a href="/publish/mcp">MCP Servers</a>',
     '<a href="/publish/mcp" data-i18n="subnav.mcp">MCP Servers</a>'),
    ('<a href="/publish/ai-apps" class="active">AI Apps</a>',
     '<a href="/publish/ai-apps" class="active" data-i18n="subnav.ai_apps">AI Apps</a>'),
    ('<a href="/publish/extensions">Extensions</a>',
     '<a href="/publish/extensions" data-i18n="subnav.extensions">Extensions</a>'),
    ('<a href="/publish/bots">Bots</a>',
     '<a href="/publish/bots" data-i18n="subnav.bots">Bots</a>'),
    ('<a href="/publish/no-code">Custom GPTs</a>',
     '<a href="/publish/no-code" data-i18n="subnav.no_code">Custom GPTs</a>'),
    ('<a class="btn btn-primary" href="/publish/signup">Start earning</a>',
     '<a class="btn btn-primary" href="/publish/signup" data-i18n="publish.cta.start_earning">Start earning</a>'),

    ('<span class="eyebrow">For AI App Builders</span>',
     '<span class="eyebrow" data-i18n="publish.aiapps.hero_eyebrow">For AI App Builders</span>'),
    ('<h1>Add ad revenue to your AI app in <span class="grad">under 5 minutes</span>.</h1>',
     '<h1 data-i18n="publish.aiapps.hero_h1_html" data-i18n-html>Add ad revenue to your AI app in <span class="grad">under 5 minutes</span>.</h1>'),
    ('<p class="sub">Lumi SDK script tag — one async <code>&lt;script&gt;</code> in your <code>&lt;head&gt;</code>. Works with OpenAI, Anthropic, Gemini, open-source models, and any agent framework (LangChain, Vercel AI SDK, CrewAI, custom orchestration). No backend changes required.</p>',
     '<p class="sub" data-i18n="publish.aiapps.hero_sub_html" data-i18n-html>Lumi SDK script tag — one async <code>&lt;script&gt;</code> in your <code>&lt;head&gt;</code>. Works with OpenAI, Anthropic, Gemini, open-source models, and any agent framework (LangChain, Vercel AI SDK, CrewAI, custom orchestration). No backend changes required.</p>'),
    ('<a class="btn btn-primary btn-lg" href="/publish/signup">Start as a publisher →</a>',
     '<a class="btn btn-primary btn-lg" href="/publish/signup" data-i18n="publish.aiapps.hero_cta">Start as a publisher →</a>'),

    ('<span class="section-eyebrow">See it appear</span>',
     '<span class="section-eyebrow" data-i18n="publish.aiapps.see_eyebrow">See it appear</span>'),
    ('<h2 class="section-h">Drop a slot. Watch the ad render in.<br>Style stays yours.</h2>',
     '<h2 class="section-h" data-i18n="publish.aiapps.see_h2_html" data-i18n-html>Drop a slot. Watch the ad render in.<br>Style stays yours.</h2>'),
    ('<p class="section-sub">A <code>&lt;div data-lumi-slot&gt;</code> placed wherever you want it. Lumi only renders the inner card — your typography, spacing, and chrome carry through.</p>',
     '<p class="section-sub" data-i18n="publish.aiapps.see_sub_html" data-i18n-html>A <code>&lt;div data-lumi-slot&gt;</code> placed wherever you want it. Lumi only renders the inner card — your typography, spacing, and chrome carry through.</p>'),
    ('<div class="stage-caption">The card renders inline with your chat layout. You control the slot position, the surrounding spacing, and what comes after — Lumi just fills in the bordered card with the sponsored content.</div>',
     '<div class="stage-caption" data-i18n="publish.aiapps.see_caption">The card renders inline with your chat layout. You control the slot position, the surrounding spacing, and what comes after — Lumi just fills in the bordered card with the sponsored content.</div>'),

    ('<span class="section-eyebrow">How it works</span>',
     '<span class="section-eyebrow" data-i18n="publish.aiapps.how_eyebrow">How it works</span>'),
    ('<h2 class="section-h">Sign up. Paste. Earn.</h2>',
     '<h2 class="section-h" data-i18n="publish.aiapps.how_h2">Sign up. Paste. Earn.</h2>'),
    ('<h4>Sign up</h4>',
     '<h4 data-i18n="publish.aiapps.how1_h4">Sign up</h4>'),
    ('<p>Copy your snippet from the dashboard. One publisher ID, ready to paste.</p>',
     '<p data-i18n="publish.aiapps.how1_p">Copy your snippet from the dashboard. One publisher ID, ready to paste.</p>'),
    ('<h4>Paste into your <code>&lt;head&gt;</code></h4>',
     '<h4 data-i18n="publish.aiapps.how2_h4_html" data-i18n-html>Paste into your <code>&lt;head&gt;</code></h4>'),
    ('<p>Async, lazy-loaded, zero impact on first paint. Works in Next.js, Nuxt, Remix, Vite, plain HTML.</p>',
     '<p data-i18n="publish.aiapps.how2_p">Async, lazy-loaded, zero impact on first paint. Works in Next.js, Nuxt, Remix, Vite, plain HTML.</p>'),
    ('<h4>Place ad slots</h4>',
     '<h4 data-i18n="publish.aiapps.how3_h4">Place ad slots</h4>'),
    ('<p>Drop a <code>&lt;div data-lumi-slot&gt;</code> wherever you want ads. Boost Boss renders the rest.</p>',
     '<p data-i18n="publish.aiapps.how3_p_html" data-i18n-html>Drop a <code>&lt;div data-lumi-slot&gt;</code> wherever you want ads. Boost Boss renders the rest.</p>'),

    ('<span class="section-eyebrow">Integration snippet</span>',
     '<span class="section-eyebrow" data-i18n="publish.aiapps.snippet_eyebrow">Integration snippet</span>'),
    ('<h2 class="section-h">One snippet. Any AI stack.</h2>',
     '<h2 class="section-h" data-i18n="publish.aiapps.snippet_h2">One snippet. Any AI stack.</h2>'),
    ('<p class="code-caption">That\'s the entire integration. Same snippet for OpenAI, Anthropic, Gemini, LangChain, Vercel AI SDK, CrewAI — Lumi works at the rendering surface, not the agent logic. <a href="/docs/js-snippet">Full docs →</a></p>',
     '<p class="code-caption" data-i18n="publish.aiapps.snippet_caption_html" data-i18n-html>That\'s the entire integration. Same snippet for OpenAI, Anthropic, Gemini, LangChain, Vercel AI SDK, CrewAI — Lumi works at the rendering surface, not the agent logic. <a href="/docs/js-snippet">Full docs →</a></p>'),
    ('<div class="shot-caption">A <code>&lt;div data-lumi-slot&gt;</code> placed below an answer. Style it to match your app — Lumi only renders the inner card.</div>',
     '<div class="shot-caption" data-i18n="publish.aiapps.snippet_shot_caption_html" data-i18n-html>A <code>&lt;div data-lumi-slot&gt;</code> placed below an answer. Style it to match your app — Lumi only renders the inner card.</div>'),

    ('<span class="section-eyebrow">Who this is for</span>',
     '<span class="section-eyebrow" data-i18n="publish.aiapps.who_eyebrow">Who this is for</span>'),
    ('<h2 class="section-h">If you ship AI in a browser, this is your path.</h2>',
     '<h2 class="section-h" data-i18n="publish.aiapps.who_h2">If you ship AI in a browser, this is your path.</h2>'),
    ('<li><span class="check">✓</span><span>You shipped an AI chat app, AI assistant, or AI tool with a web UI.</span></li>',
     '<li><span class="check">✓</span><span data-i18n="publish.aiapps.who_li1">You shipped an AI chat app, AI assistant, or AI tool with a web UI.</span></li>'),
    ('<li><span class="check">✓</span><span>You use any LLM provider — we don\'t care which.</span></li>',
     '<li><span class="check">✓</span><span data-i18n="publish.aiapps.who_li2">You use any LLM provider — we don\'t care which.</span></li>'),
    ('<li><span class="check">✓</span><span>You built with LangChain, Vercel AI SDK, CrewAI, LlamaIndex, AutoGen, Mastra, or rolled your own.</span></li>',
     '<li><span class="check">✓</span><span data-i18n="publish.aiapps.who_li3">You built with LangChain, Vercel AI SDK, CrewAI, LlamaIndex, AutoGen, Mastra, or rolled your own.</span></li>'),
    ('<li><span class="check">✓</span><span>You\'re tired of subscription churn as your only monetization.</span></li>',
     '<li><span class="check">✓</span><span data-i18n="publish.aiapps.who_li4">You\'re tired of subscription churn as your only monetization.</span></li>'),

    ('<span class="section-eyebrow">Revenue example</span>',
     '<span class="section-eyebrow" data-i18n="publish.aiapps.rev_eyebrow">Revenue example</span>'),
    ('<h2 class="section-h">What 5,000 daily users can earn.</h2>',
     '<h2 class="section-h" data-i18n="publish.aiapps.rev_h2">What 5,000 daily users can earn.</h2>'),
    ('<span class="label">Illustrative — not a guarantee</span>',
     '<span class="label" data-i18n="publish.aiapps.rev_label">Illustrative — not a guarantee</span>'),
    ('<div class="rev-row"><span>Daily active users</span><span class="v">5,000</span></div>',
     '<div class="rev-row"><span data-i18n="publish.aiapps.rev_row1">Daily active users</span><span class="v">5,000</span></div>'),
    ('<div class="rev-row"><span>Ad impressions per user per day</span><span class="v">~5</span></div>',
     '<div class="rev-row"><span data-i18n="publish.aiapps.rev_row2">Ad impressions per user per day</span><span class="v">~5</span></div>'),
    ('<div class="rev-row"><span>Daily impressions</span><span class="v">25,000</span></div>',
     '<div class="rev-row"><span data-i18n="publish.aiapps.rev_row3">Daily impressions</span><span class="v">25,000</span></div>'),
    ('<div class="rev-row"><span>Blended CPM</span><span class="v">$4</span></div>',
     '<div class="rev-row"><span data-i18n="publish.aiapps.rev_row4">Blended CPM</span><span class="v">$4</span></div>'),
    ('<div class="rev-row"><span>Monthly publisher revenue</span><span class="v">~$3,000</span></div>',
     '<div class="rev-row"><span data-i18n="publish.aiapps.rev_row5">Monthly publisher revenue</span><span class="v">~$3,000</span></div>'),
    ('<p class="disclaimer">Numbers are illustrative for an AI app with conversational UX. Actual revenue depends on session length, slot placement, fill rate, and audience. Verticals with stronger commercial intent (developer tooling, finance, B2B SaaS) typically run higher CPMs.</p>',
     '<p class="disclaimer" data-i18n="publish.aiapps.rev_disclaimer">Numbers are illustrative for an AI app with conversational UX. Actual revenue depends on session length, slot placement, fill rate, and audience. Verticals with stronger commercial intent (developer tooling, finance, B2B SaaS) typically run higher CPMs.</p>'),

    ('<span class="section-eyebrow">Frequently asked</span>',
     '<span class="section-eyebrow" data-i18n="publish.aiapps.faq_eyebrow">Frequently asked</span>'),
    ('<h2 class="section-h">The questions every AI app builder asks.</h2>',
     '<h2 class="section-h" data-i18n="publish.aiapps.faq_h2">The questions every AI app builder asks.</h2>'),
    ('<h4>Does this work with my agent framework?</h4>',
     '<h4 data-i18n="publish.aiapps.faq1_q">Does this work with my agent framework?</h4>'),
    ('<p>Yes. Lumi is framework-agnostic. We integrate at the rendering surface, not the agent logic — so LangChain, Vercel AI SDK, CrewAI, LlamaIndex, AutoGen, Mastra, or your own custom orchestration all work the same way.</p>',
     '<p data-i18n="publish.aiapps.faq1_a">Yes. Lumi is framework-agnostic. We integrate at the rendering surface, not the agent logic — so LangChain, Vercel AI SDK, CrewAI, LlamaIndex, AutoGen, Mastra, or your own custom orchestration all work the same way.</p>'),
    ('<h4>Will ads slow down my app?</h4>',
     '<h4 data-i18n="publish.aiapps.faq2_q">Will ads slow down my app?</h4>'),
    ('<p>No. The script is async and lazy-loaded — zero impact on first paint, no blocking on your bundle. Ad slots render after your AI surface is interactive.</p>',
     '<p data-i18n="publish.aiapps.faq2_a">No. The script is async and lazy-loaded — zero impact on first paint, no blocking on your bundle. Ad slots render after your AI surface is interactive.</p>'),
    ('<h4>What if I\'m using Server-Sent Events for streaming?</h4>',
     '<h4 data-i18n="publish.aiapps.faq3_q">What if I\'m using Server-Sent Events for streaming?</h4>'),
    ('<p>Lumi works alongside SSE. Ads render in your UI separately from your model\'s stream — you don\'t need to interleave anything. The ad slot is a sibling element, not a stream consumer.</p>',
     '<p data-i18n="publish.aiapps.faq3_a">Lumi works alongside SSE. Ads render in your UI separately from your model\'s stream — you don\'t need to interleave anything. The ad slot is a sibling element, not a stream consumer.</p>'),
    ('<h4>Can I theme the ads to match my UI?</h4>',
     '<h4 data-i18n="publish.aiapps.faq4_q">Can I theme the ads to match my UI?</h4>'),
    ('<p>Yes. Lumi reads your CSS variables for color and typography (<code>--lumi-primary</code>, <code>--lumi-text</code>, <code>--lumi-radius</code>, etc.). The default look is neutral; the themed look matches your brand.</p>',
     '<p data-i18n="publish.aiapps.faq4_a_html" data-i18n-html>Yes. Lumi reads your CSS variables for color and typography (<code>--lumi-primary</code>, <code>--lumi-text</code>, <code>--lumi-radius</code>, etc.). The default look is neutral; the themed look matches your brand.</p>'),
    ('<h4>Can I run my own ads alongside Boost Boss?</h4>',
     '<h4 data-i18n="publish.aiapps.faq5_q">Can I run my own ads alongside Boost Boss?</h4>'),
    ('<p>Yes. We don\'t lock down inventory. Boost Boss renders only in slots you explicitly tag with <code>data-lumi-slot</code> — everything else is yours.</p>',
     '<p data-i18n="publish.aiapps.faq5_a_html" data-i18n-html>Yes. We don\'t lock down inventory. Boost Boss renders only in slots you explicitly tag with <code>data-lumi-slot</code> — everything else is yours.</p>'),

    ('<h2>Ready to monetize your AI app?</h2>',
     '<h2 data-i18n="publish.aiapps.cta_h2">Ready to monetize your AI app?</h2>'),
    ('<p>One snippet. Five minutes. Weekly payouts.</p>',
     '<p data-i18n="publish.aiapps.cta_p">One snippet. Five minutes. Weekly payouts.</p>'),
    ('<a class="btn btn-primary btn-lg" href="/publish/signup">Apply as a Founding Publisher →</a>',
     '<a class="btn btn-primary btn-lg" href="/publish/signup" data-i18n="publish.aiapps.cta_btn">Apply as a Founding Publisher →</a>'),

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
