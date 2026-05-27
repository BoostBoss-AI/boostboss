#!/usr/bin/env python3
"""i18n tagger for /publish/mcp.

Skips SVG mockup `<text>` elements (those are styled product screenshots — the
text inside the laptop frame stays in English so the screenshot looks
authentic). Translates all marketing copy outside the mockup.
"""
import json, os

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..'))
PAGE = os.path.join(ROOT, 'public', 'publish-mcp.html')
I18N_DIR = os.path.join(ROOT, 'public', 'i18n')

# ---- English source of truth ---------------------------------------------------
EN = {
    "publish.mcp.hero_eyebrow": "For MCP Server Developers",
    "publish.mcp.hero_h1_html": "Earn revenue every time your <span class=\"grad\">MCP tool</span> is called.",
    "publish.mcp.hero_sub": "Boost Boss is the only ad network built natively into the Model Context Protocol. Your server adds three lines. Claude Desktop, Cursor, Cline, and every MCP host renders the rest.",
    "publish.mcp.hero_cta": "Start as a publisher →",

    "publish.mcp.see_eyebrow": "See it appear",
    "publish.mcp.see_h2_html": "When your tool runs, your output renders first.<br>The sponsored block slides in after.",
    "publish.mcp.see_sub": "No interruption. No latency. The user always gets your tool result before they see the ad.",
    "publish.mcp.see_caption": "The sponsored block is a structured payload Boost Boss returns alongside your tool result. The host (Claude Desktop, Cursor, Cline) renders it natively — same chrome as the rest of the response, with a clear sponsorship label.",

    "publish.mcp.how_eyebrow": "How it works",
    "publish.mcp.how_h2_html": "From <code>npm install</code> to first impression in under 10 minutes.",
    "publish.mcp.how1_h4": "Connect your MCP server",
    "publish.mcp.how1_p_html": "Add three lines: install <code>@boostbossai/lumi-mcp</code>, init with your publisher ID, attach to a tool handler.",
    "publish.mcp.how2_h4": "Tools keep working",
    "publish.mcp.how2_p": "Your existing tool output is unchanged. Boost Boss appends a sponsored block — never replaces, never delays.",
    "publish.mcp.how3_h4": "Earn per call",
    "publish.mcp.how3_p": "Boost Boss attaches relevant ads to tool responses. You earn on every impression and every click.",

    "publish.mcp.snippet_eyebrow": "Integration snippet",
    "publish.mcp.snippet_h2": "Three lines, one tool handler.",
    "publish.mcp.snippet_caption_html": "That's it. The MCP host renders the ad payload natively. <a href=\"/docs/mcp\">Full docs →</a>",
    "publish.mcp.snippet_shot_caption": "Real render. The sponsored block ships as a structured payload — the host (Claude Desktop, Cursor, Cline) draws the chrome.",

    "publish.mcp.who_eyebrow": "Who this is for",
    "publish.mcp.who_h2": "If any of these sound like you, MCP is your path.",
    "publish.mcp.who_li1_html": "You ship an MCP server listed on <strong>mcp.so</strong>, <strong>Smithery</strong>, <strong>Glama</strong>, or <strong>PulseMCP</strong>.",
    "publish.mcp.who_li2": "Your server is called by users of Claude Desktop, Cursor, Cline, Continue, Zed AI, or Windsurf.",
    "publish.mcp.who_li3": "You'd like a real revenue stream beyond GitHub Sponsors.",
    "publish.mcp.who_li4": "You build for developer audiences and want premium CPMs that match the audience value.",

    "publish.mcp.rev_eyebrow": "Revenue example",
    "publish.mcp.rev_h2": "What \"earning per call\" actually looks like.",
    "publish.mcp.rev_label": "Illustrative — not a guarantee",
    "publish.mcp.rev_row1": "Daily tool calls",
    "publish.mcp.rev_row2": "Ad impressions per day (1 in 3 calls)",
    "publish.mcp.rev_row3": "Average CPM (developer audience premium)",
    "publish.mcp.rev_row4": "Monthly publisher revenue",
    "publish.mcp.rev_disclaimer": "Numbers are illustrative for a moderately active MCP server. Actual revenue depends on tool-call volume, fill rate, advertiser demand, and your audience composition. CPMs vary; developer-tooling traffic typically sits at the high end.",

    "publish.mcp.faq_eyebrow": "Frequently asked",
    "publish.mcp.faq_h2": "The questions every MCP dev asks first.",
    "publish.mcp.faq1_q": "Will ads break my MCP integration?",
    "publish.mcp.faq1_a": "No. Ads are appended, not substituted. Your tool's primary output is unchanged — the host renders your tool result first, the sponsored block second.",
    "publish.mcp.faq2_q": "What does an MCP ad look like to the user?",
    "publish.mcp.faq2_a": "A clearly labeled sponsored block in the tool response, rendered by the host (Claude Desktop, Cursor, etc.). The user always sees both the answer and the disclosure — there's no hidden injection.",
    "publish.mcp.faq3_q": "Can I block specific advertisers?",
    "publish.mcp.faq3_a": "Yes. Category-level blocks (e.g., no recruiting ads) and domain-level blocks (e.g., never these specific competitors) — all controlled from your publisher dashboard.",
    "publish.mcp.faq4_q": "Does this work with stdio AND HTTP transports?",
    "publish.mcp.faq4_a_html": "Yes — both transports are supported. <code>@boostbossai/lumi-mcp</code> auto-detects which one your server uses; the SDK works identically across both.",
    "publish.mcp.faq5_q": "Is this approved by Anthropic?",
    "publish.mcp.faq5_a": "Boost Boss operates within MCP's public protocol — we don't require Anthropic's approval. We follow MCP disclosure norms strictly: every sponsored block is labeled, never disguised as tool output.",

    "publish.mcp.cta_h2": "Ready to monetize your MCP server?",
    "publish.mcp.cta_p": "Three lines. Ten minutes. Weekly payouts.",
    "publish.mcp.cta_btn": "Apply as a Founding Publisher →",
    "publish.mcp.cta_perk": "⚡ First 20 MCP publishers get 90/10 revshare for 6 months",

    "pubfoot.publishers": "Publishers",
}

