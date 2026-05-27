#!/usr/bin/env python3
"""i18n tagger for /publish/no-code (waitlist page)."""
import json, os

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..'))
PAGE = os.path.join(ROOT, 'public', 'publish-no-code.html')
I18N_DIR = os.path.join(ROOT, 'public', 'i18n')

MAILTO = ('mailto:hello@boostboss.ai?subject=Waitlist%3A%20no-code%20AI%20monetization&body='
          'I%20built%3A%20%5B%20describe%20your%20Custom%20GPT%20%2F%20Poe%20bot%20%2F%20Perplexity%20Page%20%2F%20no-code%20AI%20%5D%0A%0A'
          'Where%20it%20lives%3A%20%5B%20OpenAI%20GPT%20Store%20%2F%20Poe%20%2F%20Perplexity%20%2F%20other%20%5D%0A%0A'
          'Roughly%20how%20many%20conversations%20%2F%20interactions%20per%20month%3A%20%5B%20your%20best%20guess%20is%20fine%20%5D%0A%0A'
          'Anything%20else%20we%20should%20know%3A%20%5B%20optional%20%5D')

EN = {
    "publish.nocode.nav_cta": "Join waitlist",

    "publish.nocode.hero_eyebrow": "Coming soon · Waitlist open",
    "publish.nocode.hero_h1_html": "Built something with AI but <span class=\"grad\">never wrote a server?</span>",
    "publish.nocode.hero_sub": "If you built a Custom GPT, a Poe bot, a Perplexity Page, or anything where you didn't ship code — we hear you. The four integration paths Boost Boss ships today are SDK-based and assume you control a server. You probably don't. We're building no-code monetization next, and we'd like you on the waitlist.",
    "publish.nocode.hero_cta": "Join the waitlist →",

    "publish.nocode.who_eyebrow": "Who this is for",
    "publish.nocode.who_h2": "If any of these describe what you built, you're in the right place.",
    "publish.nocode.who_sub": "These are AI surfaces where the platform owns the runtime — you authored the prompt, the persona, the actions, the knowledge base. You don't deploy a server, and you can't ship an SDK.",
    "publish.nocode.who_card1_h4": "Custom GPT authors",
    "publish.nocode.who_card1_p": "You built a GPT in OpenAI's GPT Builder. It's listed in the GPT Store or shared privately. People chat with it. You'd like to earn from those conversations.",
    "publish.nocode.who_card2_h4": "Poe bot creators",
    "publish.nocode.who_card2_p": "You built a Poe bot — yours or based on a server-side Poe app. Quora's platform handles the runtime. You handle the persona, the knowledge, the prompt design.",
    "publish.nocode.who_card3_h4": "Perplexity Pages authors",
    "publish.nocode.who_card3_p": "You write Perplexity Pages with curated AI-generated answers on a topic. You have an audience returning for the content. You'd like a revenue stream.",
    "publish.nocode.who_card4_h4": "No-code AI builders",
    "publish.nocode.who_card4_p": "You shipped on Voiceflow, Botpress, Stack AI, FlowiseAI, or another no-code AI platform. You don't write JavaScript. The platform is your runtime.",

    "publish.nocode.honest_eyebrow": "Honest section",
    "publish.nocode.honest_h2": "Why this is a waitlist, not a \"sign up now\" button.",
    "publish.nocode.honest_label": "What we have today",
    "publish.nocode.honest_h3": "The four shipping paths all need code.",
    "publish.nocode.honest_p1_html": "Lumi SDK for MCP, Lumi SDK script tag, Lumi SDK for browser extensions, and Lumi API for Bots all expect a place where <em>you</em> can run logic — a server, a script, an extension manifest. Custom GPT authors and most no-code AI authors don't have that. The platform (OpenAI, Quora, Perplexity, Voiceflow, etc.) owns the runtime.",
    "publish.nocode.honest_p2": "We could ship something half-baked here that wraps your prompts in a fragile workaround, but it would break the moment OpenAI updated their Custom GPT runtime, and your users would notice. So we're not doing that.",
    "publish.nocode.honest_p3": "Instead we're collecting waitlist signal. If we hear from 30+ no-code authors with real audiences, we ship the integration. If we hear from 3, the path stays parked while we focus on the SDK doors that already work.",

    "publish.nocode.wait_h2": "Get on the waitlist",
    "publish.nocode.wait_p": "One email tells us what you built, where it lives, and roughly how many conversations or interactions it gets per month. If we ship a fit, you're first to know — and the first cohort gets a 90/10 revshare for the first six months, same as our Founding Publishers.",
    "publish.nocode.wait_cta": "Email hello@boostboss.ai",
    "publish.nocode.wait_perk1_v": "No commitment",
    "publish.nocode.wait_perk1_l": "Get on the list, drop off any time.",
    "publish.nocode.wait_perk2_v": "You shape the product",
    "publish.nocode.wait_perk2_l": "First cohort gets direct input on integration design.",
    "publish.nocode.wait_perk3_v": "Founding revshare",
    "publish.nocode.wait_perk3_l": "90/10 for the first 6 months when we ship.",

    "publish.nocode.fit_eyebrow": "Quick fit check",
    "publish.nocode.fit_h2": "A short list, both directions.",
    "publish.nocode.fit_yes_h3": "Likely a fit",
    "publish.nocode.fit_yes_li1": "You built a Custom GPT and it has actual usage (people are returning to it, or it's listed publicly).",
    "publish.nocode.fit_yes_li2": "You shipped a Poe bot and you control the persona / knowledge.",
    "publish.nocode.fit_yes_li3": "You write Perplexity Pages with a recurring audience.",
    "publish.nocode.fit_yes_li4": "You're on a no-code AI platform (Voiceflow, Botpress, Stack AI) and you'd take ad revenue if it didn't require code.",
    "publish.nocode.fit_yes_li5": "You have an idea of how many people interact with your AI per month, even rough.",
    "publish.nocode.fit_no_h3": "Likely not yet",
    "publish.nocode.fit_no_li1": "You wrote your own server or shipped your own SDK — you want one of the four shipping doors instead, not this waitlist.",
    "publish.nocode.fit_no_li2": "Your Custom GPT has fewer than ~50 conversations a month — there's no inventory to monetize yet.",
    "publish.nocode.fit_no_li3": "The no-code platform you used explicitly bans third-party content injection — we'd hit a policy wall.",
    "publish.nocode.fit_no_li4": "You want guaranteed revenue or a per-month minimum — this is unproven inventory; we're not paying advances.",

    "publish.nocode.faq_eyebrow": "Frequently asked",
    "publish.nocode.faq_h2": "The questions every no-code author asks first.",
    "publish.nocode.faq1_q": "How would the integration even work? Custom GPTs can't load arbitrary code.",
    "publish.nocode.faq1_a": "Right — that's the hard part, and the reason this is a waitlist. The most likely shape is a Custom Action that calls a Boost Boss endpoint, returns a sponsored block, and your GPT's instructions tell it to surface the block at the end of relevant answers. It's a constrained version of what the SDK does on a server. We're prototyping; we'll share what works once it does.",
    "publish.nocode.faq2_q": "Will OpenAI / Quora / Perplexity allow this?",
    "publish.nocode.faq2_a": "This is one of the things we're working out. Each platform has different content policies for what a Custom GPT or bot can serve. Some are clearly within current rules; some are gray. We won't ship a path that gets your GPT delisted, which is part of why we're going slow.",
    "publish.nocode.faq3_q": "How much could I earn?",
    "publish.nocode.faq3_a": "Honest answer: we don't know yet. The published per-impression CPM for our SDK doors trends $2-15 depending on audience and surface. No-code surfaces are likely to be at the lower end because of disclosure constraints. If your Custom GPT does 10K conversations a month and 1 in 5 surfaces a sponsored block, we're talking double-digit dollars per month at first, more as advertiser demand for AI surfaces matures. This is supplementary income, not a replacement for a job.",
    "publish.nocode.faq4_q": "Do you support no-code platforms other than Custom GPTs / Poe / Perplexity?",
    "publish.nocode.faq4_a": "If your platform supports calling an HTTP endpoint and rendering returned content (text or markdown), we can probably integrate. Tell us in your email which platform — Voiceflow, Botpress, Stack AI, FlowiseAI, Dust, custom builds — and we'll add it to the prioritization list.",
    "publish.nocode.faq5_q": "What if I want to switch from the waitlist to building my own server?",
    "publish.nocode.faq5_a_html": "Welcome change of plans. One of our four shipping doors will fit — most likely <a href=\"/publish/ai-apps\">AI Apps</a> if you're going to deploy a web frontend, or <a href=\"/publish/bots\">Bots</a> if you're moving to Discord/Telegram/Slack. Same publisher account either way; we move you over.",
    "publish.nocode.faq6_q": "Can I just hear from you when this ships, no commitment?",
    "publish.nocode.faq6_a": "Yes — just say so in the email. We won't auto-enroll you; the waitlist is informational, not a contract.",

    "publish.nocode.cta_h2": "One email. We take it from there.",
    "publish.nocode.cta_p": "Tell us what you built, where it lives, and roughly how many people use it.",
    "publish.nocode.cta_btn": "Email hello@boostboss.ai →",
}

