import "./styles.css";
import { products as fallbackSyncedProducts, syncMeta as fallbackSyncMeta } from "./catalog-data.js";

const categories = [
  { id: "all", label: "全部", icon: gridIcon() },
  { id: "video", label: "视频点播", icon: playIcon() },
  { id: "ai", label: "人工智能", icon: aiIcon() },
  { id: "software", label: "软件", icon: codeIcon() },
  { id: "new", label: "新品", icon: sparkIcon() },
  { id: "market", label: "市场", icon: shopIcon() },
  { id: "recharge", label: "充值", icon: walletIcon() },
  { id: "game", label: "游戏", icon: gameIcon() }
];

const products = [
  {
    name: "ChatGPT",
    category: "ai",
    badge: "GPT-5.5 Thinking",
    price: 41,
    unit: "月",
    color: "#0f766e",
    icon: "AI",
    sold: "li**ng 在 8 分钟前加入",
    tags: ["官方 ChatGPT Plus 方案", "支持 Codex、语音、图像与更强推理"],
    ribbon: "热卖"
  },
  {
    name: "YouTube Premium",
    category: "video",
    badge: "家庭组",
    price: 18,
    unit: "月",
    color: "#e11d48",
    icon: "▶",
    sold: "zh**u 在 20 分钟前加入",
    tags: ["无广告观看 YouTube", "支持音乐后台播放与离线下载"]
  },
  {
    name: "ChatGPT Recharge",
    category: "recharge",
    badge: "充值至本人账户",
    price: 139,
    unit: "次",
    color: "#10b981",
    icon: "AI",
    sold: "wa**09 在 1 小时前加入",
    tags: ["充值到用户自有账号", "适合已有账户升级 Pro 方案"],
    ribbon: "超值"
  },
  {
    name: "Gemini",
    category: "ai",
    badge: "Nano Banana 2",
    price: 25,
    unit: "月",
    color: "#2563eb",
    icon: "G",
    sold: "wu**in 在 1 小时前加入",
    tags: ["Gemini Pro 账号服务", "支持长上下文与多模态生成"]
  },
  {
    name: "N-VPN",
    category: "software",
    badge: "",
    price: 14,
    unit: "月",
    color: "#1d4ed8",
    icon: "N",
    sold: "mi**ek 在 2 小时前加入",
    tags: ["访问需要的海外内容", "安全高速的网络连接"]
  },
  {
    name: "Crunchyroll",
    category: "video",
    badge: "高清动漫",
    price: 16,
    unit: "月",
    color: "#f97316",
    icon: "C",
    sold: "er**51 在 2 小时前加入",
    tags: ["丰富动漫资源库", "支持移动端、PC、电视盒子"]
  },
  {
    name: "CapCut",
    category: "software",
    badge: "Seedance 2.0",
    price: 54,
    unit: "月",
    color: "#111827",
    icon: "CC",
    sold: "ge**00 在 2 小时前加入",
    tags: ["高级模板、特效与商用素材", "适合短视频团队协作"]
  },
  {
    name: "Gemini Recharge",
    category: "recharge",
    badge: "超值优惠",
    price: 18,
    unit: "次",
    color: "#3b82f6",
    icon: "G",
    sold: "li**11 在 3 小时前加入",
    tags: ["为自有 Google 账号升级", "低于官方价体验 Gemini Pro"]
  },
  {
    name: "Suno",
    category: "ai",
    badge: "",
    price: 35,
    unit: "月",
    color: "#6d28d9",
    icon: "SU",
    sold: "da**02 在 1 小时前加入",
    tags: ["AI 音乐生成", "适合短视频、播客与广告配乐"]
  },
  {
    name: "Perplexity AI",
    category: "ai",
    badge: "",
    price: 31,
    unit: "月",
    color: "#0f172a",
    icon: "PX",
    sold: "fr**77 在 1 小时前加入",
    tags: ["搜索增强式 AI 回答", "适合资料检索与研究写作"]
  },
  {
    name: "Cursor",
    category: "software",
    badge: "新品",
    price: 128,
    unit: "月",
    color: "#111827",
    icon: "CU",
    sold: "ak**11 在 1 小时前加入",
    tags: ["AI 代码编辑器 Pro", "支持自动修复、上下文问答与补全"]
  },
  {
    name: "Disney+",
    category: "video",
    badge: "",
    price: 22,
    unit: "月",
    color: "#1e40af",
    icon: "D+",
    sold: "ma**18 在 3 小时前加入",
    tags: ["影视、动画与纪录片内容", "支持高清流媒体播放"]
  }
];

let catalogProducts = mergeCatalogProducts(products, fallbackSyncedProducts);
let catalogSyncMeta = fallbackSyncMeta;

const features = [
  ["实时交付", "付款成功后自动发放订阅凭证，减少等待时间。"],
  ["快速重置密码", "订阅页保留重置入口，便于用户自助处理账号异常。"],
  ["SSL 证书", "结算流程预留安全支付通道，后续可对接支付宝。"],
  ["7×24 实时支持", "面向中国用户保留在线客服与售后处理入口。"],
  ["价格合理的会员", "用更低月费获得主流 AI、流媒体与软件会员。"],
  ["退款保障", "保留买家保护说明，便于后续接入售后规则。"]
];

let currentCategory = "all";
let searchTerm = "";
let couponVisible = false;
let cookieVisible = false;
let loginVisible = false;
let authMode = "login";
let authMessage = "";
let authForm = { email: "", code: "", password: "" };
let authCodeCooldownUntil = Number(localStorage.getItem("moneyai_auth_code_cooldown_until") || 0);
let authCodeCooldownTimer = null;
let currentToken = localStorage.getItem("moneyai_token") || "";
let currentUser = readStoredUser();
let myOrders = [];
let myOrdersLoaded = false;
let myOrdersLoading = false;
let alipayReturnConfirming = false;
let alipayReturnHandledOrder = "";
let adminToken = localStorage.getItem("moneyai_admin_session") || "";
let adminUsers = [];
let adminOrders = [];
let adminLoaded = false;
let adminMessage = "";

const productPlans = [
  { months: 1, label: "1 个月", discount: "", multiplier: 1 },
  { months: 3, label: "3 个月", discount: "省 6%", multiplier: 2.82 },
  { months: 6, label: "6 个月", discount: "省 10%", multiplier: 5.4 },
  { months: 12, label: "12 个月", discount: "省 16%", multiplier: 10.08 }
];

const paymentMethods = [
  { id: "alipay", name: "支付宝", note: "中国用户推荐", icon: "支" }
];

const livePurchases = [
  ["xiao**", "2 分钟前", "ChatGPT"],
  ["li**18", "4 分钟前", "Claude"],
  ["chen**", "6 分钟前", "Gemini"],
  ["wang**", "9 分钟前", "ChatGPT Recharge"],
  ["zhao**", "12 分钟前", "Perplexity AI"],
  ["sun**", "15 分钟前", "Cursor API"],
  ["lin**", "18 分钟前", "生成式 AI 工具包"],
  ["he**07", "21 分钟前", "Gemini Recharge"]
];

let livePurchaseIndex = 0;
let livePurchaseTimer = null;

function render() {
  const route = getRoute();
  const app = document.querySelector("#app");
  app.innerHTML = `
    ${renderHeader()}
    ${route.type === "product" ? renderProductDetail(route.product) : ""}
    ${route.type === "checkout" ? renderCheckout(route.product, route.plan) : ""}
    ${route.type === "subscriptions" ? renderSubscriptionsPage() : ""}
    ${route.type === "orders" ? renderOrdersPage() : ""}
    ${route.type === "admin" ? renderAdminPage() : ""}
    ${route.type === "help" ? renderHelpPage() : ""}
    ${route.type === "policy" ? renderPolicyPage(route.policy) : ""}
    ${route.type === "home" ? renderHome() : ""}
    ${renderFooter()}
    ${renderOverlays(route.type)}
  `;

  updatePageMeta(route);
  bindEvents();
  startAuthCodeCooldownTimer();
}

function renderHeader() {
  return `
    <header class="site-header">
      <nav class="nav-shell">
        <a class="brand" href="/" aria-label="MoneyAI 首页">
          <span class="brand-mark">MoneyAI</span>
        </a>
        <div class="desktop-links">
          <a href="/">首页</a>
          <a href="/subscriptions">商品</a>
          <a href="/orders">订单</a>
          <a href="/help">帮助</a>
        </div>
        <label class="search-box" aria-label="搜索订阅">
          ${searchIcon()}
          <input id="searchInput" type="search" placeholder="在MoneyAI中搜索" value="${escapeHtml(searchTerm)}" />
        </label>
        <div class="nav-actions">
          ${
            currentUser
              ? `<button class="login-button" type="button" data-action="logout">${userIcon()} ${escapeHtml(maskEmail(currentUser.email))}</button>`
              : `<button class="login-button" type="button" data-action="open-login">${userIcon()} 登录 / 注册</button>`
          }
        </div>
        <div class="mobile-links">
          <a href="/">首页</a>
          <a href="/subscriptions">商品</a>
          <a href="/orders">订单</a>
          <a href="/help">帮助</a>
        </div>
      </nav>
    </header>
  `;
}