# ---- Translations --------------------------------------------------------------
ZH = {
    "publish.mcp.hero_eyebrow": "面向 MCP 服务器开发者",
    "publish.mcp.hero_h1_html": "每次 <span class=\"grad\">MCP 工具</span> 被调用,你都赚钱。",
    "publish.mcp.hero_sub": "Boost Boss 是唯一原生构建在 Model Context Protocol 之上的广告网络。你的服务器加三行代码。Claude Desktop、Cursor、Cline 等 MCP 宿主负责渲染其余部分。",
    "publish.mcp.hero_cta": "以发布商身份开始 →",

    "publish.mcp.see_eyebrow": "看它出现",
    "publish.mcp.see_h2_html": "工具运行时,你的输出先渲染。<br>赞助区块随后滑入。",
    "publish.mcp.see_sub": "不中断,不增加延迟。用户总是先拿到工具结果,然后才看到广告。",
    "publish.mcp.see_caption": "赞助区块是 Boost Boss 与你的工具结果一起返回的结构化负载。宿主(Claude Desktop、Cursor、Cline)原生渲染 — 外观与回复其他部分一致,带有清晰的赞助标识。",

    "publish.mcp.how_eyebrow": "工作原理",
    "publish.mcp.how_h2_html": "从 <code>npm install</code> 到首次展示,不到 10 分钟。",
    "publish.mcp.how1_h4": "接入你的 MCP 服务器",
    "publish.mcp.how1_p_html": "加三行代码:安装 <code>@boostbossai/lumi-mcp</code>、用你的 publisher ID 初始化、挂在工具 handler 上。",
    "publish.mcp.how2_h4": "工具继续正常工作",
    "publish.mcp.how2_p": "你原有的工具输出完全不变。Boost Boss 只是追加一个赞助区块 — 不替换,不延迟。",
    "publish.mcp.how3_h4": "按调用赚钱",
    "publish.mcp.how3_p": "Boost Boss 把相关广告挂到工具响应上。每次展示、每次点击你都有收入。",

    "publish.mcp.snippet_eyebrow": "集成代码",
    "publish.mcp.snippet_h2": "三行代码,一个工具 handler。",
    "publish.mcp.snippet_caption_html": "就这样。MCP 宿主原生渲染广告负载。<a href=\"/docs/mcp\">完整文档 →</a>",
    "publish.mcp.snippet_shot_caption": "真实渲染。赞助区块以结构化负载发送 — 宿主(Claude Desktop、Cursor、Cline)绘制外观。",

    "publish.mcp.who_eyebrow": "适合谁",
    "publish.mcp.who_h2": "下面任一条像你的情况,MCP 就是你的路径。",
    "publish.mcp.who_li1_html": "你的 MCP 服务器上架在 <strong>mcp.so</strong>、<strong>Smithery</strong>、<strong>Glama</strong> 或 <strong>PulseMCP</strong>。",
    "publish.mcp.who_li2": "你的服务器被 Claude Desktop、Cursor、Cline、Continue、Zed AI 或 Windsurf 的用户调用。",
    "publish.mcp.who_li3": "你希望有真正的收入来源,不仅仅是 GitHub Sponsors。",
    "publish.mcp.who_li4": "你面向开发者受众,希望拿到匹配该受众价值的优质 CPM。",

    "publish.mcp.rev_eyebrow": "收入示例",
    "publish.mcp.rev_h2": "“按调用收益”到底长什么样。",
    "publish.mcp.rev_label": "仅供示意 — 不构成保证",
    "publish.mcp.rev_row1": "每日工具调用次数",
    "publish.mcp.rev_row2": "每日广告展示数(每 3 次调用 1 次)",
    "publish.mcp.rev_row3": "平均 CPM(开发者受众溢价)",
    "publish.mcp.rev_row4": "每月发布商收入",
    "publish.mcp.rev_disclaimer": "数字仅为示意,基于活跃度中等的 MCP 服务器估算。实际收入取决于工具调用量、填充率、广告需求和你的受众构成。CPM 会变化;开发者工具流量通常处在高端。",

    "publish.mcp.faq_eyebrow": "常见问题",
    "publish.mcp.faq_h2": "每个 MCP 开发者最先问的问题。",
    "publish.mcp.faq1_q": "广告会不会破坏我的 MCP 集成?",
    "publish.mcp.faq1_a": "不会。广告是追加,不是替换。你的工具主输出完全不变 — 宿主先渲染你的工具结果,再渲染赞助区块。",
    "publish.mcp.faq2_q": "MCP 广告在用户端长什么样?",
    "publish.mcp.faq2_a": "工具响应里一个清晰标注的赞助区块,由宿主(Claude Desktop、Cursor 等)渲染。用户总是同时看到答案和披露 — 没有任何隐藏注入。",
    "publish.mcp.faq3_q": "我能屏蔽特定广告主吗?",
    "publish.mcp.faq3_a": "可以。类别级屏蔽(例如不要招聘广告)和域名级屏蔽(例如永远不要这些竞品)— 全部从你的发布商面板控制。",
    "publish.mcp.faq4_q": "stdio 和 HTTP 传输都支持吗?",
    "publish.mcp.faq4_a_html": "是 — 两种传输都支持。<code>@boostbossai/lumi-mcp</code> 自动检测你的服务器使用哪一种;SDK 在两者上的工作方式完全一致。",
    "publish.mcp.faq5_q": "这有 Anthropic 的批准吗?",
    "publish.mcp.faq5_a": "Boost Boss 在 MCP 公开协议内运作 — 我们不需要 Anthropic 批准。我们严格遵守 MCP 披露规范:每个赞助区块都有标注,绝不伪装成工具输出。",

    "publish.mcp.cta_h2": "准备好让你的 MCP 服务器变现了吗?",
    "publish.mcp.cta_p": "三行代码。十分钟。每周打款。",
    "publish.mcp.cta_btn": "申请成为创始发布商 →",
    "publish.mcp.cta_perk": "⚡ 前 20 位 MCP 发布商前 6 个月享 90/10 分成",

    "pubfoot.publishers": "发布商",
}