ZH = {
    "publish.nocode.nav_cta": "加入候补",
    "publish.nocode.hero_eyebrow": "即将上线 · 候补名单开放",
    "publish.nocode.hero_h1_html": "用 AI 做了东西,但 <span class=\"grad\">从没写过服务器?</span>",
    "publish.nocode.hero_sub": "如果你做了 Custom GPT、Poe bot、Perplexity Page,或者任何你没写代码就能上线的东西 — 我们懂你。Boost Boss 目前发布的四条集成路径都是 SDK 方式,默认你掌控一台服务器。你大概率没有。我们接下来要做无代码变现,希望把你加进候补名单。",
    "publish.nocode.hero_cta": "加入候补 →",

    "publish.nocode.who_eyebrow": "适合谁",
    "publish.nocode.who_h2": "下面任何一条像你做的事,你就来对地方了。",
    "publish.nocode.who_sub": "这些是平台拥有运行时的 AI 界面 — 你写了 prompt、persona、actions、知识库。你不部署服务器,也没法接入 SDK。",
    "publish.nocode.who_card1_h4": "Custom GPT 作者",
    "publish.nocode.who_card1_p": "你在 OpenAI 的 GPT Builder 里做了一个 GPT,挂在 GPT Store 上或私下分享。有人在跟它聊天。你想从那些对话里赚钱。",
    "publish.nocode.who_card2_h4": "Poe bot 创建者",
    "publish.nocode.who_card2_p": "你做了一个 Poe bot — 自己的,或基于服务端 Poe 应用。Quora 的平台处理运行时。你处理 persona、知识、prompt 设计。",
    "publish.nocode.who_card3_h4": "Perplexity Pages 作者",
    "publish.nocode.who_card3_p": "你写 Perplexity Pages,精选某个主题的 AI 生成答案。你有回访的受众。你想要一条收入来源。",
    "publish.nocode.who_card4_h4": "无代码 AI 构建者",
    "publish.nocode.who_card4_p": "你在 Voiceflow、Botpress、Stack AI、FlowiseAI 等无代码 AI 平台上发布。你不写 JavaScript。平台就是你的运行时。",

    "publish.nocode.honest_eyebrow": "实话实说",
    "publish.nocode.honest_h2": "为什么这是候补而不是“立刻注册”。",
    "publish.nocode.honest_label": "我们目前的产品",
    "publish.nocode.honest_h3": "四条发布路径都需要代码。",
    "publish.nocode.honest_p1_html": "Lumi SDK for MCP、Lumi SDK script tag、Lumi SDK for browser extensions 和 Lumi API for Bots 都假设 <em>你</em> 有个地方可以跑逻辑 — 服务器、script、扩展 manifest。Custom GPT 作者和大多数无代码 AI 作者都没有。平台(OpenAI、Quora、Perplexity、Voiceflow 等)掌控运行时。",
    "publish.nocode.honest_p2": "我们可以在这里硬上一个半成品,用脆弱的 workaround 把你的 prompt 包起来,但 OpenAI 一更新 Custom GPT 运行时它就会坏,你的用户会发现。所以我们不会这么做。",
    "publish.nocode.honest_p3": "我们改为收集候补信号。如果我们听到 30 位以上有真实受众的无代码作者,就上集成。如果只听到 3 位,这条路先停着,我们专注那些已经能跑的 SDK 门。",

    "publish.nocode.wait_h2": "加入候补名单",
    "publish.nocode.wait_p": "一封邮件告诉我们你做了什么、它在哪里、每个月大概有多少对话或互动。如果我们做出合适的方案,你第一个知道 — 而且第一批入选者前 6 个月享 90/10 分成,和我们的创始发布商一样。",
    "publish.nocode.wait_cta": "发邮件到 hello@boostboss.ai",
    "publish.nocode.wait_perk1_v": "无承诺",
    "publish.nocode.wait_perk1_l": "进名单,随时退出。",
    "publish.nocode.wait_perk2_v": "你参与塑造产品",
    "publish.nocode.wait_perk2_l": "第一批入选者对集成设计有直接发言权。",
    "publish.nocode.wait_perk3_v": "创始期分成",
    "publish.nocode.wait_perk3_l": "上线后前 6 个月 90/10。",

    "publish.nocode.fit_eyebrow": "快速匹配检查",
    "publish.nocode.fit_h2": "正反两面,一份短清单。",
    "publish.nocode.fit_yes_h3": "可能适合",
    "publish.nocode.fit_yes_li1": "你做了一个有真实使用量的 Custom GPT(有人回来用,或者它公开列出)。",
    "publish.nocode.fit_yes_li2": "你做了一个 Poe bot,并掌握 persona / 知识。",
    "publish.nocode.fit_yes_li3": "你写有稳定回访受众的 Perplexity Pages。",
    "publish.nocode.fit_yes_li4": "你在无代码 AI 平台(Voiceflow、Botpress、Stack AI)上,如果不需要写代码,你愿意接广告收入。",
    "publish.nocode.fit_yes_li5": "你大致知道每月有多少人在用你的 AI,哪怕只是粗略数字。",
    "publish.nocode.fit_no_h3": "可能还不适合",
    "publish.nocode.fit_no_li1": "你自己写过服务器或发过 SDK — 你要的是那四条上线的门,不是这个候补。",
    "publish.nocode.fit_no_li2": "你的 Custom GPT 每月对话少于约 50 次 — 还没有可变现的库存。",
    "publish.nocode.fit_no_li3": "你用的无代码平台明确禁止第三方内容注入 — 我们会撞政策墙。",
    "publish.nocode.fit_no_li4": "你想要保证收益或每月保底 — 这是未经验证的库存,我们不付预付款。",

    "publish.nocode.faq_eyebrow": "常见问题",
    "publish.nocode.faq_h2": "每位无代码作者最先问的问题。",
    "publish.nocode.faq1_q": "集成到底要怎么做?Custom GPT 不能加载任意代码。",
    "publish.nocode.faq1_a": "对 — 这是难点,也是它为什么是候补。最可能的形态是一个 Custom Action,调用 Boost Boss 的 endpoint,返回一个赞助区块,你的 GPT 指令告诉它在相关回答末尾呈现这个区块。这是 SDK 在服务端做的事的一个受限版本。我们在做原型;一旦跑通会公布。",
    "publish.nocode.faq2_q": "OpenAI / Quora / Perplexity 会允许这样吗?",
    "publish.nocode.faq2_a": "这正是我们要厘清的事情之一。每个平台对 Custom GPT 或 bot 可以呈现什么有不同的内容政策。有些显然在当前规则内;有些是灰色。我们不会上一条让你 GPT 被下架的路径,这也是我们走得慢的原因之一。",
    "publish.nocode.faq3_q": "我能赚多少?",
    "publish.nocode.faq3_a": "诚实回答:还不知道。我们 SDK 门的公开单次展示 CPM 趋势在 2-15 美元,因受众和界面而异。无代码界面因披露限制,大概率在区间低端。如果你的 Custom GPT 每月 10K 对话、五分之一呈现赞助区块,初期是两位数美元/月,等广告主对 AI 界面需求成熟后会更多。这是补充收入,不是替代工作。",
    "publish.nocode.faq4_q": "Custom GPT / Poe / Perplexity 之外的无代码平台支持吗?",
    "publish.nocode.faq4_a": "如果你的平台支持调用 HTTP endpoint 并渲染返回内容(text 或 markdown),我们大概率能集成。在邮件里告诉我们是哪个平台 — Voiceflow、Botpress、Stack AI、FlowiseAI、Dust、自建 — 我们会加入排期列表。",
    "publish.nocode.faq5_q": "如果我想从候补改成自己写服务器呢?",
    "publish.nocode.faq5_a_html": "欢迎换计划。我们四条上线的门会有一条合适 — 多半是 <a href=\"/publish/ai-apps\">AI Apps</a>(如果你要做 Web 前端)或 <a href=\"/publish/bots\">Bots</a>(如果你要转到 Discord/Telegram/Slack)。发布商账号不变;我们直接帮你迁过去。",
    "publish.nocode.faq6_q": "我能只是等你们上线时收到通知,不做承诺吗?",
    "publish.nocode.faq6_a": "可以 — 在邮件里说一句就行。我们不会自动把你加进合约;候补只是信息收集,不是合约。",

    "publish.nocode.cta_h2": "一封邮件。剩下交给我们。",
    "publish.nocode.cta_p": "告诉我们你做了什么、它在哪里、大概有多少人在用。",
    "publish.nocode.cta_btn": "发邮件到 hello@boostboss.ai →",
}