function renderHome() {
  return `
    <main id="home">
      <section class="hero">
        <div class="hero-inner">
          <p class="live-toast" aria-live="polite"><span></span><b id="livePurchaseText">${livePurchaseText()}</b></p>
          <h1>在MoneyAI以更实惠的价格享受数字软件订阅</h1>
          <p class="hero-copy">连续 7 年提供高质量、价格可负担的数字订阅服务</p>
          <div class="stats-row" aria-label="平台数据">
            <span><strong>150,000+</strong> 用户总数</span>
            <span><strong>1,200,000+</strong> 订单总数</span>
            <span><strong>7+ 年</strong> 已运行</span>
          </div>
        </div>
      </section>

      <section class="catalog" id="subscriptions">
        <div class="category-tabs">
          ${categories.map(categoryButton).join("")}
        </div>
        <div class="catalog-head">
          <h2>热门订阅</h2>
          <button class="text-link" type="button" data-action="show-all">查看全部 ${catalogProducts.length} 个商品</button>
        </div>
        <div class="product-grid">
          ${filteredProducts().map(productCard).join("") || renderEmptyResult()}
        </div>
      </section>

      <section class="gams-ai">
        <div>
          <span class="section-kicker">免费试用</span>
          <h2>ChatGPT 和 MoneyAI</h2>
          <p>体验更快的响应、更多语言与智能问答，适合作为 AI 订阅商城的引流入口。</p>
        </div>
        <a href="/product/chatgpt" class="primary-btn inline-primary">立即试用</a>
      </section>

      <section class="feature-section">
        <div class="section-title">
          <span class="section-kicker">为什么选择</span>
          <h2>为什么越来越多用户使用 MoneyAI？</h2>
        </div>
        <div class="feature-grid">
          ${features
            .map(
              ([title, text], index) => `
                <article class="feature-card">
                  <span class="feature-icon">${featureIcon(index)}</span>
                  <h3>${title}</h3>
                  <p>${text}</p>
                </article>
              `
            )
            .join("")}
        </div>
      </section>

      <section class="steps-section">
        <div class="section-title">
          <span class="section-kicker">购买流程</span>
          <h2>如何使用？</h2>
        </div>
        <div class="steps">
          ${stepCard("01", "选择订阅并付款", "选择想要的订阅，点击立即购买，后续支付页将优先接入支付宝。")}
          ${stepCard("02", "查看凭证", "支付成功后进入订阅页查看账号、密码或充值进度。")}
          ${stepCard("03", "售后支持", "遇到登录、重置或续费问题时，通过在线客服提交工单。")}
        </div>
      </section>

      <section class="review-band">
        <div>
          <span class="section-kicker">98% 用户满意</span>
          <h2>快速交付、价格透明、售后可追踪</h2>
        </div>
        <div class="review-cards">
          <blockquote>“下单后很快收到订阅信息，适合长期使用 AI 工具。”</blockquote>
          <blockquote>“商品分类清楚，后续接入支付宝后会更符合国内用户习惯。”</blockquote>
        </div>
      </section>
    </main>
  `;
}

function renderProductDetail(product) {
  const related = catalogProducts.filter((item) => item.category === product.category && item.name !== product.name).slice(0, 4);
  const introduction = product.introduction?.length ? product.introduction : deriveUsage(product);
  const howItWorks = product.howItWorks?.length ? product.howItWorks : deriveSteps(product);
  return `
    <main class="detail-page">
      <section class="detail-hero">
        <div class="detail-shell">
          <a class="back-link" href="/">${arrowLeftIcon()} 返回商品列表</a>
          <div class="detail-grid">
            <div class="detail-summary">
              <span class="detail-logo" style="background:${product.color}">${product.icon}</span>
              <div>
                <span class="section-kicker">${categoryName(product.category)}</span>
                <h1>${product.name}</h1>
                <p>${introduction.join("，")}。下单后在订单中心查看凭证，支持自助续费和售后工单。</p>
              </div>
            </div>
            <aside class="detail-buy-card">
              <div class="price detail-price"><span>¥${product.price}</span><small> / ${product.unit}起</small></div>
              <div class="trust-list">
                <span>${checkIcon()} 实时交付</span>
                <span>${checkIcon()} SSL 安全支付</span>
                <span>${checkIcon()} 24 小时退款保障</span>
              </div>
              <a class="buy-btn buy-link" href="/checkout/${productSlug(product)}">立即购买</a>
            </aside>
          </div>
        </div>
      </section>

      <section class="detail-content">
        <div class="plan-panel">
          <div class="section-title compact-title">
            <span class="section-kicker">订阅方案</span>
            <h2>选择适合你的周期</h2>
          </div>
          <div class="plan-grid">
            ${productPlans.map((plan, index) => planCard(product, plan, index === 1)).join("")}
          </div>
        </div>

        <div class="detail-columns">
          <article class="info-panel">
            <h2>商品用途</h2>
            <ul class="rich-list">
              ${introduction.slice(0, 4).map((item) => `<li>${checkIcon()} ${item}</li>`).join("")}
              ${product.supportDevice?.length ? `<li>${checkIcon()} 支持设备：${product.supportDevice.join(" / ")}</li>` : ""}
            </ul>
          </article>
          <article class="info-panel">
            <h2>使用方式</h2>
            <ul class="rich-list">
              ${howItWorks.slice(0, 5).map((item) => `<li>${checkIcon()} ${item}</li>`).join("")}
              <li>${checkIcon()} 支付成功后进入订单中心查看交付信息；充值类商品需要填写自己的账号。</li>
            </ul>
          </article>
        </div>

        <div class="detail-columns detail-columns-lower">
          <article class="info-panel">
            <h2>交付与售后</h2>
            <ul class="rich-list">
              <li>${checkIcon()} 账号类商品模拟实时交付；充值类商品模拟进入处理中。</li>
              <li>${checkIcon()} 支付失败可在帮助页扫码添加客服微信，人工核查订单。</li>
              <li>${checkIcon()} 退款按商品类型、使用状态和售后策略处理。</li>
            </ul>
          </article>
          <article class="info-panel">
            <h2>常见问题</h2>
            <details open>
              <summary>付款后多久发货？</summary>
              <p>账号类商品模拟实时交付；充值类商品模拟进入处理中，真实接入后由接口返回进度。</p>
            </details>
            <details>
              <summary>是否支持支付宝？</summary>
              <p>支付页已把支付宝设为推荐方式，下一阶段接入支付宝当面付或电脑网站支付。</p>
            </details>
            <details>
              <summary>能否退款？</summary>
              <p>当前页面保留退款政策入口，实际规则应按商品类型、使用状态和售后策略配置。</p>
            </details>
          </article>
        </div>

        <section class="related-section">
          <div class="catalog-head">
            <h2>同类推荐</h2>
            <a class="text-link" href="/">查看全部</a>
          </div>
          <div class="product-grid related-grid">
            ${(related.length ? related : catalogProducts.slice(0, 4)).map(productCard).join("")}
          </div>
        </section>
      </section>
    </main>
  `;
}

function renderCheckout(product, plan) {
  const subtotal = Math.round(product.price * plan.multiplier);
  const discount = Math.max(1, Math.round(subtotal * 0.1));
  const total = subtotal - discount;
  return `
    <main class="checkout-page">
      <section class="checkout-shell">
        <a class="back-link" href="/product/${productSlug(product)}">${arrowLeftIcon()} 返回商品详情</a>
        <div class="checkout-title">
          <span class="section-kicker">安全收银台</span>
          <h1>确认订单并支付</h1>
          <p>当前为前端模拟支付界面，真实接入时由后端创建订单并返回支付宝支付参数。</p>
        </div>

        <div class="checkout-grid">
          <section class="checkout-card">
            <h2>订单信息</h2>
            <div class="order-product">
              <span class="product-logo" style="background:${product.color}">${product.icon}</span>
              <div>
                <strong>${product.name}</strong>
                <small>${plan.label} · 自动续费关闭 · 到期前提醒</small>
              </div>
            </div>
            <label class="form-field">
              <span>联系邮箱</span>
              <input type="email" value="user@example.com" />
            </label>
            <label class="form-field">
              <span>${product.category === "recharge" ? "充值账号" : "接收备注"}</span>
              <input type="text" value="${product.category === "recharge" ? "请输入待充值账号" : "自动创建订阅凭证"}" />
            </label>
            <div class="method-list">
              <h3>支付方式</h3>
              ${paymentMethods.map(paymentMethod).join("")}
            </div>
          </section>

          <aside class="summary-card">
            <h2>应付金额</h2>
            ${summaryRow(`${product.name} · ${plan.label}`, `¥${subtotal}`)}
            ${summaryRow("优惠券 10% OFF", `-¥${discount}`)}
            ${summaryRow("支付手续费", "¥0")}
            <div class="summary-total">
              <span>合计</span>
              <strong>¥${total}</strong>
            </div>
            <button
              type="button"
              class="buy-btn"
              data-action="alipay-pay"
              data-product="${escapeHtml(product.name)}"
              data-product-slug="${productSlug(product)}"
              data-product-category="${escapeHtml(product.category || "")}"
              data-plan="${escapeHtml(plan.label)}"
              data-amount="${total}"
            >使用支付宝支付</button>
            <p class="secure-note">${globeIcon()} 支付环境已启用 SSL，订单号将在支付成功后生成。</p>
          </aside>
        </div>
      </section>
    </main>
  `;
}

