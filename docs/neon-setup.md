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

## Web Push / 每日提醒（后续步骤）

数据库接通 **不代表** 每日推送已经生效。还需要在 Vercel 服务器环境变量中设置：
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`（如 `mailto:example@example.com`）
- `DISPATCH_SECRET`（高强度随机值）

然后验证 iPhone 主屏幕 PWA 的测试通知与 `/api/internal/reminders/dispatch` 的鉴权派发，最后接入定时调度。
Vercel Hobby 的 Cron 不支持按每名用户设置的分钟级时间精确触发；不要在调度配置完成前宣称自动提醒已经可用。

## 数据说明

此次迁移新建空库，**不迁移旧 Cloudflare D1 的数据**。同一部手机已有的课表可能保存在 localStorage，首次连接后会尝试同步到 Neon。跨设备自动共享不等同于同一账号同步：当前系统使用每台设备的匿名 token。