ZH_TW = {
    "publish.nocode.nav_cta": "加入候補",
    "publish.nocode.hero_eyebrow": "即將上線 · 候補名單開放",
    "publish.nocode.hero_h1_html": "用 AI 做了東西,卻 <span class=\"grad\">從沒寫過伺服器?</span>",
    "publish.nocode.hero_sub": "如果你做了 Custom GPT、Poe bot、Perplexity Page,或任何不需寫程式就能上線的東西 — 我們懂你。Boost Boss 目前發布的四條整合路徑都是 SDK 形式,預設你掌控一台伺服器。你大概沒有。我們接下來要打造無程式碼變現,希望把你加進候補名單。",
    "publish.nocode.hero_cta": "加入候補 →",

    "publish.nocode.who_eyebrow": "適合誰",
    "publish.nocode.who_h2": "下面任何一條描述了你做的事,你就來對地方了。",
    "publish.nocode.who_sub": "這些是平台擁有執行階段的 AI 介面 — 你撰寫 prompt、persona、actions、知識庫。你不部署伺服器,也無法接入 SDK。",
    "publish.nocode.who_card1_h4": "Custom GPT 作者",
    "publish.nocode.who_card1_p": "你在 OpenAI 的 GPT Builder 裡做了一個 GPT,掛在 GPT Store 上或私下分享。有人在跟它對話。你想從那些對話中賺取收益。",
    "publish.nocode.who_card2_h4": "Poe bot 創作者",
    "publish.nocode.who_card2_p": "你做了一個 Poe bot — 自己的,或基於伺服端 Poe 應用。Quora 的平台處理執行階段。你處理 persona、知識、prompt 設計。",
    "publish.nocode.who_card3_h4": "Perplexity Pages 作者",
    "publish.nocode.who_card3_p": "你撰寫 Perplexity Pages,精選某主題的 AI 生成答覆。你有回訪的受眾。你想要一條收益來源。",
    "publish.nocode.who_card4_h4": "無程式碼 AI 創作者",
    "publish.nocode.who_card4_p": "你在 Voiceflow、Botpress、Stack AI、FlowiseAI 等無程式碼 AI 平台上發布。你不寫 JavaScript。平台就是你的執行階段。",

    "publish.nocode.honest_eyebrow": "實話實說",
    "publish.nocode.honest_h2": "為什麼這是候補,而非「立刻註冊」。",
    "publish.nocode.honest_label": "我們目前有的產品",
    "publish.nocode.honest_h3": "四條上線路徑都需要程式碼。",
    "publish.nocode.honest_p1_html": "Lumi SDK for MCP、Lumi SDK script tag、Lumi SDK for browser extensions 與 Lumi API for Bots 都預設 <em>你</em> 有個地方可以跑邏輯 — 伺服器、script、擴充功能 manifest。Custom GPT 作者與多數無程式碼 AI 作者都沒有。平台(OpenAI、Quora、Perplexity、Voiceflow 等)掌控執行階段。",
    "publish.nocode.honest_p2": "我們可以硬出一個半成品,以脆弱的 workaround 把你的 prompt 包起來,但 OpenAI 一更新 Custom GPT 執行階段它就會壞,你的使用者會注意到。所以我們不會這樣做。",
    "publish.nocode.honest_p3": "我們改為收集候補訊號。如果我們聽到 30 位以上有真實受眾的無程式碼作者,就推出整合。如果只聽到 3 位,這條路先擱著,我們專注在已能運作的 SDK 路徑上。",

    "publish.nocode.wait_h2": "加入候補名單",
    "publish.nocode.wait_p": "一封信告訴我們你做了什麼、它在哪裡、每月大約有多少對話或互動。若我們推出合適方案,你第一個知道 — 第一批入選者前 6 個月享 90/10 分潤,與我們的創始發布商相同。",
    "publish.nocode.wait_cta": "寄信至 hello@boostboss.ai",
    "publish.nocode.wait_perk1_v": "無承諾",
    "publish.nocode.wait_perk1_l": "進名單,隨時退出。",
    "publish.nocode.wait_perk2_v": "你參與形塑產品",
    "publish.nocode.wait_perk2_l": "第一批入選者對整合設計有直接發言權。",
    "publish.nocode.wait_perk3_v": "創始期分潤",
    "publish.nocode.wait_perk3_l": "上線後前 6 個月 90/10。",

    "publish.nocode.fit_eyebrow": "快速契合度檢查",
    "publish.nocode.fit_h2": "正反兩面,一份簡短清單。",
    "publish.nocode.fit_yes_h3": "可能契合",
    "publish.nocode.fit_yes_li1": "你做了一個有實際使用量的 Custom GPT(有人回頭用,或它公開列出)。",
    "publish.nocode.fit_yes_li2": "你做了一個 Poe bot,並掌握 persona / 知識。",
    "publish.nocode.fit_yes_li3": "你撰寫具固定回訪受眾的 Perplexity Pages。",
    "publish.nocode.fit_yes_li4": "你在無程式碼 AI 平台(Voiceflow、Botpress、Stack AI)上,如果不需寫程式,你願意收廣告收入。",
    "publish.nocode.fit_yes_li5": "你大致知道每月有多少人在用你的 AI,即便只是粗估。",
    "publish.nocode.fit_no_h3": "可能還不適合",
    "publish.nocode.fit_no_li1": "你自己寫過伺服器或發過 SDK — 你要的是那四扇上線的門,而非這份候補。",
    "publish.nocode.fit_no_li2": "你的 Custom GPT 每月對話少於約 50 次 — 還沒有可變現的版位。",
    "publish.nocode.fit_no_li3": "你使用的無程式碼平台明確禁止第三方內容注入 — 我們會撞政策牆。",
    "publish.nocode.fit_no_li4": "你想要保證收益或每月保底 — 這是未經驗證的版位,我們不付預付款。",

    "publish.nocode.faq_eyebrow": "常見問題",
    "publish.nocode.faq_h2": "每位無程式碼作者最先問的問題。",
    "publish.nocode.faq1_q": "整合到底要怎麼做?Custom GPT 不能載入任意程式碼。",
    "publish.nocode.faq1_a": "沒錯 — 這是難點,也是它為何是候補。最可能的形態是一個 Custom Action,呼叫 Boost Boss 的 endpoint、回傳一個贊助區塊,你的 GPT 指令告訴它在相關回答末尾呈現此區塊。這是 SDK 在伺服端執行的事情的受限版本。我們在做原型;一旦跑通會公開。",
    "publish.nocode.faq2_q": "OpenAI / Quora / Perplexity 會允許嗎?",
    "publish.nocode.faq2_a": "這正是我們在釐清的事情之一。每個平台對 Custom GPT 或 bot 可呈現什麼有不同的內容政策。有些明顯在現行規則內;有些是灰色。我們不會推出會讓你 GPT 被下架的路徑,這也是我們步調較慢的原因之一。",
    "publish.nocode.faq3_q": "我能賺多少?",
    "publish.nocode.faq3_a": "誠實回答:還不知道。我們 SDK 路徑的公開單次曝光 CPM 介於 2-15 美元,依受眾與介面而異。無程式碼介面因揭露限制,大概率落在低端。若你的 Custom GPT 每月 10K 對話、五分之一呈現贊助區塊,初期是每月兩位數美元,廣告主對 AI 介面需求成熟後會更多。這是補充收入,不是工作的替代。",
    "publish.nocode.faq4_q": "除了 Custom GPT / Poe / Perplexity,還支援其他無程式碼平台嗎?",
    "publish.nocode.faq4_a": "若你的平台支援呼叫 HTTP endpoint 並渲染回傳內容(text 或 markdown),我們大概率能整合。在信件中告訴我們是哪個平台 — Voiceflow、Botpress、Stack AI、FlowiseAI、Dust、自建 — 我們會加入排序清單。",
    "publish.nocode.faq5_q": "如果我想從候補轉成自己寫伺服器呢?",
    "publish.nocode.faq5_a_html": "歡迎換計畫。我們四扇上線的門會有一扇合適 — 多半是 <a href=\"/publish/ai-apps\">AI Apps</a>(若你要部署 Web 前端)或 <a href=\"/publish/bots\">Bots</a>(若你要轉到 Discord/Telegram/Slack)。發布商帳號不變;我們幫你轉過去。",
    "publish.nocode.faq6_q": "我能只是等你們上線時收到通知,不做承諾嗎?",
    "publish.nocode.faq6_a": "可以 — 在信件中說一句即可。我們不會自動把你加入合約;候補只是資訊性,並非合約。",

    "publish.nocode.cta_h2": "一封信。其餘交給我們。",
    "publish.nocode.cta_p": "告訴我們你做了什麼、它在哪裡、大約有多少人在用。",
    "publish.nocode.cta_btn": "寄信至 hello@boostboss.ai →",
}

