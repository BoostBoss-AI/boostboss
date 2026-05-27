#!/usr/bin/env python3
"""i18n tagger for /publish/extensions."""
import json, os

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..'))
PAGE = os.path.join(ROOT, 'public', 'publish-extensions.html')
I18N_DIR = os.path.join(ROOT, 'public', 'i18n')

EN = {
    "publish.ext.hero_eyebrow": "For Browser Extension Developers",
    "publish.ext.hero_h1_html": "Real revenue for AI extensions. <span class=\"grad\">No surveillance, no malware.</span>",
    "publish.ext.hero_sub": "Most extension monetization options are sketchy. Boost Boss is built for AI-native extensions — clean SDK, contextual ads, transparent reporting.",
    "publish.ext.hero_cta": "Start as a publisher →",

    "publish.ext.see_eyebrow": "See it appear",
    "publish.ext.see_h2_html": "Lives in your side panel.<br>Renders contextually with the page.",
    "publish.ext.see_sub": "Manifest v3 native. Service-worker safe. Targets from on-page context — never user surveillance.",
    "publish.ext.see_caption": "The sponsored block sits at the bottom of your panel, contextual to whatever the user is reading. Targeting comes from page DOM context — clean, surveillance-free.",

    "publish.ext.how_eyebrow": "How it works",
    "publish.ext.how_h2": "Install. Render. Earn.",
    "publish.ext.how1_h4": "Install via npm",
    "publish.ext.how1_p_html": "Add <code>@boostbossai/lumi-sdk</code> to your extension. Manifest v3 native, service-worker safe.",
    "publish.ext.how2_h4": "Render in your UI",
    "publish.ext.how2_p": "Drop Lumi into your sidebar, popup, or content script. One element, one mount call.",
    "publish.ext.how3_h4": "Earn per impression and click",
    "publish.ext.how3_p": "Contextual targeting from page context — never surveillance. Weekly Stripe payouts.",

    "publish.ext.snippet_eyebrow": "Integration snippet",
    "publish.ext.snippet_h2": "A few lines, your sidebar component.",
    "publish.ext.snippet_caption_html": "Manifest v3 compatible. Works in service workers, content scripts, sidepanel, and popups. <a href=\"/docs/npm-sdk\">Full docs →</a>",
    "publish.ext.snippet_shot_caption": "Side panel format. The extension owns the chrome — Lumi only renders the bordered card.",

    "publish.ext.who_eyebrow": "Who this is for",
    "publish.ext.who_h2": "If your extension renders AI output, this is your path.",
    "publish.ext.who_li1": "You shipped a Chrome, Edge, or Firefox extension with AI features.",
    "publish.ext.who_li2": "Examples: writing assistants, AI sidebars, summarizers, translators, research tools, AI-augmented browsing.",
    "publish.ext.who_li3": "You're avoiding \"monetization SDKs\" with surveillance baggage that put your store listing at risk.",
    "publish.ext.who_li4": "You want a revenue stream that won't get you flagged on the next Chrome Web Store review.",

    "publish.ext.rev_eyebrow": "Revenue example",
    "publish.ext.rev_h2": "What 30,000 daily users can earn.",
    "publish.ext.rev_label": "Illustrative — not a guarantee",
    "publish.ext.rev_row1": "Daily active users",
    "publish.ext.rev_row2": "Ad impressions per user per day",
    "publish.ext.rev_row3": "Daily impressions",
    "publish.ext.rev_row4": "CPM",
    "publish.ext.rev_row5": "Monthly publisher revenue",
    "publish.ext.rev_disclaimer": "Numbers are illustrative for an established AI extension with daily-driver usage. Actual revenue depends on session length, ad slot placement, fill rate, and audience composition. Productivity-focused extensions (writing, research, dev tools) typically run higher CPMs than general-purpose ones.",

    "publish.ext.faq_eyebrow": "Frequently asked",
    "publish.ext.faq_h2": "The questions every extension dev asks.",
    "publish.ext.faq1_q": "Will Chrome Web Store flag this?",
    "publish.ext.faq1_a": "No. Lumi is compliant with Chrome Web Store policies. Ads are clearly disclosed; no hidden behavior, no permission creep, no remote-hosted code execution. Same compliance posture for Edge and Firefox stores.",
    "publish.ext.faq2_q": "Manifest v3 support?",
    "publish.ext.faq2_a_html": "Native. Lumi runs in service workers and uses declarative network rules — no remotely-hosted code, no <code>eval</code>, no patterns that v3 review rejects.",
    "publish.ext.faq3_q": "Will Lumi sell my user data?",
    "publish.ext.faq3_a": "No. Boost Boss does not sell user data and has no third-party tracking pixels. All targeting is contextual — derived from on-page or in-extension content at request time, never persisted into a user profile.",
    "publish.ext.faq4_q": "Can I run on top of an existing freemium model?",
    "publish.ext.faq4_a": "Yes — most of our extension publishers do exactly this. Show ads to free users, hide them for Pro subscribers, all controlled by your own paywall logic.",
    "publish.ext.faq5_q": "What about CSP restrictions in extension contexts?",
    "publish.ext.faq5_a_html": "Lumi works within strict CSP. Our SDK doesn't require <code>unsafe-eval</code> or <code>unsafe-inline</code>; ad creative renders inside an isolated mount point you control.",

    "publish.ext.cta_h2": "Ready to monetize your extension?",
    "publish.ext.cta_p": "Manifest v3 native. No surveillance. Weekly payouts.",
    "publish.ext.cta_btn": "Apply as a Founding Publisher →",
}

