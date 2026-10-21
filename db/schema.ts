import { bigint, boolean, index, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'

export const devices = pgTable('devices', {
  id: text('id').primaryKey(),
  tokenHash: text('token_hash').notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
}, (table) => [uniqueIndex('idx_devices_token_hash').on(table.tokenHash)])

export const deviceStates = pgTable('device_states', {
  deviceId: text('device_id').primaryKey().references(() => devices.id, { onDelete: 'cascade' }),
  slotsJson: text('slots_json').notNull().default('[]'),
  notesJson: text('notes_json').notNull().default('[]'),
  reminderEnabled: boolean('reminder_enabled').notNull().default(false),
  reminderTime: text('reminder_time').notNull().default('20:00'),
  timezone: text('timezone').notNull().default('Asia/Shanghai'),
  lastSent: text('last_sent').notNull().default(''),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
}, (table) => [index('idx_device_states_reminder_enabled').on(table.reminderEnabled)])

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: text('id').primaryKey(),
  deviceId: text('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  lastSuccessAt: bigint('last_success_at', { mode: 'number' }),
  failureCount: bigint('failure_count', { mode: 'number' }).notNull().default(0),
}, (table) => [
  uniqueIndex('idx_push_subscriptions_endpoint').on(table.endpoint),
  index('idx_push_subscriptions_device_id').on(table.deviceId),
])

export const reminderDeliveries = pgTable('reminder_deliveries', {
  id: text('id').primaryKey(),
  deviceId: text('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  localDate: text('local_date').notNull(),
  status: text('status').notNull(),
  sentAt: bigint('sent_at', { mode: 'number' }),
}, (table) => [uniqueIndex('idx_reminder_deliveries_device_date').on(table.deviceId, table.localDate)])