JA = {
    "publish.nocode.nav_cta": "ウェイトリスト登録",
    "publish.nocode.hero_eyebrow": "近日公開 · ウェイトリスト受付中",
    "publish.nocode.hero_h1_html": "AI で何かを作ったけど <span class=\"grad\">サーバーは書いたことがない?</span>",
    "publish.nocode.hero_sub": "Custom GPT、Poe bot、Perplexity Page、コードを書かずに何かを出したあなた — 分かります。Boost Boss が今出している 4 つの統合パスはどれも SDK ベースで、あなたがサーバーを持っていることが前提。たぶん持っていません。次はノーコードのマネタイズを作ります。ウェイトリストに登録してください。",
    "publish.nocode.hero_cta": "ウェイトリストに登録 →",

    "publish.nocode.who_eyebrow": "向いている人",
    "publish.nocode.who_h2": "以下のどれかがあなたの作ったものなら、ここが正しい場所です。",
    "publish.nocode.who_sub": "これらはプラットフォームがランタイムを所有する AI サーフェスです — プロンプト、ペルソナ、アクション、ナレッジベースを書いたのはあなた。サーバーをデプロイせず、SDK もリリースできない。",
    "publish.nocode.who_card1_h4": "Custom GPT 作者",
    "publish.nocode.who_card1_p": "OpenAI の GPT Builder で GPT を作った。GPT Store に掲載、もしくは限定共有。誰かが話しかけている。その会話から稼ぎたい。",
    "publish.nocode.who_card2_h4": "Poe bot 作成者",
    "publish.nocode.who_card2_p": "Poe bot を作った — 自前、もしくはサーバーサイドの Poe アプリ ベース。ランタイムは Quora のプラットフォームが処理。ペルソナ、ナレッジ、プロンプト設計はあなた。",
    "publish.nocode.who_card3_h4": "Perplexity Pages 作者",
    "publish.nocode.who_card3_p": "特定トピックに対するキュレーション済み AI 回答の Perplexity Pages を書く。コンテンツを目的に戻ってくる読者がいる。収益源が欲しい。",
    "publish.nocode.who_card4_h4": "ノーコード AI ビルダー",
    "publish.nocode.who_card4_p": "Voiceflow、Botpress、Stack AI、FlowiseAI など、ノーコード AI プラットフォームで出している。JavaScript は書かない。プラットフォームがランタイム。",

    "publish.nocode.honest_eyebrow": "正直なセクション",
    "publish.nocode.honest_h2": "これがウェイトリストで、「今すぐ登録」ボタンではない理由。",
    "publish.nocode.honest_label": "現在あるもの",
    "publish.nocode.honest_h3": "出荷中の 4 つのパスはすべてコードを必要とします。",
    "publish.nocode.honest_p1_html": "Lumi SDK for MCP、Lumi SDK script tag、Lumi SDK for browser extensions、Lumi API for Bots はどれも <em>あなた</em> がロジックを動かせる場所(サーバー、スクリプト、拡張機能 manifest)を前提とします。Custom GPT 作者やほとんどのノーコード AI 作者にはそれがありません。プラットフォーム(OpenAI、Quora、Perplexity、Voiceflow など)がランタイムを所有しています。",
    "publish.nocode.honest_p2": "プロンプトを脆い回避策で包む中途半端なものを出すこともできますが、OpenAI が Custom GPT のランタイムを更新した瞬間に壊れ、ユーザーが気づくでしょう。だからやりません。",
    "publish.nocode.honest_p3": "代わりにウェイトリストのシグナルを集めています。実オーディエンスを持つノーコード作者から 30 名以上聞ければ、統合を出します。3 名しかいなければ、このパスは保留して、既に動く SDK ドアに集中します。",

    "publish.nocode.wait_h2": "ウェイトリストに登録",
    "publish.nocode.wait_p": "1 通のメールで、何を作ったか、どこで動いているか、月のおおよその会話・インタラクション数を教えてください。フィットを出したら、あなたが最初に知ります — 最初のコホートは創業パブリッシャー同様、最初の 6 ヶ月 90/10 のレベニューシェア。",
    "publish.nocode.wait_cta": "hello@boostboss.ai にメール",
    "publish.nocode.wait_perk1_v": "コミットなし",
    "publish.nocode.wait_perk1_l": "リストに乗り、いつでも降りられる。",
    "publish.nocode.wait_perk2_v": "プロダクトを形作る",
    "publish.nocode.wait_perk2_l": "最初のコホートは統合設計に直接インプット。",
    "publish.nocode.wait_perk3_v": "創業レベニューシェア",
    "publish.nocode.wait_perk3_l": "リリース時、最初の 6 ヶ月 90/10。",

    "publish.nocode.fit_eyebrow": "クイック適合チェック",
    "publish.nocode.fit_h2": "両方向の短いリスト。",
    "publish.nocode.fit_yes_h3": "適合しそう",
    "publish.nocode.fit_yes_li1": "実際の利用がある Custom GPT を作った(リピート利用、または公開掲載)。",
    "publish.nocode.fit_yes_li2": "Poe bot をリリースし、ペルソナ / ナレッジを管理している。",
    "publish.nocode.fit_yes_li3": "繰り返し訪れるオーディエンスがいる Perplexity Pages を書いている。",
    "publish.nocode.fit_yes_li4": "ノーコード AI プラットフォーム(Voiceflow、Botpress、Stack AI)を使っており、コード不要なら広告収益を受け入れる。",
    "publish.nocode.fit_yes_li5": "月にどれくらいの人があなたの AI と関わっているか、おおよそ把握している。",
    "publish.nocode.fit_no_h3": "まだ向いていない",
    "publish.nocode.fit_no_li1": "自分でサーバーを書いたり SDK を出した — このウェイトリストではなく、4 つの出荷済みドアのいずれかが必要。",
    "publish.nocode.fit_no_li2": "Custom GPT の月の会話が約 50 未満 — まだマネタイズする在庫がない。",
    "publish.nocode.fit_no_li3": "使っているノーコードプラットフォームが第三者コンテンツ挿入を明示的に禁じている — ポリシーの壁にぶつかる。",
    "publish.nocode.fit_no_li4": "保証収益や月次ミニマムを望む — これは未検証の在庫であり、前払いはしません。",

    "publish.nocode.faq_eyebrow": "よくある質問",
    "publish.nocode.faq_h2": "ノーコード作者が必ず最初に聞く質問。",
    "publish.nocode.faq1_q": "そもそもどう統合するの? Custom GPT は任意のコードをロードできません。",
    "publish.nocode.faq1_a": "そうです — そこが難しく、ウェイトリストである理由です。最も可能性のある形は、Boost Boss のエンドポイントを呼ぶ Custom Action でスポンサーブロックを返し、GPT のインストラクションが関連回答の末尾でそれを出すよう指示する形。サーバー上で SDK がやっていることの制約版です。プロトタイプ中で、動いたら共有します。",
    "publish.nocode.faq2_q": "OpenAI / Quora / Perplexity は許可してくれる?",
    "publish.nocode.faq2_a": "これも我々が詰めているところ。プラットフォームごとに Custom GPT やボットが配信できる内容のポリシーが異なります。明らかに現行ルール内のものもあれば、グレーゾーンも。GPT が掲載解除されるようなパスはリリースしません。歩みが慎重なのはそのため。",
    "publish.nocode.faq3_q": "どれくらい稼げる?",
    "publish.nocode.faq3_a": "正直に言って、まだ分かりません。SDK ドアの公開インプレッション CPM はオーディエンスとサーフェスにより 2-15 ドル。ノーコードサーフェスは開示の制約により下端になりそう。Custom GPT が月 10K 会話で、5 回に 1 回スポンサーブロックを出すなら、初期は 2 桁ドル / 月、広告主の AI サーフェス需要が成熟するにつれもっと。これは補助収入で、仕事の代替ではありません。",
    "publish.nocode.faq4_q": "Custom GPT / Poe / Perplexity 以外のノーコードプラットフォームは対応?",
    "publish.nocode.faq4_a": "プラットフォームが HTTP エンドポイントを呼んで返ってきたコンテンツ(text や markdown)をレンダリングできるなら、たぶん統合できます。どのプラットフォームかメールで教えてください — Voiceflow、Botpress、Stack AI、FlowiseAI、Dust、独自ビルド — 優先順位リストに入れます。",
    "publish.nocode.faq5_q": "ウェイトリストから自前サーバー構築に切り替えたい場合は?",
    "publish.nocode.faq5_a_html": "歓迎する方針転換。4 つの出荷済みドアのどれかが合うはず — Web フロントエンドをデプロイするなら <a href=\"/publish/ai-apps\">AI Apps</a>、Discord/Telegram/Slack に移るなら <a href=\"/publish/bots\">Bots</a>。パブリッシャーアカウントは同じ;移行はこちらで処理します。",
    "publish.nocode.faq6_q": "コミットなしで、リリース時にお知らせもらえるだけでいい?",
    "publish.nocode.faq6_a": "はい — メールでそう伝えてください。自動登録はしません;ウェイトリストは情報用で、契約ではありません。",

    "publish.nocode.cta_h2": "1 通のメール。あとはこちらで。",
    "publish.nocode.cta_p": "何を作ったか、どこで動いているか、おおよそ何人が使っているかを教えてください。",
    "publish.nocode.cta_btn": "hello@boostboss.ai にメール →",
}

