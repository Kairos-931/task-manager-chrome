# TaskMaster 公开演示页部署

## 数据边界

演示页只加载 `demo/sample-data.js` 中的虚构数据。它不连接 Cloudflare Worker，不读取扩展存储，不使用 LocalStorage、IndexedDB、Cookie 或数据库。页面刷新后恢复初始数据。

## 本地预览

在项目根目录运行：

```powershell
npm run demo
```

浏览器打开 `http://127.0.0.1:4173`。可通过环境变量更换端口：

```powershell
$env:DEMO_PORT=4180
npm run demo
```

## Docker 预览

项目根目录运行：

```powershell
docker compose -f deploy/demo/compose.yaml up -d --build
```

默认地址为 `http://localhost:8080`，健康检查为 `http://localhost:8080/healthz`。

停止服务：

```powershell
docker compose -f deploy/demo/compose.yaml down
```

## 服务器上线

服务器需要 Linux、Docker Engine、Docker Compose 插件和一个指向服务器的域名。建议通过 Caddy、Nginx Proxy Manager 或云平台网关提供 HTTPS，再把流量转发到 Demo 容器的 80 端口。

上线步骤：

1. 将仓库拉取到服务器。
2. 在项目根目录执行 Docker Compose 启动命令。
3. 配置域名与 HTTPS 反向代理。
4. 检查首页、静态资源和 `/healthz`。
5. 在浏览器开发者工具的 Network 面板确认没有 Worker 或第三方 API 请求。

## 升级与回滚

发布新版本时先拉取对应 Git tag，再重新构建镜像。镜像标签必须与 TaskMaster 版本一致。回滚时切回上一 Git tag 并重新构建；演示页没有数据库，不涉及数据迁移或恢复。

## 验证清单

- 页面显示“公开演示”和“不会保存或同步”。
- 样例任务、分类、搜索、筛选、视图切换、完成、新增和重置可用。
- 刷新页面后恢复初始样例。
- `/healthz` 返回 `ok`。
- 响应包含 CSP、`X-Content-Type-Options`、`X-Frame-Options` 和 `Referrer-Policy`。
- 页面无外部网络请求，源文件中不包含 `API_TOKEN` 或真实任务。