function renderSubscriptionsPage() {
  return `
    <main class="subpage">
      <section class="page-hero compact-page-hero">
        <div>
          <span class="section-kicker">全部商品</span>
          <h1>订阅商品库</h1>
          <p>按分类、关键词和库存状态快速筛选，后续可接入后台上下架和价格审核。</p>
        </div>
      </section>
      <section class="catalog catalog-page">
        <div class="category-tabs page-tabs">
          ${categories.map(categoryButton).join("")}
        </div>
        <div class="catalog-head">
          <h2>${categoryName(currentCategory)} · ${filteredProducts().length} 个商品</h2>
          <button class="text-link" type="button" data-action="show-all">重置筛选</button>
        </div>
        <div class="product-grid">
          ${filteredProducts().map(productCard).join("") || renderEmptyResult()}
        </div>
      </section>
    </main>
  `;
}

function renderOrdersPage() {
  const order = catalogProducts[0];
  const selectedOrder = selectedOrderFromRoute();
  const rows = myOrders.length
    ? myOrders.map(orderSummaryCard).join("")
    : currentUser && myOrdersLoaded
      ? `<div class="empty-result"><strong>暂无订单</strong><span>选择一个商品后完成支付宝支付，这里会展示订单状态。</span></div>`
      : "";
  return `
    <main class="subpage">
      <section class="page-hero compact-page-hero">
        <div>
          <span class="section-kicker">用户中心</span>
          <h1>我的订单</h1>
          <p>${currentUser ? `当前账号：${escapeHtml(currentUser.email)}` : "登录后可查看你的订单状态、支付结果和售后入口。"}</p>
        </div>
      </section>
      <section class="account-grid">
        ${accountCard("待支付", String(myOrders.filter((item) => item.status === "pending").length), "15 分钟内完成支付，超时自动关闭")}
        ${accountCard("进行中", String(myOrders.filter((item) => ["processing", "payment_error"].includes(item.status)).length), "充值类商品正在处理")}
        ${accountCard("已支付", String(myOrders.filter((item) => item.status === "paid").length), "支付完成后进入交付流程")}
      </section>
      <section class="table-panel">
        <div class="catalog-head">
          <h2>最近订单</h2>
          <a class="text-link" href="/checkout/${productSlug(order)}">继续支付</a>
        </div>
        <div class="order-table">
          ${
            currentUser
              ? rows || `<div class="empty-result"><strong>正在加载订单</strong><span>请稍候。</span></div>`
              : `<div class="empty-result"><strong>需要登录</strong><span>请先使用邮箱和密码登录后查看订单。</span><button type="button" class="buy-btn inline-action" data-action="open-login">登录 / 注册</button></div>`
          }
        </div>
      </section>
      ${currentUser && selectedOrder ? renderOrderDetail(selectedOrder) : ""}
    </main>
  `;
}

function renderAdminPage() {
  if (!adminToken) {
    return `
      <main class="subpage admin-page">
        <section class="page-hero compact-page-hero">
          <div>
            <span class="section-kicker">后台管理</span>
            <h1>MoneyAI 管理后台</h1>
            <p>输入管理员账号和密码后查看用户、管理用户和查看订单。</p>
          </div>
        </section>
        <section class="table-panel admin-login-panel">
          <label class="form-field">
            <span>管理员账号</span>
            <input id="adminUsernameInput" type="text" autocomplete="username" placeholder="请输入管理员账号" />
          </label>
          <label class="form-field">
            <span>管理员密码</span>
            <input id="adminPasswordInput" type="password" autocomplete="current-password" placeholder="请输入管理员密码" />
          </label>
          <button class="buy-btn inline-action" type="button" data-action="admin-login">进入后台</button>
          ${adminMessage ? `<p class="payment-error">${escapeHtml(adminMessage)}</p>` : ""}
        </section>
      </main>
    `;
  }

  const activeCount = adminUsers.filter((user) => user.status === "active").length;
  const blockedCount = adminUsers.filter((user) => user.status === "blocked").length;
  const paidCount = adminOrders.filter((order) => order.status === "paid").length;
  const revenue = adminOrders.filter((order) => order.status === "paid").reduce((sum, order) => sum + Number(order.amount || 0), 0);

  return `
    <main class="subpage admin-page">
      <section class="page-hero compact-page-hero admin-hero">
        <div>
          <span class="section-kicker">后台管理</span>
          <h1>用户与订单</h1>
          <p>查看注册用户、拉黑或删除用户，并检查所有支付宝下单记录。</p>
        </div>
        <div class="admin-actions">
          <button class="text-link" type="button" data-action="admin-refresh">刷新</button>
          <button class="text-link" type="button" data-action="admin-logout">退出后台</button>
        </div>
      </section>
      <section class="account-grid">
        ${accountCard("注册用户", String(adminUsers.length), "本地数据文件记录")}
        ${accountCard("已拉黑", String(blockedCount), "被拉黑账号不能登录")}
        ${accountCard("活跃用户", String(activeCount), "可正常登录下单")}
        ${accountCard("已支付金额", `¥${Math.round(revenue)}`, `${paidCount} 笔已支付订单`)}
      </section>
      <section class="subpage-grid admin-grid">
        <div class="table-panel">
          <div class="catalog-head">
            <h2>注册用户</h2>
            <span class="table-note">${adminLoaded ? `${adminUsers.length} 个用户` : "正在加载"}</span>
          </div>
          <form class="admin-add-user" data-admin-add-user>
            <input name="email" type="email" placeholder="新增用户邮箱" required />
            <input name="password" type="password" placeholder="初始密码" required />
            <button type="submit" class="buy-btn">新增</button>
          </form>
          ${adminMessage ? `<p class="payment-error">${escapeHtml(adminMessage)}</p>` : ""}
          <div class="admin-table">
            ${adminUsers.map(adminUserRow).join("") || renderAdminEmpty("暂无用户")}
          </div>
        </div>
        <div class="table-panel">
          <div class="catalog-head">
            <h2>所有订单</h2>
            <span class="table-note">${adminLoaded ? `${adminOrders.length} 笔订单` : "正在加载"}</span>
          </div>
          <div class="admin-table">
            ${adminOrders.map(adminOrderRow).join("") || renderAdminEmpty("暂无订单")}
          </div>
        </div>
      </section>
    </main>
  `;
}

function renderHelpPage() {
  return `
    <main class="subpage">
      <section class="page-hero compact-page-hero">
        <div>
          <span class="section-kicker">帮助中心</span>
          <h1>售前与售后支持</h1>
          <p>面向中国用户整理支付、交付、退款和账号异常处理路径。</p>
        </div>
      </section>
      <section class="help-grid">
        ${helpCard("支付问题", "支付宝付款失败、重复扣款、订单超时等问题处理。")}
        ${helpCard("交付问题", "查看订阅凭证、账号登录失败、充值进度查询。")}
        ${helpCard("退款政策", "按商品状态判断是否可退，保留客服审核入口。")}
        ${helpCard("账号安全", "密码重置、异常登录、二次验证和资料保护。")}
      </section>
      <section class="contact-panel">
        <div>
          <span class="section-kicker">人工客服</span>
          <h2>支付失败？扫码添加客服微信</h2>
          <p>如果遇到支付宝无法唤起、付款后订单未更新、充值账号填写错误等问题，可以添加客服微信并提供订单号。当前为示例二维码位置，上线时替换为真实客服二维码图片。</p>
        </div>
        <div class="wechat-card" aria-label="客服微信二维码">
          <div class="qr-code"><span></span></div>
          <strong>微信客服</strong>
          <small>工作时间 09:00-24:00</small>
        </div>
      </section>
      <section class="info-panel help-panel">
        <h2>常见问题</h2>
        <details open><summary>为什么价格会变化？</summary><p>同步脚本按原站美元价、最新 USD/CNY 汇率和 10% 溢价生成人民币售价，汇率或原站价格变化都会影响最终展示。</p></details>
        <details><summary>库存如何保证？</summary><p>商品同步会读取原站锁定状态和可售状态，建议真实上线时再加本地安全库存、手动下架和异常告警。</p></details>
        <details><summary>支付成功后如何交付？</summary><p>支付回调确认后创建订阅记录，账号类可实时展示凭证，充值类进入处理队列。</p></details>
      </section>
    </main>
  `;
}