KO = {
    "publish.nocode.nav_cta": "대기열 등록",
    "publish.nocode.hero_eyebrow": "곧 출시 · 대기열 오픈",
    "publish.nocode.hero_h1_html": "AI로 뭔가를 만들었지만 <span class=\"grad\">서버를 써본 적 없으세요?</span>",
    "publish.nocode.hero_sub": "Custom GPT, Poe bot, Perplexity Page, 또는 코드를 짜지 않고 만든 무언가가 있다면 — 우리는 압니다. Boost Boss가 지금 제공하는 네 가지 통합 경로는 모두 SDK 기반이며 당신이 서버를 제어한다고 가정합니다. 아마 아니실 겁니다. 다음으로 노코드 수익화를 만들고 있고, 당신을 대기열에 넣고 싶습니다.",
    "publish.nocode.hero_cta": "대기열에 등록하기 →",

    "publish.nocode.who_eyebrow": "이런 분에게 맞습니다",
    "publish.nocode.who_h2": "다음 중 하나라도 당신이 만든 것과 맞다면 제대로 찾아오신 겁니다.",
    "publish.nocode.who_sub": "이것들은 플랫폼이 런타임을 소유한 AI 표면입니다 — 프롬프트, 페르소나, 액션, 지식 베이스는 당신이 작성. 서버를 배포하지 않고 SDK도 출시할 수 없습니다.",
    "publish.nocode.who_card1_h4": "Custom GPT 작성자",
    "publish.nocode.who_card1_p": "OpenAI의 GPT Builder에서 GPT를 만들었습니다. GPT Store에 등록되거나 비공개로 공유 중. 사람들이 대화합니다. 그 대화에서 수익을 얻고 싶습니다.",
    "publish.nocode.who_card2_h4": "Poe 봇 제작자",
    "publish.nocode.who_card2_p": "Poe 봇을 만들었습니다 — 직접 또는 서버 측 Poe 앱 기반. Quora 플랫폼이 런타임을 처리합니다. 당신은 페르소나, 지식, 프롬프트 설계를 다룹니다.",
    "publish.nocode.who_card3_h4": "Perplexity Pages 작성자",
    "publish.nocode.who_card3_p": "특정 주제에 대한 큐레이팅된 AI 답변으로 Perplexity Pages를 작성합니다. 콘텐츠를 위해 돌아오는 오디언스가 있습니다. 수익원을 원합니다.",
    "publish.nocode.who_card4_h4": "노코드 AI 빌더",
    "publish.nocode.who_card4_p": "Voiceflow, Botpress, Stack AI, FlowiseAI 또는 다른 노코드 AI 플랫폼에서 배포. JavaScript를 작성하지 않습니다. 플랫폼이 런타임입니다.",

    "publish.nocode.honest_eyebrow": "솔직한 섹션",
    "publish.nocode.honest_h2": "이것이 대기열이고 \"지금 가입\" 버튼이 아닌 이유.",
    "publish.nocode.honest_label": "현재 우리가 가진 것",
    "publish.nocode.honest_h3": "출시한 네 가지 경로 모두 코드가 필요합니다.",
    "publish.nocode.honest_p1_html": "Lumi SDK for MCP, Lumi SDK script tag, Lumi SDK for browser extensions, Lumi API for Bots는 모두 <em>당신</em>이 로직을 실행할 수 있는 곳(서버, 스크립트, 확장 매니페스트)을 가정합니다. Custom GPT 작성자와 대부분의 노코드 AI 작성자에게는 그게 없습니다. 플랫폼(OpenAI, Quora, Perplexity, Voiceflow 등)이 런타임을 소유합니다.",
    "publish.nocode.honest_p2": "프롬프트를 약한 우회로 감싼 미완성품을 출시할 수도 있지만, OpenAI가 Custom GPT 런타임을 업데이트하는 순간 깨질 것이고 사용자가 알아챌 것입니다. 그래서 하지 않습니다.",
    "publish.nocode.honest_p3": "대신 대기열 시그널을 모으고 있습니다. 진짜 오디언스를 가진 노코드 작성자 30명 이상에게서 들으면 통합을 출시합니다. 3명만 듣는다면 이 경로는 보류하고 이미 작동하는 SDK 도어에 집중합니다.",

    "publish.nocode.wait_h2": "대기열에 등록",
    "publish.nocode.wait_p": "이메일 하나로 무엇을 만들었는지, 어디에 있는지, 월 대략 몇 번의 대화 또는 상호작용이 있는지 알려주세요. 적합한 솔루션을 출시하면 당신이 가장 먼저 알게 되고 — 첫 코호트는 우리 파운딩 퍼블리셔와 동일하게 첫 6개월 90/10 수익 배분.",
    "publish.nocode.wait_cta": "hello@boostboss.ai로 이메일",
    "publish.nocode.wait_perk1_v": "약속 없음",
    "publish.nocode.wait_perk1_l": "리스트에 올라가고, 언제든 빠질 수 있음.",
    "publish.nocode.wait_perk2_v": "제품을 함께 만듭니다",
    "publish.nocode.wait_perk2_l": "첫 코호트는 통합 설계에 직접 입력합니다.",
    "publish.nocode.wait_perk3_v": "파운딩 수익 배분",
    "publish.nocode.wait_perk3_l": "출시 시 첫 6개월 90/10.",

    "publish.nocode.fit_eyebrow": "빠른 적합도 체크",
    "publish.nocode.fit_h2": "양방향의 짧은 리스트.",
    "publish.nocode.fit_yes_h3": "맞을 것 같음",
    "publish.nocode.fit_yes_li1": "실제 사용량 있는 Custom GPT를 만들었다(사람들이 돌아와 쓰거나 공개 등록됨).",
    "publish.nocode.fit_yes_li2": "Poe 봇을 배포했고 페르소나 / 지식을 제어한다.",
    "publish.nocode.fit_yes_li3": "정기적으로 돌아오는 오디언스를 가진 Perplexity Pages를 쓴다.",
    "publish.nocode.fit_yes_li4": "노코드 AI 플랫폼(Voiceflow, Botpress, Stack AI)에 있으며, 코드가 필요 없다면 광고 수익을 받겠다.",
    "publish.nocode.fit_yes_li5": "월에 몇 명이 당신의 AI와 상호작용하는지 대략은 안다.",
    "publish.nocode.fit_no_h3": "아직 아닌 것 같음",
    "publish.nocode.fit_no_li1": "자체 서버를 썼거나 SDK를 출시했다 — 이 대기열이 아니라 출시된 네 도어 중 하나가 필요.",
    "publish.nocode.fit_no_li2": "Custom GPT의 월 대화가 약 50건 미만 — 아직 수익화할 인벤토리가 없음.",
    "publish.nocode.fit_no_li3": "사용한 노코드 플랫폼이 명시적으로 제3자 콘텐츠 주입을 금지함 — 정책 벽에 부딪힘.",
    "publish.nocode.fit_no_li4": "보장 수익이나 월 최저액을 원함 — 이는 검증되지 않은 인벤토리; 선급금을 지급하지 않음.",

    "publish.nocode.faq_eyebrow": "자주 묻는 질문",
    "publish.nocode.faq_h2": "모든 노코드 작성자가 가장 먼저 묻는 질문.",
    "publish.nocode.faq1_q": "통합이 도대체 어떻게 되나요? Custom GPT는 임의 코드를 로드할 수 없습니다.",
    "publish.nocode.faq1_a": "맞아요 — 그게 어려운 부분이고 이게 대기열인 이유입니다. 가장 가능성 있는 형태는 Boost Boss 엔드포인트를 호출하고 스폰서 블록을 반환하는 Custom Action이며, GPT의 지시문이 관련 답변 끝에 그 블록을 표시하도록 안내하는 방식입니다. 서버에서 SDK가 하는 일의 제약 버전. 프로토타이핑 중이며 작동하면 공유합니다.",
    "publish.nocode.faq2_q": "OpenAI / Quora / Perplexity가 허용할까요?",
    "publish.nocode.faq2_a": "그것도 우리가 풀고 있는 것 중 하나입니다. 플랫폼마다 Custom GPT나 봇이 제공할 수 있는 내용에 대한 정책이 다릅니다. 명확히 현행 규칙 안인 것도 있고, 회색 영역도 있습니다. GPT가 등록 취소될 경로는 출시하지 않습니다. 우리가 천천히 가는 이유 중 하나.",
    "publish.nocode.faq3_q": "얼마나 벌 수 있나요?",
    "publish.nocode.faq3_a": "솔직히: 아직 모릅니다. SDK 도어의 공개 임프레션당 CPM은 오디언스와 표면에 따라 2-15달러 수준. 노코드 표면은 공개 제약 때문에 낮은 쪽이 될 가능성. Custom GPT가 월 10K 대화이고 그 중 5분의 1에서 스폰서 블록을 표시한다면, 초기에는 월 두 자릿수 달러 수준이며 광고주의 AI 표면 수요가 성숙해지면 더 많아집니다. 이건 보조 수입이지 직장 대체가 아닙니다.",
    "publish.nocode.faq4_q": "Custom GPT / Poe / Perplexity 외의 노코드 플랫폼도 지원하나요?",
    "publish.nocode.faq4_a": "플랫폼이 HTTP 엔드포인트를 호출하고 반환된 콘텐츠(텍스트 또는 마크다운)를 렌더링할 수 있다면 통합이 가능할 겁니다. 이메일에 어떤 플랫폼인지 알려주세요 — Voiceflow, Botpress, Stack AI, FlowiseAI, Dust, 자체 빌드 — 우선순위 리스트에 추가합니다.",
    "publish.nocode.faq5_q": "대기열에서 자체 서버 빌드로 전환하고 싶다면요?",
    "publish.nocode.faq5_a_html": "환영하는 계획 변경입니다. 출시된 네 도어 중 하나가 맞을 겁니다 — 웹 프론트엔드를 배포한다면 <a href=\"/publish/ai-apps\">AI Apps</a>, Discord/Telegram/Slack으로 이동한다면 <a href=\"/publish/bots\">Bots</a>가 가장 가능성 높습니다. 어느 쪽이든 동일한 퍼블리셔 계정; 우리가 옮겨드립니다.",
    "publish.nocode.faq6_q": "약속 없이 출시할 때만 알림을 받을 수 있나요?",
    "publish.nocode.faq6_a": "네 — 이메일에 그렇게 말씀하시면 됩니다. 자동 등록하지 않습니다; 대기열은 정보용이지 계약이 아닙니다.",

    "publish.nocode.cta_h2": "이메일 한 통. 나머지는 우리가.",
    "publish.nocode.cta_p": "무엇을 만들었고, 어디에 있고, 대략 몇 명이 쓰는지 알려주세요.",
    "publish.nocode.cta_btn": "hello@boostboss.ai로 이메일 →",
}

