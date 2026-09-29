# 闪闪计划 SHINE PLAN

## 开发与部署

项目使用 React 19、Vinext 1、Vite 8 和 npm。需要 Node.js 22.13 或更新版本；依赖版本由 `package-lock.json` 固定。

### 本地开发

```bash
git pull
npm ci
npm run dev
```

打开 `http://localhost:5190`。开发服务器监听 `0.0.0.0`，本地和 Codespaces 使用同一命令。普通开发模式适合检查页面；需要本地 Cloudflare D1 运行时的接口测试时，先运行 `npm run db:local:migrate`，再运行 `npm run dev:cloudflare`。不要将正式站点的数据库或密钥用于开发预览。

`npm run typecheck` 执行 TypeScript 检查。原有 `npm run build` 继续生成 Cloudflare Workers / Sites 构建产物到 `dist/client` 和 `dist/server`。

### GitHub Codespaces

在 GitHub 仓库点击 **Code → Codespaces → Create codespace on main**。首次创建会自动安装依赖并初始化独立的本地 D1 测试库。在 Codespaces 终端运行 `npm run dev`，然后在 **Ports** 中打开转发的 **5190** 端口；默认保持端口为 Private。需要测试数据接口时改用 `npm run dev:cloudflare`。停止本地电脑不会停止 Codespace 中的开发服务器，但 Codespace 闲置后会自动暂停。

### Vercel

Vercel 使用独立的 Nitro 构建路径；不会改变本地开发或现有 Sites 构建。**在确定 Vercel API 后端并完成验证前，请不要启用自动部署。**之后导入 GitHub 仓库时使用：

| 设置 | 值 |
| --- | --- |
| Root Directory | 仓库根目录 |
| Framework Preset | Nitro |
| Install Command | `npm ci` |
| Build Command | `npm run build:vercel` |
| Output Directory | 保持 Nitro 预设默认值；构建实际生成 `.vercel/output`（Vercel Build Output API） |
| Node.js | 22.x，至少 22.13 |
| Production Branch | `main` |

连接 GitHub 后，`main` 的提交用于 Production，其他分支及 PR 用于 Preview。项目只有 `/` 页面；课表和设置在首页内切换，没有需要额外 SPA rewrite 的二级页面。静态资源使用根路径，例如 `/manifest.webmanifest`。Vercel 的 `VERCEL_URL` 用于未设置 `SITE_ORIGIN` 时的页面元数据地址。

**数据接口尚不能直接在 Vercel 运行：**当前 `/api/*` 依赖 Cloudflare D1 绑定，Vercel 不提供该绑定。完成后端连接和隔离前，不应把 Vercel 构建成功视为完整功能已部署。现有 Sites 站点与 GitHub、Vercel 是独立部署流程。

### 环境变量

`.env.example` 只列出变量名和安全示例。`.env`、`.env.local` 等实际值已被 Git 忽略。`SITE_ORIGIN` 可选，用于页面元数据；本地默认 `http://localhost:5190`，Vercel 可使用系统提供的 `VERCEL_URL`。`VAPID_PUBLIC_KEY`、`VAPID_PRIVATE_KEY`、`VAPID_SUBJECT` 和 `DISPATCH_SECRET` 用于推送通知及提醒派发，按需在实际运行环境中单独配置，不要提交到 Git。

| 环境 | 配置方式 |
| --- | --- |
| 本地开发 | 使用默认地址；运行 `db:local:migrate` 后可在 `dev:cloudflare` 下测试本地 D1。按需在被忽略的 `.env.local` 设置提醒密钥。 |
| Codespaces | 自动安装依赖并初始化独立本地 D1；密钥使用 Codespaces secrets，不能放进仓库。 |
| Vercel Preview | 使用 Vercel 的 Preview 环境变量和自动生成的 `VERCEL_URL`；API 后端需与正式数据的隔离策略确认后配置。 |
| Vercel Production | 使用 Vercel 的 Production 环境变量和自动生成的 `VERCEL_URL`；API 后端需在部署前确认。 |
