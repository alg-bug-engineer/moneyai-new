import "dotenv/config";
import { rename, writeFile } from "node:fs/promises";
import {
  DEFAULT_PRIORITY_ACCOUNT_ROUTES,
  GAMESGO_PRODUCTS_URL,
  discoverAccountRoutes,
  fetchAccountListingsForRoute,
  fetchProductDetails,
  fetchSourceProducts,
  fetchUsdCnyRate,
  readPositiveNumber,
  uniqueBy
} from "./gamsgo-source.mjs";

const OUTPUT_FILE = new URL("../src/catalog-data.js", import.meta.url);
const TEMP_OUTPUT_FILE = new URL("../src/catalog-data.js.tmp", import.meta.url);
const MARKUP_RATE = Number(process.env.PRICE_MARKUP_RATE || 0.1);
const MAX_PRODUCTS = readPositiveNumber(process.env.SYNC_PRODUCT_LIMIT, 600);
const ACCOUNT_ROUTE_LIMIT = readPositiveNumber(process.env.SYNC_ACCOUNT_ROUTE_LIMIT, 40);
const ACCOUNT_LISTING_LIMIT = readPositiveNumber(process.env.SYNC_ACCOUNT_LISTING_LIMIT, MAX_PRODUCTS);
const ACCOUNT_LISTINGS_PER_ROUTE = readPositiveNumber(process.env.SYNC_ACCOUNT_LISTINGS_PER_ROUTE, 500);
const ACCOUNT_PAGE_LIMIT = readPositiveNumber(process.env.SYNC_ACCOUNT_PAGE_LIMIT, 60);
const ACCOUNT_PAGE_SIZE = readPositiveNumber(process.env.SYNC_ACCOUNT_PAGE_SIZE, 18);

const colors = ["#0f766e", "#e11d48", "#2563eb", "#7c2d12", "#111827", "#6d28d9", "#1d4ed8", "#b45309"];

async function main() {
  const [sourcePayload, exchangeRate, accountRoutes] = await Promise.all([
    fetchSourceProducts(),
    fetchUsdCnyRate(),
    discoverAccountRoutes({ routeLimit: ACCOUNT_ROUTE_LIMIT, priorityRoutes: DEFAULT_PRIORITY_ACCOUNT_ROUTES })
  ]);

  const rawProducts = sourcePayload.data?.list || [];
  if (!rawProducts.length) {
    throw new Error("原站商品接口没有返回商品列表，已停止写入。");
  }

  const syncedAt = new Date().toISOString();
  const legacyProducts = await buildLegacyProducts(rawProducts, exchangeRate, syncedAt);
  const accountResult = await buildAccountProducts(accountRoutes, exchangeRate, syncedAt);

  const products = finalizeProducts([...accountResult.products, ...legacyProducts]).slice(0, MAX_PRODUCTS);
  if (!products.length) throw new Error("同步后没有可用商品，已停止写入。");

  const meta = {
    source: GAMESGO_PRODUCTS_URL,
    accountSource: "https://mapi.gamsgo2.com/index/planList",
    accountSitemap: "https://www.gamsgo.com/accounts_zh.xml",
    syncedAt,
    exchangeRate,
    markupRate: MARKUP_RATE,
    productCount: products.length,
    sourceStatistics: sourcePayload.data?.statistics || null,
    sourceBreakdown: {
      legacySpuCount: legacyProducts.length,
      accountListingCount: accountResult.products.length,
      accountRoutesScanned: accountResult.routesScanned,
      accountRoutesWithListings: accountResult.routesWithListings,
      accountListingsAvailable: accountResult.availableListings
    },
    warning: accountResult.errors.length ? accountResult.errors.slice(0, 10).join("; ") : null
  };

  const file = `export const syncMeta = ${JSON.stringify(meta, null, 2)};\n\nexport const products = ${JSON.stringify(products, null, 2)};\n`;
  await writeFile(TEMP_OUTPUT_FILE, file, "utf8");
  await rename(TEMP_OUTPUT_FILE, OUTPUT_FILE);
  console.log(
    `Synced ${products.length} products (${accountResult.products.length} account listings + ${legacyProducts.length} SPU). USD/CNY=${exchangeRate}, markup=${MARKUP_RATE * 100}%`
  );
}

async function buildLegacyProducts(rawProducts, exchangeRate, syncedAt) {
  const selectedProducts = rawProducts.slice(0, MAX_PRODUCTS);
  const detailMap = await fetchProductDetails(selectedProducts);
  return selectedProducts
    .map((item, index) => normalizeLegacyProduct(item, index, exchangeRate, syncedAt, detailMap.get(item.id)))
    .filter(Boolean);
}