ZH_TW = {
    "publish.mcp.hero_eyebrow": "面向 MCP 伺服器開發者",
    "publish.mcp.hero_h1_html": "每次 <span class=\"grad\">MCP 工具</span> 被呼叫,你都賺取收益。",
    "publish.mcp.hero_sub": "Boost Boss 是唯一原生建構於 Model Context Protocol 之上的廣告網路。你的伺服器加三行程式碼。Claude Desktop、Cursor、Cline 等 MCP 宿主負責渲染其餘部分。",
    "publish.mcp.hero_cta": "以發布商身分開始 →",

    "publish.mcp.see_eyebrow": "看看它出現的樣子",
    "publish.mcp.see_h2_html": "工具執行時,你的輸出先渲染。<br>贊助區塊隨後滑入。",
    "publish.mcp.see_sub": "不中斷,不增加延遲。使用者一定先拿到工具結果,然後才看到廣告。",
    "publish.mcp.see_caption": "贊助區塊是 Boost Boss 與你的工具結果一起回傳的結構化內容。宿主(Claude Desktop、Cursor、Cline)原生渲染 — 外觀與回覆其他部分一致,並附上清楚的贊助標示。",

    "publish.mcp.how_eyebrow": "運作方式",
    "publish.mcp.how_h2_html": "從 <code>npm install</code> 到首次曝光,不到 10 分鐘。",
    "publish.mcp.how1_h4": "接入你的 MCP 伺服器",
    "publish.mcp.how1_p_html": "加三行程式碼:安裝 <code>@boostbossai/lumi-mcp</code>、用你的 publisher ID 初始化、掛在工具 handler 上。",
    "publish.mcp.how2_h4": "工具持續正常運作",
    "publish.mcp.how2_p": "你原有的工具輸出完全不變。Boost Boss 只是附加一個贊助區塊 — 不替換,不延遲。",
    "publish.mcp.how3_h4": "按呼叫賺取收益",
    "publish.mcp.how3_p": "Boost Boss 把相關廣告附到工具回應上。每次曝光、每次點擊你都有收益。",

    "publish.mcp.snippet_eyebrow": "整合程式碼",
    "publish.mcp.snippet_h2": "三行程式碼,一個工具 handler。",
    "publish.mcp.snippet_caption_html": "就這樣。MCP 宿主原生渲染廣告內容。<a href=\"/docs/mcp\">完整文件 →</a>",
    "publish.mcp.snippet_shot_caption": "真實渲染。贊助區塊以結構化內容傳送 — 宿主(Claude Desktop、Cursor、Cline)繪製外觀。",

    "publish.mcp.who_eyebrow": "適合誰",
    "publish.mcp.who_h2": "以下任一條符合你的情況,MCP 就是你的路徑。",
    "publish.mcp.who_li1_html": "你的 MCP 伺服器上架於 <strong>mcp.so</strong>、<strong>Smithery</strong>、<strong>Glama</strong> 或 <strong>PulseMCP</strong>。",
    "publish.mcp.who_li2": "你的伺服器被 Claude Desktop、Cursor、Cline、Continue、Zed AI 或 Windsurf 的使用者呼叫。",
    "publish.mcp.who_li3": "你希望有真正的收益來源,不只是 GitHub Sponsors。",
    "publish.mcp.who_li4": "你面向開發者受眾,希望取得契合該受眾價值的優質 CPM。",

    "publish.mcp.rev_eyebrow": "收益範例",
    "publish.mcp.rev_h2": "「按呼叫賺取收益」實際的樣子。",
    "publish.mcp.rev_label": "僅供示意 — 不構成保證",
    "publish.mcp.rev_row1": "每日工具呼叫次數",
    "publish.mcp.rev_row2": "每日廣告曝光數(每 3 次呼叫 1 次)",
    "publish.mcp.rev_row3": "平均 CPM(開發者受眾溢價)",
    "publish.mcp.rev_row4": "每月發布商收益",
    "publish.mcp.rev_disclaimer": "數字僅為示意,以活躍度中等的 MCP 伺服器為基準。實際收益取決於工具呼叫量、填充率、廣告需求,以及你的受眾組成。CPM 會浮動;開發者工具流量通常落在高端。",

    "publish.mcp.faq_eyebrow": "常見問題",
    "publish.mcp.faq_h2": "每個 MCP 開發者最先問的問題。",
    "publish.mcp.faq1_q": "廣告會破壞我的 MCP 整合嗎?",
    "publish.mcp.faq1_a": "不會。廣告是附加,不是取代。你的工具主輸出完全不變 — 宿主先渲染你的工具結果,再渲染贊助區塊。",
    "publish.mcp.faq2_q": "MCP 廣告在使用者端長什麼樣?",
    "publish.mcp.faq2_a": "工具回應中一個清楚標示的贊助區塊,由宿主(Claude Desktop、Cursor 等)渲染。使用者一定同時看到答案與揭露 — 沒有任何隱藏注入。",
    "publish.mcp.faq3_q": "我可以封鎖特定廣告主嗎?",
    "publish.mcp.faq3_a": "可以。類別層級封鎖(例如不接受招募廣告)與網域層級封鎖(例如永遠拒絕這幾家競品)— 全部從你的發布商儀表板控制。",
    "publish.mcp.faq4_q": "stdio 與 HTTP 傳輸都支援嗎?",
    "publish.mcp.faq4_a_html": "是 — 兩種傳輸皆支援。<code>@boostbossai/lumi-mcp</code> 會自動偵測你的伺服器使用哪一種;SDK 在兩者上的運作方式完全一致。",
    "publish.mcp.faq5_q": "這經過 Anthropic 認可嗎?",
    "publish.mcp.faq5_a": "Boost Boss 在 MCP 公開協定內運作 — 我們不需要 Anthropic 認可。我們嚴格遵守 MCP 揭露規範:每個贊助區塊都有標示,絕不偽裝成工具輸出。",

    "publish.mcp.cta_h2": "準備好讓你的 MCP 伺服器變現了嗎?",
    "publish.mcp.cta_p": "三行程式碼。十分鐘。每週撥款。",
    "publish.mcp.cta_btn": "申請成為創始發布商 →",
    "publish.mcp.cta_perk": "⚡ 前 20 位 MCP 發布商前 6 個月享 90/10 分潤",

    "pubfoot.publishers": "發布商",
}

