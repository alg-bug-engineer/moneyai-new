const path = require("node:path");
const fs = require("node:fs/promises");
const crypto = require("node:crypto");
const { promisify } = require("node:util");
const Express = require("express");
const nodemailer = require("nodemailer");
const { AlipaySdk } = require("alipay-sdk");
const dotenv = require("dotenv");

dotenv.config(); // Load from root .env

const scryptAsync = promisify(crypto.scrypt);
const app = new Express();
const port = process.env.PORT || 3000;
const publicBaseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${port}`;
const dataDir = path.join(__dirname, "data");
const storePath = path.join(dataDir, "store.json");
const adminUsername = process.env.ADMIN_USERNAME || "wwlsm";
const adminPassword = process.env.ADMIN_PASSWORD || "Zl161829@@";
const adminSessions = new Map();

app.use(Express.json());
app.use(Express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "http://127.0.0.1:5173");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

const alipaySdk = new AlipaySdk({
  appId: process.env.ALIPAY_APP_ID,
  privateKey: process.env.ALIPAY_PRIVATE_KEY,
  alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY,
  gateway: process.env.ALIPAY_GATEWAY || "https://openapi.alipay.com/gateway.do"
});

const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.qq.com",
  port: Number(process.env.SMTP_PORT || 465),
  secure: String(process.env.SMTP_SECURE || "true") === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "MoneyAI API" });
});

app.post("/api/auth/send-code", async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!isEmail(email)) {
    res.status(400).json({ message: "请输入有效邮箱" });
    return;
  }

  const store = await readStore();
  const existing = store.users.find((user) => user.email === email);
  if (existing && existing.status !== "deleted") {
    res.status(409).json({ message: "该邮箱已经注册，请直接登录" });
    return;
  }

  const code = makeVerificationCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  store.verificationCodes = store.verificationCodes.filter((item) => item.email !== email);
  store.verificationCodes.push({
    id: makeId("vc"),
    email,
    codeHash: hashOneTimeValue(code),
    expiresAt,
    createdAt: new Date().toISOString()
  });
  await writeStore(store);

  try {
    await sendVerificationEmail(email, code);
    res.json({ ok: true, message: "验证码已发送，请查看邮箱" });
  } catch (error) {
    console.error("验证码邮件发送失败", error);
    res.status(500).json({ message: "验证码邮件发送失败，请检查 SMTP 配置或稍后重试" });
  }
});

app.post("/api/auth/register", async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || "");
  const code = String(req.body.code || "").trim();

  if (!isEmail(email)) {
    res.status(400).json({ message: "请输入有效邮箱" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ message: "密码至少 6 位" });
    return;
  }
  if (!/^\d{6}$/.test(code)) {
    res.status(400).json({ message: "请输入 6 位邮箱验证码" });
    return;
  }

  const store = await readStore();
  const existing = store.users.find((user) => user.email === email && user.status !== "deleted");
  if (existing) {
    res.status(409).json({ message: "该邮箱已经注册，请直接登录" });
    return;
  }

  const codeRecord = store.verificationCodes.find((item) => item.email === email);
  if (!codeRecord || new Date(codeRecord.expiresAt).getTime() < Date.now() || codeRecord.codeHash !== hashOneTimeValue(code)) {
    res.status(400).json({ message: "验证码无效或已过期" });
    return;
  }

  const user = {
    id: makeId("usr"),
    email,
    passwordHash: await hashPassword(password),
    status: "active",
    role: "user",
    createdAt: new Date().toISOString(),
    lastLoginAt: null
  };
  store.users.push(user);
  store.verificationCodes = store.verificationCodes.filter((item) => item.email !== email);
  const session = createSession(user);
  store.sessions.push(session);
  await writeStore(store);

  res.status(201).json({ token: session.token, user: publicUser(user) });
});

app.post("/api/auth/login", async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || "");
  const store = await readStore();
  const user = store.users.find((item) => item.email === email && item.status !== "deleted");

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    res.status(401).json({ message: "邮箱或密码错误" });
    return;
  }
  if (user.status === "blocked") {
    res.status(403).json({ message: "该账号已被拉黑，请联系客服" });
    return;
  }

  user.lastLoginAt = new Date().toISOString();
  const session = createSession(user);
  store.sessions.push(session);
  await writeStore(store);
  res.json({ token: session.token, user: publicUser(user) });
});

app.get("/api/me", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ message: "未登录" });
    return;
  }
  res.json({ user: publicUser(user) });
});

app.get("/api/my/orders", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) {
    res.status(401).json({ message: "未登录" });
    return;
  }
  const store = await readStore();
  const orders = store.orders.filter((order) => order.userId === user.id).sort(sortByCreatedDesc);
  res.json({ orders });
});

app.post("/api/orders/alipay", async (req, res) => {
  const amount = Number(req.body.totalAmount);
  const productName = String(req.body.productName || "MoneyAI 订阅");
  const planLabel = String(req.body.planLabel || "订阅");
  const outTradeNo = makeOrderNo();
  const user = await getCurrentUser(req);

  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ message: "订单金额无效" });
    return;
  }

  const order = {
    id: makeId("ord"),
    outTradeNo,
    userId: user?.id || null,
    userEmail: user?.email || normalizeEmail(req.body.email) || null,
    productName,
    planLabel,
    amount: Number(amount.toFixed(2)),
    currency: "CNY",
    paymentMethod: "alipay",
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const store = await readStore();
  store.orders.push(order);
  await writeStore(store);

  if (!process.env.ALIPAY_APP_ID || !process.env.ALIPAY_PRIVATE_KEY || !process.env.ALIPAY_PUBLIC_KEY) {
    res.status(500).json({ message: "支付宝配置缺失，请检查 ALIPAY_APP_ID、ALIPAY_PRIVATE_KEY、ALIPAY_PUBLIC_KEY" });
    return;
  }

  try {
    const paymentForm = await alipaySdk.pageExec("alipay.trade.page.pay", {
      bizContent: {
        out_trade_no: outTradeNo,
        product_code: "FAST_INSTANT_TRADE_PAY",
        total_amount: amount.toFixed(2),
        subject: `${productName} - ${planLabel}`,
        body: "MoneyAI 数字订阅订单"
      },
      returnUrl: `${publicBaseUrl}/orders?payment=return&order=${outTradeNo}`,
      notifyUrl: process.env.ALIPAY_NOTIFY_URL || `${publicBaseUrl}/api/alipay/notify`
    });

    res.json({ outTradeNo, paymentForm });
  } catch (error) {
    await updateOrderStatus(outTradeNo, "payment_error", { errorMessage: error.message });
    console.error("支付宝支付发起失败", error);
    res.status(500).json({ message: `支付宝支付发起失败：${error.message}` });
  }
});

app.post("/api/alipay/notify", async (req, res) => {
  try {
    const isValid = alipaySdk.checkNotifySign(req.body);
    if (!isValid) {
      res.send("failure");
      return;
    }
    const paid = ["TRADE_SUCCESS", "TRADE_FINISHED"].includes(req.body.trade_status);
    await updateOrderStatus(req.body.out_trade_no, paid ? "paid" : "processing", {
      alipayTradeNo: req.body.trade_no,
      notifyPayload: req.body
    });
    res.send("success");
  } catch (error) {
    console.error("支付宝异步通知处理失败", error);
    res.send("failure");
  }
});

app.post("/api/admin/login", async (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  if (username !== adminUsername || password !== adminPassword) {
    res.status(401).json({ message: "管理员账号或密码错误" });
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  adminSessions.set(token, {
    username,
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + 12 * 60 * 60 * 1000
  });
  res.json({ token, admin: { username } });
});

app.get("/api/admin/users", requireAdmin, async (req, res) => {
  const store = await readStore();
  res.json({ users: store.users.filter((user) => user.status !== "deleted").map(publicUser).sort(sortByCreatedDesc) });
});

app.post("/api/admin/users", requireAdmin, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || "");
  const status = ["active", "blocked"].includes(req.body.status) ? req.body.status : "active";

  if (!isEmail(email)) {
    res.status(400).json({ message: "请输入有效邮箱" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ message: "密码至少 6 位" });
    return;
  }

  const store = await readStore();
  if (store.users.some((user) => user.email === email && user.status !== "deleted")) {
    res.status(409).json({ message: "邮箱已存在" });
    return;
  }
  const user = {
    id: makeId("usr"),
    email,
    passwordHash: await hashPassword(password),
    status,
    role: "user",
    createdAt: new Date().toISOString(),
    lastLoginAt: null
  };
  store.users.push(user);
  await writeStore(store);
  res.status(201).json({ user: publicUser(user) });
});

app.patch("/api/admin/users/:id", requireAdmin, async (req, res) => {
  const store = await readStore();
  const user = store.users.find((item) => item.id === req.params.id && item.status !== "deleted");
  if (!user) {
    res.status(404).json({ message: "用户不存在" });
    return;
  }

  if (["active", "blocked"].includes(req.body.status)) user.status = req.body.status;
  if (req.body.password) user.passwordHash = await hashPassword(String(req.body.password));
  user.updatedAt = new Date().toISOString();
  await writeStore(store);
  res.json({ user: publicUser(user) });
});

app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
  const store = await readStore();
  const user = store.users.find((item) => item.id === req.params.id && item.status !== "deleted");
  if (!user) {
    res.status(404).json({ message: "用户不存在" });
    return;
  }
  user.status = "deleted";
  user.deletedAt = new Date().toISOString();
  store.sessions = store.sessions.filter((session) => session.userId !== user.id);
  await writeStore(store);
  res.json({ ok: true });
});

app.get("/api/admin/orders", requireAdmin, async (req, res) => {
  const store = await readStore();
  res.json({ orders: store.orders.sort(sortByCreatedDesc) });
});

app.use(Express.static(path.join(__dirname, "dist")));
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "dist/index.html"));
});

initStore()
  .then(() => {
    app.listen(port, () => {
      console.log(`MoneyAI server running at ${publicBaseUrl}`);
    });
  })
  .catch((error) => {
    console.error("MoneyAI server failed to start", error);
    process.exit(1);
  });

async function sendVerificationEmail(email, code) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) throw new Error("SMTP 配置缺失");
  await mailer.sendMail({
    from: process.env.SMTP_FROM || `"MoneyAI" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "MoneyAI 注册验证码",
    text: `你的 MoneyAI 注册验证码是：${code}。验证码 10 分钟内有效。`,
    html: `<p>你的 MoneyAI 注册验证码是：</p><p style="font-size:24px;font-weight:700;letter-spacing:4px;">${code}</p><p>验证码 10 分钟内有效。如非本人操作，请忽略此邮件。</p>`
  });
}

