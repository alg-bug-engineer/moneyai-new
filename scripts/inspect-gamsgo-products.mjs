import "dotenv/config";
import {
  DEFAULT_PRIORITY_ACCOUNT_ROUTES,
  discoverAccountRoutes,
  fetchAccountListingsForRoute,
  fetchSourceProducts,
  readPositiveNumber
} from "./gamsgo-source.mjs";

const ROUTE_LIMIT = readPositiveNumber(process.env.INSPECT_ACCOUNT_ROUTE_LIMIT || process.env.SYNC_ACCOUNT_ROUTE_LIMIT, 40);
const PAGE_SIZE = readPositiveNumber(process.env.INSPECT_ACCOUNT_PAGE_SIZE || process.env.SYNC_ACCOUNT_PAGE_SIZE, 18);

async function main() {
  const sourcePayload = await fetchSourceProducts();
  const spuList = sourcePayload.data?.list || [];
  const routes = await discoverAccountRoutes({ routeLimit: ROUTE_LIMIT, priorityRoutes: DEFAULT_PRIORITY_ACCOUNT_ROUTES });

  const summaries = [];
  for (const route of routes) {
    try {
      const result = await fetchAccountListingsForRoute(route, {
        perRouteLimit: PAGE_SIZE,
        pageSize: PAGE_SIZE,
        pageLimit: 1
      });
      if (!result.category) {
        summaries.push({ route, name: "-", total: 0, firstPage: 0, status: "skipped" });
        continue;
      }
      summaries.push({
        route,
        name: result.category.type_name || result.category.name || route,
        total: result.total,
        firstPage: result.list.length,
        status: result.list.length ? "ok" : "empty"
      });
    } catch (error) {
      summaries.push({ route, name: "-", total: 0, firstPage: 0, status: `error: ${error.message}` });
    }
  }

  const availableAccountListings = summaries.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const routesWithListings = summaries.filter((item) => item.total > 0).length;

  console.log("GamsGo source inspection");
  console.log(`- legacy SPU API products: ${spuList.length}`);
  console.log(`- account routes inspected: ${routes.length}`);
  console.log(`- account routes with listings: ${routesWithListings}`);
  console.log(`- available account listings in inspected routes: ${availableAccountListings}`);
  console.log("");
  console.table(
    summaries.map((item) => ({
      route: item.route,
      name: item.name,
      total: item.total,
      firstPage: item.firstPage,
      status: item.status
    }))
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
