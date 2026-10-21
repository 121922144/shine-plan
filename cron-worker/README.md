# 闪闪计划：Preview 每日课程提醒定时器

> **状态：代码已准备，Cloudflare Worker 尚需账号所有者部署与配置密钥。**
> 本定时器只访问 Vercel Preview，不涉及 Production、旧 Cloudflare D1 或 VAPID 私钥。

## 运行原理

- iPhone 从主屏幕开启提醒后，Neon `device_states` 存储 `reminder_enabled`、`reminder_time` 和 IANA `timezone`。
- 独立 Cloudflare Worker 按 UTC Cron 运行，携带私密 `DISPATCH_SECRET` 调用 Vercel Preview 的 `POST /api/internal/reminders/dispatch`。
- Vercel 根据**每台设备**保存的本地时区和 `HH:mm` 判断是否到点，再生成第二天的课程和备注，使用已有 Web Push 发至手机。
- `reminder_deliveries` 以设备和本地日期去重，成功后当天不重复发送。
- 若某次发送失败，下一次调用可以重试。Cron 只负责触发，不会保存设备、课程、VAPID 密钥或数据库连接串。

### 免费配额与时间精度

目前仅一部 iPhone 开启 20:00（Asia/Shanghai）提醒。为了避免 Neon 免费版每 5 分钟被唤醒而无法休眠，配置为：

| 北京时间 | 检查间隔 | 可能的延迟 |
| --- | --- | --- |
| 18:00–22:59 | 每 5 分钟 | 通常 0–5 分钟，受平台调度与网络影响 |
| 其余时间 | 每小时 | 可能接近 60 分钟 |

这个方案优先保证当前 20:00 提醒的及时性；需要全天精细到分钟时，须重新评估 Neon 计算时长和调度策略。Cron 不等于毫秒级精确保证。Cloudflare Cron 修改最长可能约 15 分钟传播。

## 配置步骤（Windows 11 / PowerShell）

### 1. Vercel Preview 设置派发密钥

先在**自己的电脑**用 PowerShell 运行：

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

复制输出的随机字符串到你自己的密码管理器；**不要发送给任何聊天、不截屏、不提交 GitHub**。

在 Vercel → `shine-plan` → **Environment Variables** 新增：

- Key: `DISPATCH_SECRET`
- Value: 上面的随机字符串
- Environments: **Preview**（包含 `fix/home-course-list-match-schedule-20260929` 分支）

保存后，把当前开发分支最新 Preview 重新部署，确认变成 **Ready**。环境变量只能在新部署中读取。

> 注意：派发密钥与 `VAPID_PUBLIC_KEY`、`VAPID_PRIVATE_KEY`、`VAPID_SUBJECT` 是不同的东西；三项 VAPID 配置不要修改。也不需要在 Cloudflare 配置数据库密码或 VAPID 私钥。

### 2. 部署独立 Cloudflare Worker

本地进入 GitHub 仓库根目录，切到最新开发分支：

```powershell
git checkout fix/home-course-list-match-schedule-20260929
git pull
npm ci
npx wrangler login
```

如 `wrangler.toml` 中 `SITE_DISPATCH_URL` 与 Vercel 最新 Preview **Visit** 打开的地址不同，请把它改成那个站点的 https 基础网址，不能带 `/api/config` 或查询参数。

在仓库根目录执行：

```powershell
npx wrangler secret put DISPATCH_SECRET --config cron-worker/wrangler.toml
```

按提示粘贴**第 1 步生成的同一个随机字符串**。这个命令以 Cloudflare 加密 Secret 存储，不应该把值写入任何源码文件。

然后执行：

```powershell
npx wrangler deploy --config cron-worker/wrangler.toml
```

确认 Cloudflare 控制台 → **Workers & Pages** → `shine-plan-preview-reminder-cron` → **Triggers / Cron Triggers** 显示两个 Cron 表达式。

**提示：** 初次设置 `wrangler secret put` 时，Wrangler 可能提示创建 Worker，按提示确认即可。若 Secret 的设置顺序或 `required` 校验阻止部署，先按照 Wrangler 提示完成 Secret 设置，不要把明文密钥写入 `wrangler.toml`。

### 如果 Cloudflare 日志报 `Reminder dispatch rejected: HTTP 302`

HTTP 302 表示 Vercel 将定时器请求重定向了。**常见原因是 Preview 的 Vercel Authentication / Deployment Protection**；仅凭 HTTP 状态不能排除其他重定向原因。

优先保持 Preview 保护，在 Vercel `shine-plan → Settings → Deployment Protection → Protection Bypass for Automation` 中生成一个用于 Cloudflare Cron 的 bypass secret。官方文档：https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation

此 bypass secret 与 `DISPATCH_SECRET` 是**不同的两份密钥**：

- `DISPATCH_SECRET`：Vercel API 验证派发任务身份；Cloudflare Worker 已存储。
- `VERCEL_AUTOMATION_BYPASS_SECRET`：允许 Cloudflare 请求跨过 Vercel Preview 访问保护；仅存储到 Cloudflare Worker Secret。

在**仓库根目录**执行（粘贴刚在 Vercel 生成的 bypass secret）：

```powershell
npx wrangler secret put VERCEL_AUTOMATION_BYPASS_SECRET --config cron-worker/wrangler.toml
npx wrangler deploy --config cron-worker/wrangler.toml
```

Worker 若读取到该 secret，会在给 Vercel 的请求中添加 `x-vercel-protection-bypass` HTTP header，并继续发送原来的 `Authorization: Bearer DISPATCH_SECRET`。不需要将 bypass secret 加入 `wrangler.toml`、GitHub、URL 或 Vercel 自定义环境变量。

如果仍返回 302，先只读检查 Vercel 的重定向目标，再判断是否因错误域名、未更新部署或访问保护导致；不要直接关闭整站访问保护。

### 3. 验证定时调度和推送

1. 保持 iPhone「闪闪计划」设置 → 每日提醒处于开启状态，时间为 20:00。
2. Cloudflare 控制台 → Worker → **Observability / Logs**：20:00 附近应出现 `[shine-plan-reminders]`，成功时 `sent: 1`，未到时间时 `skipped: 1`。
3. 到 20:00 后在 Neon Preview 数据库执行（只查汇总，不显示订阅私密地址）：

```sql
SELECT local_date, status, sent_at
FROM reminder_deliveries
ORDER BY local_date DESC
LIMIT 5;
```

返回当天 `status = 'sent'` 后应能在 iPhone 收到一条「明天的课程提醒」通知。

如果收到 `HTTP 401`：优先检查 Preview 与 Cloudflare 中 `DISPATCH_SECRET` 是否完全相同、Preview 是否重新部署。若出现 `HTTP 403` 或 `302`：检查 Vercel Preview Deployment Protection，确保外部 Worker 可以访问，不要把私钥放到网址里。

### 日后迁移到正式版

正式环境的数据、密钥及域名应单独配置并验证。在未迁移、未验证前，请**不要把 Cloudflare Worker 指向 Production**，也不要修改当前正式版的提醒设置。

### 停用

Cloudflare 控制台里移除/禁用该 Worker 的 Cron Trigger，便可停止自动触发，不会删除 Neon 的课表和提醒设置。也可把 `cron-worker/wrangler.toml` 的 `crons` 设置为 `[]` 再部署。