VI = {
    "publish.nocode.nav_cta": "Vào waitlist",
    "publish.nocode.hero_eyebrow": "Sắp ra mắt · Waitlist mở",
    "publish.nocode.hero_h1_html": "Đã xây thứ gì đó với AI nhưng <span class=\"grad\">chưa bao giờ viết server?</span>",
    "publish.nocode.hero_sub": "Nếu bạn đã xây Custom GPT, Poe bot, Perplexity Page hoặc bất cứ thứ gì không cần ship code — chúng tôi nghe bạn. Bốn đường tích hợp Boost Boss đang có hiện nay đều dựa trên SDK và giả định bạn kiểm soát một server. Có lẽ bạn không có. Chúng tôi đang xây phương án kiếm tiền no-code tiếp theo và muốn bạn vào waitlist.",
    "publish.nocode.hero_cta": "Vào waitlist →",

    "publish.nocode.who_eyebrow": "Dành cho ai",
    "publish.nocode.who_h2": "Nếu bất kỳ điều nào dưới đây mô tả thứ bạn đã xây, bạn ở đúng chỗ.",
    "publish.nocode.who_sub": "Đây là các bề mặt AI nơi platform sở hữu runtime — bạn viết prompt, persona, action, knowledge base. Bạn không deploy server và không thể ship SDK.",
    "publish.nocode.who_card1_h4": "Tác giả Custom GPT",
    "publish.nocode.who_card1_p": "Bạn xây một GPT trong GPT Builder của OpenAI. Nó được liệt kê trên GPT Store hoặc chia sẻ riêng. Mọi người chat với nó. Bạn muốn kiếm tiền từ các cuộc hội thoại đó.",
    "publish.nocode.who_card2_h4": "Người tạo Poe bot",
    "publish.nocode.who_card2_p": "Bạn đã xây Poe bot — của riêng bạn hoặc dựa trên app Poe phía server. Platform của Quora xử lý runtime. Bạn xử lý persona, kiến thức, thiết kế prompt.",
    "publish.nocode.who_card3_h4": "Tác giả Perplexity Pages",
    "publish.nocode.who_card3_p": "Bạn viết Perplexity Pages với câu trả lời do AI tạo được tuyển chọn quanh một chủ đề. Bạn có audience quay lại đọc nội dung. Bạn muốn có nguồn doanh thu.",
    "publish.nocode.who_card4_h4": "Người xây AI no-code",
    "publish.nocode.who_card4_p": "Bạn ship trên Voiceflow, Botpress, Stack AI, FlowiseAI hoặc một platform AI no-code khác. Bạn không viết JavaScript. Platform là runtime của bạn.",

    "publish.nocode.honest_eyebrow": "Phần thẳng thắn",
    "publish.nocode.honest_h2": "Vì sao đây là waitlist, không phải nút \"đăng ký ngay\".",
    "publish.nocode.honest_label": "Hiện chúng tôi có",
    "publish.nocode.honest_h3": "Cả bốn đường đã ship đều cần code.",
    "publish.nocode.honest_p1_html": "Lumi SDK for MCP, Lumi SDK script tag, Lumi SDK for browser extensions và Lumi API for Bots đều giả định <em>bạn</em> có một nơi để chạy logic — server, script, manifest tiện ích. Tác giả Custom GPT và đa số tác giả AI no-code không có nơi đó. Platform (OpenAI, Quora, Perplexity, Voiceflow, v.v.) sở hữu runtime.",
    "publish.nocode.honest_p2": "Chúng tôi có thể ship một thứ nửa vời, gói prompt của bạn trong một workaround mong manh, nhưng nó sẽ vỡ ngay khi OpenAI cập nhật runtime Custom GPT, và user của bạn sẽ nhận ra. Nên chúng tôi không làm vậy.",
    "publish.nocode.honest_p3": "Thay vào đó, chúng tôi gom tín hiệu waitlist. Nếu nghe được 30+ tác giả no-code có audience thật, chúng tôi ship tích hợp. Nếu chỉ nghe 3 người, hướng này tạm gác lại, chúng tôi tập trung vào các cửa SDK đã chạy.",

    "publish.nocode.wait_h2": "Vào waitlist",
    "publish.nocode.wait_p": "Một email cho chúng tôi biết bạn đã xây gì, nó ở đâu, và mỗi tháng có khoảng bao nhiêu cuộc hội thoại hoặc tương tác. Nếu chúng tôi ship một giải pháp phù hợp, bạn là người đầu tiên biết — và cohort đầu tiên được chia 90/10 trong 6 tháng đầu, giống Founding Publishers của chúng tôi.",
    "publish.nocode.wait_cta": "Email hello@boostboss.ai",
    "publish.nocode.wait_perk1_v": "Không cam kết",
    "publish.nocode.wait_perk1_l": "Vào danh sách, rời bất kỳ lúc nào.",
    "publish.nocode.wait_perk2_v": "Bạn định hình sản phẩm",
    "publish.nocode.wait_perk2_l": "Cohort đầu có tiếng nói trực tiếp vào thiết kế tích hợp.",
    "publish.nocode.wait_perk3_v": "Chia doanh thu founding",
    "publish.nocode.wait_perk3_l": "90/10 trong 6 tháng đầu khi chúng tôi ship.",

    "publish.nocode.fit_eyebrow": "Kiểm tra phù hợp nhanh",
    "publish.nocode.fit_h2": "Danh sách ngắn, theo cả hai hướng.",
    "publish.nocode.fit_yes_h3": "Có vẻ phù hợp",
    "publish.nocode.fit_yes_li1": "Bạn xây một Custom GPT đang được dùng thực tế (có người quay lại hoặc nó được niêm yết công khai).",
    "publish.nocode.fit_yes_li2": "Bạn ship một Poe bot và bạn kiểm soát persona / kiến thức.",
    "publish.nocode.fit_yes_li3": "Bạn viết Perplexity Pages có audience quay lại định kỳ.",
    "publish.nocode.fit_yes_li4": "Bạn ở trên một platform AI no-code (Voiceflow, Botpress, Stack AI) và bạn sẽ nhận doanh thu quảng cáo nếu không cần code.",
    "publish.nocode.fit_yes_li5": "Bạn có ý niệm về số người tương tác với AI của bạn mỗi tháng, dù chỉ áng chừng.",
    "publish.nocode.fit_no_h3": "Có lẽ chưa",
    "publish.nocode.fit_no_li1": "Bạn đã viết server của riêng mình hoặc ship SDK riêng — bạn muốn một trong bốn cửa đã ship, không phải waitlist này.",
    "publish.nocode.fit_no_li2": "Custom GPT của bạn dưới ~50 cuộc hội thoại một tháng — chưa có inventory để kiếm tiền.",
    "publish.nocode.fit_no_li3": "Platform no-code bạn dùng cấm chèn nội dung bên thứ ba — sẽ đụng tường policy.",
    "publish.nocode.fit_no_li4": "Bạn muốn doanh thu đảm bảo hoặc mức tối thiểu hàng tháng — đây là inventory chưa được kiểm chứng; chúng tôi không trả trước.",

    "publish.nocode.faq_eyebrow": "Câu hỏi thường gặp",
    "publish.nocode.faq_h2": "Những câu mà mọi tác giả no-code đều hỏi đầu tiên.",
    "publish.nocode.faq1_q": "Tích hợp sẽ hoạt động ra sao? Custom GPT không thể load code tùy ý.",
    "publish.nocode.faq1_a": "Đúng — đó là phần khó, và là lý do đây là waitlist. Hình dạng khả thi nhất là một Custom Action gọi một endpoint Boost Boss, trả về khối sponsored, và instructions của GPT bảo nó hiển thị khối đó ở cuối các câu trả lời phù hợp. Đó là phiên bản giới hạn của những gì SDK làm trên server. Chúng tôi đang prototype; sẽ chia sẻ khi nó chạy được.",
    "publish.nocode.faq2_q": "OpenAI / Quora / Perplexity có cho phép không?",
    "publish.nocode.faq2_a": "Đó là một trong những thứ chúng tôi đang làm rõ. Mỗi platform có policy nội dung khác nhau về thứ một Custom GPT hay bot có thể phục vụ. Có cái rõ ràng trong quy tắc hiện hành; có cái xám. Chúng tôi sẽ không ship đường nào khiến GPT của bạn bị gỡ, đó là một phần lý do chúng tôi đi chậm.",
    "publish.nocode.faq3_q": "Tôi kiếm được bao nhiêu?",
    "publish.nocode.faq3_a": "Trả lời thật: chúng tôi chưa biết. CPM per impression công khai cho các cửa SDK của chúng tôi quanh khoảng 2-15 USD tùy audience và surface. Surface no-code có khả năng nằm ở mức thấp do ràng buộc khai báo. Nếu Custom GPT của bạn có 10K hội thoại một tháng và 1 trong 5 lần hiển thị khối sponsored, ban đầu là chục USD/tháng, nhiều hơn khi nhu cầu advertiser cho AI surface trưởng thành. Đây là thu nhập bổ sung, không thay thế công việc.",
    "publish.nocode.faq4_q": "Bạn có hỗ trợ platform no-code ngoài Custom GPTs / Poe / Perplexity không?",
    "publish.nocode.faq4_a": "Nếu platform của bạn hỗ trợ gọi một HTTP endpoint và render nội dung trả về (text hoặc markdown), chúng tôi có khả năng tích hợp. Cho chúng tôi biết platform nào trong email — Voiceflow, Botpress, Stack AI, FlowiseAI, Dust, build tự làm — chúng tôi sẽ thêm vào danh sách ưu tiên.",
    "publish.nocode.faq5_q": "Lỡ tôi muốn chuyển từ waitlist sang tự xây server thì sao?",
    "publish.nocode.faq5_a_html": "Đổi kế hoạch luôn được chào đón. Một trong bốn cửa đã ship sẽ phù hợp — nhiều khả năng là <a href=\"/publish/ai-apps\">AI Apps</a> nếu bạn deploy frontend web, hoặc <a href=\"/publish/bots\">Bots</a> nếu bạn chuyển sang Discord/Telegram/Slack. Cùng một tài khoản publisher; chúng tôi chuyển bạn qua.",
    "publish.nocode.faq6_q": "Tôi có thể chỉ nhận thông báo khi launch, không cam kết gì được không?",
    "publish.nocode.faq6_a": "Được — nói vậy trong email là đủ. Chúng tôi không tự đăng ký bạn; waitlist mang tính thông tin, không phải hợp đồng.",

    "publish.nocode.cta_h2": "Một email. Phần còn lại để chúng tôi lo.",
    "publish.nocode.cta_p": "Cho chúng tôi biết bạn xây gì, nó ở đâu và khoảng bao nhiêu người dùng.",
    "publish.nocode.cta_btn": "Email hello@boostboss.ai →",
}

DICTS = {"en": EN, "zh": ZH, "zh-TW": ZH_TW, "ja": JA, "ko": KO, "vi": VI}

