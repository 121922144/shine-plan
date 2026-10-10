# Vercel + Neon 后端接通（开发分支）

「闪闪计划」的 Vercel 前端与 API 在同一项目下，客户端调用相对路径 `/api/*`。
Vercel Functions 通过服务器端 `DATABASE_URL` 连接 Neon PostgreSQL；绝不能将数据库地址放进 `VITE_*` 环境变量。

## 首次建立数据库

1. Vercel → Storage → `neon-citron-house`，确认 Connected Projects 中包含 `shine-plan`。
2. Vercel → `shine-plan` → Environment Variables，确认 **Preview** 环境包含 `DATABASE_URL`，且为 Neon 集成配置。不要公开变量值。
3. 点击数据库的 **Open in Neon**，进入 Neon 控制台的 **SQL Editor**。
4. 将仓库里的 [scripts/neon-schema.sql](../scripts/neon-schema.sql) 全部复制到 SQL Editor 并执行。这是新数据库建表脚本，不会操作旧 Cloudflare D1。
5. 执行后的最后一个 SELECT 应返回四张表：`devices`、`device_states`、`push_subscriptions`、`reminder_deliveries`。

## 部署与验证

- 等 Vercel Preview 重新部署开发分支；原 Production 基于 `main`，不会随这个开发分支变化。
- 在 **Preview** 地址访问 `/api/config`，应该得到类似 `{"pushAvailable":false,"vapidPublicKey":""}` 的 JSON（未配置推送密钥是正常的）。
- 打开 Preview 的设置页，查看「匿名云端保存」是否变为「已同步到云端」。
- 在 Preview 中保存一节课程，刷新再打开，确认仍然显示；最好在关闭 VPN 后别清理 Safari 数据以免误删本机备份。
- 若失败，在 Vercel → Logs 中查看 Function 错误。不要将 `DATABASE_URL` 或推送私钥贴入聊天。

## iPhone Web Push：先验证即时测试通知

**Web Push 与每天定时派发是两个阶段。** 项目使用 `@block65/webcrypto-web-push@2`，支持 iOS 的 RFC 8291 / RFC 8292；旧的 1.x 不支持 Apple Push。

1. 在你自己的电脑上进入仓库目录并切换到开发分支：`git checkout fix/home-course-list-match-schedule-20260929`，`git pull`。确认本地 Node 版本 ≥ 22。
2. 在终端执行 `npm run push:keys`（等价于 `node scripts/generate-vapid-keys.mjs`），本地生成一对 VAPID 密钥。**不要把生成的私钥发给 ChatGPT、截屏或提交到 GitHub。**
3. Vercel → `shine-plan` → **Settings → Environment Variables**，依次添加：
   - `VAPID_PUBLIC_KEY`：输出的公钥。
   - `VAPID_PRIVATE_KEY`：输出的私钥，务必只配置为服务器端环境变量，不加 `VITE_` 前缀。
   - `VAPID_SUBJECT`：改为你自己的有效邮箱，例如 `mailto:your-email@example.com`（不要照抄占位符）。
   - 环境范围先只选择 **Preview**，不要在调试期间改 Production。
4. 变量变更对新部署生效。进入 Deployments，对**开发分支**最新的 Preview 执行 **Redeploy**（不要 redeploy Production）。在 Preview 地址打开 `/api/config`：必须返回 JSON 且 `pushAvailable: true`。**不要分享含有私钥的页面截图。**
5. iPhone 必须 iOS 16.4+。使用 Safari 打开 Preview 地址 → **分享 → 添加到主屏幕**。从主屏幕图标打开后进入 **设置 → 每日提醒**，开启通知权限、点击开关。此时服务器会向这台手机发一条即时测试通知。
6. iOS 系统通知权限若曾拒绝，进入 iPhone 设置 → 通知 → 闪闪计划，允许通知。测试成功以后，在 Neon Preview 分支的 `push_subscriptions` 表能看到一条记录，且 `last_success_at` 不为空。**不要直接在 Safari 普通标签页测试 iOS Web Push。**

### 注意

- 只设置 VAPID 密钥并打开开关，**不等于每天到指定时间会自动弹出通知**；这还需要定时调度。
- Vercel Hobby Cron 最多每天一次，且可能在指定小时内的任意时刻触发，**无法精确实现每台手机自定义的分钟级提醒时间**。
- 在选择调度方案前不要配置或开放 `DISPATCH_SECRET`。后续会为 `/api/internal/reminders/dispatch` 设置安全调用和定时派发。
- 重新生成并更换 VAPID 密钥会使旧的推送订阅失效，需要手机重新关闭、开启提醒。

### 已验证结果

Neon 已连接到 `shine-plan`；Preview 分支 `preview/fix/home-course-list-match-schedule-20260929` 已成功创建上述四张表并验证云端保存。这个步骤无需重复执行。

## 数据说明

此次迁移新建空库，**不迁移旧 Cloudflare D1 的数据**。同一部手机已有的课表可能保存在 localStorage，首次连接后会尝试同步到 Neon。跨设备自动共享不等同于同一账号同步：当前系统使用每台设备的匿名 token。