function renderPolicyPage(policy) {
  const pages = {
    refund: {
      kicker: "退款政策",
      title: "退款与售后规则",
      intro: "不同数字订阅商品的交付方式不同，退款会按商品类型、交付状态和使用状态处理。",
      items: [
        ["未支付订单", "超过支付时限后自动关闭，不产生扣款。"],
        ["支付失败", "如已扣款但订单未更新，请在帮助页添加客服微信并提供订单号。"],
        ["已交付账号", "账号类商品一经交付需先由客服核查是否可用，再按售后规则处理。"],
        ["充值类商品", "进入处理中后需要核实上游状态，未完成充值可优先补发或退款。"]
      ]
    },
    privacy: {
      kicker: "隐私政策",
      title: "我们如何处理你的信息",
      intro: "MoneyAI 仅收集完成订单、支付和售后所需的基础信息，并尽量减少不必要的数据留存。",
      items: [
        ["账号信息", "邮箱用于登录、订单通知和售后联系。"],
        ["支付信息", "支付宝支付由支付宝收银台处理，MoneyAI 不保存银行卡或支付密码。"],
        ["订单信息", "商品、金额、支付状态和交付记录用于履约和售后。"],
        ["客服信息", "用户主动提交的问题和订单号仅用于人工处理。"]
      ]
    },
    terms: {
      kicker: "服务条款",
      title: "使用 MoneyAI 前需要了解的规则",
      intro: "使用本网站购买数字订阅服务，即表示你理解商品交付、账号安全和售后处理方式。",
      items: [
        ["合规使用", "用户需遵守所购买服务的官方使用规则，不得用于违法或侵权用途。"],
        ["订单履约", "支付成功后按商品类型实时交付或进入充值处理流程。"],
        ["价格变化", "商品价格会因汇率、上游价格和库存状态变化而调整。"],
        ["服务调整", "如上游服务变化导致商品不可用，MoneyAI 会提供替代方案或售后处理。"]
      ]
    }
  };
  const page = pages[policy] || pages.terms;
  return `
    <main class="subpage policy-page">
      <section class="page-hero compact-page-hero">
        <div>
          <span class="section-kicker">${page.kicker}</span>
          <h1>${page.title}</h1>
          <p>${page.intro}</p>
        </div>
      </section>
      <section class="policy-list">
        ${page.items
          .map(
            ([title, text]) => `
              <article class="info-panel">
                <h2>${title}</h2>
                <p>${text}</p>
              </article>
            `
          )
          .join("")}
      </section>
    </main>
  `;
}

function renderFooter() {
  return `
    <footer class="footer">
      <div class="footer-brand">MoneyAI</div>
      <div class="footer-links">
        <a href="/help">帮助中心</a>
        <a href="/refund">退款政策</a>
        <a href="/privacy">隐私政策</a>
        <a href="/terms">服务条款</a>
        <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">冀ICP备2026011782号</a>
      </div>
    </footer>
  `;
}

function renderOverlays(routeType) {
  return `
    ${
      cookieVisible
        ? `<aside class="cookie-banner" id="cookieBanner">
            <button type="button" class="dismiss" data-action="close-cookie" aria-label="关闭 Cookie 提示">${closeIcon()}</button>
            <strong>Cookie & 隐私</strong>
            <p>我们使用 Cookie 来提升体验。继续使用即表示您同意使用 Cookie。</p>
            <button type="button" class="cookie-accept" data-action="close-cookie">接受推荐设置</button>
          </aside>`
        : ""
    }

    ${
      routeType === "home" && couponVisible
        ? `<div class="coupon-modal" id="couponModal" role="dialog" aria-modal="true" aria-labelledby="couponTitle">
            <button type="button" class="coupon-close" data-action="close-coupon" aria-label="关闭优惠券">${closeIcon()}</button>
            <div class="coupon-gifts"></div>
            <div class="coupon-panel">
              <h2 id="couponTitle">限时优惠券</h2>
              ${couponRow("全部订阅", "10% OFF")}
              ${couponRow("AI Tools", "10% OFF")}
              ${couponRow("Gemini Recharge", "10% OFF")}
            </div>
            <div class="coupon-bottom">
              <div class="countdown">剩余时间 <b>29</b> : <b>53</b> : <b>6</b></div>
              <button type="button" class="coupon-claim" data-action="close-coupon">领取优惠券</button>
            </div>
          </div>`
        : ""
    }

    <div class="floating-tools">
      <button type="button" aria-label="优惠券" data-action="show-coupon">COUPON</button>
      <button type="button" aria-label="在线客服">${chatIcon()}</button>
    </div>
    ${loginVisible ? renderLoginDialog() : ""}
  `;
}

function renderLoginDialog() {
  return `
    <div class="modal-backdrop" role="presentation" data-action="close-login"></div>
    <section class="login-dialog" role="dialog" aria-modal="true" aria-labelledby="loginTitle">
      <button type="button" class="dismiss" data-action="close-login" aria-label="关闭登录">${closeIcon()}</button>
      <span class="section-kicker">账号</span>
      <h2 id="loginTitle">${authMode === "login" ? "邮箱登录" : "邮箱注册"}</h2>
      <p>${authMode === "login" ? "使用注册邮箱和密码登录，登录后可查看订单。" : "注册时会向邮箱发送 6 位验证码，验证码 10 分钟内有效。"}</p>
      <div class="segmented">
        <button class="${authMode === "login" ? "selected" : ""}" type="button" data-auth-mode="login">登录</button>
        <button class="${authMode === "register" ? "selected" : ""}" type="button" data-auth-mode="register">注册</button>
      </div>
      <label class="form-field">
        <span>邮箱地址</span>
        <input id="authEmail" type="email" autocomplete="email" placeholder="name@example.com" value="${escapeHtml(authForm.email)}" />
      </label>
      ${
        authMode === "register"
          ? `<div class="code-row">
              <label class="form-field">
                <span>邮箱验证码</span>
                <input id="authCode" type="text" inputmode="numeric" maxlength="6" placeholder="6 位验证码" value="${escapeHtml(authForm.code)}" />
              </label>
              <button id="authSendCodeButton" type="button" class="text-link code-button" data-action="send-code" ${getAuthCodeCooldownSeconds() > 0 ? "disabled" : ""}>${authCodeButtonText()}</button>
            </div>`
          : ""
      }
      <label class="form-field">
        <span>密码</span>
        <input id="authPassword" type="password" autocomplete="${authMode === "login" ? "current-password" : "new-password"}" placeholder="${authMode === "login" ? "请输入密码" : "至少 6 位密码"}" value="${escapeHtml(authForm.password)}" />
      </label>
      ${authMessage ? `<p class="auth-message">${escapeHtml(authMessage)}</p>` : ""}
      <button type="button" class="buy-btn" data-action="${authMode === "login" ? "login" : "register"}">${authMode === "login" ? "登录" : "注册并登录"}</button>
      <small>继续即代表同意服务条款与隐私政策。</small>
    </section>
  `;
}

