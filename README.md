# MoneyAI 数字订阅商城

MoneyAI 是一个面向中国用户的数字订阅商城示例项目，前端展示 AI 工具、流媒体、软件和充值类商品，后端提供邮箱注册登录、订单创建、支付宝网页支付、支付宝异步通知和本地后台管理能力。

## 技术栈

- 前端：Vite + 原生 JavaScript + CSS，入口为 `src/main.js`
- 商品数据：`src/catalog-data.js`，由同步脚本从上游接口生成
- 后端：Express 5，入口为 `server.cjs`
- 本地数据：`data/store.json`，保存用户、会话、验证码和订单
- 支付：`alipay-sdk`
- 邮件：`nodemailer`

## 目录结构

```text
.
├── src/                    # 前端源码和商品数据
├── public/                 # robots.txt、sitemap.xml 等静态资源
├── scripts/                # 同步、检查、部署脚本
├── docs/                   # 商品同步说明
├── data/store.json         # 本地运行数据
├── server.cjs              # Express API + 静态站点服务
└── vite.config.js          # Vite 开发代理配置
```

## 环境变量

根目录 `.env` 会被后端和同步/站点地图脚本读取。常用配置：

```env
PORT=3000
PUBLIC_BASE_URL=http://localhost:3000
CORS_ORIGIN=http://127.0.0.1:5173
SESSION_SECRET=change-me

ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me

SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=
SMTP_PASS=
SMTP_FROM="MoneyAI" <your@email.com>

ALIPAY_APP_ID=
ALIPAY_PRIVATE_KEY=
ALIPAY_PUBLIC_KEY=
ALIPAY_GATEWAY=https://openapi.alipay.com/gateway.do
ALIPAY_NOTIFY_URL=

SITE_URL=https://www.example.com
PRICE_MARKUP_RATE=0.1
SYNC_PRODUCT_LIMIT=80
```

生产环境不要使用默认管理员账号密码，也不要把真实密钥提交到代码仓库。

## 本地开发

```bash
npm install
npm run server
```

另开一个终端启动前端开发服务器：

```bash
npm run dev
```

访问 `http://127.0.0.1:5173`。Vite 会把 `/api` 代理到 `http://localhost:3000`。

## 商品同步

手动同步并检查数据：

```bash
npm run inspect:gamsgo
npm run sync:products
npm run check:catalog
```

同步脚本会同时拉取旧版 SPU 商品接口和账号市场 `/accounts/*` listing。账号市场路由来自 GamsGo sitemap，详情通过 `mapi.gamsgo2.com/index/typeCategory` 与 `/index/planList` 分页读取；脚本用 Node `fetch` 执行检查和同步，不依赖 curl 批量抓取。

常用同步参数：

- `SYNC_PRODUCT_LIMIT`：最终写入前端的商品总数，默认 `600`
- `SYNC_ACCOUNT_ROUTE_LIMIT`：最多检查多少个账号市场路由，默认 `40`
- `SYNC_ACCOUNT_LISTING_LIMIT`：最多同步多少个账号市场 listing，默认跟随 `SYNC_PRODUCT_LIMIT`
- `SYNC_ACCOUNT_ROUTES`：手动指定路由，例如 `claude,gemini,cursor`
- `CATALOG_MIN_ACCOUNT_LISTINGS`：检查时要求的账号市场商品下限

所有商品按 `ceil(美元价 * USD/CNY * (1 + PRICE_MARKUP_RATE))` 生成人民币价格，最后原子替换 `src/catalog-data.js`。

生产环境必须在同步后重新构建前端，否则 `dist/` 里仍是旧的打包数据：

```bash
npm run sync:products
npm run check:catalog
npm run build
```

## 一键部署

阿里云 ECS + PM2 + Nginx + Certbot 的完整生产部署步骤见 [docs/aliyun-ecs-deployment.md](/Users/zhangqilai/project/learn-ai/docs/aliyun-ecs-deployment.md)。

新增脚本：

```bash
chmod +x scripts/deploy.sh scripts/update.sh scripts/sync-products-cron.sh
npm run deploy
```

`scripts/deploy.sh` 会执行：