JA = {
    "publish.mcp.hero_eyebrow": "MCP サーバー開発者向け",
    "publish.mcp.hero_h1_html": "あなたの <span class=\"grad\">MCP ツール</span> が呼ばれるたびに収益が発生。",
    "publish.mcp.hero_sub": "Boost Boss は Model Context Protocol にネイティブに組み込まれた唯一の広告ネットワーク。サーバーに 3 行追加するだけ。Claude Desktop、Cursor、Cline、その他すべての MCP ホストが残りをレンダリングします。",
    "publish.mcp.hero_cta": "パブリッシャーとして始める →",

    "publish.mcp.see_eyebrow": "実際の見え方",
    "publish.mcp.see_h2_html": "ツールが実行されると、あなたの出力が先に表示されます。<br>スポンサーブロックは後からスライドして現れます。",
    "publish.mcp.see_sub": "中断なし、レイテンシなし。ユーザーは必ずツール結果を先に見てから広告を見ます。",
    "publish.mcp.see_caption": "スポンサーブロックは Boost Boss がツール結果と一緒に返す構造化されたペイロードです。ホスト(Claude Desktop、Cursor、Cline)がネイティブに描画 — 応答の他の部分と同じ見た目で、明確なスポンサー表示付き。",

    "publish.mcp.how_eyebrow": "仕組み",
    "publish.mcp.how_h2_html": "<code>npm install</code> から初回インプレッションまで 10 分以内。",
    "publish.mcp.how1_h4": "MCP サーバーに接続",
    "publish.mcp.how1_p_html": "3 行追加するだけ: <code>@boostbossai/lumi-mcp</code> をインストール、パブリッシャー ID で初期化、ツールハンドラに接続。",
    "publish.mcp.how2_h4": "ツールはそのまま動く",
    "publish.mcp.how2_p": "既存のツール出力は変更されません。Boost Boss はスポンサーブロックを追加するだけ — 置き換えなし、遅延なし。",
    "publish.mcp.how3_h4": "呼び出しごとに収益",
    "publish.mcp.how3_p": "Boost Boss が関連広告をツール応答に付けます。インプレッションごと、クリックごとに収益が発生。",

    "publish.mcp.snippet_eyebrow": "統合スニペット",
    "publish.mcp.snippet_h2": "3 行、1 つのツールハンドラ。",
    "publish.mcp.snippet_caption_html": "以上です。MCP ホストが広告ペイロードをネイティブにレンダリング。<a href=\"/docs/mcp\">完全ドキュメント →</a>",
    "publish.mcp.snippet_shot_caption": "実際のレンダリング。スポンサーブロックは構造化ペイロードとして送られ、ホスト(Claude Desktop、Cursor、Cline)が外観を描画します。",

    "publish.mcp.who_eyebrow": "向いている人",
    "publish.mcp.who_h2": "以下のいずれかに当てはまるなら、MCP があなたの道です。",
    "publish.mcp.who_li1_html": "<strong>mcp.so</strong>、<strong>Smithery</strong>、<strong>Glama</strong>、<strong>PulseMCP</strong> のいずれかに MCP サーバーを出している。",
    "publish.mcp.who_li2": "サーバーが Claude Desktop、Cursor、Cline、Continue、Zed AI、Windsurf のユーザーから呼ばれる。",
    "publish.mcp.who_li3": "GitHub Sponsors を超える本格的な収益源が欲しい。",
    "publish.mcp.who_li4": "開発者向けのオーディエンスを持っており、その価値に見合うプレミアム CPM が欲しい。",

    "publish.mcp.rev_eyebrow": "収益例",
    "publish.mcp.rev_h2": "「呼び出しごとの収益」の実際の見え方。",
    "publish.mcp.rev_label": "あくまで例 — 保証ではありません",
    "publish.mcp.rev_row1": "1 日あたりのツール呼び出し数",
    "publish.mcp.rev_row2": "1 日あたりの広告インプレッション数(3 回に 1 回)",
    "publish.mcp.rev_row3": "平均 CPM(開発者オーディエンスのプレミアム)",
    "publish.mcp.rev_row4": "月間パブリッシャー収益",
    "publish.mcp.rev_disclaimer": "数値は中程度の活動量の MCP サーバーを想定した例示です。実際の収益はツール呼び出し量、フィル率、広告需要、オーディエンス構成に左右されます。CPM は変動しますが、開発者向けトラフィックは通常ハイエンドに位置します。",

    "publish.mcp.faq_eyebrow": "よくある質問",
    "publish.mcp.faq_h2": "MCP 開発者が最初に聞く質問。",
    "publish.mcp.faq1_q": "広告が MCP の動作を壊しませんか?",
    "publish.mcp.faq1_a": "壊しません。広告は置換ではなく追加です。ツールの主出力は変更されません — ホストが先にツール結果を、次にスポンサーブロックをレンダリングします。",
    "publish.mcp.faq2_q": "MCP 広告はユーザーにはどう見えますか?",
    "publish.mcp.faq2_a": "ツール応答内に明確にラベル付けされたスポンサーブロックが、ホスト(Claude Desktop、Cursor など)によって描画されます。ユーザーは常に回答と開示の両方を見るので、隠れた挿入はありません。",
    "publish.mcp.faq3_q": "特定の広告主をブロックできますか?",
    "publish.mcp.faq3_a": "はい。カテゴリ単位のブロック(例: 採用広告は不要)とドメイン単位のブロック(例: この競合は常に除外)— すべてパブリッシャーダッシュボードから制御できます。",
    "publish.mcp.faq4_q": "stdio と HTTP の両方のトランスポートで動きますか?",
    "publish.mcp.faq4_a_html": "はい — 両方サポートしています。<code>@boostbossai/lumi-mcp</code> はサーバーがどちらを使っているかを自動検出し、SDK は両方で同じように動作します。",
    "publish.mcp.faq5_q": "Anthropic の承認は受けていますか?",
    "publish.mcp.faq5_a": "Boost Boss は MCP の公開プロトコル内で運用しており、Anthropic の承認は不要です。MCP の開示規範を厳格に守ります: すべてのスポンサーブロックにラベルを付け、ツール出力に偽装することは絶対にありません。",

    "publish.mcp.cta_h2": "MCP サーバーで収益化する準備はできましたか?",
    "publish.mcp.cta_p": "3 行。10 分。週次支払い。",
    "publish.mcp.cta_btn": "ファウンディングパブリッシャーとして申し込む →",
    "publish.mcp.cta_perk": "⚡ 最初の 20 名の MCP パブリッシャーは 6 ヶ月間 90/10 のレベニューシェア",

    "pubfoot.publishers": "パブリッシャー",
}

