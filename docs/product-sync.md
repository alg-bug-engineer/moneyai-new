# 商品同步与人民币定价方案

## 当前实现

- 手动同步命令：`npm run sync:products`
- 上游覆盖检查：`npm run inspect:gamsgo`
- 同步脚本：`scripts/sync-products.mjs`
- 数据源工具：`scripts/gamsgo-source.mjs`
- 运行时商品数据：`data/catalog-data.json`
- 前台兜底数据：`src/catalog-data.js`
- 原站 SPU 接口：`https://api.gamsgo2.com/index/getSpuList`
- 账号市场路由：`https://www.gamsgo.com/accounts_zh.xml`
- 账号市场接口：`https://mapi.gamsgo2.com/index/typeCategory`、`https://mapi.gamsgo2.com/index/planList`
- 汇率接口：`https://open.er-api.com/v6/latest/USD`
- 人民币价公式：`ceil(原站美元价 * USD/CNY * (1 + PRICE_MARKUP_RATE))`，默认浮动 20%

同步脚本会先拉取旧版 SPU 商品列表，读取 `min_price`、`lock_status`、`vip_status`、描述、图片等字段，再对每个商品调用 `/index/detail` 同步 `introduction`、`how_it_works`、`support_device` 等详情内容。

账号市场部分会从 sitemap 发现 `/accounts/*` 路由，调用 `/index/typeCategory` 获取 `type_category_id`，再用 `/index/planList` 按页同步卖家 listing。同步过程由 Node 脚本完成，不通过 curl 命令批量抓取。

常用环境变量：

- `SYNC_PRODUCT_LIMIT`：最终写入前端的商品总数，默认 `600`
- `SYNC_ACCOUNT_ROUTE_LIMIT`：最多检查多少个账号市场路由，默认 `40`
- `SYNC_ACCOUNT_LISTING_LIMIT`：最多同步多少个账号市场 listing，默认跟随 `SYNC_PRODUCT_LIMIT`
- `SYNC_ACCOUNT_LISTINGS_PER_ROUTE`：单个账号路由最多同步多少条 listing，默认 `500`
- `SYNC_ACCOUNT_ROUTES`：手动指定路由，例如 `claude,gemini,cursor`
- `PRICE_MARKUP_RATE`：人民币售价浮动比例，默认 `0.2`
- `CATALOG_MIN_ACCOUNT_LISTINGS`：`npm run check:catalog` 的账号市场商品下限

## 手动触发

```bash
npm run inspect:gamsgo
npm run sync:products
npm run check:catalog
npm run build
```

同步后会写入 `data/catalog-data.json`，并生成 `src/catalog-data.js` 作为前端静态兜底数据。后端 `/api/catalog` 默认读取 `data/catalog-data.json`，前端启动后会优先使用该接口返回的数据。

## 定时触发

生产环境建议把同步脚本放到后端服务或 CI 定时任务中执行，不建议由浏览器前端直接请求原站接口。

Cron 示例：

```cron
*/30 * * * * cd /path/to/app && /usr/bin/env bash scripts/sync-products-cron.sh >> logs/product-sync.log 2>&1
```

`scripts/sync-products-cron.sh` 会加锁防止重复执行，按顺序完成上游覆盖检查、同步、数据检查和前端构建。可用 `SYNC_SKIP_INSPECT=1` 跳过覆盖检查；可用 `CATALOG_MAX_AGE_MIN=60 npm run check:catalog` 检查 cron 拉取的数据是否过旧。

## 热更新与重启

开发环境运行 `npm run dev` 时，`src/catalog-data.js` 变更会触发 Vite HMR；后端接口读取的 `data/catalog-data.json` 会在下一次 `/api/catalog` 请求时生效。

生产环境中商品数据已经被打包进 `dist/assets/*.js`。同步后必须重新执行 `npm run build` 才会生成新的静态资源；通常不需要重启 `server.cjs`，因为 Express 会从磁盘服务最新的 `dist/` 文件。只有修改后端代码、依赖、Node 版本或需要后端进程重新读取的环境变量时，才需要重启网站进程。

GitHub Actions 示例：

```yaml
on:
  schedule:
    - cron: "*/30 * * * *"
  workflow_dispatch:
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npm run inspect:gamsgo
      - run: npm run sync:products
      - run: npm run check:catalog
      - run: npm run build
```

## 上线建议

真实商城应把同步结果写入数据库，而不是直接写前端文件。推荐表结构：

- `source_products`：原站商品快照，保留原始 JSON、美元价、库存状态、同步时间。
- `products`：站内商品，保存中文名、分类、上下架、推荐标签、人民币售价、人工覆盖价。
- `exchange_rates`：汇率来源、USD/CNY、更新时间。
- `sync_jobs`：同步任务状态、错误信息、拉取数量、耗时。

定价优先级建议：

1. 人工锁价优先，运营手动设置后不被同步覆盖。
2. 否则按 `ceil(美元价 * 汇率 * (1 + 溢价率))` 自动计算。
3. 缺货或原站锁定时前台显示缺货，本地可额外设置安全库存。
