import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const devices = sqliteTable('devices', {
  id: text('id').primaryKey(),
  tokenHash: text('token_hash').notNull(),
  createdAt: integer('created_at').notNull(),
}, (table) => [uniqueIndex('idx_devices_token_hash').on(table.tokenHash)])

export const deviceStates = sqliteTable('device_states', {
  deviceId: text('device_id').primaryKey().references(() => devices.id, { onDelete: 'cascade' }),
  slotsJson: text('slots_json').notNull().default('[]'),
  booksJson: text('books_json').notNull().default('{}'),
  reminderEnabled: integer('reminder_enabled', { mode: 'boolean' }).notNull().default(false),
  reminderTime: text('reminder_time').notNull().default('20:00'),
  timezone: text('timezone').notNull().default('Asia/Shanghai'),
  lastSent: text('last_sent').notNull().default(''),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [index('idx_device_states_reminder_enabled').on(table.reminderEnabled)])

export const pushSubscriptions = sqliteTable('push_subscriptions', {
  id: text('id').primaryKey(),
  deviceId: text('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: integer('created_at').notNull(),
  lastSuccessAt: integer('last_success_at'),
  failureCount: integer('failure_count').notNull().default(0),
}, (table) => [
  uniqueIndex('idx_push_subscriptions_endpoint').on(table.endpoint),
  index('idx_push_subscriptions_device_id').on(table.deviceId),
])

export const reminderDeliveries = sqliteTable('reminder_deliveries', {
  id: text('id').primaryKey(),
  deviceId: text('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  localDate: text('local_date').notNull(),
  status: text('status').notNull(),
  sentAt: integer('sent_at'),
}, (table) => [uniqueIndex('idx_reminder_deliveries_device_date').on(table.deviceId, table.localDate)])