ZH = {
    "publish.ext.hero_eyebrow": "面向浏览器扩展开发者",
    "publish.ext.hero_h1_html": "AI 扩展也能有真正的收入。<span class=\"grad\">不监控,不夹带恶意代码。</span>",
    "publish.ext.hero_sub": "市面上大多数扩展变现方案都很可疑。Boost Boss 专为 AI 原生扩展打造 — 干净的 SDK、基于上下文的广告、透明的数据报告。",
    "publish.ext.hero_cta": "以发布商身份开始 →",

    "publish.ext.see_eyebrow": "看它出现",
    "publish.ext.see_h2_html": "落在你的侧边栏里。<br>依据页面上下文渲染。",
    "publish.ext.see_sub": "原生支持 Manifest v3。Service worker 安全。基于页面上下文定向 — 不做用户监控。",
    "publish.ext.see_caption": "赞助区块落在你面板底部,与用户正在阅读的内容相关。定向来自页面 DOM 上下文 — 干净、无监控。",

    "publish.ext.how_eyebrow": "工作原理",
    "publish.ext.how_h2": "安装。渲染。赚钱。",
    "publish.ext.how1_h4": "通过 npm 安装",
    "publish.ext.how1_p_html": "在你的扩展里加 <code>@boostbossai/lumi-sdk</code>。原生支持 Manifest v3,service worker 安全。",
    "publish.ext.how2_h4": "在你的 UI 中渲染",
    "publish.ext.how2_p": "把 Lumi 放进侧边栏、弹窗或 content script。一个元素、一次 mount 调用。",
    "publish.ext.how3_h4": "按展示和点击赚钱",
    "publish.ext.how3_p": "基于页面上下文定向 — 不做监控。每周 Stripe 打款。",

    "publish.ext.snippet_eyebrow": "集成代码",
    "publish.ext.snippet_h2": "几行代码,你的侧边栏组件。",
    "publish.ext.snippet_caption_html": "兼容 Manifest v3。可在 service workers、content scripts、sidepanel 和弹窗中工作。<a href=\"/docs/npm-sdk\">完整文档 →</a>",
    "publish.ext.snippet_shot_caption": "侧边栏格式。扩展拥有外壳 — Lumi 只渲染带边框的卡片。",

    "publish.ext.who_eyebrow": "适合谁",
    "publish.ext.who_h2": "如果你的扩展会渲染 AI 输出,这就是你的路径。",
    "publish.ext.who_li1": "你做了一个带 AI 功能的 Chrome、Edge 或 Firefox 扩展。",
    "publish.ext.who_li2": "示例:写作助手、AI 侧边栏、摘要工具、翻译工具、研究工具、AI 增强浏览。",
    "publish.ext.who_li3": "你不想用那些带监控包袱、可能让你商店上架变危险的“变现 SDK”。",
    "publish.ext.who_li4": "你想要一个不会让你在下次 Chrome Web Store 审核时被标记的收入来源。",

    "publish.ext.rev_eyebrow": "收入示例",
    "publish.ext.rev_h2": "30,000 日活能赚多少。",
    "publish.ext.rev_label": "仅供示意 — 不构成保证",
    "publish.ext.rev_row1": "日活用户",
    "publish.ext.rev_row2": "每用户每日广告展示数",
    "publish.ext.rev_row3": "每日展示数",
    "publish.ext.rev_row4": "CPM",
    "publish.ext.rev_row5": "每月发布商收入",
    "publish.ext.rev_disclaimer": "数字仅为示意,以日常使用、已成型的 AI 扩展为基准。实际收入取决于会话长度、广告 slot 位置、填充率和受众构成。生产力类扩展(写作、研究、开发工具)通常比通用类扩展 CPM 更高。",

    "publish.ext.faq_eyebrow": "常见问题",
    "publish.ext.faq_h2": "每个扩展开发者都会问的问题。",
    "publish.ext.faq1_q": "Chrome Web Store 会标记我吗?",
    "publish.ext.faq1_a": "不会。Lumi 符合 Chrome Web Store 政策。广告清晰披露;无隐藏行为、无权限扩张、无远程代码执行。Edge 和 Firefox 商店的合规姿态相同。",
    "publish.ext.faq2_q": "支持 Manifest v3 吗?",
    "publish.ext.faq2_a_html": "原生支持。Lumi 在 service worker 中运行,使用声明式网络规则 — 不依赖远程代码、不用 <code>eval</code>、不踩 v3 审核会拒的模式。",
    "publish.ext.faq3_q": "Lumi 会卖我的用户数据吗?",
    "publish.ext.faq3_a": "不会。Boost Boss 不出售用户数据,也没有第三方追踪像素。所有定向都是上下文定向 — 在请求时从页面或扩展内容中提取,绝不持久化到用户画像里。",
    "publish.ext.faq4_q": "我可以在 freemium 之上再加广告吗?",
    "publish.ext.faq4_a": "可以 — 我们大多数扩展发布商正是这样做的。向免费用户展示广告,对 Pro 订阅者隐藏,全由你自己的 paywall 逻辑控制。",
    "publish.ext.faq5_q": "扩展上下文的 CSP 限制怎么办?",
    "publish.ext.faq5_a_html": "Lumi 在严格 CSP 下工作。我们的 SDK 不需要 <code>unsafe-eval</code> 或 <code>unsafe-inline</code>;广告素材渲染在你控制的隔离 mount 点内。",

    "publish.ext.cta_h2": "准备好让你的扩展变现了吗?",
    "publish.ext.cta_p": "原生支持 Manifest v3。不做监控。每周打款。",
    "publish.ext.cta_btn": "申请成为创始发布商 →",
}