function bindEvents() {
  startLivePurchaseTicker();
  const route = getRoute();
  if (route.type === "orders" && currentUser && !myOrdersLoaded && !myOrdersLoading) {
    refreshOrdersPage();
  }
  if (route.type === "admin" && adminToken && !adminLoaded) {
    loadAdminData();
  }

  document.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      currentCategory = button.dataset.category;
      render();
    });
  });

  const searchInput = document.querySelector("#searchInput");
  searchInput.addEventListener("input", (event) => {
    searchTerm = event.target.value.trim();
    if (getRoute().type !== "home") {
      window.location.href = "/";
      return;
    }
    document.querySelector(".product-grid").innerHTML = filteredProducts().map(productCard).join("") || renderEmptyResult();
    bindProductButtons();
  });

  document.querySelectorAll("[data-action='close-cookie']").forEach((button) => {
    button.addEventListener("click", () => {
      cookieVisible = false;
      document.querySelector("#cookieBanner")?.remove();
    });
  });
  document.querySelectorAll("[data-action='close-coupon']").forEach((button) => {
    button.addEventListener("click", () => {
      couponVisible = false;
      document.querySelector("#couponModal")?.remove();
    });
  });
  document.querySelectorAll("[data-action='show-coupon']").forEach((button) => {
    button.addEventListener("click", () => {
      couponVisible = true;
      window.history.pushState(null, "", "/");
      render();
    });
  });
  document.querySelectorAll("[data-action='show-all']").forEach((button) => {
    button.addEventListener("click", () => {
      searchTerm = "";
      currentCategory = "all";
      render();
    });
  });
  document.querySelectorAll("[data-action='alipay-pay']").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!currentToken) {
        authMessage = "请先使用邮箱注册或登录后再支付。";
        loginVisible = true;
        render();
        return;
      }
      button.textContent = "正在创建支付宝订单...";
      button.disabled = true;
      try {
        const response = await fetch("/api/orders/alipay", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            productName: button.dataset.product,
            productSlug: button.dataset.productSlug,
            productCategory: button.dataset.productCategory,
            planLabel: button.dataset.plan,
            totalAmount: button.dataset.amount,
            email: currentUser?.email
          })
        });
        const text = await response.text();
        const payload = parseApiResponse(text);
        if (!response.ok) throw new Error(payload.message || "支付宝订单创建失败");
        submitAlipayForm(payload.paymentForm);
      } catch (error) {
        button.textContent = "使用支付宝支付";
        button.disabled = false;
        showInlineMessage(button, `${error.message}。如已付款或无法唤起支付宝，请到帮助页添加客服微信处理。`);
      }
    });
  });
  document.querySelectorAll("[data-action='open-login']").forEach((button) => {
    button.addEventListener("click", () => {
      loginVisible = true;
      authMessage = "";
      render();
    });
  });
  document.querySelectorAll("[data-action='close-login']").forEach((button) => {
    button.addEventListener("click", () => {
      loginVisible = false;
      authMessage = "";
      authForm = { email: "", code: "", password: "" };
      render();
    });
  });
  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      updateAuthFormFromInputs();
      authMode = button.dataset.authMode;
      authMessage = "";
      render();
    });
  });
  document.querySelectorAll("#authEmail, #authCode, #authPassword").forEach((input) => {
    input.addEventListener("input", updateAuthFormFromInputs);
  });
  document.querySelectorAll("[data-action='send-code']").forEach((button) => {
    button.addEventListener("click", async () => {
      await sendRegisterCode(button);
    });
  });
  document.querySelectorAll("[data-action='login']").forEach((button) => {
    button.addEventListener("click", async () => {
      await submitAuth(button, "login");
    });
  });
  document.querySelectorAll("[data-action='register']").forEach((button) => {
    button.addEventListener("click", async () => {
      await submitAuth(button, "register");
    });
  });
  document.querySelectorAll("[data-action='logout']").forEach((button) => {
    button.addEventListener("click", () => {
      currentToken = "";
      currentUser = null;
      myOrders = [];
      myOrdersLoaded = false;
      localStorage.removeItem("moneyai_token");
      localStorage.removeItem("moneyai_user");
      render();
    });
  });

  bindAdminEvents();

  bindProductButtons();
}

function bindProductButtons() {
  document.querySelectorAll("[data-buy]").forEach((button) => {
    button.addEventListener("click", () => {
      const product = catalogProducts.find((item) => item.name === button.dataset.buy);
      window.location.href = `/checkout/${productSlug(product)}`;
    });
  });
}

function bindAdminEvents() {
  document.querySelectorAll("[data-action='admin-login']").forEach((button) => {
    button.addEventListener("click", async () => {
      await loginAdmin(button);
    });
  });
  document.querySelectorAll("[data-action='admin-refresh']").forEach((button) => {
    button.addEventListener("click", async () => {
      adminLoaded = false;
      await loadAdminData();
    });
  });
  document.querySelectorAll("[data-action='admin-logout']").forEach((button) => {
    button.addEventListener("click", () => {
      adminToken = "";
      adminLoaded = false;
      adminUsers = [];
      adminOrders = [];
      localStorage.removeItem("moneyai_admin_session");
      render();
    });
  });
  document.querySelectorAll("[data-admin-add-user]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      await adminApi("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password")
        })
      });
      adminMessage = "用户已新增";
      await loadAdminData();
    });
  });
  document.querySelectorAll("[data-admin-user-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const { userId, adminUserAction } = button.dataset;
      if (adminUserAction === "delete") {
        await adminApi(`/api/admin/users/${userId}`, { method: "DELETE" });
        adminMessage = "用户已删除";
      } else {
        await adminApi(`/api/admin/users/${userId}`, {
          method: "PATCH",
          body: JSON.stringify({ status: adminUserAction })
        });
        adminMessage = adminUserAction === "blocked" ? "用户已拉黑" : "用户已恢复";
      }
      await loadAdminData();
    });
  });
}

async function loginAdmin(button) {
  const username = document.querySelector("#adminUsernameInput")?.value.trim() || "";
  const password = document.querySelector("#adminPasswordInput")?.value || "";
  button.disabled = true;
  button.textContent = "登录中...";
  try {
    const payload = await apiJson("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
    adminToken = payload.token;
    localStorage.setItem("moneyai_admin_session", adminToken);
    adminMessage = "";
    adminLoaded = false;
    await loadAdminData();
  } catch (error) {
    adminMessage = error.message;
    adminToken = "";
    localStorage.removeItem("moneyai_admin_session");
    render();
  } finally {
    button.disabled = false;
  }
}

async function sendRegisterCode(button) {
  const email = document.querySelector("#authEmail")?.value.trim();
  authForm.email = email || "";
  if (getAuthCodeCooldownSeconds() > 0) {
    updateAuthCodeButton();
    return;
  }
  button.disabled = true;
  button.textContent = "发送中...";
  try {
    const payload = await apiJson("/api/auth/send-code", {
      method: "POST",
      body: JSON.stringify({ email })
    });
    authMessage = payload.message || "验证码已发送";
    startAuthCodeCooldown(300);
  } catch (error) {
    authMessage = error.message;
    if (error.status === 429 && Number.isFinite(error.retryAfter)) {
      startAuthCodeCooldown(error.retryAfter);
    }
  } finally {
    button.disabled = false;
    render();
  }
}

function startAuthCodeCooldown(seconds) {
  const safeSeconds = Math.max(1, Math.ceil(Number(seconds) || 300));
  authCodeCooldownUntil = Date.now() + safeSeconds * 1000;
  localStorage.setItem("moneyai_auth_code_cooldown_until", String(authCodeCooldownUntil));
  startAuthCodeCooldownTimer();
}

function startAuthCodeCooldownTimer() {
  if (authCodeCooldownTimer || getAuthCodeCooldownSeconds() <= 0) return;
  updateAuthCodeButton();
  authCodeCooldownTimer = window.setInterval(() => {
    updateAuthCodeButton();
    if (getAuthCodeCooldownSeconds() <= 0) {
      window.clearInterval(authCodeCooldownTimer);
      authCodeCooldownTimer = null;
      localStorage.removeItem("moneyai_auth_code_cooldown_until");
    }
  }, 1000);
}

function updateAuthCodeButton() {
  const button = document.querySelector("#authSendCodeButton");
  if (!button) return;
  const seconds = getAuthCodeCooldownSeconds();
  button.disabled = seconds > 0;
  button.textContent = authCodeButtonText();
}

function authCodeButtonText() {
  const seconds = getAuthCodeCooldownSeconds();
  return seconds > 0 ? `${seconds} 秒后重发` : "发送验证码";
}

function getAuthCodeCooldownSeconds() {
  const seconds = Math.ceil((authCodeCooldownUntil - Date.now()) / 1000);
  return seconds > 0 ? seconds : 0;
}

async function submitAuth(button, mode) {
  const email = document.querySelector("#authEmail")?.value.trim();
  const password = document.querySelector("#authPassword")?.value || "";
  const code = document.querySelector("#authCode")?.value.trim() || "";
  authForm = { email: email || "", password, code };
  button.disabled = true;
  button.textContent = mode === "login" ? "登录中..." : "注册中...";
  try {
    const payload = await apiJson(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, code })
    });
    currentToken = payload.token;
    currentUser = payload.user;
    localStorage.setItem("moneyai_token", currentToken);
    localStorage.setItem("moneyai_user", JSON.stringify(currentUser));
    loginVisible = false;
    authMessage = "";
    authForm = { email: "", code: "", password: "" };
    myOrdersLoaded = false;
  } catch (error) {
    authMessage = error.message;
  } finally {
    button.disabled = false;
    render();
  }
}