async function getCurrentUser(req) {
  const token = bearerToken(req);
  if (!token) return null;
  const store = await readStore();
  const session = store.sessions.find((item) => item.token === token && new Date(item.expiresAt).getTime() > Date.now());
  if (!session) return null;
  return store.users.find((user) => user.id === session.userId && user.status === "active") || null;
}

function requireAdmin(req, res, next) {
  const session = adminSessions.get(bearerToken(req));
  if (!session || session.expiresAt < Date.now()) {
    res.status(401).json({ message: "后台登录已失效，请重新登录" });
    return;
  }
  next();
}

async function initStore() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(storePath);
  } catch {
    await writeStore({ users: [], sessions: [], verificationCodes: [], orders: [] });
  }
}

async function readStore() {
  await initStore();
  const raw = await fs.readFile(storePath, "utf8");
  const store = JSON.parse(raw || "{}");
  return {
    users: Array.isArray(store.users) ? store.users : [],
    sessions: Array.isArray(store.sessions) ? store.sessions : [],
    verificationCodes: Array.isArray(store.verificationCodes) ? store.verificationCodes : [],
    orders: Array.isArray(store.orders) ? store.orders : []
  };
}

async function writeStore(store) {
  await fs.mkdir(dataDir, { recursive: true });
  const safeStore = {
    users: store.users || [],
    sessions: store.sessions || [],
    verificationCodes: store.verificationCodes || [],
    orders: store.orders || []
  };
  await fs.writeFile(storePath, `${JSON.stringify(safeStore, null, 2)}\n`, "utf8");
}

async function updateOrderStatus(outTradeNo, status, patch = {}) {
  const store = await readStore();
  const order = store.orders.find((item) => item.outTradeNo === outTradeNo);
  if (!order) return;
  Object.assign(order, patch, { status, updatedAt: new Date().toISOString() });
  await writeStore(store);
}

function createSession(user) {
  return {
    token: crypto.randomBytes(32).toString("hex"),
    userId: user.id,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  };
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await scryptAsync(password, salt, 64);
  return `${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(password, passwordHash) {
  if (!passwordHash || !passwordHash.includes(":")) return false;
  const [salt, hash] = passwordHash.split(":");
  const derived = await scryptAsync(password, salt, 64);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), derived);
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    status: user.status,
    role: user.role,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt || null
  };
}

function bearerToken(req) {
  const value = req.get("Authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}

function makeVerificationCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function hashOneTimeValue(value) {
  return crypto.createHash("sha256").update(`${process.env.SESSION_SECRET || "moneyai"}:${value}`).digest("hex");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function makeOrderNo() {
  const timestamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `MAI${timestamp}${random}`;
}

function makeId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function sortByCreatedDesc(a, b) {
  return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
}