ZH_TW = {
    "publish.ext.hero_eyebrow": "面向瀏覽器擴充功能開發者",
    "publish.ext.hero_h1_html": "AI 擴充功能也能有真正的收益。<span class=\"grad\">不監控,不夾帶惡意程式。</span>",
    "publish.ext.hero_sub": "市面上多數擴充功能變現方案都很可疑。Boost Boss 為 AI 原生擴充功能打造 — 乾淨的 SDK、情境式廣告、透明的數據報告。",
    "publish.ext.hero_cta": "以發布商身分開始 →",

    "publish.ext.see_eyebrow": "看看它出現的樣子",
    "publish.ext.see_h2_html": "落在你的側邊欄裡。<br>依頁面情境渲染。",
    "publish.ext.see_sub": "原生支援 Manifest v3。Service worker 安全。依頁面情境定向 — 不做使用者監控。",
    "publish.ext.see_caption": "贊助區塊落在你面板底部,與使用者正在閱讀的內容相關。定向源自頁面 DOM 情境 — 乾淨、無監控。",

    "publish.ext.how_eyebrow": "運作方式",
    "publish.ext.how_h2": "安裝。渲染。賺取收益。",
    "publish.ext.how1_h4": "透過 npm 安裝",
    "publish.ext.how1_p_html": "在你的擴充功能加入 <code>@boostbossai/lumi-sdk</code>。原生支援 Manifest v3,service worker 安全。",
    "publish.ext.how2_h4": "在你的 UI 中渲染",
    "publish.ext.how2_p": "把 Lumi 放進側邊欄、彈窗或 content script。一個元素、一次 mount 呼叫。",
    "publish.ext.how3_h4": "按曝光與點擊賺取收益",
    "publish.ext.how3_p": "依頁面情境定向 — 不做監控。每週 Stripe 撥款。",

    "publish.ext.snippet_eyebrow": "整合程式碼",
    "publish.ext.snippet_h2": "幾行程式碼,你的側邊欄元件。",
    "publish.ext.snippet_caption_html": "相容 Manifest v3。可於 service workers、content scripts、sidepanel 與彈窗中運作。<a href=\"/docs/npm-sdk\">完整文件 →</a>",
    "publish.ext.snippet_shot_caption": "側邊欄格式。擴充功能擁有外觀 — Lumi 只渲染帶邊框的卡片。",

    "publish.ext.who_eyebrow": "適合誰",
    "publish.ext.who_h2": "如果你的擴充功能會渲染 AI 輸出,這就是你的路徑。",
    "publish.ext.who_li1": "你做了一個帶 AI 功能的 Chrome、Edge 或 Firefox 擴充功能。",
    "publish.ext.who_li2": "範例:寫作助手、AI 側邊欄、摘要工具、翻譯工具、研究工具、AI 增強瀏覽。",
    "publish.ext.who_li3": "你不想用那些帶監控包袱、可能讓你商店上架變危險的「變現 SDK」。",
    "publish.ext.who_li4": "你想要一個不會讓你在下次 Chrome Web Store 審核時被標記的收益來源。",

    "publish.ext.rev_eyebrow": "收益範例",
    "publish.ext.rev_h2": "30,000 日活躍能賺多少。",
    "publish.ext.rev_label": "僅供示意 — 不構成保證",
    "publish.ext.rev_row1": "日活躍使用者",
    "publish.ext.rev_row2": "每位使用者每日廣告曝光數",
    "publish.ext.rev_row3": "每日曝光數",
    "publish.ext.rev_row4": "CPM",
    "publish.ext.rev_row5": "每月發布商收益",
    "publish.ext.rev_disclaimer": "數字僅為示意,以日常使用、已成型的 AI 擴充功能為基準。實際收益取決於工作階段長度、廣告 slot 位置、填充率與受眾組成。生產力類擴充功能(寫作、研究、開發工具)通常比通用類 CPM 更高。",

    "publish.ext.faq_eyebrow": "常見問題",
    "publish.ext.faq_h2": "每位擴充功能開發者都會問的問題。",
    "publish.ext.faq1_q": "Chrome Web Store 會標記我嗎?",
    "publish.ext.faq1_a": "不會。Lumi 符合 Chrome Web Store 政策。廣告清楚揭露;沒有隱藏行為、沒有權限擴張、沒有遠端程式碼執行。Edge 與 Firefox 商店合規態度相同。",
    "publish.ext.faq2_q": "支援 Manifest v3 嗎?",
    "publish.ext.faq2_a_html": "原生支援。Lumi 於 service worker 中運作,使用宣告式網路規則 — 不依賴遠端程式碼、不用 <code>eval</code>、不採用 v3 審查會拒絕的模式。",
    "publish.ext.faq3_q": "Lumi 會販售我的使用者資料嗎?",
    "publish.ext.faq3_a": "不會。Boost Boss 不販售使用者資料,也沒有第三方追蹤像素。所有定向皆為情境式定向 — 在請求當下從頁面或擴充功能內容擷取,絕不保留為使用者輪廓。",
    "publish.ext.faq4_q": "我可以在現有 freemium 之上加廣告嗎?",
    "publish.ext.faq4_a": "可以 — 我們大多數擴充功能發布商就是這樣做。對免費使用者顯示廣告,對 Pro 訂閱者隱藏,全由你自己的 paywall 邏輯控制。",
    "publish.ext.faq5_q": "擴充功能情境下的 CSP 限制怎麼辦?",
    "publish.ext.faq5_a_html": "Lumi 可於嚴格 CSP 下運作。我們的 SDK 不需要 <code>unsafe-eval</code> 或 <code>unsafe-inline</code>;廣告素材渲染於你掌控的隔離 mount 點內。",

    "publish.ext.cta_h2": "準備好讓你的擴充功能變現了嗎?",
    "publish.ext.cta_p": "原生支援 Manifest v3。不做監控。每週撥款。",
    "publish.ext.cta_btn": "申請成為創始發布商 →",
}