1. 安装依赖
2. 检查 GamsGo 上游覆盖
3. 同步商品数据并检查
4. 构建前端
5. 使用 PM2 启动/重启 `server.cjs`；如果没有 PM2，则使用 `nohup npm run server`
6. 请求 `/api/health` 做健康检查

可用环境变量：

```bash
APP_NAME=moneyai PORT=3000 npm run deploy
DEPLOY_SKIP_SYNC=1 npm run deploy
DEPLOY_SKIP_INSPECT=1 npm run deploy
HEALTHCHECK_URL=http://127.0.0.1:3000/api/health npm run deploy
```

## 一键更新

`scripts/update.sh` 适合已有服务器上的日常更新，会按顺序完成安装依赖、上游覆盖检查、商品同步、数据检查、构建和 PM2 reload/start：

```bash
npm run update
```

可用环境变量：

```bash
UPDATE_PULL=1 npm run update
UPDATE_SKIP_INSTALL=1 npm run update
UPDATE_SKIP_SYNC=1 npm run update
UPDATE_SKIP_INSPECT=1 npm run update
UPDATE_SKIP_RESTART=1 npm run update
```

## Cron 数据同步任务

新增脚本 `scripts/sync-products-cron.sh` 适合放入 cron。它会加锁防止并发执行，完成“覆盖检查 -> 同步 -> 数据检查 -> 构建”，日志建议追加到 `logs/product-sync.log`。如只想跳过覆盖检查，可设置 `SYNC_SKIP_INSPECT=1`。

示例，每 30 分钟同步一次：

```cron
*/30 * * * * cd /Users/zhangqilai/project/learn-ai && /usr/bin/env bash scripts/sync-products-cron.sh >> logs/product-sync.log 2>&1
```

如果希望 cron 后顺便检查本地服务：

```cron
*/30 * * * * cd /Users/zhangqilai/project/learn-ai && HEALTHCHECK_URL=http://127.0.0.1:3000/api/health /usr/bin/env bash scripts/sync-products-cron.sh >> logs/product-sync.log 2>&1
```

可以单独检查 cron 最近拉取的数据：

```bash
CATALOG_MAX_AGE_MIN=60 npm run check:catalog
tail -n 100 logs/product-sync.log
```

`CATALOG_MAX_AGE_MIN` 用于判断 `syncMeta.syncedAt` 是否过旧；不设置时只检查结构、数量、价格、汇率和重复 slug。

## 热更新与是否需要重启

当前项目开发环境可以热更新：`npm run dev` 运行时，`src/catalog-data.js` 变化会触发 Vite HMR。

生产环境不是实时推送式热更新。商品数据被打包进 `dist/assets/*.js`，所以 cron 拉取数据后必须执行 `npm run build` 才会影响线上静态文件。

通常不需要重启网站进程。Express 使用 `dist/` 目录直接服务静态文件，重新 build 后，新访问或刷新页面的用户会拿到新的 `index.html` 和新 hash 的 JS 文件。以下情况才需要重启：

- 修改了 `server.cjs`
- 修改了后端依赖或 Node 版本
- 修改了需要后端进程重新读取的环境变量
- 使用了额外缓存层/CDN，且需要重启或清缓存才能看到新资源

已经打开页面的用户不会自动刷新到新商品数据；需要用户刷新页面，或者后续改造为接口拉取商品 JSON 并做前端轮询/长连接。

## 常用命令

```bash
npm run dev              # 前端开发服务器
npm run server           # 后端 API + dist 静态服务
npm run build            # 生成 sitemap 并构建前端
npm run preview          # 预览前端构建产物
npm run sync:products    # 拉取商品数据
npm run inspect:gamsgo    # 检查 GamsGo 上游覆盖
npm run check:catalog    # 检查商品数据
npm run sync:cron        # 执行 cron 同步任务
npm run deploy           # 一键部署
npm run update           # 一键更新
```

## 生产注意事项

- `data/store.json` 只适合轻量或演示部署；真实生产建议迁移到数据库。
- 支付宝异步通知地址 `ALIPAY_NOTIFY_URL` 必须是公网可访问 HTTPS 地址。
- 邮箱验证码依赖 SMTP，`SMTP_USER` 和 `SMTP_PASS` 缺失时无法发送验证码。
- 建议用 PM2、systemd 或容器编排托管 `server.cjs`，并保留 `logs/` 日志。
