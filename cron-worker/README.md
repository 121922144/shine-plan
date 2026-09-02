# 书包计划定时提醒

这个 Worker 每五分钟调用一次正式站点的提醒派发接口。

部署正式站点后，把 `SITE_DISPATCH_URL` 改为正式地址，并用 `wrangler secret put DISPATCH_SECRET` 设置与 Sites 相同的派发密钥，再执行 `wrangler deploy --config cron-worker/wrangler.toml`。