KO = {
    "publish.mcp.hero_eyebrow": "MCP 서버 개발자용",
    "publish.mcp.hero_h1_html": "당신의 <span class=\"grad\">MCP 도구</span>가 호출될 때마다 수익을 얻으세요.",
    "publish.mcp.hero_sub": "Boost Boss는 Model Context Protocol에 네이티브로 통합된 유일한 광고 네트워크입니다. 서버에 세 줄만 추가하면 됩니다. Claude Desktop, Cursor, Cline 등 모든 MCP 호스트가 나머지를 렌더링합니다.",
    "publish.mcp.hero_cta": "퍼블리셔로 시작하기 →",

    "publish.mcp.see_eyebrow": "이렇게 보입니다",
    "publish.mcp.see_h2_html": "도구가 실행되면 당신의 출력이 먼저 렌더링됩니다.<br>스폰서 블록은 그 다음에 슬라이드인.",
    "publish.mcp.see_sub": "중단 없음, 지연 없음. 사용자는 항상 도구 결과를 먼저 보고 그 다음에 광고를 봅니다.",
    "publish.mcp.see_caption": "스폰서 블록은 Boost Boss가 도구 결과와 함께 반환하는 구조화된 페이로드입니다. 호스트(Claude Desktop, Cursor, Cline)가 네이티브로 렌더링 — 응답의 다른 부분과 동일한 외관에, 명확한 스폰서십 라벨이 붙습니다.",

    "publish.mcp.how_eyebrow": "동작 방식",
    "publish.mcp.how_h2_html": "<code>npm install</code>부터 첫 임프레션까지 10분 미만.",
    "publish.mcp.how1_h4": "MCP 서버 연결",
    "publish.mcp.how1_p_html": "세 줄 추가: <code>@boostbossai/lumi-mcp</code> 설치, 퍼블리셔 ID로 초기화, 도구 핸들러에 연결.",
    "publish.mcp.how2_h4": "도구는 그대로 작동",
    "publish.mcp.how2_p": "기존 도구 출력은 변경되지 않습니다. Boost Boss는 스폰서 블록을 추가만 합니다 — 대체하지 않고, 지연시키지도 않습니다.",
    "publish.mcp.how3_h4": "호출당 수익",
    "publish.mcp.how3_p": "Boost Boss가 관련 광고를 도구 응답에 붙입니다. 임프레션과 클릭마다 수익이 발생합니다.",

    "publish.mcp.snippet_eyebrow": "통합 스니펫",
    "publish.mcp.snippet_h2": "세 줄, 하나의 도구 핸들러.",
    "publish.mcp.snippet_caption_html": "끝입니다. MCP 호스트가 광고 페이로드를 네이티브로 렌더링합니다. <a href=\"/docs/mcp\">전체 문서 →</a>",
    "publish.mcp.snippet_shot_caption": "실제 렌더링. 스폰서 블록은 구조화된 페이로드로 전송되며, 호스트(Claude Desktop, Cursor, Cline)가 외관을 그립니다.",

    "publish.mcp.who_eyebrow": "이런 분에게 맞습니다",
    "publish.mcp.who_h2": "다음 중 하나라도 해당된다면 MCP가 당신의 경로입니다.",
    "publish.mcp.who_li1_html": "<strong>mcp.so</strong>, <strong>Smithery</strong>, <strong>Glama</strong>, <strong>PulseMCP</strong>에 등록된 MCP 서버를 배포했다.",
    "publish.mcp.who_li2": "당신의 서버가 Claude Desktop, Cursor, Cline, Continue, Zed AI, Windsurf 사용자에 의해 호출된다.",
    "publish.mcp.who_li3": "GitHub Sponsors를 넘어서는 실질적 수익원이 필요하다.",
    "publish.mcp.who_li4": "개발자 오디언스를 위해 만드는데 그에 걸맞은 프리미엄 CPM을 원한다.",

    "publish.mcp.rev_eyebrow": "수익 예시",
    "publish.mcp.rev_h2": "\"호출당 수익\"이 실제로 어떻게 생겼는지.",
    "publish.mcp.rev_label": "예시일 뿐 — 보장이 아닙니다",
    "publish.mcp.rev_row1": "일일 도구 호출",
    "publish.mcp.rev_row2": "일일 광고 임프레션(3회 호출당 1회)",
    "publish.mcp.rev_row3": "평균 CPM(개발자 오디언스 프리미엄)",
    "publish.mcp.rev_row4": "월간 퍼블리셔 수익",
    "publish.mcp.rev_disclaimer": "수치는 활동도가 중간 수준인 MCP 서버를 가정한 예시입니다. 실제 수익은 도구 호출량, 채움률, 광고주 수요, 오디언스 구성에 따라 달라집니다. CPM은 변동하며, 개발자 도구 트래픽은 보통 상단에 위치합니다.",

    "publish.mcp.faq_eyebrow": "자주 묻는 질문",
    "publish.mcp.faq_h2": "모든 MCP 개발자가 제일 먼저 묻는 질문.",
    "publish.mcp.faq1_q": "광고가 내 MCP 통합을 망가뜨리나요?",
    "publish.mcp.faq1_a": "아니요. 광고는 대체가 아니라 추가입니다. 도구의 주요 출력은 그대로이며, 호스트가 도구 결과를 먼저, 스폰서 블록을 두 번째로 렌더링합니다.",
    "publish.mcp.faq2_q": "MCP 광고는 사용자에게 어떻게 보이나요?",
    "publish.mcp.faq2_a": "도구 응답 안에 명확히 라벨링된 스폰서 블록이 호스트(Claude Desktop, Cursor 등)에 의해 그려집니다. 사용자는 항상 답변과 공개를 함께 보며, 숨겨진 삽입은 없습니다.",
    "publish.mcp.faq3_q": "특정 광고주를 차단할 수 있나요?",
    "publish.mcp.faq3_a": "네. 카테고리 단위 차단(예: 채용 광고 안 받음)과 도메인 단위 차단(예: 특정 경쟁사 절대 안 됨) — 모두 퍼블리셔 대시보드에서 제어합니다.",
    "publish.mcp.faq4_q": "stdio와 HTTP 트랜스포트 모두에서 작동하나요?",
    "publish.mcp.faq4_a_html": "네 — 둘 다 지원됩니다. <code>@boostbossai/lumi-mcp</code>가 서버가 어느 쪽을 쓰는지 자동 감지하며, SDK는 양쪽에서 동일하게 작동합니다.",
    "publish.mcp.faq5_q": "Anthropic의 승인을 받았나요?",
    "publish.mcp.faq5_a": "Boost Boss는 MCP의 공개 프로토콜 안에서 운영하므로 Anthropic의 승인은 필요하지 않습니다. MCP 공개 규범을 엄격히 따릅니다: 모든 스폰서 블록에 라벨을 붙이며, 도구 출력으로 위장하지 않습니다.",

    "publish.mcp.cta_h2": "MCP 서버로 수익화할 준비가 되셨나요?",
    "publish.mcp.cta_p": "세 줄. 10분. 주간 정산.",
    "publish.mcp.cta_btn": "파운딩 퍼블리셔로 신청하기 →",
    "publish.mcp.cta_perk": "⚡ 첫 20명의 MCP 퍼블리셔는 6개월 동안 90/10 수익 배분",

    "pubfoot.publishers": "퍼블리셔",
}