async function buildAccountProducts(routes, exchangeRate, syncedAt) {
  const products = [];
  const errors = [];
  let routesScanned = 0;
  let routesWithListings = 0;
  let availableListings = 0;

  for (const route of routes) {
    if (products.length >= ACCOUNT_LISTING_LIMIT) break;
    routesScanned += 1;

    try {
      const result = await fetchAccountListingsForRoute(route, {
        perRouteLimit: Math.min(ACCOUNT_LISTINGS_PER_ROUTE, ACCOUNT_LISTING_LIMIT - products.length),
        pageSize: ACCOUNT_PAGE_SIZE,
        pageLimit: ACCOUNT_PAGE_LIMIT
      });
      if (!result.category || !result.list.length) continue;

      routesWithListings += 1;
      availableListings += result.total || result.list.length;
      result.list.forEach((listing, index) => {
        const normalized = normalizeAccountListing(result.category, listing, products.length + index, exchangeRate, syncedAt);
        if (normalized) products.push(normalized);
      });
    } catch (error) {
      errors.push(`${route}: ${error.message}`);
    }
  }

  return {
    products: uniqueBy(products, (product) => product.id),
    errors,
    routesScanned,
    routesWithListings,
    availableListings
  };
}

function normalizeLegacyProduct(item, index, exchangeRate, syncedAt, detail) {
  const usd = Number(item.min_price);
  if (!Number.isFinite(usd) || usd <= 0) return null;

  const name = item.type_name || item.type_name0 || `Product ${item.id}`;
  const category = inferCategory(name, item.description || []);
  const stockStatus = item.lock_status || item.vip_status === 2 ? "缺货" : "有库存";
  const price = toCnyPrice(usd, exchangeRate);
  const introduction = sanitizeCopy([...(detail?.introduction || []), ...(item.description || [])].filter(Boolean));
  const howItWorks = sanitizeCopy((detail?.how_it_works || []).filter(Boolean));
  const tags = introduction.slice(0, 2);

  return {
    id: `spu-${item.id}`,
    sourceKind: "spu",
    sourceRoute: item.detail_route || "",
    sourceUrl: item.detail_route ? `https://www.gamsgo.com/zh/details/${item.detail_route}` : "",
    name,
    category,
    badge: item.rank <= 10 ? "热门" : stockStatus === "缺货" ? "缺货" : "",
    price,
    unit: item.average_price_unit === 2 ? "天" : "月",
    color: colors[index % colors.length],
    icon: makeIcon(name),
    sold: makeRecentOrder(name, index),
    tags: tags.length ? tags : ["高质量数字订阅服务", "同步原站价格并按人民币展示"],
    introduction: introduction.length ? introduction : ["高质量数字订阅服务", "同步原站价格并按人民币展示"],
    howItWorks: howItWorks.length ? howItWorks : ["选择订阅周期并完成支付", "在订单中心查看交付信息", "遇到问题可联系人工客服"],
    supportDevice: detail?.support_device || [],
    plan: detail?.plan || "",
    originalPriceUsd: Number(detail?.original_price) || null,
    ribbon: item.rank <= 5 ? "热卖" : "",
    stockStatus,
    sourcePriceUsd: usd,
    exchangeRate,
    markupRate: MARKUP_RATE,
    image: item.thumb_img || item.image || "",
    updatedAt: syncedAt
  };
}