function updateAuthFormFromInputs() {
  const emailInput = document.querySelector("#authEmail");
  const codeInput = document.querySelector("#authCode");
  const passwordInput = document.querySelector("#authPassword");
  authForm = {
    email: emailInput ? emailInput.value.trim() : authForm.email,
    code: codeInput ? codeInput.value.trim() : authForm.code,
    password: passwordInput ? passwordInput.value : authForm.password
  };
}

async function loadMyOrders() {
  myOrdersLoading = true;
  try {
    const payload = await apiJson("/api/my/orders", { method: "GET", headers: authHeaders(), cache: "no-store" });
    myOrders = payload.orders || [];
    myOrdersLoaded = true;
  } catch (error) {
    if (error.status === 401) myOrders = [];
    myOrdersLoaded = true;
  } finally {
    myOrdersLoading = false;
  }
}

async function refreshOrdersPage() {
  try {
    await confirmAlipayReturnIfNeeded();
    await loadMyOrders();
  } finally {
    render();
  }
}

async function confirmAlipayReturnIfNeeded() {
  const params = currentQueryParams();
  const outTradeNo = params.get("out_trade_no") || params.get("order") || "";
  if (params.get("payment") !== "return" || !outTradeNo || alipayReturnConfirming || alipayReturnHandledOrder === outTradeNo) return;

  alipayReturnConfirming = true;
  try {
    await apiJson("/api/orders/alipay/return", {
      method: "POST",
      headers: authHeaders(),
      cache: "no-store",
      body: JSON.stringify({
        outTradeNo,
        tradeNo: params.get("trade_no") || "",
        totalAmount: params.get("total_amount") || "",
        returnPayload: Object.fromEntries(params.entries())
      })
    });
    alipayReturnHandledOrder = outTradeNo;
    window.history.replaceState(null, "", "/orders");
  } catch {
    alipayReturnHandledOrder = outTradeNo;
  } finally {
    alipayReturnConfirming = false;
  }
}

function currentQueryParams() {
  const query = window.location.hash.startsWith("#/") ? window.location.hash.split("?")[1] || "" : window.location.search.slice(1);
  return new URLSearchParams(query);
}

async function loadAdminData() {
  try {
    const [usersPayload, ordersPayload] = await Promise.all([
      adminApi("/api/admin/users"),
      adminApi("/api/admin/orders")
    ]);
    adminUsers = usersPayload.users || [];
    adminOrders = ordersPayload.orders || [];
    adminLoaded = true;
    adminMessage = "";
  } catch (error) {
    adminLoaded = true;
    adminMessage = error.message;
    if (error.status === 401) {
      adminToken = "";
      localStorage.removeItem("moneyai_admin_session");
    }
  }
  render();
}

async function apiJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const payload = parseApiResponse(await response.text());
  if (!response.ok) {
    const error = new Error(payload.message || "请求失败");
    error.status = response.status;
    if (Number.isFinite(Number(payload.retryAfter))) error.retryAfter = Number(payload.retryAfter);
    throw error;
  }
  return payload;
}

async function loadCatalogData() {
  try {
    const payload = await apiJson("/api/catalog", { method: "GET" });
    if (!Array.isArray(payload.products) || !payload.products.length) return;
    catalogProducts = mergeCatalogProducts(products, payload.products);
    catalogSyncMeta = payload.syncMeta || catalogSyncMeta;
    render();
  } catch {
    catalogProducts = mergeCatalogProducts(products, fallbackSyncedProducts);
  }
}