VI = {
    "publish.mcp.hero_eyebrow": "Dành cho nhà phát triển MCP Server",
    "publish.mcp.hero_h1_html": "Mỗi lần <span class=\"grad\">MCP tool</span> của bạn được gọi, bạn kiếm tiền.",
    "publish.mcp.hero_sub": "Boost Boss là mạng quảng cáo duy nhất được tích hợp native vào Model Context Protocol. Server của bạn thêm ba dòng code. Claude Desktop, Cursor, Cline và mọi MCP host đảm nhận phần còn lại.",
    "publish.mcp.hero_cta": "Bắt đầu với tư cách publisher →",

    "publish.mcp.see_eyebrow": "Xem nó xuất hiện",
    "publish.mcp.see_h2_html": "Khi tool chạy, output của bạn render trước.<br>Khối sponsored trượt vào sau.",
    "publish.mcp.see_sub": "Không gián đoạn, không độ trễ. Người dùng luôn nhận kết quả tool trước khi nhìn thấy quảng cáo.",
    "publish.mcp.see_caption": "Khối sponsored là một payload có cấu trúc mà Boost Boss trả về cùng kết quả tool của bạn. Host (Claude Desktop, Cursor, Cline) render native — cùng giao diện với phần còn lại của phản hồi, kèm nhãn sponsorship rõ ràng.",

    "publish.mcp.how_eyebrow": "Cách hoạt động",
    "publish.mcp.how_h2_html": "Từ <code>npm install</code> đến impression đầu tiên trong chưa đầy 10 phút.",
    "publish.mcp.how1_h4": "Kết nối MCP server",
    "publish.mcp.how1_p_html": "Thêm ba dòng: cài <code>@boostbossai/lumi-mcp</code>, init với publisher ID của bạn, gắn vào một tool handler.",
    "publish.mcp.how2_h4": "Tool vẫn chạy bình thường",
    "publish.mcp.how2_p": "Output tool hiện có của bạn không đổi. Boost Boss chỉ thêm một khối sponsored — không thay thế, không trì hoãn.",
    "publish.mcp.how3_h4": "Kiếm tiền theo lần gọi",
    "publish.mcp.how3_p": "Boost Boss gắn quảng cáo phù hợp vào phản hồi tool. Bạn kiếm được mỗi impression và mỗi click.",

    "publish.mcp.snippet_eyebrow": "Đoạn code tích hợp",
    "publish.mcp.snippet_h2": "Ba dòng, một tool handler.",
    "publish.mcp.snippet_caption_html": "Vậy thôi. MCP host render payload quảng cáo native. <a href=\"/docs/mcp\">Tài liệu đầy đủ →</a>",
    "publish.mcp.snippet_shot_caption": "Render thật. Khối sponsored được gửi đi dưới dạng payload có cấu trúc — host (Claude Desktop, Cursor, Cline) vẽ giao diện.",

    "publish.mcp.who_eyebrow": "Dành cho ai",
    "publish.mcp.who_h2": "Nếu bất kỳ điều nào dưới đây nghe quen, MCP là đường của bạn.",
    "publish.mcp.who_li1_html": "Bạn đã ship một MCP server có mặt trên <strong>mcp.so</strong>, <strong>Smithery</strong>, <strong>Glama</strong>, hoặc <strong>PulseMCP</strong>.",
    "publish.mcp.who_li2": "Server của bạn được gọi bởi người dùng Claude Desktop, Cursor, Cline, Continue, Zed AI hoặc Windsurf.",
    "publish.mcp.who_li3": "Bạn muốn một nguồn doanh thu thật sự, không chỉ GitHub Sponsors.",
    "publish.mcp.who_li4": "Bạn xây cho audience developer và muốn CPM premium tương xứng giá trị audience.",

    "publish.mcp.rev_eyebrow": "Ví dụ doanh thu",
    "publish.mcp.rev_h2": "\"Kiếm tiền theo lần gọi\" thực sự trông như thế nào.",
    "publish.mcp.rev_label": "Chỉ mang tính minh họa — không phải cam kết",
    "publish.mcp.rev_row1": "Lần gọi tool mỗi ngày",
    "publish.mcp.rev_row2": "Impression quảng cáo mỗi ngày (1 trong 3 lần gọi)",
    "publish.mcp.rev_row3": "CPM trung bình (premium audience developer)",
    "publish.mcp.rev_row4": "Doanh thu publisher hàng tháng",
    "publish.mcp.rev_disclaimer": "Con số mang tính minh họa cho một MCP server hoạt động ở mức trung bình. Doanh thu thực tế tùy thuộc vào số lần gọi tool, fill rate, nhu cầu advertiser và thành phần audience của bạn. CPM dao động; lưu lượng công cụ dành cho developer thường ở mức cao.",

    "publish.mcp.faq_eyebrow": "Câu hỏi thường gặp",
    "publish.mcp.faq_h2": "Những câu mà mọi MCP dev hỏi đầu tiên.",
    "publish.mcp.faq1_q": "Quảng cáo có làm hỏng tích hợp MCP của tôi không?",
    "publish.mcp.faq1_a": "Không. Quảng cáo là thêm vào, không phải thay thế. Output chính của tool không đổi — host render kết quả tool của bạn trước, khối sponsored sau.",
    "publish.mcp.faq2_q": "Quảng cáo MCP trông như thế nào với người dùng?",
    "publish.mcp.faq2_a": "Một khối sponsored có nhãn rõ ràng trong phản hồi tool, do host (Claude Desktop, Cursor, v.v.) vẽ. Người dùng luôn thấy cả câu trả lời lẫn phần khai báo — không có chèn ngầm.",
    "publish.mcp.faq3_q": "Tôi có thể chặn advertiser cụ thể không?",
    "publish.mcp.faq3_a": "Có. Chặn theo category (ví dụ: không quảng cáo tuyển dụng) và chặn theo domain (ví dụ: không bao giờ các đối thủ cụ thể này) — tất cả điều khiển từ dashboard publisher.",
    "publish.mcp.faq4_q": "Có chạy được với cả transport stdio VÀ HTTP không?",
    "publish.mcp.faq4_a_html": "Có — cả hai transport đều được hỗ trợ. <code>@boostbossai/lumi-mcp</code> tự phát hiện server bạn dùng cái nào; SDK chạy giống nhau trên cả hai.",
    "publish.mcp.faq5_q": "Có được Anthropic phê duyệt không?",
    "publish.mcp.faq5_a": "Boost Boss vận hành trong protocol công khai của MCP — chúng tôi không cần Anthropic phê duyệt. Chúng tôi tuân thủ chuẩn khai báo của MCP nghiêm ngặt: mọi khối sponsored đều có nhãn, không bao giờ ngụy trang thành output tool.",

    "publish.mcp.cta_h2": "Sẵn sàng kiếm tiền từ MCP server của bạn?",
    "publish.mcp.cta_p": "Ba dòng. Mười phút. Thanh toán hàng tuần.",
    "publish.mcp.cta_btn": "Đăng ký làm Founding Publisher →",
    "publish.mcp.cta_perk": "⚡ 20 publisher MCP đầu tiên được chia 90/10 trong 6 tháng",

    "pubfoot.publishers": "Publisher",
}

DICTS = {"en": EN, "zh": ZH, "zh-TW": ZH_TW, "ja": JA, "ko": KO, "vi": VI}