JA = {
    "publish.ext.hero_eyebrow": "ブラウザ拡張機能開発者向け",
    "publish.ext.hero_h1_html": "AI 拡張機能に本物の収益を。<span class=\"grad\">監視なし、マルウェアなし。</span>",
    "publish.ext.hero_sub": "拡張機能のマネタイズ手段はたいてい怪しい。Boost Boss は AI ネイティブな拡張機能のために作られています — クリーンな SDK、コンテキスト広告、透明なレポート。",
    "publish.ext.hero_cta": "パブリッシャーとして始める →",

    "publish.ext.see_eyebrow": "実際の見え方",
    "publish.ext.see_h2_html": "サイドパネルの中で生きる。<br>ページに応じてコンテキストで描画。",
    "publish.ext.see_sub": "Manifest v3 ネイティブ。Service worker セーフ。ターゲティングはページ上のコンテキストから — ユーザー監視は一切しません。",
    "publish.ext.see_caption": "スポンサーブロックはパネル下部に配置され、ユーザーが読んでいる内容に応じたコンテキストです。ターゲティングはページ DOM のコンテキストから — クリーンで監視なし。",

    "publish.ext.how_eyebrow": "仕組み",
    "publish.ext.how_h2": "インストール。描画。収益化。",
    "publish.ext.how1_h4": "npm でインストール",
    "publish.ext.how1_p_html": "拡張機能に <code>@boostbossai/lumi-sdk</code> を追加。Manifest v3 ネイティブ、service worker セーフ。",
    "publish.ext.how2_h4": "UI に描画",
    "publish.ext.how2_p": "Lumi をサイドバー、ポップアップ、コンテンツスクリプトに配置。1 つの要素、1 回の mount 呼び出し。",
    "publish.ext.how3_h4": "インプレッションとクリックで収益",
    "publish.ext.how3_p": "ページコンテキストからのコンテキストターゲティング — 監視なし。週次 Stripe 支払い。",

    "publish.ext.snippet_eyebrow": "統合スニペット",
    "publish.ext.snippet_h2": "数行で、サイドバーコンポーネントに。",
    "publish.ext.snippet_caption_html": "Manifest v3 互換。Service workers、コンテンツスクリプト、sidepanel、ポップアップで動作。<a href=\"/docs/npm-sdk\">完全ドキュメント →</a>",
    "publish.ext.snippet_shot_caption": "サイドパネル形式。拡張機能が外観を所有 — Lumi は枠付きカードだけを描画します。",

    "publish.ext.who_eyebrow": "向いている人",
    "publish.ext.who_h2": "拡張機能が AI 出力を描画するなら、これがあなたの道です。",
    "publish.ext.who_li1": "AI 機能付きの Chrome、Edge、Firefox 拡張機能を出している。",
    "publish.ext.who_li2": "例: ライティングアシスタント、AI サイドバー、要約ツール、翻訳ツール、リサーチツール、AI 強化ブラウジング。",
    "publish.ext.who_li3": "ストア掲載をリスクにさらす監視付き「マネタイズ SDK」は使いたくない。",
    "publish.ext.who_li4": "次の Chrome Web Store 審査でフラグ立てされない収益源が欲しい。",

    "publish.ext.rev_eyebrow": "収益例",
    "publish.ext.rev_h2": "日次 30,000 ユーザーで得られる収益。",
    "publish.ext.rev_label": "あくまで例 — 保証ではありません",
    "publish.ext.rev_row1": "日次アクティブユーザー",
    "publish.ext.rev_row2": "1 ユーザー 1 日あたりの広告インプレッション",
    "publish.ext.rev_row3": "日次インプレッション",
    "publish.ext.rev_row4": "CPM",
    "publish.ext.rev_row5": "月間パブリッシャー収益",
    "publish.ext.rev_disclaimer": "数値は日常使用される定着した AI 拡張機能を想定した例示です。実際の収益はセッション長、広告スロット配置、フィル率、オーディエンス構成に左右されます。生産性系拡張機能(ライティング、リサーチ、開発ツール)は通常、汎用拡張より CPM が高くなります。",

    "publish.ext.faq_eyebrow": "よくある質問",
    "publish.ext.faq_h2": "拡張機能開発者が必ず聞く質問。",
    "publish.ext.faq1_q": "Chrome Web Store にフラグ立てされませんか?",
    "publish.ext.faq1_a": "されません。Lumi は Chrome Web Store ポリシーに準拠しています。広告は明示的に開示され、隠れた動作、権限肥大化、リモートコード実行は一切ありません。Edge、Firefox ストアでも同じ準拠姿勢です。",
    "publish.ext.faq2_q": "Manifest v3 サポートは?",
    "publish.ext.faq2_a_html": "ネイティブ対応。Lumi は service worker で動作し、宣言的ネットワークルールを使用 — リモートコードなし、<code>eval</code> なし、v3 審査が拒否するパターンを使いません。",
    "publish.ext.faq3_q": "Lumi はユーザーデータを売りますか?",
    "publish.ext.faq3_a": "売りません。Boost Boss はユーザーデータを販売せず、サードパーティトラッキングピクセルもありません。ターゲティングはすべてコンテキスト型 — リクエスト時にページや拡張内コンテンツから取り出し、ユーザープロファイルとして永続化しません。",
    "publish.ext.faq4_q": "既存のフリーミアムモデルの上で動かせますか?",
    "publish.ext.faq4_a": "はい — 拡張機能パブリッシャーのほとんどがそうしています。無料ユーザーには広告を表示し、Pro 加入者には非表示にする、すべて自前のペイウォールロジックで制御。",
    "publish.ext.faq5_q": "拡張機能コンテキストの CSP 制限は?",
    "publish.ext.faq5_a_html": "Lumi は厳格な CSP でも動作します。SDK は <code>unsafe-eval</code> や <code>unsafe-inline</code> を必要とせず、広告クリエイティブはあなたが制御する分離された mount ポイント内で描画されます。",

    "publish.ext.cta_h2": "拡張機能で収益化する準備はできましたか?",
    "publish.ext.cta_p": "Manifest v3 ネイティブ。監視なし。週次支払い。",
    "publish.ext.cta_btn": "ファウンディングパブリッシャーとして申し込む →",
}