# Build patches with the mailto URL spliced in
def patches():
    return [
        ('<a href="/publish/mcp">MCP Servers</a>',
         '<a href="/publish/mcp" data-i18n="subnav.mcp">MCP Servers</a>'),
        ('<a href="/publish/ai-apps">AI Apps</a>',
         '<a href="/publish/ai-apps" data-i18n="subnav.ai_apps">AI Apps</a>'),
        ('<a href="/publish/extensions">Extensions</a>',
         '<a href="/publish/extensions" data-i18n="subnav.extensions">Extensions</a>'),
        ('<a href="/publish/bots">Bots</a>',
         '<a href="/publish/bots" data-i18n="subnav.bots">Bots</a>'),
        ('<a href="/publish/no-code" class="active">Custom GPTs</a>',
         '<a href="/publish/no-code" class="active" data-i18n="subnav.no_code">Custom GPTs</a>'),

        # Nav CTA (Join waitlist)
        (f'<a class="btn btn-primary" href="{MAILTO}">Join waitlist</a>',
         f'<a class="btn btn-primary" href="{MAILTO}" data-i18n="publish.nocode.nav_cta">Join waitlist</a>'),

        # Hero
        ('<span class="eyebrow">Coming soon · Waitlist open</span>',
         '<span class="eyebrow" data-i18n="publish.nocode.hero_eyebrow">Coming soon · Waitlist open</span>'),
        ('<h1>Built something with AI but <span class="grad">never wrote a server?</span></h1>',
         '<h1 data-i18n="publish.nocode.hero_h1_html" data-i18n-html>Built something with AI but <span class="grad">never wrote a server?</span></h1>'),
        ("<p class=\"sub\">If you built a Custom GPT, a Poe bot, a Perplexity Page, or anything where you didn't ship code — we hear you. The four integration paths Boost Boss ships today are SDK-based and assume you control a server. You probably don't. We're building no-code monetization next, and we'd like you on the waitlist.</p>",
         "<p class=\"sub\" data-i18n=\"publish.nocode.hero_sub\">If you built a Custom GPT, a Poe bot, a Perplexity Page, or anything where you didn't ship code — we hear you. The four integration paths Boost Boss ships today are SDK-based and assume you control a server. You probably don't. We're building no-code monetization next, and we'd like you on the waitlist.</p>"),
        (f'<a class="btn btn-primary btn-lg" href="{MAILTO}">Join the waitlist →</a>',
         f'<a class="btn btn-primary btn-lg" href="{MAILTO}" data-i18n="publish.nocode.hero_cta">Join the waitlist →</a>'),

        # Recognize yourself
        ('<span class="section-eyebrow">Who this is for</span>',
         '<span class="section-eyebrow" data-i18n="publish.nocode.who_eyebrow">Who this is for</span>'),
        ("<h2 class=\"section-h\">If any of these describe what you built, you're in the right place.</h2>",
         "<h2 class=\"section-h\" data-i18n=\"publish.nocode.who_h2\">If any of these describe what you built, you're in the right place.</h2>"),
        ("<p class=\"section-sub\">These are AI surfaces where the platform owns the runtime — you authored the prompt, the persona, the actions, the knowledge base. You don't deploy a server, and you can't ship an SDK.</p>",
         "<p class=\"section-sub\" data-i18n=\"publish.nocode.who_sub\">These are AI surfaces where the platform owns the runtime — you authored the prompt, the persona, the actions, the knowledge base. You don't deploy a server, and you can't ship an SDK.</p>"),
        ('<h4>Custom GPT authors</h4>',
         '<h4 data-i18n="publish.nocode.who_card1_h4">Custom GPT authors</h4>'),
        ("<p>You built a GPT in OpenAI's GPT Builder. It's listed in the GPT Store or shared privately. People chat with it. You'd like to earn from those conversations.</p>",
         "<p data-i18n=\"publish.nocode.who_card1_p\">You built a GPT in OpenAI's GPT Builder. It's listed in the GPT Store or shared privately. People chat with it. You'd like to earn from those conversations.</p>"),
        ('<h4>Poe bot creators</h4>',
         '<h4 data-i18n="publish.nocode.who_card2_h4">Poe bot creators</h4>'),
        ("<p>You built a Poe bot — yours or based on a server-side Poe app. Quora's platform handles the runtime. You handle the persona, the knowledge, the prompt design.</p>",
         "<p data-i18n=\"publish.nocode.who_card2_p\">You built a Poe bot — yours or based on a server-side Poe app. Quora's platform handles the runtime. You handle the persona, the knowledge, the prompt design.</p>"),
        ('<h4>Perplexity Pages authors</h4>',
         '<h4 data-i18n="publish.nocode.who_card3_h4">Perplexity Pages authors</h4>'),
        ("<p>You write Perplexity Pages with curated AI-generated answers on a topic. You have an audience returning for the content. You'd like a revenue stream.</p>",
         "<p data-i18n=\"publish.nocode.who_card3_p\">You write Perplexity Pages with curated AI-generated answers on a topic. You have an audience returning for the content. You'd like a revenue stream.</p>"),
        ('<h4>No-code AI builders</h4>',
         '<h4 data-i18n="publish.nocode.who_card4_h4">No-code AI builders</h4>'),
        ("<p>You shipped on Voiceflow, Botpress, Stack AI, FlowiseAI, or another no-code AI platform. You don't write JavaScript. The platform is your runtime.</p>",
         "<p data-i18n=\"publish.nocode.who_card4_p\">You shipped on Voiceflow, Botpress, Stack AI, FlowiseAI, or another no-code AI platform. You don't write JavaScript. The platform is your runtime.</p>"),

        # Honest section
        ('<span class="section-eyebrow">Honest section</span>',
         '<span class="section-eyebrow" data-i18n="publish.nocode.honest_eyebrow">Honest section</span>'),
        ('<h2 class="section-h">Why this is a waitlist, not a "sign up now" button.</h2>',
         '<h2 class="section-h" data-i18n="publish.nocode.honest_h2">Why this is a waitlist, not a "sign up now" button.</h2>'),
        ('<span class="label">What we have today</span>',
         '<span class="label" data-i18n="publish.nocode.honest_label">What we have today</span>'),
        ('<h3>The four shipping paths all need code.</h3>',
         '<h3 data-i18n="publish.nocode.honest_h3">The four shipping paths all need code.</h3>'),
        ("<p>Lumi SDK for MCP, Lumi SDK script tag, Lumi SDK for browser extensions, and Lumi API for Bots all expect a place where <em>you</em> can run logic — a server, a script, an extension manifest. Custom GPT authors and most no-code AI authors don't have that. The platform (OpenAI, Quora, Perplexity, Voiceflow, etc.) owns the runtime.</p>",
         "<p data-i18n=\"publish.nocode.honest_p1_html\" data-i18n-html>Lumi SDK for MCP, Lumi SDK script tag, Lumi SDK for browser extensions, and Lumi API for Bots all expect a place where <em>you</em> can run logic — a server, a script, an extension manifest. Custom GPT authors and most no-code AI authors don't have that. The platform (OpenAI, Quora, Perplexity, Voiceflow, etc.) owns the runtime.</p>"),
        ("<p>We could ship something half-baked here that wraps your prompts in a fragile workaround, but it would break the moment OpenAI updated their Custom GPT runtime, and your users would notice. So we're not doing that.</p>",
         "<p data-i18n=\"publish.nocode.honest_p2\">We could ship something half-baked here that wraps your prompts in a fragile workaround, but it would break the moment OpenAI updated their Custom GPT runtime, and your users would notice. So we're not doing that.</p>"),
        ("<p>Instead we're collecting waitlist signal. If we hear from 30+ no-code authors with real audiences, we ship the integration. If we hear from 3, the path stays parked while we focus on the SDK doors that already work.</p>",
         "<p data-i18n=\"publish.nocode.honest_p3\">Instead we're collecting waitlist signal. If we hear from 30+ no-code authors with real audiences, we ship the integration. If we hear from 3, the path stays parked while we focus on the SDK doors that already work.</p>"),

        # Waitlist
        ('<h2>Get on the waitlist</h2>',
         '<h2 data-i18n="publish.nocode.wait_h2">Get on the waitlist</h2>'),
        ("<p>One email tells us what you built, where it lives, and roughly how many conversations or interactions it gets per month. If we ship a fit, you're first to know — and the first cohort gets a 90/10 revshare for the first six months, same as our Founding Publishers.</p>",
         "<p data-i18n=\"publish.nocode.wait_p\">One email tells us what you built, where it lives, and roughly how many conversations or interactions it gets per month. If we ship a fit, you're first to know — and the first cohort gets a 90/10 revshare for the first six months, same as our Founding Publishers.</p>"),
        (f'<a class="btn btn-primary btn-lg" href="{MAILTO}">Email hello@boostboss.ai</a>',
         f'<a class="btn btn-primary btn-lg" href="{MAILTO}" data-i18n="publish.nocode.wait_cta">Email hello@boostboss.ai</a>'),
        ('<div class="perk"><strong>No commitment</strong><span>Get on the list, drop off any time.</span></div>',
         '<div class="perk"><strong data-i18n="publish.nocode.wait_perk1_v">No commitment</strong><span data-i18n="publish.nocode.wait_perk1_l">Get on the list, drop off any time.</span></div>'),
        ('<div class="perk"><strong>You shape the product</strong><span>First cohort gets direct input on integration design.</span></div>',
         '<div class="perk"><strong data-i18n="publish.nocode.wait_perk2_v">You shape the product</strong><span data-i18n="publish.nocode.wait_perk2_l">First cohort gets direct input on integration design.</span></div>'),
        ('<div class="perk"><strong>Founding revshare</strong><span>90/10 for the first 6 months when we ship.</span></div>',
         '<div class="perk"><strong data-i18n="publish.nocode.wait_perk3_v">Founding revshare</strong><span data-i18n="publish.nocode.wait_perk3_l">90/10 for the first 6 months when we ship.</span></div>'),

        # Fit check
        ('<span class="section-eyebrow">Quick fit check</span>',
         '<span class="section-eyebrow" data-i18n="publish.nocode.fit_eyebrow">Quick fit check</span>'),
        ('<h2 class="section-h">A short list, both directions.</h2>',
         '<h2 class="section-h" data-i18n="publish.nocode.fit_h2">A short list, both directions.</h2>'),
        ('<h3>Likely a fit</h3>',
         '<h3 data-i18n="publish.nocode.fit_yes_h3">Likely a fit</h3>'),
        ("<li><span class=\"mark\">✓</span><span>You built a Custom GPT and it has actual usage (people are returning to it, or it's listed publicly).</span></li>",
         "<li><span class=\"mark\">✓</span><span data-i18n=\"publish.nocode.fit_yes_li1\">You built a Custom GPT and it has actual usage (people are returning to it, or it's listed publicly).</span></li>"),
        ('<li><span class="mark">✓</span><span>You shipped a Poe bot and you control the persona / knowledge.</span></li>',
         '<li><span class="mark">✓</span><span data-i18n="publish.nocode.fit_yes_li2">You shipped a Poe bot and you control the persona / knowledge.</span></li>'),
        ('<li><span class="mark">✓</span><span>You write Perplexity Pages with a recurring audience.</span></li>',
         '<li><span class="mark">✓</span><span data-i18n="publish.nocode.fit_yes_li3">You write Perplexity Pages with a recurring audience.</span></li>'),
        ("<li><span class=\"mark\">✓</span><span>You're on a no-code AI platform (Voiceflow, Botpress, Stack AI) and you'd take ad revenue if it didn't require code.</span></li>",
         "<li><span class=\"mark\">✓</span><span data-i18n=\"publish.nocode.fit_yes_li4\">You're on a no-code AI platform (Voiceflow, Botpress, Stack AI) and you'd take ad revenue if it didn't require code.</span></li>"),
        ('<li><span class="mark">✓</span><span>You have an idea of how many people interact with your AI per month, even rough.</span></li>',
         '<li><span class="mark">✓</span><span data-i18n="publish.nocode.fit_yes_li5">You have an idea of how many people interact with your AI per month, even rough.</span></li>'),
        ('<h3>Likely not yet</h3>',
         '<h3 data-i18n="publish.nocode.fit_no_h3">Likely not yet</h3>'),
        ("<li><span class=\"mark\">✕</span><span>You wrote your own server or shipped your own SDK — you want one of the four shipping doors instead, not this waitlist.</span></li>",
         "<li><span class=\"mark\">✕</span><span data-i18n=\"publish.nocode.fit_no_li1\">You wrote your own server or shipped your own SDK — you want one of the four shipping doors instead, not this waitlist.</span></li>"),
        ("<li><span class=\"mark\">✕</span><span>Your Custom GPT has fewer than ~50 conversations a month — there's no inventory to monetize yet.</span></li>",
         "<li><span class=\"mark\">✕</span><span data-i18n=\"publish.nocode.fit_no_li2\">Your Custom GPT has fewer than ~50 conversations a month — there's no inventory to monetize yet.</span></li>"),
        ("<li><span class=\"mark\">✕</span><span>The no-code platform you used explicitly bans third-party content injection — we'd hit a policy wall.</span></li>",
         "<li><span class=\"mark\">✕</span><span data-i18n=\"publish.nocode.fit_no_li3\">The no-code platform you used explicitly bans third-party content injection — we'd hit a policy wall.</span></li>"),
        ("<li><span class=\"mark\">✕</span><span>You want guaranteed revenue or a per-month minimum — this is unproven inventory; we're not paying advances.</span></li>",
         "<li><span class=\"mark\">✕</span><span data-i18n=\"publish.nocode.fit_no_li4\">You want guaranteed revenue or a per-month minimum — this is unproven inventory; we're not paying advances.</span></li>"),

        # FAQ
        ('<span class="section-eyebrow">Frequently asked</span>',
         '<span class="section-eyebrow" data-i18n="publish.nocode.faq_eyebrow">Frequently asked</span>'),
        ('<h2 class="section-h">The questions every no-code author asks first.</h2>',
         '<h2 class="section-h" data-i18n="publish.nocode.faq_h2">The questions every no-code author asks first.</h2>'),
        ("<h4>How would the integration even work? Custom GPTs can't load arbitrary code.</h4>",
         "<h4 data-i18n=\"publish.nocode.faq1_q\">How would the integration even work? Custom GPTs can't load arbitrary code.</h4>"),
        ("<p>Right — that's the hard part, and the reason this is a waitlist. The most likely shape is a Custom Action that calls a Boost Boss endpoint, returns a sponsored block, and your GPT's instructions tell it to surface the block at the end of relevant answers. It's a constrained version of what the SDK does on a server. We're prototyping; we'll share what works once it does.</p>",
         "<p data-i18n=\"publish.nocode.faq1_a\">Right — that's the hard part, and the reason this is a waitlist. The most likely shape is a Custom Action that calls a Boost Boss endpoint, returns a sponsored block, and your GPT's instructions tell it to surface the block at the end of relevant answers. It's a constrained version of what the SDK does on a server. We're prototyping; we'll share what works once it does.</p>"),
        ('<h4>Will OpenAI / Quora / Perplexity allow this?</h4>',
         '<h4 data-i18n="publish.nocode.faq2_q">Will OpenAI / Quora / Perplexity allow this?</h4>'),
        ("<p>This is one of the things we're working out. Each platform has different content policies for what a Custom GPT or bot can serve. Some are clearly within current rules; some are gray. We won't ship a path that gets your GPT delisted, which is part of why we're going slow.</p>",
         "<p data-i18n=\"publish.nocode.faq2_a\">This is one of the things we're working out. Each platform has different content policies for what a Custom GPT or bot can serve. Some are clearly within current rules; some are gray. We won't ship a path that gets your GPT delisted, which is part of why we're going slow.</p>"),
        ('<h4>How much could I earn?</h4>',
         '<h4 data-i18n="publish.nocode.faq3_q">How much could I earn?</h4>'),
        ("<p>Honest answer: we don't know yet. The published per-impression CPM for our SDK doors trends $2-15 depending on audience and surface. No-code surfaces are likely to be at the lower end because of disclosure constraints. If your Custom GPT does 10K conversations a month and 1 in 5 surfaces a sponsored block, we're talking double-digit dollars per month at first, more as advertiser demand for AI surfaces matures. This is supplementary income, not a replacement for a job.</p>",
         "<p data-i18n=\"publish.nocode.faq3_a\">Honest answer: we don't know yet. The published per-impression CPM for our SDK doors trends $2-15 depending on audience and surface. No-code surfaces are likely to be at the lower end because of disclosure constraints. If your Custom GPT does 10K conversations a month and 1 in 5 surfaces a sponsored block, we're talking double-digit dollars per month at first, more as advertiser demand for AI surfaces matures. This is supplementary income, not a replacement for a job.</p>"),
        ('<h4>Do you support no-code platforms other than Custom GPTs / Poe / Perplexity?</h4>',
         '<h4 data-i18n="publish.nocode.faq4_q">Do you support no-code platforms other than Custom GPTs / Poe / Perplexity?</h4>'),
        ("<p>If your platform supports calling an HTTP endpoint and rendering returned content (text or markdown), we can probably integrate. Tell us in your email which platform — Voiceflow, Botpress, Stack AI, FlowiseAI, Dust, custom builds — and we'll add it to the prioritization list.</p>",
         "<p data-i18n=\"publish.nocode.faq4_a\">If your platform supports calling an HTTP endpoint and rendering returned content (text or markdown), we can probably integrate. Tell us in your email which platform — Voiceflow, Botpress, Stack AI, FlowiseAI, Dust, custom builds — and we'll add it to the prioritization list.</p>"),
        ('<h4>What if I want to switch from the waitlist to building my own server?</h4>',
         '<h4 data-i18n="publish.nocode.faq5_q">What if I want to switch from the waitlist to building my own server?</h4>'),
        ("<p>Welcome change of plans. One of our four shipping doors will fit — most likely <a href=\"/publish/ai-apps\">AI Apps</a> if you're going to deploy a web frontend, or <a href=\"/publish/bots\">Bots</a> if you're moving to Discord/Telegram/Slack. Same publisher account either way; we move you over.</p>",
         "<p data-i18n=\"publish.nocode.faq5_a_html\" data-i18n-html>Welcome change of plans. One of our four shipping doors will fit — most likely <a href=\"/publish/ai-apps\">AI Apps</a> if you're going to deploy a web frontend, or <a href=\"/publish/bots\">Bots</a> if you're moving to Discord/Telegram/Slack. Same publisher account either way; we move you over.</p>"),
        ('<h4>Can I just hear from you when this ships, no commitment?</h4>',
         '<h4 data-i18n="publish.nocode.faq6_q">Can I just hear from you when this ships, no commitment?</h4>'),
        ("<p>Yes — just say so in the email. We won't auto-enroll you; the waitlist is informational, not a contract.</p>",
         "<p data-i18n=\"publish.nocode.faq6_a\">Yes — just say so in the email. We won't auto-enroll you; the waitlist is informational, not a contract.</p>"),

        # CTA footer
        ('<h2>One email. We take it from there.</h2>',
         '<h2 data-i18n="publish.nocode.cta_h2">One email. We take it from there.</h2>'),
        ('<p>Tell us what you built, where it lives, and roughly how many people use it.</p>',
         '<p data-i18n="publish.nocode.cta_p">Tell us what you built, where it lives, and roughly how many people use it.</p>'),
        (f'<a class="btn btn-primary btn-lg" href="{MAILTO}">Email hello@boostboss.ai →</a>',
         f'<a class="btn btn-primary btn-lg" href="{MAILTO}" data-i18n="publish.nocode.cta_btn">Email hello@boostboss.ai →</a>'),

        # Site footer
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
    for old, new in patches():
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