function adminApi(url, options = {}) {
  return apiJson(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${adminToken}`,
      ...(options.headers || {})
    }
  });
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {})
  };
}

function startLivePurchaseTicker() {
  const target = document.querySelector("#livePurchaseText");
  if (!target) {
    if (livePurchaseTimer) {
      window.clearInterval(livePurchaseTimer);
      livePurchaseTimer = null;
    }
    return;
  }
  target.textContent = livePurchaseText();
  if (livePurchaseTimer) return;
  livePurchaseTimer = window.setInterval(() => {
    livePurchaseIndex = (livePurchaseIndex + 1) % livePurchases.length;
    const node = document.querySelector("#livePurchaseText");
    if (!node) return;
    node.classList.remove("is-updating");
    void node.offsetWidth;
    node.textContent = livePurchaseText();
    node.classList.add("is-updating");
  }, 4000);
}

function livePurchaseText() {
  const [name, time, product] = livePurchases[livePurchaseIndex];
  return `${name} 在 ${time}购买 ${product}`;
}

function submitAlipayForm(paymentForm) {
  if (/^https?:\/\//.test(paymentForm)) {
    window.location.href = paymentForm;
    return;
  }
  document.open();
  document.write(paymentForm);
  document.close();
}

function parseApiResponse(text) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: "支付服务返回了非 JSON 响应，请确认开发服务已重启并启用 /api 代理。" };
  }
}

function showInlineMessage(anchor, message) {
  const existing = anchor.parentElement.querySelector(".payment-error");
  if (existing) existing.remove();
  const node = document.createElement("p");
  node.className = "payment-error";
  node.textContent = message;
  anchor.insertAdjacentElement("afterend", node);
}

function filteredProducts() {
  return catalogProducts.filter((product) => {
    const matchesCategory = currentCategory === "all" || product.category === currentCategory;
    const matchesSearch =
      !searchTerm || product.name.toLowerCase().includes(searchTerm.toLowerCase()) || product.tags.join("").includes(searchTerm);
    return matchesCategory && matchesSearch;
  });
}

function mergeCatalogProducts(seedProducts, remoteProducts) {
  const merged = [...seedProducts];
  const seen = new Set(seedProducts.map(productSlug));
  remoteProducts.forEach((product) => {
    const slug = productSlug(product);
    if (!seen.has(slug)) {
      merged.push(product);
      seen.add(slug);
    }
  });
  return merged;
}

function deriveUsage(product) {
  const name = product.name.toLowerCase();
  if (name.includes("recharge")) return ["为你的自有账号完成会员充值或方案升级", "适合已经拥有官方账号、只需要补充订阅权益的用户"];
  if (name.includes("chatgpt")) return ["用于 AI 问答、写作、翻译、代码生成和多模态处理", "适合学习、办公、内容创作和开发辅助"];
  if (name.includes("youtube")) return ["无广告观看 YouTube 视频并支持后台播放", "适合音乐、视频学习和家庭娱乐"];
  if (name.includes("gemini")) return ["使用 Google Gemini 的长上下文、多模态理解和生成能力", "适合资料分析、图片理解和创意生成"];
  if (name.includes("capcut")) return ["解锁高级视频剪辑模板、特效、字幕和商用素材", "适合短视频创作、团队协作和社媒运营"];
  if (name.includes("vpn")) return ["用于更稳定地访问海外内容和保护网络连接", "适合跨区内容访问和隐私保护"];
  return product.tags?.length ? product.tags : ["高质量数字订阅服务", "适合日常学习、办公和娱乐使用"];
}

function deriveSteps(product) {
  if (product.category === "recharge") return ["选择充值周期并填写自己的账号", "完成支付宝支付后进入处理中状态", "客服或系统完成充值后在订单中心更新结果"];
  return ["选择订阅周期并完成支付", "在订单中心查看账号、密码或使用凭证", "按商品说明登录对应官网或应用使用"];
}

function categoryButton(category) {
  const active = currentCategory === category.id ? "active" : "";
  return `
    <button class="category-tab ${active}" type="button" data-category="${category.id}">
      ${category.icon}
      <span>${category.label}</span>
    </button>
  `;
}

function productCard(product) {
  return `
    <article class="product-card">
      <a class="product-hero product-hero-link" href="/product/${productSlug(product)}" style="--brand-color:${product.color}">
        ${product.badge ? `<span class="badge">${product.badge}</span>` : ""}
        ${product.ribbon ? `<span class="ribbon">${product.ribbon}</span>` : ""}
        <div class="product-title">
          <span class="product-logo" style="background:${product.color}">${product.icon}</span>
          <h3>${product.name}</h3>
        </div>
        <p class="recent">${product.sold}</p>
        <div class="price"><span>¥${product.price}</span><small> / ${product.unit}</small></div>
      </a>
      <div class="product-body">
        <ul>
          ${product.tags.map((tag) => `<li>${checkIcon()}<span>${tag}</span></li>`).join("")}
        </ul>
        <button type="button" class="buy-btn" data-buy="${product.name}">立即购买</button>
        <a class="detail-btn detail-link" href="/product/${productSlug(product)}">查看更多详情</a>
      </div>
    </article>
  `;
}

function planCard(product, plan, selected) {
  const total = Math.round(product.price * plan.multiplier);
  return `
    <a class="plan-card ${selected ? "selected" : ""}" href="/checkout/${productSlug(product)}?plan=${plan.months}">
      <span>${plan.label}</span>
      <strong>¥${total}</strong>
      <small>${plan.discount || "灵活体验"}</small>
    </a>
  `;
}

function paymentMethod(method) {
  return `
    <label class="payment-method ${method.id === "alipay" ? "selected" : ""}">
      <input type="radio" name="payment" ${method.id === "alipay" ? "checked" : ""} />
      <span class="payment-icon">${method.icon}</span>
      <span>
        <strong>${method.name}</strong>
        <small>${method.note}</small>
      </span>
    </label>
  `;
}

function summaryRow(label, value) {
  return `
    <div class="summary-row">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function accountCard(title, value, note) {
  return `
    <article class="account-card">
      <span>${title}</span>
      <strong>${value}</strong>
      <small>${note}</small>
    </article>
  `;
}

function orderSummaryCard(order) {
  const product = orderProduct(order);
  const paid = order.status === "paid";
  return `
    <article class="order-card ${paid ? "is-paid" : ""}">
      <div class="order-card-main">
        <div>
          <span class="order-id">${escapeHtml(order.outTradeNo)}</span>
          <h3>${escapeHtml(order.productName || "未知商品")}</h3>
          <p>${escapeHtml(order.planLabel || "默认套餐")} · ${escapeHtml(categoryName(product?.category || order.productCategory || "market"))}</p>
        </div>
        <div class="order-money">
          <strong>¥${formatAmount(order.amount)}</strong>
          <span class="${paid ? "status-good" : "status-bad"}">${orderStatusText(order.status)}</span>
        </div>
      </div>
      <div class="order-card-meta">
        <span>下单：${formatTime(order.createdAt)}</span>
        <span>支付：${order.paidAt ? formatTime(order.paidAt) : "待支付"}</span>
        <span>交付：${deliveryStatusText(order.deliveryStatus, order.status)}</span>
      </div>
      <div class="order-card-actions">
        <a class="text-link" href="/orders?order=${encodeURIComponent(order.outTradeNo)}">查看明细</a>
        <a class="text-link" href="/product/${productSlug(product || order.productName || order.productSlug || "")}">关联商品</a>
      </div>
    </article>
  `;
}

function renderOrderDetail(order) {
  const product = orderProduct(order);
  const paid = order.status === "paid";
  return `
    <section class="table-panel order-detail-panel">
      <div class="catalog-head">
        <h2>订单明细</h2>
        <a class="text-link" href="/orders">收起明细</a>
      </div>
      <div class="order-detail-grid">
        ${detailItem("订单编号", escapeHtml(order.outTradeNo))}
        ${detailItem("订单状态", `<span class="${paid ? "status-good" : "status-bad"}">${orderStatusText(order.status)}</span>`)}
        ${detailItem("商品", `<a class="text-link" href="/product/${productSlug(product || order.productName || order.productSlug || "")}">${escapeHtml(order.productName || "未知商品")}</a>`)}
        ${detailItem("套餐", escapeHtml(order.planLabel || "默认套餐"))}
        ${detailItem("订单金额", `¥${formatAmount(order.amount)}`)}
        ${detailItem("支付方式", paymentMethodText(order.paymentMethod))}
        ${detailItem("下单时间", formatTime(order.createdAt))}
        ${detailItem("支付时间", order.paidAt ? formatTime(order.paidAt) : "待支付")}
        ${detailItem("支付宝交易号", escapeHtml(order.alipayTradeNo || "暂无"))}
        ${detailItem("交付状态", deliveryStatusText(order.deliveryStatus, order.status))}
      </div>
      <div class="delivery-box">
        <span>商品交付</span>
        <strong>${deliveryStatusText(order.deliveryStatus, order.status)}</strong>
        <p>${escapeHtml(order.deliveryMessage || deliveryMessage(order))}</p>
      </div>
    </section>
  `;
}

function detailItem(label, value) {
  return `
    <div class="detail-item">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function selectedOrderFromRoute() {
  const orderNo = currentQueryParams().get("order");
  return orderNo ? myOrders.find((order) => order.outTradeNo === orderNo) : null;
}

function orderProduct(order) {
  return catalogProducts.find((product) => productSlug(product) === (order.productSlug || productSlug(order.productName || "")))
    || catalogProducts.find((product) => product.name === order.productName)
    || null;
}

function formatAmount(value) {
  const amount = Number(value || 0);
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

function paymentMethodText(method) {
  return method === "alipay" ? "支付宝" : method || "未知";
}

function deliveryStatusText(status, orderStatus) {
  if (orderStatus !== "paid") return "待支付";
  return {
    waiting_payment: "待支付",
    pending_delivery: "待交付",
    processing: "交付处理中",
    delivered: "已交付",
    after_sale: "售后中"
  }[status] || "待交付";
}

function deliveryMessage(order) {
  if (order.status !== "paid") return "完成支付后，商品会进入交付流程。";
  return "支付已确认，商品交付正在处理中。请留意订单状态或联系客服获取凭证。";
}

function adminUserRow(user) {
  const blocked = user.status === "blocked";
  return `
    <div class="admin-row">
      <span><strong>${escapeHtml(user.email)}</strong><small>${formatTime(user.createdAt)} 注册</small></span>
      <span class="${blocked ? "status-bad" : "status-good"}">${blocked ? "已拉黑" : "正常"}</span>
      <span>${user.lastLoginAt ? formatTime(user.lastLoginAt) : "未登录"}</span>
      <span class="row-actions">
        <button type="button" class="text-link" data-admin-user-action="${blocked ? "active" : "blocked"}" data-user-id="${user.id}">${blocked ? "恢复" : "拉黑"}</button>
        <button type="button" class="text-link danger-link" data-admin-user-action="delete" data-user-id="${user.id}">删除</button>
      </span>
    </div>
  `;
}

function adminOrderRow(order) {
  return `
    <div class="admin-row order-admin-row">
      <span><strong>${escapeHtml(order.outTradeNo)}</strong><small>${escapeHtml(order.userEmail || "未登录用户")}</small></span>
      <span>${escapeHtml(order.productName)}<small>${escapeHtml(order.planLabel)}</small></span>
      <span>¥${order.amount}</span>
      <span class="${order.status === "paid" ? "status-good" : "status-bad"}">${orderStatusText(order.status)}</span>
      <span>${formatTime(order.createdAt)}</span>
    </div>
  `;
}

function renderAdminEmpty(text) {
  return `<div class="empty-result"><strong>${text}</strong><span>数据会在用户注册或下单后自动出现。</span></div>`;
}

function orderStatusText(status) {
  return {
    pending: "待支付",
    paid: "已支付",
    processing: "处理中",
    payment_error: "支付发起失败"
  }[status] || status || "未知";
}

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("moneyai_user") || "null");
  } catch {
    return null;
  }
}

function maskEmail(email) {
  const [name, domain] = String(email || "").split("@");
  if (!domain) return "已登录";
  return `${name.slice(0, 2)}***@${domain}`;
}

function helpCard(title, text) {
  return `
    <article class="help-card">
      <span class="feature-icon">${chatIcon()}</span>
      <h3>${title}</h3>
      <p>${text}</p>
    </article>
  `;
}

function formatTime(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "暂无";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function renderEmptyResult() {
  return `
    <div class="empty-result">
      <strong>没有找到匹配商品</strong>
      <span>换个关键词或查看全部订阅。</span>
    </div>
  `;
}

function getRoute() {
  const routeSource = window.location.hash.startsWith("#/")
    ? window.location.hash.replace(/^#\/?/, "")
    : `${window.location.pathname.replace(/^\/?/, "")}${window.location.search}`;
  const [path, query = ""] = routeSource.split("?");
  const [type, slug] = path.split("/");
  const product = catalogProducts.find((item) => productSlug(item) === slug) || catalogProducts[0];
  const params = new URLSearchParams(query);
  const plan = productPlans.find((item) => String(item.months) === params.get("plan")) || productPlans[1];
  if (type === "product") return { type: "product", product };
  if (type === "checkout") return { type: "checkout", product, plan };
  if (type === "subscriptions") {
    searchTerm = (params.get("q") || "").trim();
    return { type, product: null };
  }
  if (["orders", "help"].includes(type)) return { type, product: null };
  if (type === "wwlsm") return { type: "admin", product: null };
  if (["refund", "privacy", "terms"].includes(type)) return { type: "policy", policy: type, product: null };
  return { type: "home", product: null };
}

function updatePageMeta(route) {
  const meta = getPageMeta(route);
  document.documentElement.lang = "zh-CN";
  document.title = meta.title;
  setMeta("description", meta.description);
  setMeta("keywords", meta.keywords);
  setMeta("robots", meta.robots || "index,follow,max-image-preview:large");
  setMeta("theme-color", "#f5f5f7");
  setMetaProperty("og:site_name", "MoneyAI");
  setMetaProperty("og:type", route.type === "product" ? "product" : "website");
  setMetaProperty("og:title", meta.title);
  setMetaProperty("og:description", meta.description);
  setMetaProperty("og:url", meta.url);
  setMeta("twitter:card", "summary_large_image");
  setCanonical(meta.url);
  setJsonLd(buildJsonLd(route, meta));
}

function getPageMeta(route) {
  const baseUrl = window.location.origin;
  const commonKeywords = "MoneyAI,AI,人工智能,生成式 AI,ChatGPT,Claude,Gemini,OpenAI API,Claude API,Gemini API,API 订阅,数字订阅,AI工具订阅,支付宝支付,流媒体会员";
  if (route.type === "product") {
    const product = route.product;
    return {
      title: `${product.name} 订阅购买 - MoneyAI`,
      description: `在 MoneyAI 购买 ${product.name}，人民币价格、支付宝支付、订单中心交付，适合中国用户使用。`,
      keywords: `${product.name},${categoryName(product.category)},AI订阅,生成式AI订阅,API服务,${commonKeywords}`,
      robots: "index,follow,max-image-preview:large",
      url: `${baseUrl}/product/${productSlug(product)}`
    };
  }
  if (route.type === "checkout") {
    return {
      title: `确认订单并支付 - MoneyAI`,
      description: "MoneyAI 安全收银台，支持支付宝支付数字订阅订单。",
      keywords: `支付宝支付,订单支付,AI订阅支付,${commonKeywords}`,
      robots: "noindex,nofollow",
      url: `${baseUrl}/checkout/${productSlug(route.product)}`
    };
  }
  const pageMap = {
    subscriptions: ["AI 与数字订阅商品 - MoneyAI", "浏览 MoneyAI 数字订阅商品，包含 ChatGPT、Claude、Gemini、生成式 AI、API、视频会员、软件和充值服务。"],
    orders: ["我的订单 - MoneyAI", "查看 MoneyAI 订单状态、支付结果、交付凭证和售后入口。"],
    admin: ["后台管理 - MoneyAI", "MoneyAI 后台管理，查看注册用户、管理用户状态和查看订单。"],
    help: ["帮助中心 - MoneyAI", "MoneyAI 帮助中心，处理支付失败、订单交付、退款政策和客服微信联系。"],
    policy: [`${policyTitle(route.policy)} - MoneyAI`, `MoneyAI ${policyTitle(route.policy)}，了解数字订阅购买、支付、售后和隐私规则。`],
    home: ["MoneyAI AI 与数字订阅商城", "MoneyAI 面向中国用户提供 ChatGPT、Claude、Gemini、生成式 AI、API、视频会员、软件和充值类数字订阅，支持支付宝支付。"]
  };
  const [title, description] = pageMap[route.type] || pageMap.home;
  const robots = ["orders", "admin"].includes(route.type) ? "noindex,nofollow" : "index,follow,max-image-preview:large";
  const path = route.type === "admin" ? "/wwlsm" : route.type === "home" ? "/" : `/${route.policy || route.type}`;
  return { title, description, keywords: commonKeywords, robots, url: `${baseUrl}${path}` };
}

function policyTitle(policy) {
  return { refund: "退款政策", privacy: "隐私政策", terms: "服务条款" }[policy] || "服务条款";
}

function setMeta(name, content) {
  let tag = document.head.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("name", name);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function setMetaProperty(property, content) {
  let tag = document.head.querySelector(`meta[property="${property}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("property", property);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function setCanonical(url) {
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", url);
}

function setJsonLd(data) {
  let script = document.head.querySelector("#moneyai-jsonld");
  if (!script) {
    script = document.createElement("script");
    script.id = "moneyai-jsonld";
    script.type = "application/ld+json";
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}

function buildJsonLd(route, meta) {
  const graph = [
    {
      "@type": "Organization",
      "@id": `${window.location.origin}/#organization`,
      name: "MoneyAI",
      url: window.location.origin,
      contactPoint: [{ "@type": "ContactPoint", contactType: "customer support", availableLanguage: "zh-CN" }]
    },
    {
      "@type": "WebSite",
      "@id": `${window.location.origin}/#website`,
      name: "MoneyAI",
      url: window.location.origin,
      potentialAction: {
        "@type": "SearchAction",
        target: `${window.location.origin}/subscriptions?q={search_term_string}`,
        "query-input": "required name=search_term_string"
      }
    }
  ];
  if (route.type === "product") {
    graph.push({
      "@type": "Product",
      name: route.product.name,
      description: meta.description,
      category: categoryName(route.product.category),
      offers: {
        "@type": "Offer",
        priceCurrency: "CNY",
        price: route.product.price,
        availability: route.product.stockStatus === "缺货" ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
        url: meta.url
      }
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

function productSlug(product) {
  return String(product?.name || product || "").toLowerCase().replace(/\+/g, "plus").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function categoryName(categoryId) {
  return categories.find((category) => category.id === categoryId)?.label || "订阅";
}

function stepCard(number, title, text) {
  return `
    <article class="step-card">
      <span>${number}</span>
      <h3>${title}</h3>
      <p>${text}</p>
    </article>
  `;
}

function couponRow(name, discount) {
  return `
    <div class="coupon-row">
      <div>
        <strong>${name}</strong>
        <small>2026/04/27-2026/05/10</small>
      </div>
      <b>${discount}</b>
    </div>
  `;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function svg(path, attrs = "") {
  return `<svg aria-hidden="true" viewBox="0 0 24 24" ${attrs}>${path}</svg>`;
}

function gridIcon() {
  return svg('<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>');
}

function playIcon() {
  return svg('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18.5z"/><path fill="#fff" d="m10 8 6 4-6 4z"/>');
}

function aiIcon() {
  return svg('<path d="M8 3h8v3h3v8h-3v3H8v-3H5V6h3z"/><path fill="#fff" d="M9 9h2v5H9zm4 0h2v5h-2z"/>');
}

function codeIcon() {
  return svg('<path d="M4 5h16v14H4z"/><path fill="#fff" d="m10 9-3 3 3 3 1-1-2-2 2-2zm4 0-1 1 2 2-2 2 1 1 3-3z"/>');
}

function sparkIcon() {
  return svg('<path d="m12 2 2.2 6.2L20 10l-5.8 1.8L12 18l-2.2-6.2L4 10l5.8-1.8zM19 15l1 3 3 1-3 1-1 3-1-3-3-1 3-1z"/>');
}

function shopIcon() {
  return svg('<path d="M5 4h14l1 6H4zM6 10v10h12V10M9 20v-6h6v6"/>', 'fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"');
}

function walletIcon() {
  return svg('<path d="M4 7h16v12H4zM4 7l3-4h10l3 4M15 13h5"/>', 'fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"');
}

function gameIcon() {
  return svg('<path d="M7 9h10a5 5 0 0 1 4 8l-1 1a2 2 0 0 1-3 0l-1-2H8l-1 2a2 2 0 0 1-3 0l-1-1a5 5 0 0 1 4-8z"/><path fill="#fff" d="M7 12h2v-2h2v2h2v2h-2v2H9v-2H7zM16 12h2v2h-2z"/>');
}

function searchIcon() {
  return svg('<path d="m21 21-4.4-4.4M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z"/>', 'fill="none" stroke="currentColor" stroke-width="2"');
}

function globeIcon() {
  return svg('<path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.2 2.4 3.3 5.4 3.3 9S14.2 18.6 12 21M12 3C9.8 5.4 8.7 8.4 8.7 12S9.8 18.6 12 21"/>', 'fill="none" stroke="currentColor" stroke-width="2"');
}

function userIcon() {
  return svg('<path d="M20 21a8 8 0 0 0-16 0M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10z"/>', 'fill="none" stroke="currentColor" stroke-width="2"');
}

function closeIcon() {
  return svg('<path d="M6 6l12 12M18 6 6 18"/>', 'fill="none" stroke="currentColor" stroke-width="2"');
}

function chatIcon() {
  return svg('<path d="M4 5h16v11H8l-4 4z"/>');
}

function checkIcon() {
  return svg('<path d="m5 12 4 4L19 6"/>', 'fill="none" stroke="currentColor" stroke-width="2"');
}

function arrowLeftIcon() {
  return svg('<path d="M19 12H5M12 19l-7-7 7-7"/>', 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"');
}

function featureIcon(index) {
  return [walletIcon(), closeIcon(), globeIcon(), chatIcon(), sparkIcon(), checkIcon()][index];
}

window.addEventListener("hashchange", render);
render();
loadCatalogData();