function normalizeAccountListing(category, listing, index, exchangeRate, syncedAt) {
  const usd = Number(listing.total_price);
  if (!Number.isFinite(usd) || usd <= 0) return null;

  const serviceName = category.type_name || category.name || listing.type_name || "账号";
  const attribute = cleanText(listing.attribute_name || "");
  const title = cleanText(listing.title || `${serviceName} ${attribute}`);
  const merchant = cleanText(listing.merchant_name || "");
  const name = buildListingName(serviceName, attribute, title, merchant, listing.type_plan_id);
  const categoryName = inferCategory(`${serviceName} ${title}`, [attribute]);
  const deliveryText = listing.delivery_type === 1 ? "立即发货" : listing.shipping_time_name ? `${listing.shipping_time_name}发货` : "卖家发货";
  const warrantyText = listing.warranty_period_status === 1 && listing.warranty_period ? `${listing.warranty_period}保修` : "平台保障";

  return {
    id: `account-${listing.type_plan_id}`,
    sourceKind: "account-listing",
    sourceRoute: category.list_route || "",
    sourceUrl: `https://www.gamsgo.com/zh/accounts/${category.list_route}`,
    sourceListingUrl: `https://www.gamsgo.com/zh/shop/${listing.type_plan_id}`,
    name,
    category: categoryName,
    badge: deliveryText,
    price: toCnyPrice(usd, exchangeRate),
    unit: inferUnit(attribute || title),
    color: colors[index % colors.length],
    icon: makeIcon(serviceName),
    sold: makeRecentOrder(serviceName, index),
    tags: [compactText(title, 68), `${merchant || "认证卖家"} · ${listing.merchant_comment_rate || "暂无评分"}`].filter(Boolean),
    introduction: [
      compactText(title, 120),
      attribute ? `套餐：${attribute}` : "",
      merchant ? `卖家：${merchant}，好评率 ${listing.merchant_comment_rate || "暂无评分"}，评价数 ${listing.merchant_comment_num || 0}` : "",
      `${deliveryText}，${warrantyText}`
    ].filter(Boolean),
    howItWorks: [
      "选择账号市场商品并完成支付",
      deliveryText === "立即发货" ? "付款成功后查看交付凭证" : `卖家承诺${deliveryText}`,
      warrantyText,
      "遇到账号异常可按订单售后规则处理"
    ],
    supportDevice: [],
    plan: attribute,
    originalPriceUsd: null,
    ribbon: index < 8 ? "市场" : "",
    stockStatus: "有库存",
    sourcePriceUsd: usd,
    exchangeRate,
    markupRate: MARKUP_RATE,
    image: listing.type_image || category.type_image || category.thumb_image || "",
    merchantName: merchant,
    merchantRate: listing.merchant_comment_rate || "",
    warrantyPeriod: listing.warranty_period || "",
    shippingTime: listing.shipping_time_name || "",
    updatedAt: syncedAt
  };
}

function finalizeProducts(products) {
  const seenSlugs = new Map();
  return products.map((product) => {
    const slug = productSlug(product.name);
    const count = seenSlugs.get(slug) || 0;
    seenSlugs.set(slug, count + 1);
    if (count === 0) return product;
    return { ...product, name: `${product.name} ${shortId(product.id)}` };
  });
}

function buildListingName(serviceName, attribute, title, merchant, id) {
  const primary = attribute && attribute.length <= 48 ? `${serviceName} ${attribute}` : `${serviceName} ${compactText(title, 44)}`;
  const suffix = merchant ? ` · ${compactText(merchant, 18)}` : ` · ${shortId(id)}`;
  return compactText(`${primary}${suffix}`, 86);
}

function toCnyPrice(usd, exchangeRate) {
  return Math.ceil(usd * exchangeRate * (1 + MARKUP_RATE));
}

function inferCategory(name, descriptions) {
  const text = `${name} ${descriptions.join(" ")}`.toLowerCase();
  if (/(chatgpt|gemini|claude|suno|perplexity|runway|dreamina|ai|aippt|cursor|midjourney|sora|grok|kling|luma|manus|poe|elevenlabs|heygen|leonardo)/i.test(text)) return "ai";
  if (/(youtube|netflix|disney|crunchyroll|video|film|capcut|prime|spotify|qobuz|dazn|nba|viki|mubi|plex|shahid|osn|watcha)/i.test(text)) return "video";
  if (/(recharge|充值|top.?up)/i.test(text)) return "recharge";
  if (/(game|playstation|xbox|discord|eaplay|steam)/i.test(text)) return "game";
  if (/(vpn|pdf|updf|software|软件|avica|terabox|notion|figma|github|windows|autodesk|deepl|dropbox|1password|adguard|replit|coursera|linkedin)/i.test(text)) return "software";
  return "market";
}

function inferUnit(text) {
  if (/(年|year|12个月)/i.test(text)) return "年";
  if (/(天|day)/i.test(text)) return "天";
  if (/(月|month)/i.test(text)) return "月";
  return "件";
}

function makeIcon(name) {
  const normalized = name.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return normalized.slice(0, 2) || "GG";
}

function makeRecentOrder(name, index) {
  const prefixes = ["li", "wu", "zh", "mi", "ak", "fr"];
  const minutes = [8, 12, 20, 36, 48, 59][index % 6];
  return `${prefixes[index % prefixes.length]}**${String(index + 7).padStart(2, "0")} 在 ${minutes} 分钟前加入`;
}

function sanitizeCopy(items) {
  return items.map((item) => cleanText(String(item).replace(/GamsGo/gi, "MoneyAI"))).filter(Boolean);
}

function cleanText(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function compactText(value, limit) {
  const text = cleanText(value);
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function productSlug(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\+/g, "plus")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function shortId(id) {
  return String(id || "")
    .replace(/^account-|^spu-/, "")
    .slice(0, 6);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
