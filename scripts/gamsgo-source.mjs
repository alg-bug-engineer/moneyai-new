export const GAMESGO_PRODUCTS_URL = "https://api.gamsgo2.com/index/getSpuList";
export const GAMESGO_DETAIL_URL = "https://api.gamsgo2.com/index/detail";
export const GAMESGO_C2C_API_URL = "https://mapi.gamsgo2.com";
export const GAMESGO_ACCOUNTS_SITEMAP_URL = "https://www.gamsgo.com/accounts_zh.xml";
export const FX_URL = "https://open.er-api.com/v6/latest/USD";

export const DEFAULT_PRIORITY_ACCOUNT_ROUTES = ["claude", "gemini"];

const DEFAULT_HEADERS = {
  "content-type": "application/json",
  origin: "https://www.gamsgo.com",
  referer: "https://www.gamsgo.com/zh",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
};

export function readPositiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

export function uniqueBy(items, selector) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = selector(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

export async function fetchSourceProducts() {
  const payload = await postJson(GAMESGO_PRODUCTS_URL, {
    language: "zh",
    show_currency: "USD"
  });
  if (payload.code !== 0) throw new Error(`原站商品接口失败：${payload.message || payload.code}`);
  return payload;
}

export async function fetchProductDetail(product) {
  try {
    const payload = await postJson(GAMESGO_DETAIL_URL, {
      language: "zh",
      show_currency: "USD",
      type_id: product.id
    });
    return payload.code === 0 ? payload.data : null;
  } catch {
    return null;
  }
}

export async function fetchProductDetails(products) {
  const entries = await Promise.all(products.map(async (product) => [product.id, await fetchProductDetail(product)]));
  return new Map(entries);
}

export async function fetchUsdCnyRate() {
  const response = await fetch(FX_URL);
  if (!response.ok) throw new Error(`汇率接口失败：HTTP ${response.status}`);
  const payload = await response.json();
  const rate = Number(payload.rates?.CNY);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("汇率接口没有返回有效 USD/CNY。");
  return Number(rate.toFixed(4));
}

export async function discoverAccountRoutes({ routeLimit = 40, priorityRoutes = DEFAULT_PRIORITY_ACCOUNT_ROUTES } = {}) {
  const configuredRoutes = parseRouteList(process.env.SYNC_ACCOUNT_ROUTES || "");
  if (configuredRoutes.length) return configuredRoutes.slice(0, routeLimit);

  const response = await fetch(GAMESGO_ACCOUNTS_SITEMAP_URL, {
    headers: { "user-agent": DEFAULT_HEADERS["user-agent"] }
  });
  if (!response.ok) throw new Error(`账号市场 sitemap 获取失败：HTTP ${response.status}`);

  const sitemap = await response.text();
  const sitemapRoutes = [...sitemap.matchAll(/https:\/\/www\.gamsgo\.com\/(?:zh\/)?accounts\/([^<"\s]+)/g)]
    .map((match) => decodeURIComponent(match[1]).replace(/\/$/, ""))
    .filter(Boolean);

  return uniqueBy([...priorityRoutes, ...sitemapRoutes], (route) => route).slice(0, routeLimit);
}

export async function fetchAccountCategory(route) {
  const payload = await postC2cJson("/index/typeCategory", {
    list_route: route
  });
  if (payload.code !== 0) return null;
  return (payload.data || []).find((item) => item?.user_route === "/accounts" && item?.list_view === 1) || null;
}

export async function fetchAccountPlanPage(category, { page = 1, limit = 18, orderBy = 0, explore = [] } = {}) {
  const payload = await postC2cJson("/index/planList", {
    type_category_id: category.type_category_id,
    page,
    limit,
    order_by: orderBy,
    explore
  });
  if (payload.code !== 0) throw new Error(`${category.list_route || category.type_name} planList 失败：${payload.message || payload.code}`);
  return payload.data || null;
}

export async function fetchAccountListingsForRoute(
  route,
  { perRouteLimit = 500, pageSize = 18, pageLimit = 60, orderBy = 0 } = {}
) {
  const category = await fetchAccountCategory(route);
  if (!category) {
    return { route, category: null, total: 0, list: [], pagesFetched: 0, skipped: true };
  }

  const list = [];
  let explore = [];
  let total = 0;
  let page = 1;
  let pagesFetched = 0;

  while (list.length < perRouteLimit && page <= pageLimit) {
    const data = await fetchAccountPlanPage(category, {
      page,
      limit: Math.min(pageSize, perRouteLimit - list.length),
      orderBy,
      explore
    });
    if (!data?.list?.length) break;

    list.push(...data.list);
    total = Number(data.total || total || data.list.length);
    explore = Array.isArray(data.explore) ? data.explore : explore;
    pagesFetched += 1;

    if (list.length >= total) break;
    page += 1;
  }

  return { route, category, total, list, pagesFetched, skipped: false };
}

export function parseRouteList(value) {
  return value
    .split(",")
    .map((route) => route.trim().replace(/^\/+|\/+$/g, "").replace(/^zh\/accounts\//, "").replace(/^accounts\//, ""))
    .filter(Boolean);
}

export async function postC2cJson(path, body) {
  return postJson(`${GAMESGO_C2C_API_URL}${path}`, {
    language: "zh",
    show_currency: "USD",
    ...body
  });
}

export async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`${url} 请求失败：HTTP ${response.status}`);
  return response.json();
}