# ---- HTML patches --------------------------------------------------------------
# Tag sub-nav at top, hero, and all sections. Skip SVG `<text>` mockup internals.
HTML_PATCHES = [
    # Top sub-nav (5)
    ('<a href="/publish/mcp" class="active">MCP Servers</a>',
     '<a href="/publish/mcp" class="active" data-i18n="subnav.mcp">MCP Servers</a>'),
    ('<a href="/publish/ai-apps">AI Apps</a>',
     '<a href="/publish/ai-apps" data-i18n="subnav.ai_apps">AI Apps</a>'),
    ('<a href="/publish/extensions">Extensions</a>',
     '<a href="/publish/extensions" data-i18n="subnav.extensions">Extensions</a>'),
    ('<a href="/publish/bots">Bots</a>',
     '<a href="/publish/bots" data-i18n="subnav.bots">Bots</a>'),
    ('<a href="/publish/no-code">Custom GPTs</a>',
     '<a href="/publish/no-code" data-i18n="subnav.no_code">Custom GPTs</a>'),

    # Start earning button
    ('<a class="btn btn-primary" href="/publish/signup">Start earning</a>',
     '<a class="btn btn-primary" href="/publish/signup" data-i18n="publish.cta.start_earning">Start earning</a>'),

    # Hero
    ('<span class="eyebrow">For MCP Server Developers</span>',
     '<span class="eyebrow" data-i18n="publish.mcp.hero_eyebrow">For MCP Server Developers</span>'),
    ('<h1>Earn revenue every time your <span class="grad">MCP tool</span> is called.</h1>',
     '<h1 data-i18n="publish.mcp.hero_h1_html" data-i18n-html>Earn revenue every time your <span class="grad">MCP tool</span> is called.</h1>'),
    ('<p class="sub">Boost Boss is the only ad network built natively into the Model Context Protocol. Your server adds three lines. Claude Desktop, Cursor, Cline, and every MCP host renders the rest.</p>',
     '<p class="sub" data-i18n="publish.mcp.hero_sub">Boost Boss is the only ad network built natively into the Model Context Protocol. Your server adds three lines. Claude Desktop, Cursor, Cline, and every MCP host renders the rest.</p>'),
    ('<a class="btn btn-primary btn-lg" href="/publish/signup">Start as a publisher →</a>',
     '<a class="btn btn-primary btn-lg" href="/publish/signup" data-i18n="publish.mcp.hero_cta">Start as a publisher →</a>'),

    # See it appear
    ('<span class="section-eyebrow">See it appear</span>',
     '<span class="section-eyebrow" data-i18n="publish.mcp.see_eyebrow">See it appear</span>'),
    ('<h2 class="section-h">When your tool runs, your output renders first.<br>The sponsored block slides in after.</h2>',
     '<h2 class="section-h" data-i18n="publish.mcp.see_h2_html" data-i18n-html>When your tool runs, your output renders first.<br>The sponsored block slides in after.</h2>'),
    ('<p class="section-sub">No interruption. No latency. The user always gets your tool result before they see the ad.</p>',
     '<p class="section-sub" data-i18n="publish.mcp.see_sub">No interruption. No latency. The user always gets your tool result before they see the ad.</p>'),
    ('<div class="stage-caption">The sponsored block is a structured payload Boost Boss returns alongside your tool result. The host (Claude Desktop, Cursor, Cline) renders it natively — same chrome as the rest of the response, with a clear sponsorship label.</div>',
     '<div class="stage-caption" data-i18n="publish.mcp.see_caption">The sponsored block is a structured payload Boost Boss returns alongside your tool result. The host (Claude Desktop, Cursor, Cline) renders it natively — same chrome as the rest of the response, with a clear sponsorship label.</div>'),

    # How it works
    ('<span class="section-eyebrow">How it works</span>',
     '<span class="section-eyebrow" data-i18n="publish.mcp.how_eyebrow">How it works</span>'),
    ('<h2 class="section-h">From <code>npm install</code> to first impression in under 10 minutes.</h2>',
     '<h2 class="section-h" data-i18n="publish.mcp.how_h2_html" data-i18n-html>From <code>npm install</code> to first impression in under 10 minutes.</h2>'),
    ('<h4>Connect your MCP server</h4>',
     '<h4 data-i18n="publish.mcp.how1_h4">Connect your MCP server</h4>'),
    ('<p>Add three lines: install <code>@boostbossai/lumi-mcp</code>, init with your publisher ID, attach to a tool handler.</p>',
     '<p data-i18n="publish.mcp.how1_p_html" data-i18n-html>Add three lines: install <code>@boostbossai/lumi-mcp</code>, init with your publisher ID, attach to a tool handler.</p>'),
    ('<h4>Tools keep working</h4>',
     '<h4 data-i18n="publish.mcp.how2_h4">Tools keep working</h4>'),
    ('<p>Your existing tool output is unchanged. Boost Boss appends a sponsored block — never replaces, never delays.</p>',
     '<p data-i18n="publish.mcp.how2_p">Your existing tool output is unchanged. Boost Boss appends a sponsored block — never replaces, never delays.</p>'),
    ('<h4>Earn per call</h4>',
     '<h4 data-i18n="publish.mcp.how3_h4">Earn per call</h4>'),
    ('<p>Boost Boss attaches relevant ads to tool responses. You earn on every impression and every click.</p>',
     '<p data-i18n="publish.mcp.how3_p">Boost Boss attaches relevant ads to tool responses. You earn on every impression and every click.</p>'),

    # Integration snippet
    ('<span class="section-eyebrow">Integration snippet</span>',
     '<span class="section-eyebrow" data-i18n="publish.mcp.snippet_eyebrow">Integration snippet</span>'),
    ('<h2 class="section-h">Three lines, one tool handler.</h2>',
     '<h2 class="section-h" data-i18n="publish.mcp.snippet_h2">Three lines, one tool handler.</h2>'),
    ('<p class="code-caption">That\'s it. The MCP host renders the ad payload natively. <a href="/docs/mcp">Full docs →</a></p>',
     '<p class="code-caption" data-i18n="publish.mcp.snippet_caption_html" data-i18n-html>That\'s it. The MCP host renders the ad payload natively. <a href="/docs/mcp">Full docs →</a></p>'),
    ('<div class="shot-caption">Real render. The sponsored block ships as a structured payload — the host (Claude Desktop, Cursor, Cline) draws the chrome.</div>',
     '<div class="shot-caption" data-i18n="publish.mcp.snippet_shot_caption">Real render. The sponsored block ships as a structured payload — the host (Claude Desktop, Cursor, Cline) draws the chrome.</div>'),

    # Who this is for
    ('<span class="section-eyebrow">Who this is for</span>',
     '<span class="section-eyebrow" data-i18n="publish.mcp.who_eyebrow">Who this is for</span>'),
    ('<h2 class="section-h">If any of these sound like you, MCP is your path.</h2>',
     '<h2 class="section-h" data-i18n="publish.mcp.who_h2">If any of these sound like you, MCP is your path.</h2>'),
    ('<li><span class="check">✓</span><span>You ship an MCP server listed on <strong>mcp.so</strong>, <strong>Smithery</strong>, <strong>Glama</strong>, or <strong>PulseMCP</strong>.</span></li>',
     '<li><span class="check">✓</span><span data-i18n="publish.mcp.who_li1_html" data-i18n-html>You ship an MCP server listed on <strong>mcp.so</strong>, <strong>Smithery</strong>, <strong>Glama</strong>, or <strong>PulseMCP</strong>.</span></li>'),
    ('<li><span class="check">✓</span><span>Your server is called by users of Claude Desktop, Cursor, Cline, Continue, Zed AI, or Windsurf.</span></li>',
     '<li><span class="check">✓</span><span data-i18n="publish.mcp.who_li2">Your server is called by users of Claude Desktop, Cursor, Cline, Continue, Zed AI, or Windsurf.</span></li>'),
    ('<li><span class="check">✓</span><span>You\'d like a real revenue stream beyond GitHub Sponsors.</span></li>',
     '<li><span class="check">✓</span><span data-i18n="publish.mcp.who_li3">You\'d like a real revenue stream beyond GitHub Sponsors.</span></li>'),
    ('<li><span class="check">✓</span><span>You build for developer audiences and want premium CPMs that match the audience value.</span></li>',
     '<li><span class="check">✓</span><span data-i18n="publish.mcp.who_li4">You build for developer audiences and want premium CPMs that match the audience value.</span></li>'),

    # Revenue example
    ('<span class="section-eyebrow">Revenue example</span>',
     '<span class="section-eyebrow" data-i18n="publish.mcp.rev_eyebrow">Revenue example</span>'),
    ('<h2 class="section-h">What "earning per call" actually looks like.</h2>',
     '<h2 class="section-h" data-i18n="publish.mcp.rev_h2">What "earning per call" actually looks like.</h2>'),
    ('<span class="label">Illustrative — not a guarantee</span>',
     '<span class="label" data-i18n="publish.mcp.rev_label">Illustrative — not a guarantee</span>'),
    ('<div class="rev-row"><span>Daily tool calls</span><span class="v">5,000</span></div>',
     '<div class="rev-row"><span data-i18n="publish.mcp.rev_row1">Daily tool calls</span><span class="v">5,000</span></div>'),
    ('<div class="rev-row"><span>Ad impressions per day (1 in 3 calls)</span><span class="v">~1,500</span></div>',
     '<div class="rev-row"><span data-i18n="publish.mcp.rev_row2">Ad impressions per day (1 in 3 calls)</span><span class="v">~1,500</span></div>'),
    ('<div class="rev-row"><span>Average CPM (developer audience premium)</span><span class="v">$12</span></div>',
     '<div class="rev-row"><span data-i18n="publish.mcp.rev_row3">Average CPM (developer audience premium)</span><span class="v">$12</span></div>'),
    ('<div class="rev-row"><span>Monthly publisher revenue</span><span class="v">~$540</span></div>',
     '<div class="rev-row"><span data-i18n="publish.mcp.rev_row4">Monthly publisher revenue</span><span class="v">~$540</span></div>'),
    ('<p class="disclaimer">Numbers are illustrative for a moderately active MCP server. Actual revenue depends on tool-call volume, fill rate, advertiser demand, and your audience composition. CPMs vary; developer-tooling traffic typically sits at the high end.</p>',
     '<p class="disclaimer" data-i18n="publish.mcp.rev_disclaimer">Numbers are illustrative for a moderately active MCP server. Actual revenue depends on tool-call volume, fill rate, advertiser demand, and your audience composition. CPMs vary; developer-tooling traffic typically sits at the high end.</p>'),

    # FAQ
    ('<span class="section-eyebrow">Frequently asked</span>',
     '<span class="section-eyebrow" data-i18n="publish.mcp.faq_eyebrow">Frequently asked</span>'),
    ('<h2 class="section-h">The questions every MCP dev asks first.</h2>',
     '<h2 class="section-h" data-i18n="publish.mcp.faq_h2">The questions every MCP dev asks first.</h2>'),
    ('<h4>Will ads break my MCP integration?</h4>',
     '<h4 data-i18n="publish.mcp.faq1_q">Will ads break my MCP integration?</h4>'),
    ('<p>No. Ads are appended, not substituted. Your tool\'s primary output is unchanged — the host renders your tool result first, the sponsored block second.</p>',
     '<p data-i18n="publish.mcp.faq1_a">No. Ads are appended, not substituted. Your tool\'s primary output is unchanged — the host renders your tool result first, the sponsored block second.</p>'),
    ('<h4>What does an MCP ad look like to the user?</h4>',
     '<h4 data-i18n="publish.mcp.faq2_q">What does an MCP ad look like to the user?</h4>'),
    ('<p>A clearly labeled sponsored block in the tool response, rendered by the host (Claude Desktop, Cursor, etc.). The user always sees both the answer and the disclosure — there\'s no hidden injection.</p>',
     '<p data-i18n="publish.mcp.faq2_a">A clearly labeled sponsored block in the tool response, rendered by the host (Claude Desktop, Cursor, etc.). The user always sees both the answer and the disclosure — there\'s no hidden injection.</p>'),
    ('<h4>Can I block specific advertisers?</h4>',
     '<h4 data-i18n="publish.mcp.faq3_q">Can I block specific advertisers?</h4>'),
    ('<p>Yes. Category-level blocks (e.g., no recruiting ads) and domain-level blocks (e.g., never these specific competitors) — all controlled from your publisher dashboard.</p>',
     '<p data-i18n="publish.mcp.faq3_a">Yes. Category-level blocks (e.g., no recruiting ads) and domain-level blocks (e.g., never these specific competitors) — all controlled from your publisher dashboard.</p>'),
    ('<h4>Does this work with stdio AND HTTP transports?</h4>',
     '<h4 data-i18n="publish.mcp.faq4_q">Does this work with stdio AND HTTP transports?</h4>'),
    ('<p>Yes — both transports are supported. <code>@boostbossai/lumi-mcp</code> auto-detects which one your server uses; the SDK works identically across both.</p>',
     '<p data-i18n="publish.mcp.faq4_a_html" data-i18n-html>Yes — both transports are supported. <code>@boostbossai/lumi-mcp</code> auto-detects which one your server uses; the SDK works identically across both.</p>'),
    ('<h4>Is this approved by Anthropic?</h4>',
     '<h4 data-i18n="publish.mcp.faq5_q">Is this approved by Anthropic?</h4>'),
    ('<p>Boost Boss operates within MCP\'s public protocol — we don\'t require Anthropic\'s approval. We follow MCP disclosure norms strictly: every sponsored block is labeled, never disguised as tool output.</p>',
     '<p data-i18n="publish.mcp.faq5_a">Boost Boss operates within MCP\'s public protocol — we don\'t require Anthropic\'s approval. We follow MCP disclosure norms strictly: every sponsored block is labeled, never disguised as tool output.</p>'),

    # CTA footer
    ('<h2>Ready to monetize your MCP server?</h2>',
     '<h2 data-i18n="publish.mcp.cta_h2">Ready to monetize your MCP server?</h2>'),
    ('<p>Three lines. Ten minutes. Weekly payouts.</p>',
     '<p data-i18n="publish.mcp.cta_p">Three lines. Ten minutes. Weekly payouts.</p>'),
    ('<a class="btn btn-primary btn-lg" href="/publish/signup">Apply as a Founding Publisher →</a>',
     '<a class="btn btn-primary btn-lg" href="/publish/signup" data-i18n="publish.mcp.cta_btn">Apply as a Founding Publisher →</a>'),
    ('<span class="perk">⚡ First 20 MCP publishers get 90/10 revshare for 6 months</span>',
     '<span class="perk" data-i18n="publish.mcp.cta_perk">⚡ First 20 MCP publishers get 90/10 revshare for 6 months</span>'),

    # Site footer
    ('<a href="/publish">Publishers</a>',
     '<a href="/publish" data-i18n="pubfoot.publishers">Publishers</a>'),
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
