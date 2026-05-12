import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const siteUrl = (process.env.SITE_URL || "https://www.moneyai.example").replace(/\/$/, "");
const publicDir = new URL("../public/", import.meta.url);
const catalogUrl = new URL("../data/catalog-data.json", import.meta.url);
const { products } = JSON.parse(await readFile(catalogUrl, "utf8"));
const now = new Date().toISOString();

const staticRoutes = ["/", "/subscriptions", "/help", "/refund", "/privacy", "/terms"];
const productRoutes = products.map((product) => `/product/${productSlug(product)}`);
const routes = [...new Set([...staticRoutes, ...productRoutes])];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    (route) => `  <url>
    <loc>${escapeXml(`${siteUrl}${route}`)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${route.startsWith("/product") ? "daily" : "weekly"}</changefreq>
    <priority>${priority(route)}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`;

const robots = `User-agent: *
Allow: /
Disallow: /checkout
Disallow: /orders
Disallow: /admin
Disallow: /wwlsm

Sitemap: ${siteUrl}/sitemap.xml
`;

await mkdir(publicDir, { recursive: true });
await writeFile(new URL("sitemap.xml", publicDir), sitemap, "utf8");
await writeFile(new URL("robots.txt", publicDir), robots, "utf8");
console.log(`Generated sitemap with ${routes.length} URLs for ${siteUrl}`);

function productSlug(product) {
  return product.name.toLowerCase().replace(/\+/g, "plus").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function priority(route) {
  if (route === "/") return "1.0";
  if (route === "/subscriptions") return "0.9";
  if (route.startsWith("/product")) return "0.8";
  return "0.6";
}

function escapeXml(value) {
  return value.replace(/[<>&'"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[char]);
}
