# 阿里云 ECS 部署指南

本文档说明如何将 MoneyAI 部署到阿里云 ECS，并使用 PM2 管理 Node 服务、Nginx 反向代理、Certbot 申请和自动续费 HTTPS 证书。

本文假设：

- 服务器系统：Ubuntu 22.04/24.04
- 域名：`money-ai.cn`
- Node 服务端口：`127.0.0.1:3000`
- 项目目录：`/root/workplace/moneyai`
- 进程名称：`moneyai`

## 1. 阿里云控制台准备

### 1.1 域名解析

在域名 DNS 解析中添加：

```text
A    money-ai.cn        ECS 公网 IP
A    www.money-ai.cn    ECS 公网 IP
```

如果暂时不使用 `www`，可以只解析 `money-ai.cn`。

### 1.2 安全组放行

ECS 安全组入方向建议：

```text
22/tcp     你的固定 IP
80/tcp     0.0.0.0/0
443/tcp    0.0.0.0/0
```

不要向公网开放 `3000` 端口，Node 服务只由 Nginx 在本机代理访问。

### 1.3 ICP 备案

如果 ECS 位于中国大陆，`money-ai.cn` 需要完成 ICP 备案，否则 80/443 访问可能受限。

## 2. 初始化 ECS

使用 root 登录：

```bash
ssh root@你的ECS公网IP
```

安装基础依赖、Nginx 和 Node.js 22：

```bash
apt update && apt upgrade -y
apt install -y curl git nginx snapd ufw build-essential

curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

node -v
npm -v
systemctl enable --now nginx
```

可以创建专用部署用户，也可以沿用你当前的 root 部署目录。本文后续命令按当前服务器路径 `/root/workplace/moneyai` 写：

```bash
mkdir -p /root/workplace/moneyai
```

## 3. 上传项目

在本机执行：

```bash
rsync -av \
  --exclude node_modules \
  --exclude .git \
  --exclude logs \
  --exclude .env \
  --exclude data/store.json \
  /Users/zhangqilai/project/learn-ai/ \
  root@你的ECS公网IP:/root/workplace/moneyai/
```

在服务器执行：

```bash
cd /root/workplace/moneyai
npm ci
chmod +x scripts/deploy.sh scripts/update.sh scripts/sync-products-cron.sh
mkdir -p logs data
```

注意：

- `.env` 是生产密钥文件，不要用本地文件覆盖服务器文件。
- `data/store.json` 保存用户、会话和订单，更新代码时必须保留。
- `data/catalog-data.json` 是商品数据快照，可以随代码同步，也可以在服务器执行 `npm run sync:products` 重新生成。

## 4. 配置生产环境变量

在服务器创建 `.env`：

```bash
cd /root/workplace/moneyai
nano .env
```

推荐配置：

```env
PORT=3000
PUBLIC_BASE_URL=https://money-ai.cn
SITE_URL=https://money-ai.cn
CORS_ORIGIN=https://money-ai.cn
SESSION_SECRET=请改成强随机字符串

ADMIN_USERNAME=请改成后台账号
ADMIN_PASSWORD=请改成强密码

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
ALIPAY_NOTIFY_URL=https://money-ai.cn/api/alipay/notify

PRICE_MARKUP_RATE=0.2
SYNC_PRODUCT_LIMIT=80
```

注意：

- 生产环境不要使用默认管理员账号密码。
- 不要把真实 `.env`、支付宝私钥、SMTP 授权码提交到代码仓库。
- 支付宝异步通知地址必须是公网可访问 HTTPS 地址。
- 支付宝网页支付会使用 `PUBLIC_BASE_URL` 拼接同步回跳地址，必须是 `https://money-ai.cn`，否则支付后可能回到本地或错误域名。
- 支付宝后台里的应用公钥、支付宝公钥、应用 ID、网关和当前 `.env` 必须对应同一个应用。

## 4.1 代码上传后必须确认的修改项

每次把代码上传到 `/root/workplace/moneyai` 后，至少确认这些项：

```bash
cd /root/workplace/moneyai
grep -E '^(PORT|PUBLIC_BASE_URL|SITE_URL|CORS_ORIGIN|ALIPAY_NOTIFY_URL|PRICE_MARKUP_RATE)=' .env
```

必须符合：

```env
PORT=3000
PUBLIC_BASE_URL=https://money-ai.cn
SITE_URL=https://money-ai.cn
CORS_ORIGIN=https://money-ai.cn
ALIPAY_NOTIFY_URL=https://money-ai.cn/api/alipay/notify
PRICE_MARKUP_RATE=0.2
```

