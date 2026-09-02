CREATE TABLE `device_states` (
	`device_id` text PRIMARY KEY NOT NULL,
	`slots_json` text DEFAULT '[]' NOT NULL,
	`books_json` text DEFAULT '{}' NOT NULL,
	`reminder_enabled` integer DEFAULT false NOT NULL,
	`reminder_time` text DEFAULT '20:00' NOT NULL,
	`timezone` text DEFAULT 'Asia/Shanghai' NOT NULL,
	`last_sent` text DEFAULT '' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_device_states_reminder_enabled` ON `device_states` (`reminder_enabled`);--> statement-breakpoint
CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_devices_token_hash` ON `devices` (`token_hash`);--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_success_at` integer,
	`failure_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_push_subscriptions_endpoint` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE INDEX `idx_push_subscriptions_device_id` ON `push_subscriptions` (`device_id`);--> statement-breakpoint
CREATE TABLE `reminder_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`local_date` text NOT NULL,
	`status` text NOT NULL,
	`sent_at` integer,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_reminder_deliveries_device_date` ON `reminder_deliveries` (`device_id`,`local_date`);