import { stat } from "node:fs/promises";

const catalogUrl = new URL("../src/catalog-data.js", import.meta.url);
const maxAgeMin = Number(process.env.CATALOG_MAX_AGE_MIN || 0);
const minProducts = Number(process.env.CATALOG_MIN_PRODUCTS || 1);
const minAccountListings = Number(process.env.CATALOG_MIN_ACCOUNT_LISTINGS || 0);
const { syncMeta, products } = await import(`${catalogUrl.href}?check=${Date.now()}`);

const errors = [];

if (!Array.isArray(products)) {
  errors.push("products is not an array");
} else {
  if (products.length < minProducts) {
    errors.push(`product count ${products.length} is lower than CATALOG_MIN_PRODUCTS=${minProducts}`);
  }

  const seenSlugs = new Set();
  products.forEach((product, index) => {
    const label = product?.name || `#${index + 1}`;
    const slug = productSlug(product || {});

    if (!product || typeof product !== "object") errors.push(`product ${index + 1} is not an object`);
    if (!String(product?.id || "").trim()) errors.push(`${label}: missing id`);
    if (!String(product?.name || "").trim()) errors.push(`${label}: missing name`);
    if (!String(product?.category || "").trim()) errors.push(`${label}: missing category`);
    if (!Number.isFinite(Number(product?.price)) || Number(product.price) <= 0) errors.push(`${label}: invalid price`);
    if (!String(product?.unit || "").trim()) errors.push(`${label}: missing unit`);
    if (!String(product?.sourceKind || "").trim()) errors.push(`${label}: missing sourceKind`);
    if (seenSlugs.has(slug)) errors.push(`${label}: duplicate product slug ${slug}`);
    seenSlugs.add(slug);
  });

  if (minAccountListings > 0) {
    const accountListings = products.filter((product) => product?.sourceKind === "account-listing").length;
    if (accountListings < minAccountListings) {
      errors.push(`account listing count ${accountListings} is lower than CATALOG_MIN_ACCOUNT_LISTINGS=${minAccountListings}`);
    }
  }
}

if (!syncMeta || typeof syncMeta !== "object") {
  errors.push("syncMeta is missing");
} else {
  if (syncMeta.productCount !== products.length) {
    errors.push(`syncMeta.productCount=${syncMeta.productCount} does not match products.length=${products.length}`);
  }
  if (!Number.isFinite(Number(syncMeta.exchangeRate)) || Number(syncMeta.exchangeRate) <= 0) {
    errors.push("syncMeta.exchangeRate is invalid");
  }
  if (syncMeta.sourceBreakdown && typeof syncMeta.sourceBreakdown === "object") {
    const accountListingCount = Number(syncMeta.sourceBreakdown.accountListingCount || 0);
    if (minAccountListings > 0 && accountListingCount < minAccountListings) {
      errors.push(
        `syncMeta.sourceBreakdown.accountListingCount=${accountListingCount} is lower than CATALOG_MIN_ACCOUNT_LISTINGS=${minAccountListings}`
      );
    }
  }
  const syncedAt = Date.parse(syncMeta.syncedAt || "");
  if (!Number.isFinite(syncedAt)) {
    errors.push("syncMeta.syncedAt is invalid");
  } else if (maxAgeMin > 0) {
    const ageMin = (Date.now() - syncedAt) / 60000;
    if (ageMin > maxAgeMin) {
      errors.push(`catalog data is ${Math.round(ageMin)} minutes old, exceeds CATALOG_MAX_AGE_MIN=${maxAgeMin}`);
    }
  }
}

try {
  const fileStat = await stat(catalogUrl);
  if (!fileStat.size) errors.push("src/catalog-data.js is empty");
} catch (error) {
  errors.push(`cannot stat src/catalog-data.js: ${error.message}`);
}

if (errors.length) {
  console.error("Catalog data check failed:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(
  `Catalog data check passed: ${products.length} products, syncedAt=${syncMeta.syncedAt}, USD/CNY=${syncMeta.exchangeRate}`
);

function productSlug(product) {
  return String(product.name || "")
    .toLowerCase()
    .replace(/\+/g, "plus")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