如果代码里改了 `server.cjs`、依赖、`.env` 或 PM2 配置，上传后必须重启：

```bash
pm2 reload moneyai --update-env
```

如果只改前端、CSS、商品数据或文档，上传后执行：

```bash
npm ci
npm run check:catalog
npm run build
pm2 reload moneyai --update-env
```

如果 `data/catalog-data.json` 不存在或商品过旧：

```bash
npm run sync:products
npm run check:catalog
npm run build
pm2 reload moneyai --update-env
```

## 5. 构建和启动 PM2

安装 PM2：

```bash
sudo npm install -g pm2
```

创建 PM2 配置：

```bash
cd /root/workplace/moneyai
nano ecosystem.config.cjs
```

写入：

```js
module.exports = {
  apps: [
    {
      name: "moneyai",
      script: "server.cjs",
      cwd: "/root/workplace/moneyai-new",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "3000"
      },
      error_file: "/root/workplace/moneyai-new/logs/pm2-error.log",
      out_file: "/root/workplace/moneyai-new/logs/pm2-out.log",
      time: true
    }
  ]
};
```

首次同步商品、检查数据并构建：

```bash
npm run inspect:gamsgo
npm run sync:products
npm run check:catalog
npm run build
```

启动服务：

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root
```

`pm2 startup` 会输出一条带 `sudo env PATH=...` 的命令，复制执行一次。

检查服务：

```bash
pm2 status
curl http://127.0.0.1:3000/api/health
```

## 6. 配置 Nginx 反向代理

你当前已有 `/etc/nginx/sites-enabled/money-ai.cn`。建议确认配置包含 `X-Forwarded-Proto`，并保留 HTTPS 反代到 `127.0.0.1:3000`：

```bash
sudo nano /etc/nginx/sites-available/money-ai.cn
```

推荐配置：

```nginx
server {
    listen 80;
    server_name money-ai.cn www.money-ai.cn;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name money-ai.cn www.money-ai.cn;

    ssl_certificate /etc/letsencrypt/live/money-ai.cn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/money-ai.cn/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

你当前配置和推荐配置基本一致，但需要补上：

```nginx
proxy_set_header X-Forwarded-Proto $scheme;
```

启用配置：

```bash
sudo ln -sf /etc/nginx/sites-available/money-ai.cn /etc/nginx/sites-enabled/money-ai.cn
sudo nginx -t
sudo systemctl reload nginx
```

此时可以先测试 HTTP：

```bash
curl -I http://money-ai.cn
```

## 7. 申请 HTTPS 证书并自动续费

安装 Certbot：

```bash
sudo snap install core
sudo snap refresh core
sudo snap install --classic certbot
sudo ln -sf /snap/bin/certbot /usr/bin/certbot
```

如果 `www.money-ai.cn` 已解析：

```bash
sudo certbot --nginx -d money-ai.cn -d www.money-ai.cn --redirect
```

如果只使用根域名：

```bash
sudo certbot --nginx -d money-ai.cn --redirect
```

证书路径通常为：

```text
/etc/letsencrypt/live/money-ai.cn/fullchain.pem
/etc/letsencrypt/live/money-ai.cn/privkey.pem
```

添加证书续费后自动重载 Nginx：

```bash
sudo mkdir -p /etc/letsencrypt/renewal-hooks/deploy
sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh >/dev/null <<'EOF'
#!/usr/bin/env bash
systemctl reload nginx
EOF
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

验证自动续费：

```bash
sudo certbot renew --dry-run
sudo certbot certificates
systemctl list-timers | grep certbot
```

## 8. 配置商品同步 Cron

使用当前部署用户编辑 cron。你现在是 root 部署，就用 root 的 crontab：

```bash
crontab -e
```

添加：

```cron
SHELL=/bin/bash
PATH=/usr/local/bin:/usr/bin:/bin

*/30 * * * * cd /root/workplace/moneyai && HEALTHCHECK_URL=https://money-ai.cn/api/health /usr/bin/env bash scripts/sync-products-cron.sh >> logs/product-sync.log 2>&1
```

检查同步结果：

```bash
cd /root/workplace/moneyai
npm run inspect:gamsgo
npm run check:catalog
tail -n 100 logs/product-sync.log
```

如果想检查数据是否在 60 分钟内更新过：

```bash
CATALOG_MAX_AGE_MIN=60 npm run check:catalog
```

## 9. 更新部署

本机同步新代码到服务器：

```bash
rsync -av \
  --exclude node_modules \
  --exclude .git \
  --exclude logs \
  --exclude .env \
  --exclude data/store.json \
  /Users/zhangqilai/project/learn-ai/ \
  root@你的ECS公网IP:/root/workplace/moneyai/
```

服务器执行：

```bash
cd /root/workplace/moneyai
npm run update
```

`npm run update` 会执行依赖安装、GamsGo 覆盖检查、商品同步、数据检查、构建和 PM2 reload/start。常用开关：`UPDATE_SKIP_INSTALL=1`、`UPDATE_SKIP_SYNC=1`、`UPDATE_SKIP_INSPECT=1`、`UPDATE_SKIP_RESTART=1`、`UPDATE_PULL=1`。

更新前后都不要覆盖服务器上的 `.env` 和 `data/store.json`。前者保存生产密钥，后者保存用户、登录会话和订单。

如果只是商品同步，cron 脚本已经会执行 `npm run inspect:gamsgo`、`npm run sync:products`、`npm run check:catalog` 和 `npm run build`，通常不需要 `pm2 reload`。

## 10. 热更新和是否需要重启

当前项目开发环境运行 `npm run dev` 时，修改 `src/catalog-data.js` 会触发 Vite HMR；后端 `/api/catalog` 默认读取 `data/catalog-data.json`。

生产环境不是实时推送式热更新。商品数据同步会写入 `data/catalog-data.json`，同时生成 `src/catalog-data.js` 作为打包兜底数据。cron 拉取商品后建议继续执行：

```bash
npm run build
```

`scripts/sync-products-cron.sh` 已经包含构建步骤。

正常商品同步后不需要重启 PM2。Express 会从磁盘服务新的 `dist/` 文件，新访问或刷新页面的用户会拿到新的静态资源。以下情况才需要重启：

- 修改了 `server.cjs`
- 修改了后端依赖或 Node 版本
- 修改了需要后端进程重新读取的 `.env`
- 修改了 PM2 配置

重启命令：

```bash
pm2 reload moneyai --update-env
```

## 11. 常用运维命令

PM2：

```bash
pm2 status
pm2 logs moneyai
pm2 restart moneyai --update-env
pm2 reload moneyai --update-env
pm2 save
```

Nginx：

```bash
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl status nginx
tail -n 100 /var/log/nginx/error.log
tail -n 100 /var/log/nginx/access.log
```

应用健康检查：

```bash
curl https://money-ai.cn/api/health
curl -I https://money-ai.cn
```

订单和商品接口检查：

```bash
curl https://money-ai.cn/api/catalog
tail -n 100 /root/workplace/moneyai/logs/server.log
```

支付上线检查：

```bash
grep -E 'PUBLIC_BASE_URL|ALIPAY_NOTIFY_URL|ALIPAY_APP_ID' /root/workplace/moneyai/.env
curl -I https://money-ai.cn/orders
```

完成一笔小额支付后，日志里应该能看到：

```text
orders.alipay.created
orders.alipay_return.confirmed
orders.my.success
```

如果同步回跳签名校验失败，但支付宝交易查询确认成功，日志会出现：

```text
orders.alipay_return.query_confirmed
```

这表示后端已通过支付宝交易查询把订单确认成已支付。

商品同步日志：

```bash
tail -n 100 /root/workplace/moneyai/logs/product-sync.log
```

证书：

```bash
sudo certbot certificates
sudo certbot renew --dry-run
```

## 12. 排错

### 域名打不开

检查：

```bash
dig money-ai.cn
sudo nginx -t
sudo systemctl status nginx
curl http://127.0.0.1:3000/api/health
```

同时确认阿里云安全组已放行 80/443，域名已备案。

### HTTPS 申请失败

检查：

```bash
curl -I http://money-ai.cn
sudo tail -n 100 /var/log/nginx/error.log
```

Certbot 申请证书前，HTTP 80 必须能被公网访问。

### PM2 服务异常

检查：

```bash
pm2 status
pm2 logs moneyai
cat /root/workplace/moneyai/logs/pm2-error.log
```

常见原因是 `.env` 缺少支付宝、SMTP 或端口配置。

### 商品同步失败

检查：

```bash
cd /root/workplace/moneyai
npm run inspect:gamsgo
npm run sync:products
npm run check:catalog
tail -n 100 logs/product-sync.log
```

常见原因是上游接口不可用、网络无法访问、汇率接口失败或商品字段变化。