KO = {
    "publish.ext.hero_eyebrow": "브라우저 확장 개발자용",
    "publish.ext.hero_h1_html": "AI 확장 프로그램에 진짜 수익을. <span class=\"grad\">감시 없음, 멀웨어 없음.</span>",
    "publish.ext.hero_sub": "확장 프로그램 수익화 옵션은 대부분 미심쩍습니다. Boost Boss는 AI 네이티브 확장을 위해 만들어졌습니다 — 깨끗한 SDK, 컨텍스트 광고, 투명한 리포팅.",
    "publish.ext.hero_cta": "퍼블리셔로 시작하기 →",

    "publish.ext.see_eyebrow": "이렇게 보입니다",
    "publish.ext.see_h2_html": "당신의 사이드 패널 안에 살고,<br>페이지에 맞춰 컨텍스트로 렌더링됩니다.",
    "publish.ext.see_sub": "Manifest v3 네이티브. Service worker 안전. 페이지 컨텍스트에서 타겟팅 — 사용자 감시 없음.",
    "publish.ext.see_caption": "스폰서 블록은 패널 하단에 위치하며 사용자가 읽고 있는 내용에 맞춰집니다. 타겟팅은 페이지 DOM 컨텍스트에서 — 깨끗하고 감시 없음.",

    "publish.ext.how_eyebrow": "동작 방식",
    "publish.ext.how_h2": "설치. 렌더링. 수익화.",
    "publish.ext.how1_h4": "npm으로 설치",
    "publish.ext.how1_p_html": "확장 프로그램에 <code>@boostbossai/lumi-sdk</code>를 추가하세요. Manifest v3 네이티브, service worker 안전.",
    "publish.ext.how2_h4": "UI에서 렌더링",
    "publish.ext.how2_p": "Lumi를 사이드바, 팝업, 콘텐츠 스크립트에 배치하세요. 요소 하나, 마운트 한 번.",
    "publish.ext.how3_h4": "임프레션과 클릭당 수익",
    "publish.ext.how3_p": "페이지 컨텍스트에서 컨텍스트 타겟팅 — 감시 없음. 주간 Stripe 정산.",

    "publish.ext.snippet_eyebrow": "통합 스니펫",
    "publish.ext.snippet_h2": "몇 줄, 당신의 사이드바 컴포넌트.",
    "publish.ext.snippet_caption_html": "Manifest v3 호환. Service workers, 콘텐츠 스크립트, sidepanel, 팝업에서 동작. <a href=\"/docs/npm-sdk\">전체 문서 →</a>",
    "publish.ext.snippet_shot_caption": "사이드 패널 포맷. 확장 프로그램이 외관을 소유 — Lumi는 테두리 있는 카드만 렌더링.",

    "publish.ext.who_eyebrow": "이런 분에게 맞습니다",
    "publish.ext.who_h2": "확장 프로그램이 AI 출력을 렌더링한다면 이게 경로입니다.",
    "publish.ext.who_li1": "AI 기능을 갖춘 Chrome, Edge, Firefox 확장 프로그램을 배포했다.",
    "publish.ext.who_li2": "예: 글쓰기 어시스턴트, AI 사이드바, 요약기, 번역기, 리서치 도구, AI 강화 브라우징.",
    "publish.ext.who_li3": "스토어 등록을 위험에 빠뜨리는 감시 부담을 가진 \"수익화 SDK\"를 피하고 있다.",
    "publish.ext.who_li4": "다음 Chrome Web Store 심사에서 플래그되지 않을 수익원을 원한다.",

    "publish.ext.rev_eyebrow": "수익 예시",
    "publish.ext.rev_h2": "일 30,000 사용자가 벌 수 있는 금액.",
    "publish.ext.rev_label": "예시일 뿐 — 보장이 아닙니다",
    "publish.ext.rev_row1": "일일 활성 사용자",
    "publish.ext.rev_row2": "사용자당 일일 광고 임프레션",
    "publish.ext.rev_row3": "일일 임프레션",
    "publish.ext.rev_row4": "CPM",
    "publish.ext.rev_row5": "월간 퍼블리셔 수익",
    "publish.ext.rev_disclaimer": "수치는 일상적으로 사용되는 자리 잡은 AI 확장 프로그램을 가정한 예시입니다. 실제 수익은 세션 길이, 광고 슬롯 배치, 채움률, 오디언스 구성에 따라 달라집니다. 생산성 중심 확장(글쓰기, 리서치, 개발 도구)은 일반 목적 확장보다 CPM이 높은 편입니다.",

    "publish.ext.faq_eyebrow": "자주 묻는 질문",
    "publish.ext.faq_h2": "모든 확장 개발자가 묻는 질문.",
    "publish.ext.faq1_q": "Chrome Web Store가 이걸 플래그하나요?",
    "publish.ext.faq1_a": "아니요. Lumi는 Chrome Web Store 정책을 준수합니다. 광고는 명확히 공개되며, 숨겨진 동작, 권한 부풀리기, 원격 호스팅 코드 실행이 없습니다. Edge와 Firefox 스토어에서도 동일한 준수 자세입니다.",
    "publish.ext.faq2_q": "Manifest v3 지원은?",
    "publish.ext.faq2_a_html": "네이티브. Lumi는 service worker에서 실행되고 선언적 네트워크 규칙을 사용합니다 — 원격 호스팅 코드 없음, <code>eval</code> 없음, v3 심사가 거부하는 패턴 없음.",
    "publish.ext.faq3_q": "Lumi가 내 사용자 데이터를 팔까요?",
    "publish.ext.faq3_a": "아니요. Boost Boss는 사용자 데이터를 판매하지 않고 서드파티 트래킹 픽셀도 없습니다. 모든 타겟팅은 컨텍스트형 — 요청 시점에 페이지나 확장 내 콘텐츠에서 추출하며 사용자 프로필로 영속화하지 않습니다.",
    "publish.ext.faq4_q": "기존 freemium 모델 위에 얹을 수 있나요?",
    "publish.ext.faq4_a": "네 — 우리 확장 퍼블리셔 대부분이 그렇게 합니다. 무료 사용자에게는 광고를 보여주고 Pro 구독자에게는 숨기는 것을 모두 자체 페이월 로직으로 제어합니다.",
    "publish.ext.faq5_q": "확장 컨텍스트의 CSP 제한은요?",
    "publish.ext.faq5_a_html": "Lumi는 엄격한 CSP에서도 작동합니다. SDK는 <code>unsafe-eval</code>이나 <code>unsafe-inline</code>을 요구하지 않으며, 광고 크리에이티브는 당신이 제어하는 격리된 마운트 포인트 안에서 렌더링됩니다.",

    "publish.ext.cta_h2": "확장 프로그램으로 수익화할 준비가 되셨나요?",
    "publish.ext.cta_p": "Manifest v3 네이티브. 감시 없음. 주간 정산.",
    "publish.ext.cta_btn": "파운딩 퍼블리셔로 신청하기 →",
}

