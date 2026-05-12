const path = require("node:path");
const fsSync = require("node:fs");
const fs = require("node:fs/promises");
const crypto = require("node:crypto");
const { promisify } = require("node:util");
const Express = require("express");
const nodemailer = require("nodemailer");
const { AlipaySdk } = require("alipay-sdk");
const dotenv = require("dotenv");

// 加载环境变量
dotenv.config();

const scryptAsync = promisify(crypto.scrypt);
const app = new Express();
const port = process.env.PORT || 3000;
const publicBaseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${port}`;
const dataDir = path.join(__dirname, "data");
const logDir = path.join(__dirname, "logs");
const serverLogPath = path.join(logDir, "server.log");
const errorLogPath = path.join(logDir, "error.log");
const storePath = path.join(dataDir, "store.json");
const catalogDataPath = path.join(dataDir, "catalog-data.json");
const adminUsername = process.env.ADMIN_USERNAME || "wwlsm";
const adminPassword = process.env.ADMIN_PASSWORD || "Zl161829@@";
const adminSessions = new Map();
const registerCodeCooldownMs = 300 * 1000;
const logger = {
  info: (event, meta) => writeLog("info", event, meta),
  warn: (event, meta) => writeLog("warn", event, meta),
  error: (event, meta) => writeLog("error", event, meta)
};

ensureLogDir();
logger.info("server.boot", {
  port,
  publicBaseUrl,
  nodeEnv: process.env.NODE_ENV || "development",
  smtpConfigured: Boolean(process.env.SMTP_USER && process.env.SMTP_PASS),
  sessionKeyConfigured: Boolean(process.env.SESSION_SECRET),
  logFile: serverLogPath
});

app.use((req, res, next) => {
  req.requestId = makeId("req");
  next();
});
app.use(Express.json());
app.use(Express.urlencoded({ extended: true }));
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});
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
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    logger.info("http.request", {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      ip: req.ip,
      userAgent: req.get("User-Agent")
    });
  });
  next();
});

// 支付宝配置诊断与初始化
const alipayConfig = {
  appId: process.env.ALIPAY_APP_ID,
  privateKey: !!process.env.ALIPAY_PRIVATE_KEY, // 仅打印是否存在，保护隐私
  alipayPublicKey: !!process.env.ALIPAY_PUBLIC_KEY,
  gateway: process.env.ALIPAY_GATEWAY
};

let alipaySdk = null;
if (alipayConfig.appId && process.env.ALIPAY_PRIVATE_KEY && process.env.ALIPAY_PUBLIC_KEY) {
  try {
    alipaySdk = new AlipaySdk({
      appId: alipayConfig.appId,
      privateKey: process.env.ALIPAY_PRIVATE_KEY,
      alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY,
      gateway: alipayConfig.gateway || "https://openapi.alipay.com/gateway.do"
    });
    logger.info("alipay.init.success", { appId: maskValue(alipayConfig.appId), gateway: alipayConfig.gateway || "default" });
  } catch (error) {
    logger.error("alipay.init.failed", { error });
  }
} else {
  logger.warn("alipay.init.skipped", {
    appIdConfigured: Boolean(alipayConfig.appId),
    privateKeyConfigured: alipayConfig.privateKey,
    publicKeyConfigured: alipayConfig.alipayPublicKey,
    gatewayConfigured: Boolean(alipayConfig.gateway)
  });
}

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
  res.json({ ok: true, service: "MoneyAI API", alipay: !!alipaySdk });
});

app.get("/api/catalog", async (req, res) => {
  try {
    const catalog = await readCatalogData();
    logger.info("catalog.read.success", {
      requestId: req.requestId,
      productCount: catalog.products.length,
      syncedAt: catalog.syncMeta?.syncedAt || null,
      source: "data/catalog-data.json"
    });
    res.json(catalog);
  } catch (error) {
    logger.error("catalog.read.failed", { requestId: req.requestId, path: catalogDataPath, error });
    res.status(500).json({ message: "商品数据读取失败，请先执行 npm run sync:products", requestId: req.requestId });
  }
});

app.post("/api/auth/send-code", async (req, res) => {
  const email = normalizeEmail(req.body.email);
  logger.info("auth.send_code.received", {
    requestId: req.requestId,
    email: maskEmailForLog(email),
    smtpConfigured: Boolean(process.env.SMTP_USER && process.env.SMTP_PASS)
  });
  if (!isEmail(email)) {
    logger.warn("auth.send_code.rejected", { requestId: req.requestId, reason: "invalid_email", email: maskEmailForLog(email) });
    res.status(400).json({ message: "请输入有效邮箱" });
    return;
  }

  const store = await readStore();
  const existing = store.users.find((user) => user.email === email);
  if (existing && existing.status !== "deleted") {
    logger.warn("auth.send_code.rejected", { requestId: req.requestId, reason: "email_exists", email: maskEmailForLog(email) });
    res.status(409).json({ message: "该邮箱已经注册，请直接登录" });
    return;
  }

  const recentCode = store.verificationCodes.find((item) => item.email === email);
  const recentCreatedAt = Date.parse(recentCode?.createdAt || "");
  if (Number.isFinite(recentCreatedAt)) {
    const retryAfter = Math.ceil((registerCodeCooldownMs - (Date.now() - recentCreatedAt)) / 1000);
    if (retryAfter > 0) {
      logger.warn("auth.send_code.rejected", {
        requestId: req.requestId,
        reason: "cooldown",
        email: maskEmailForLog(email),
        retryAfter
      });
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({ message: `验证码发送太频繁，请 ${retryAfter} 秒后再试`, retryAfter });
      return;
    }
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
    logger.info("auth.send_code.sent", {
      requestId: req.requestId,
      email: maskEmailForLog(email),
      expiresAt
    });
    res.json({ ok: true, message: "验证码已发送，请查看邮箱" });
  } catch (error) {
    store.verificationCodes = store.verificationCodes.filter((item) => item.email !== email);
    await writeStore(store);
    logger.error("auth.send_code.email_failed", { requestId: req.requestId, email: maskEmailForLog(email), error });
    res.status(500).json({ message: "验证码邮件发送失败，请检查 SMTP 配置或稍后重试" });
  }
});

app.post("/api/auth/register", async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || "");
  const code = String(req.body.code || "").trim();

  logger.info("auth.register.received", {
    requestId: req.requestId,
    email: maskEmailForLog(email),
    passwordLength: password.length,
    codeLength: code.length
  });

  if (!isEmail(email)) {
    logger.warn("auth.register.rejected", { requestId: req.requestId, reason: "invalid_email", email: maskEmailForLog(email) });
    res.status(400).json({ message: "请输入有效邮箱" });
    return;
  }
  if (password.length < 6) {
    logger.warn("auth.register.rejected", { requestId: req.requestId, reason: "short_password", email: maskEmailForLog(email), passwordLength: password.length });
    res.status(400).json({ message: "密码至少 6 位" });
    return;
  }
  if (!/^\d{6}$/.test(code)) {
    logger.warn("auth.register.rejected", { requestId: req.requestId, reason: "invalid_code_format", email: maskEmailForLog(email), codeLength: code.length });
    res.status(400).json({ message: "请输入 6 位邮箱验证码" });
    return;
  }

  const store = await readStore();
  const existing = store.users.find((user) => user.email === email && user.status !== "deleted");
  if (existing) {
    logger.warn("auth.register.rejected", { requestId: req.requestId, reason: "email_exists", email: maskEmailForLog(email) });
    res.status(409).json({ message: "该邮箱已经注册，请直接登录" });
    return;
  }

  const codeRecord = store.verificationCodes.find((item) => item.email === email);
  if (!codeRecord) {
    logger.warn("auth.register.rejected", { requestId: req.requestId, reason: "code_missing", email: maskEmailForLog(email) });
    res.status(400).json({ message: "验证码无效或已过期" });
    return;
  }

  const isExpired = new Date(codeRecord.expiresAt).getTime() < Date.now();
  if (isExpired) {
    logger.warn("auth.register.rejected", {
      requestId: req.requestId,
      reason: "code_expired",
      email: maskEmailForLog(email),
      expiresAt: codeRecord.expiresAt,
      now: new Date().toISOString()
    });
    res.status(400).json({ message: "验证码无效或已过期" });
    return;
  }

  const codeHash = hashOneTimeValue(code);
  if (codeRecord.codeHash !== codeHash) {
    logger.warn("auth.register.rejected", { requestId: req.requestId, reason: "code_mismatch", email: maskEmailForLog(email) });
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

  logger.info("auth.register.success", { requestId: req.requestId, email: maskEmailForLog(email), userId: user.id });
  res.status(201).json({ token: session.token, user: publicUser(user) });
});

app.post("/api/auth/login", async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || "");
  logger.info("auth.login.received", { requestId: req.requestId, email: maskEmailForLog(email), passwordLength: password.length });
  const store = await readStore();
  const user = store.users.find((item) => item.email === email && item.status !== "deleted");

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    logger.warn("auth.login.rejected", { requestId: req.requestId, reason: "invalid_credentials", email: maskEmailForLog(email) });
    res.status(401).json({ message: "邮箱或密码错误" });
    return;
  }

  if (user.status === "blocked") {
    logger.warn("auth.login.rejected", { requestId: req.requestId, reason: "blocked", email: maskEmailForLog(email), userId: user.id });
    res.status(403).json({ message: "该账号已被拉黑，请联系客服" });
    return;
  }

  const session = createSession(user);
  store.sessions.push(session);
  user.lastLoginAt = new Date().toISOString();
  await writeStore(store);

  logger.info("auth.login.success", { requestId: req.requestId, email: maskEmailForLog(email), userId: user.id });
  res.json({ token: session.token, user: publicUser(user) });
});

app.get("/api/my/orders", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) {
    logger.warn("orders.my.rejected", { requestId: req.requestId, reason: "unauthorized" });
    res.status(401).json({ message: "请先登录" });
    return;
  }
  const store = await readStore();
  const orders = store.orders.filter((item) => item.userEmail === user.email);
  logger.info("orders.my.success", { requestId: req.requestId, email: maskEmailForLog(user.email), count: orders.length });
  res.json({ orders: orders.sort(sortByCreatedDesc).map(publicOrder) });
});

app.post("/api/orders/alipay", async (req, res) => {
  const user = await getCurrentUser(req);
  const productName = String(req.body.productName || "");
  const planLabel = String(req.body.planLabel || "");
  const amount = Number(req.body.totalAmount || 0);

  if (!user) {
    logger.warn("orders.alipay.rejected", { requestId: req.requestId, reason: "unauthorized" });
    res.status(401).json({ message: "请先登录后再支付" });
    return;
  }
  if (amount <= 0) {
    logger.warn("orders.alipay.rejected", { requestId: req.requestId, reason: "invalid_amount", amount });
    res.status(400).json({ message: "订单金额无效" });
    return;
  }

  const outTradeNo = makeOrderNo();
  const order = {
    outTradeNo,
    userId: user.id,
    userEmail: user.email,
    productName,
    productSlug: String(req.body.productSlug || ""),
    productCategory: String(req.body.productCategory || ""),
    planLabel,
    amount: Number(amount.toFixed(2)),
    currency: "CNY",
    paymentMethod: "alipay",
    status: "pending",
    paidAt: null,
    deliveryStatus: "waiting_payment",
    deliveryMessage: "等待支付完成后进入交付流程。",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const store = await readStore();
  store.orders.push(order);
  await writeStore(store);
  logger.info("orders.alipay.created", {
    requestId: req.requestId,
    outTradeNo,
    userId: user.id,
    email: maskEmailForLog(user.email),
    productName,
    planLabel,
    amount: order.amount
  });

  if (!alipaySdk) {
    res.status(500).json({ message: "支付宝功能未配置或初始化失败，请检查环境变量" });
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
    logger.error("alipay.payment.failed", { requestId: req.requestId, outTradeNo, error });
    res.status(500).json({ message: `支付宝支付发起失败：${error.message}` });
  }
});

app.post("/api/orders/alipay/return", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) {
    logger.warn("orders.alipay_return.rejected", { requestId: req.requestId, reason: "unauthorized" });
    res.status(401).json({ message: "请先登录后再确认订单" });
    return;
  }

  const outTradeNo = String(req.body.outTradeNo || req.body.order || "").trim();
  const alipayTradeNo = String(req.body.tradeNo || "").trim();
  const totalAmount = Number(req.body.totalAmount || 0);
  const returnPayload = req.body.returnPayload && typeof req.body.returnPayload === "object" ? req.body.returnPayload : {};
  if (!outTradeNo) {
    logger.warn("orders.alipay_return.rejected", { requestId: req.requestId, reason: "missing_out_trade_no" });
    res.status(400).json({ message: "缺少支付宝订单号" });
    return;
  }

  const store = await readStore();
  const order = store.orders.find((item) => item.outTradeNo === outTradeNo);
  if (!order || order.userEmail !== user.email) {
    logger.warn("orders.alipay_return.rejected", {
      requestId: req.requestId,
      reason: "order_not_found",
      outTradeNo,
      email: maskEmailForLog(user.email)
    });
    res.status(404).json({ message: "订单不存在或不属于当前账号" });
    return;
  }
  if (Number.isFinite(totalAmount) && totalAmount > 0 && Math.abs(Number(order.amount) - totalAmount) >= 0.01) {
    logger.warn("orders.alipay_return.rejected", {
      requestId: req.requestId,
      reason: "amount_mismatch",
      outTradeNo,
      expectedAmount: order.amount,
      totalAmount
    });
    res.status(400).json({ message: "支付宝返回金额与订单金额不一致" });
    return;
  }
  const returnSignVerified = verifyAlipayReturnPayload(returnPayload);
  if (!returnSignVerified) {
    const queryResult = await queryAlipayTrade(outTradeNo, alipayTradeNo);
    const queryPaid = ["TRADE_SUCCESS", "TRADE_FINISHED"].includes(queryResult?.tradeStatus);
    const queryAmount = Number(queryResult?.totalAmount || 0);
    if (!queryPaid || (Number.isFinite(queryAmount) && queryAmount > 0 && Math.abs(Number(order.amount) - queryAmount) >= 0.01)) {
      logger.warn("orders.alipay_return.rejected", {
        requestId: req.requestId,
        reason: "return_unverified_and_trade_query_failed",
        outTradeNo,
        returnSignVerified,
        queryTradeStatus: queryResult?.tradeStatus || null,
        queryTotalAmount: queryResult?.totalAmount || null
      });
      res.status(400).json({ message: "支付宝支付结果确认失败，请稍后刷新订单或联系客服" });
      return;
    }
    logger.info("orders.alipay_return.query_confirmed", {
      requestId: req.requestId,
      outTradeNo,
      queryTradeStatus: queryResult.tradeStatus,
      queryTotalAmount: queryResult.totalAmount
    });
  }

  Object.assign(order, {
    status: "paid",
    alipayTradeNo: alipayTradeNo || order.alipayTradeNo || null,
    returnPayload,
    paidAt: order.paidAt || new Date().toISOString(),
    deliveryStatus: order.deliveryStatus && order.deliveryStatus !== "waiting_payment" ? order.deliveryStatus : "pending_delivery",
    deliveryMessage: order.deliveryMessage && order.deliveryMessage !== "等待支付完成后进入交付流程。"
      ? order.deliveryMessage
      : "支付已确认，商品交付正在处理中。请留意订单状态或联系客服获取凭证。",
    updatedAt: new Date().toISOString()
  });
  await writeStore(store);
  logger.info("orders.alipay_return.confirmed", {
    requestId: req.requestId,
    outTradeNo,
    email: maskEmailForLog(user.email),
    alipayTradeNo: alipayTradeNo || null,
    returnSignVerified
  });
  res.json({ order: publicOrder(order) });
});

app.post("/api/alipay/notify", async (req, res) => {
  try {
    if (!alipaySdk) {
      logger.warn("alipay.notify.rejected", { requestId: req.requestId, reason: "sdk_not_initialized" });
      res.send("failure");
      return;
    }
    const isValid = alipaySdk.checkNotifySign(req.body);
    if (!isValid) {
      res.send("failure");
      return;
    }
    const paid = ["TRADE_SUCCESS", "TRADE_FINISHED"].includes(req.body.trade_status);
    await updateOrderStatus(req.body.out_trade_no, paid ? "paid" : "processing", {
      alipayTradeNo: req.body.trade_no,
      notifyPayload: req.body,
      ...(paid
        ? {
            paidAt: new Date().toISOString(),
            deliveryStatus: "pending_delivery",
            deliveryMessage: "支付已确认，商品交付正在处理中。请留意订单状态或联系客服获取凭证。"
          }
        : {})
    });
    res.send("success");
  } catch (error) {
    logger.error("alipay.notify.failed", { requestId: req.requestId, error });
    res.send("failure");
  }
});

app.post("/api/admin/login", async (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  logger.info("admin.login.received", { requestId: req.requestId, username, passwordLength: password.length });

  if (username === adminUsername && password === adminPassword) {
    const token = crypto.randomBytes(32).toString("hex");
    adminSessions.set(token, { username, expiresAt: Date.now() + 3600 * 1000 });
    logger.info("admin.login.success", { requestId: req.requestId, username });
    res.json({ token });
  } else {
    logger.warn("admin.login.rejected", { requestId: req.requestId, username });
    res.status(401).json({ message: "管理员账号或密码错误" });
  }
});

app.get("/api/admin/users", requireAdmin, async (req, res) => {
  const store = await readStore();
  res.json({ users: store.users.filter((item) => item.status !== "deleted").sort(sortByCreatedDesc) });
});

app.post("/api/admin/users", requireAdmin, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || "");
  if (!isEmail(email) || password.length < 6) {
    res.status(400).json({ message: "无效的邮箱或密码" });
    return;
  }
  const store = await readStore();
  if (store.users.find((item) => item.email === email && item.status !== "deleted")) {
    res.status(409).json({ message: "邮箱已存在" });
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
  res.json({ orders: store.orders.sort(sortByCreatedDesc).map(publicOrder) });
});

app.use("/api", (req, res) => {
  logger.warn("api.not_found", { requestId: req.requestId, method: req.method, path: req.originalUrl });
  res.status(404).json({ message: "接口不存在", requestId: req.requestId });
});

app.use(Express.static(path.join(__dirname, "dist")));
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "dist/index.html"));
});

app.use((error, req, res, next) => {
  logger.error("request.unhandled_error", {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    error
  });
  if (res.headersSent) {
    next(error);
    return;
  }
  res.status(error.status || error.statusCode || 500).json({ message: "服务器内部错误", requestId: req.requestId });
});

initStore()
  .then(() => {
    app.listen(port, () => {
      logger.info("server.listen", { port, publicBaseUrl });
    });
  })
  .catch((error) => {
    logger.error("server.start_failed", { error });
    process.exit(1);
  });

process.on("unhandledRejection", (error) => {
  logger.error("process.unhandled_rejection", { error });
});

process.on("uncaughtException", (error) => {
  logger.error("process.uncaught_exception", { error });
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

async function readCatalogData() {
  const raw = await fs.readFile(catalogDataPath, "utf8");
  const catalog = JSON.parse(raw || "{}");
  if (!catalog || !Array.isArray(catalog.products)) {
    throw new Error("data/catalog-data.json missing products array");
  }
  return {
    syncMeta: catalog.syncMeta && typeof catalog.syncMeta === "object" ? catalog.syncMeta : null,
    products: catalog.products
  };
}

async function updateOrderStatus(outTradeNo, status, patch = {}) {
  const store = await readStore();
  const order = store.orders.find((item) => item.outTradeNo === outTradeNo);
  if (!order) return;
  Object.assign(order, patch, { status, updatedAt: new Date().toISOString() });
  await writeStore(store);
}

function verifyAlipayReturnPayload(payload) {
  if (!alipaySdk || !payload?.sign) return false;
  try {
    return alipaySdk.checkNotifySign(payload) || alipaySdk.checkNotifySignV2(payload);
  } catch {
    return false;
  }
}

async function queryAlipayTrade(outTradeNo, tradeNo = "") {
  if (!alipaySdk) return null;
  try {
    const result = await alipaySdk.exec(
      "alipay.trade.query",
      {
        bizContent: {
          out_trade_no: outTradeNo,
          ...(tradeNo ? { trade_no: tradeNo } : {})
        }
      },
      { validateSign: false }
    );
    return result;
  } catch (error) {
    logger.error("alipay.trade_query.failed", { outTradeNo, error });
    return null;
  }
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

function publicOrder(order) {
  const status = order.status || "pending";
  return {
    ...order,
    productSlug: order.productSlug || productSlug(order.productName),
    productCategory: order.productCategory || "",
    paidAt: order.paidAt || (status === "paid" ? order.updatedAt || null : null),
    deliveryStatus: order.deliveryStatus || (status === "paid" ? "pending_delivery" : "waiting_payment"),
    deliveryMessage:
      order.deliveryMessage ||
      (status === "paid"
        ? "支付已确认，商品交付正在处理中。请留意订单状态或联系客服获取凭证。"
        : "等待支付完成后进入交付流程。")
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

function productSlug(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\+/g, "plus")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function ensureLogDir() {
  fsSync.mkdirSync(logDir, { recursive: true });
}

function writeLog(level, event, meta = {}) {
  const entry = {
    time: new Date().toISOString(),
    level,
    event,
    meta: sanitizeLogMeta(meta)
  };
  const line = JSON.stringify(entry);
  const output = `${line}\n`;
  const stream = level === "error" ? process.stderr : process.stdout;
  stream.write(output);
  try {
    ensureLogDir();
    fsSync.appendFileSync(serverLogPath, output, "utf8");
    if (level === "error") fsSync.appendFileSync(errorLogPath, output, "utf8");
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({ time: new Date().toISOString(), level: "error", event: "logger.write_failed", meta: { message: error.message } })}\n`
    );
  }
}

function sanitizeLogMeta(value, key = "") {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack
    };
  }
  if (Array.isArray(value)) return value.map((item) => sanitizeLogMeta(item, key));
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([itemKey, itemValue]) => {
      if (isSensitiveLogKey(itemKey)) return [itemKey, "[REDACTED]"];
      return [itemKey, sanitizeLogMeta(itemValue, itemKey)];
    })
  );
}

function isSensitiveLogKey(key) {
  const normalized = key.toLowerCase();
  if (normalized.endsWith("length") || normalized.endsWith("configured")) return false;
  return (
    normalized === "code" ||
    /password|pass|secret|token|authorization|codehash|private|publickey|signature/i.test(key)
  );
}

function maskEmailForLog(email) {
  if (!email || !email.includes("@")) return email || "";
  const [name, domain] = email.split("@");
  const visible = name.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(1, name.length - visible.length))}@${domain}`;
}

function maskValue(value) {
  const text = String(value || "");
  if (text.length <= 6) return text ? "***" : "";
  return `${text.slice(0, 3)}***${text.slice(-3)}`;
}

function sortByCreatedDesc(a, b) {
  return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
}