VI = {
    "publish.ext.hero_eyebrow": "Dành cho nhà phát triển tiện ích trình duyệt",
    "publish.ext.hero_h1_html": "Doanh thu thật cho tiện ích AI. <span class=\"grad\">Không giám sát, không malware.</span>",
    "publish.ext.hero_sub": "Đa số phương án kiếm tiền từ tiện ích đều mờ ám. Boost Boss được xây cho tiện ích AI-native — SDK sạch, quảng cáo theo ngữ cảnh, báo cáo minh bạch.",
    "publish.ext.hero_cta": "Bắt đầu với tư cách publisher →",

    "publish.ext.see_eyebrow": "Xem nó xuất hiện",
    "publish.ext.see_h2_html": "Sống trong side panel của bạn.<br>Render theo ngữ cảnh trang.",
    "publish.ext.see_sub": "Manifest v3 native. An toàn với service worker. Target từ ngữ cảnh trang — không giám sát người dùng.",
    "publish.ext.see_caption": "Khối sponsored nằm ở dưới panel, theo ngữ cảnh nội dung người dùng đang đọc. Targeting từ DOM context của trang — sạch, không giám sát.",

    "publish.ext.how_eyebrow": "Cách hoạt động",
    "publish.ext.how_h2": "Cài đặt. Render. Kiếm tiền.",
    "publish.ext.how1_h4": "Cài qua npm",
    "publish.ext.how1_p_html": "Thêm <code>@boostbossai/lumi-sdk</code> vào tiện ích của bạn. Manifest v3 native, an toàn với service worker.",
    "publish.ext.how2_h4": "Render trong UI của bạn",
    "publish.ext.how2_p": "Đặt Lumi vào sidebar, popup, hoặc content script. Một element, một lần mount.",
    "publish.ext.how3_h4": "Kiếm tiền theo impression và click",
    "publish.ext.how3_p": "Targeting theo ngữ cảnh từ context trang — không giám sát. Thanh toán Stripe hàng tuần.",

    "publish.ext.snippet_eyebrow": "Đoạn code tích hợp",
    "publish.ext.snippet_h2": "Vài dòng, component sidebar của bạn.",
    "publish.ext.snippet_caption_html": "Tương thích Manifest v3. Chạy được trong service workers, content scripts, sidepanel và popups. <a href=\"/docs/npm-sdk\">Tài liệu đầy đủ →</a>",
    "publish.ext.snippet_shot_caption": "Định dạng side panel. Tiện ích sở hữu giao diện — Lumi chỉ render thẻ có viền.",

    "publish.ext.who_eyebrow": "Dành cho ai",
    "publish.ext.who_h2": "Nếu tiện ích của bạn render output AI, đây là đường của bạn.",
    "publish.ext.who_li1": "Bạn đã ship một tiện ích Chrome, Edge hoặc Firefox có tính năng AI.",
    "publish.ext.who_li2": "Ví dụ: trợ lý viết, AI sidebar, công cụ tóm tắt, công cụ dịch, công cụ nghiên cứu, duyệt web tăng cường AI.",
    "publish.ext.who_li3": "Bạn đang tránh các \"SDK kiếm tiền\" mang gánh nặng giám sát, đe dọa listing trên store.",
    "publish.ext.who_li4": "Bạn muốn nguồn doanh thu không bị flag trong lần review Chrome Web Store tiếp theo.",

    "publish.ext.rev_eyebrow": "Ví dụ doanh thu",
    "publish.ext.rev_h2": "30,000 người dùng mỗi ngày có thể kiếm được bao nhiêu.",
    "publish.ext.rev_label": "Chỉ mang tính minh họa — không phải cam kết",
    "publish.ext.rev_row1": "Người dùng hoạt động mỗi ngày",
    "publish.ext.rev_row2": "Impression quảng cáo trên mỗi người dùng mỗi ngày",
    "publish.ext.rev_row3": "Impression mỗi ngày",
    "publish.ext.rev_row4": "CPM",
    "publish.ext.rev_row5": "Doanh thu publisher hàng tháng",
    "publish.ext.rev_disclaimer": "Con số mang tính minh họa cho tiện ích AI đã có chỗ đứng, được dùng hàng ngày. Doanh thu thực tế tùy vào độ dài phiên, vị trí slot quảng cáo, fill rate và thành phần audience. Tiện ích thiên về năng suất (viết, nghiên cứu, dev tools) thường có CPM cao hơn loại đa năng.",

    "publish.ext.faq_eyebrow": "Câu hỏi thường gặp",
    "publish.ext.faq_h2": "Những câu mà mọi dev tiện ích đều hỏi.",
    "publish.ext.faq1_q": "Chrome Web Store có flag cái này không?",
    "publish.ext.faq1_a": "Không. Lumi tuân thủ chính sách Chrome Web Store. Quảng cáo được khai báo rõ ràng; không có hành vi ẩn, không bành trướng quyền, không thực thi code remote. Cùng tư thế tuân thủ với Edge và Firefox store.",
    "publish.ext.faq2_q": "Hỗ trợ Manifest v3?",
    "publish.ext.faq2_a_html": "Native. Lumi chạy trong service workers và dùng declarative network rules — không code remote, không <code>eval</code>, không pattern bị v3 review từ chối.",
    "publish.ext.faq3_q": "Lumi có bán dữ liệu người dùng của tôi không?",
    "publish.ext.faq3_a": "Không. Boost Boss không bán dữ liệu người dùng và không có tracking pixel bên thứ ba. Mọi targeting đều theo ngữ cảnh — lấy từ nội dung trên trang hoặc trong tiện ích lúc request, không lưu vào profile người dùng.",
    "publish.ext.faq4_q": "Tôi có thể chạy trên mô hình freemium hiện có không?",
    "publish.ext.faq4_a": "Có — phần lớn publisher tiện ích của chúng tôi làm chính xác như vậy. Hiển thị quảng cáo cho user free, ẩn với user Pro, tất cả do logic paywall của bạn điều khiển.",
    "publish.ext.faq5_q": "Còn các hạn chế CSP trong ngữ cảnh tiện ích thì sao?",
    "publish.ext.faq5_a_html": "Lumi chạy trong CSP nghiêm ngặt. SDK của chúng tôi không cần <code>unsafe-eval</code> hay <code>unsafe-inline</code>; creative quảng cáo render bên trong một mount point cô lập do bạn kiểm soát.",

    "publish.ext.cta_h2": "Sẵn sàng kiếm tiền từ tiện ích của bạn?",
    "publish.ext.cta_p": "Manifest v3 native. Không giám sát. Thanh toán hàng tuần.",
    "publish.ext.cta_btn": "Đăng ký làm Founding Publisher →",
}

DICTS = {"en": EN, "zh": ZH, "zh-TW": ZH_TW, "ja": JA, "ko": KO, "vi": VI}

HTML_PATCHES = [
    ('<a href="/publish/mcp">MCP Servers</a>',
     '<a href="/publish/mcp" data-i18n="subnav.mcp">MCP Servers</a>'),
    ('<a href="/publish/ai-apps">AI Apps</a>',
     '<a href="/publish/ai-apps" data-i18n="subnav.ai_apps">AI Apps</a>'),
    ('<a href="/publish/extensions" class="active">Extensions</a>',
     '<a href="/publish/extensions" class="active" data-i18n="subnav.extensions">Extensions</a>'),
    ('<a href="/publish/bots">Bots</a>',
     '<a href="/publish/bots" data-i18n="subnav.bots">Bots</a>'),
    ('<a href="/publish/no-code">Custom GPTs</a>',
     '<a href="/publish/no-code" data-i18n="subnav.no_code">Custom GPTs</a>'),
    ('<a class="btn btn-primary" href="/publish/signup">Start earning</a>',
     '<a class="btn btn-primary" href="/publish/signup" data-i18n="publish.cta.start_earning">Start earning</a>'),

    ('<span class="eyebrow">For Browser Extension Developers</span>',
     '<span class="eyebrow" data-i18n="publish.ext.hero_eyebrow">For Browser Extension Developers</span>'),
    ('<h1>Real revenue for AI extensions. <span class="grad">No surveillance, no malware.</span></h1>',
     '<h1 data-i18n="publish.ext.hero_h1_html" data-i18n-html>Real revenue for AI extensions. <span class="grad">No surveillance, no malware.</span></h1>'),
    ('<p class="sub">Most extension monetization options are sketchy. Boost Boss is built for AI-native extensions — clean SDK, contextual ads, transparent reporting.</p>',
     '<p class="sub" data-i18n="publish.ext.hero_sub">Most extension monetization options are sketchy. Boost Boss is built for AI-native extensions — clean SDK, contextual ads, transparent reporting.</p>'),
    ('<a class="btn btn-primary btn-lg" href="/publish/signup">Start as a publisher →</a>',
     '<a class="btn btn-primary btn-lg" href="/publish/signup" data-i18n="publish.ext.hero_cta">Start as a publisher →</a>'),

    ('<span class="section-eyebrow">See it appear</span>',
     '<span class="section-eyebrow" data-i18n="publish.ext.see_eyebrow">See it appear</span>'),
    ('<h2 class="section-h">Lives in your side panel.<br>Renders contextually with the page.</h2>',
     '<h2 class="section-h" data-i18n="publish.ext.see_h2_html" data-i18n-html>Lives in your side panel.<br>Renders contextually with the page.</h2>'),
    ('<p class="section-sub">Manifest v3 native. Service-worker safe. Targets from on-page context — never user surveillance.</p>',
     '<p class="section-sub" data-i18n="publish.ext.see_sub">Manifest v3 native. Service-worker safe. Targets from on-page context — never user surveillance.</p>'),
    ('<div class="stage-caption">The sponsored block sits at the bottom of your panel, contextual to whatever the user is reading. Targeting comes from page DOM context — clean, surveillance-free.</div>',
     '<div class="stage-caption" data-i18n="publish.ext.see_caption">The sponsored block sits at the bottom of your panel, contextual to whatever the user is reading. Targeting comes from page DOM context — clean, surveillance-free.</div>'),

    ('<span class="section-eyebrow">How it works</span>',
     '<span class="section-eyebrow" data-i18n="publish.ext.how_eyebrow">How it works</span>'),
    ('<h2 class="section-h">Install. Render. Earn.</h2>',
     '<h2 class="section-h" data-i18n="publish.ext.how_h2">Install. Render. Earn.</h2>'),
    ('<h4>Install via npm</h4>',
     '<h4 data-i18n="publish.ext.how1_h4">Install via npm</h4>'),
    ('<p>Add <code>@boostbossai/lumi-sdk</code> to your extension. Manifest v3 native, service-worker safe.</p>',
     '<p data-i18n="publish.ext.how1_p_html" data-i18n-html>Add <code>@boostbossai/lumi-sdk</code> to your extension. Manifest v3 native, service-worker safe.</p>'),
    ('<h4>Render in your UI</h4>',
     '<h4 data-i18n="publish.ext.how2_h4">Render in your UI</h4>'),
    ('<p>Drop Lumi into your sidebar, popup, or content script. One element, one mount call.</p>',
     '<p data-i18n="publish.ext.how2_p">Drop Lumi into your sidebar, popup, or content script. One element, one mount call.</p>'),
    ('<h4>Earn per impression and click</h4>',
     '<h4 data-i18n="publish.ext.how3_h4">Earn per impression and click</h4>'),
    ('<p>Contextual targeting from page context — never surveillance. Weekly Stripe payouts.</p>',
     '<p data-i18n="publish.ext.how3_p">Contextual targeting from page context — never surveillance. Weekly Stripe payouts.</p>'),

    ('<span class="section-eyebrow">Integration snippet</span>',
     '<span class="section-eyebrow" data-i18n="publish.ext.snippet_eyebrow">Integration snippet</span>'),
    ('<h2 class="section-h">A few lines, your sidebar component.</h2>',
     '<h2 class="section-h" data-i18n="publish.ext.snippet_h2">A few lines, your sidebar component.</h2>'),
    ('<p class="code-caption">Manifest v3 compatible. Works in service workers, content scripts, sidepanel, and popups. <a href="/docs/npm-sdk">Full docs →</a></p>',
     '<p class="code-caption" data-i18n="publish.ext.snippet_caption_html" data-i18n-html>Manifest v3 compatible. Works in service workers, content scripts, sidepanel, and popups. <a href="/docs/npm-sdk">Full docs →</a></p>'),
    ('<div class="shot-caption">Side panel format. The extension owns the chrome — Lumi only renders the bordered card.</div>',
     '<div class="shot-caption" data-i18n="publish.ext.snippet_shot_caption">Side panel format. The extension owns the chrome — Lumi only renders the bordered card.</div>'),

    ('<span class="section-eyebrow">Who this is for</span>',
     '<span class="section-eyebrow" data-i18n="publish.ext.who_eyebrow">Who this is for</span>'),
    ('<h2 class="section-h">If your extension renders AI output, this is your path.</h2>',
     '<h2 class="section-h" data-i18n="publish.ext.who_h2">If your extension renders AI output, this is your path.</h2>'),
    ('<li><span class="check">✓</span><span>You shipped a Chrome, Edge, or Firefox extension with AI features.</span></li>',
     '<li><span class="check">✓</span><span data-i18n="publish.ext.who_li1">You shipped a Chrome, Edge, or Firefox extension with AI features.</span></li>'),
    ('<li><span class="check">✓</span><span>Examples: writing assistants, AI sidebars, summarizers, translators, research tools, AI-augmented browsing.</span></li>',
     '<li><span class="check">✓</span><span data-i18n="publish.ext.who_li2">Examples: writing assistants, AI sidebars, summarizers, translators, research tools, AI-augmented browsing.</span></li>'),
    ('<li><span class="check">✓</span><span>You\'re avoiding "monetization SDKs" with surveillance baggage that put your store listing at risk.</span></li>',
     '<li><span class="check">✓</span><span data-i18n="publish.ext.who_li3">You\'re avoiding "monetization SDKs" with surveillance baggage that put your store listing at risk.</span></li>'),
    ('<li><span class="check">✓</span><span>You want a revenue stream that won\'t get you flagged on the next Chrome Web Store review.</span></li>',
     '<li><span class="check">✓</span><span data-i18n="publish.ext.who_li4">You want a revenue stream that won\'t get you flagged on the next Chrome Web Store review.</span></li>'),

    ('<span class="section-eyebrow">Revenue example</span>',
     '<span class="section-eyebrow" data-i18n="publish.ext.rev_eyebrow">Revenue example</span>'),
    ('<h2 class="section-h">What 30,000 daily users can earn.</h2>',
     '<h2 class="section-h" data-i18n="publish.ext.rev_h2">What 30,000 daily users can earn.</h2>'),
    ('<span class="label">Illustrative — not a guarantee</span>',
     '<span class="label" data-i18n="publish.ext.rev_label">Illustrative — not a guarantee</span>'),
    ('<div class="rev-row"><span>Daily active users</span><span class="v">30,000</span></div>',
     '<div class="rev-row"><span data-i18n="publish.ext.rev_row1">Daily active users</span><span class="v">30,000</span></div>'),
    ('<div class="rev-row"><span>Ad impressions per user per day</span><span class="v">~3</span></div>',
     '<div class="rev-row"><span data-i18n="publish.ext.rev_row2">Ad impressions per user per day</span><span class="v">~3</span></div>'),
    ('<div class="rev-row"><span>Daily impressions</span><span class="v">90,000</span></div>',
     '<div class="rev-row"><span data-i18n="publish.ext.rev_row3">Daily impressions</span><span class="v">90,000</span></div>'),
    ('<div class="rev-row"><span>CPM</span><span class="v">$5</span></div>',
     '<div class="rev-row"><span data-i18n="publish.ext.rev_row4">CPM</span><span class="v">$5</span></div>'),
    ('<div class="rev-row"><span>Monthly publisher revenue</span><span class="v">~$13,500</span></div>',
     '<div class="rev-row"><span data-i18n="publish.ext.rev_row5">Monthly publisher revenue</span><span class="v">~$13,500</span></div>'),
    ('<p class="disclaimer">Numbers are illustrative for an established AI extension with daily-driver usage. Actual revenue depends on session length, ad slot placement, fill rate, and audience composition. Productivity-focused extensions (writing, research, dev tools) typically run higher CPMs than general-purpose ones.</p>',
     '<p class="disclaimer" data-i18n="publish.ext.rev_disclaimer">Numbers are illustrative for an established AI extension with daily-driver usage. Actual revenue depends on session length, ad slot placement, fill rate, and audience composition. Productivity-focused extensions (writing, research, dev tools) typically run higher CPMs than general-purpose ones.</p>'),

    ('<span class="section-eyebrow">Frequently asked</span>',
     '<span class="section-eyebrow" data-i18n="publish.ext.faq_eyebrow">Frequently asked</span>'),
    ('<h2 class="section-h">The questions every extension dev asks.</h2>',
     '<h2 class="section-h" data-i18n="publish.ext.faq_h2">The questions every extension dev asks.</h2>'),
    ('<h4>Will Chrome Web Store flag this?</h4>',
     '<h4 data-i18n="publish.ext.faq1_q">Will Chrome Web Store flag this?</h4>'),
    ('<p>No. Lumi is compliant with Chrome Web Store policies. Ads are clearly disclosed; no hidden behavior, no permission creep, no remote-hosted code execution. Same compliance posture for Edge and Firefox stores.</p>',
     '<p data-i18n="publish.ext.faq1_a">No. Lumi is compliant with Chrome Web Store policies. Ads are clearly disclosed; no hidden behavior, no permission creep, no remote-hosted code execution. Same compliance posture for Edge and Firefox stores.</p>'),
    ('<h4>Manifest v3 support?</h4>',
     '<h4 data-i18n="publish.ext.faq2_q">Manifest v3 support?</h4>'),
    ('<p>Native. Lumi runs in service workers and uses declarative network rules — no remotely-hosted code, no <code>eval</code>, no patterns that v3 review rejects.</p>',
     '<p data-i18n="publish.ext.faq2_a_html" data-i18n-html>Native. Lumi runs in service workers and uses declarative network rules — no remotely-hosted code, no <code>eval</code>, no patterns that v3 review rejects.</p>'),
    ('<h4>Will Lumi sell my user data?</h4>',
     '<h4 data-i18n="publish.ext.faq3_q">Will Lumi sell my user data?</h4>'),
    ('<p>No. Boost Boss does not sell user data and has no third-party tracking pixels. All targeting is contextual — derived from on-page or in-extension content at request time, never persisted into a user profile.</p>',
     '<p data-i18n="publish.ext.faq3_a">No. Boost Boss does not sell user data and has no third-party tracking pixels. All targeting is contextual — derived from on-page or in-extension content at request time, never persisted into a user profile.</p>'),
    ('<h4>Can I run on top of an existing freemium model?</h4>',
     '<h4 data-i18n="publish.ext.faq4_q">Can I run on top of an existing freemium model?</h4>'),
    ('<p>Yes — most of our extension publishers do exactly this. Show ads to free users, hide them for Pro subscribers, all controlled by your own paywall logic.</p>',
     '<p data-i18n="publish.ext.faq4_a">Yes — most of our extension publishers do exactly this. Show ads to free users, hide them for Pro subscribers, all controlled by your own paywall logic.</p>'),
    ('<h4>What about CSP restrictions in extension contexts?</h4>',
     '<h4 data-i18n="publish.ext.faq5_q">What about CSP restrictions in extension contexts?</h4>'),
    ('<p>Lumi works within strict CSP. Our SDK doesn\'t require <code>unsafe-eval</code> or <code>unsafe-inline</code>; ad creative renders inside an isolated mount point you control.</p>',
     '<p data-i18n="publish.ext.faq5_a_html" data-i18n-html>Lumi works within strict CSP. Our SDK doesn\'t require <code>unsafe-eval</code> or <code>unsafe-inline</code>; ad creative renders inside an isolated mount point you control.</p>'),

    ('<h2>Ready to monetize your extension?</h2>',
     '<h2 data-i18n="publish.ext.cta_h2">Ready to monetize your extension?</h2>'),
    ('<p>Manifest v3 native. No surveillance. Weekly payouts.</p>',
     '<p data-i18n="publish.ext.cta_p">Manifest v3 native. No surveillance. Weekly payouts.</p>'),
    ('<a class="btn btn-primary btn-lg" href="/publish/signup">Apply as a Founding Publisher →</a>',
     '<a class="btn btn-primary btn-lg" href="/publish/signup" data-i18n="publish.ext.cta_btn">Apply as a Founding Publisher →</a>'),

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
