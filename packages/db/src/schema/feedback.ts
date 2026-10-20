/** Zenith's small, durable product-to-delivery extension. Prose stays in private comments. */
import {
  pgTable,
  text,
  uuid,
  boolean,
  timestamp,
  jsonb,
  integer,
  uniqueIndex,
  index,
  check,
  foreignKey,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { typeIdColumn } from '@zenith/ids/drizzle'
import { boards } from './boards'
import { segments } from './segments'
import { principal } from './auth'
import { posts } from './posts'

export const feedbackProducts = pgTable('feedback_products', {
  key: text('key').primaryKey(),
  name: text('name').notNull(),
  boardId: typeIdColumn('board')('board_id')
    .notNull()
    .unique()
    .references(() => boards.id),
  segmentId: typeIdColumn('segment')('segment_id')
    .notNull()
    .unique()
    .references(() => segments.id),
  allowedOrigins: jsonb('allowed_origins').$type<string[]>().notNull(),
  repository: text('repository').notNull(),
  environment: text('environment').notNull(),
  appUrl: text('app_url').notNull(),
  identitySecret: text('identity_secret').notNull(),
  deploymentSecret: text('deployment_secret').notNull(),
  approvalSecret: text('approval_secret').notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const productUserBindings = pgTable(
  'product_user_bindings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    productKey: text('product_key')
      .notNull()
      .references(() => feedbackProducts.key),
    appUserId: text('app_user_id').notNull(),
    principalId: typeIdColumn('principal')('principal_id')
      .notNull()
      .references(() => principal.id),
    email: text('email').notNull(),
    displayName: text('display_name').notNull(),
    active: boolean('active').default(true).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('product_user_subject_idx').on(t.productKey, t.appUserId),
    uniqueIndex('product_user_active_principal_idx')
      .on(t.productKey, t.principalId)
      .where(sql`${t.active} = true`),
  ]
)

export const feedbackWork = pgTable(
  'feedback_work',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    productKey: text('product_key')
      .notNull()
      .references(() => feedbackProducts.key),
    canonicalPostId: typeIdColumn('post')('canonical_post_id').notNull(),
    sourceIds: jsonb('source_ids').$type<string[]>().notNull(),
    ownerId: typeIdColumn('principal')('owner_id')
      .notNull()
      .references(() => principal.id),
    sessionId: text('session_id').notNull(),
    claimHash: text('claim_hash').notNull(),
    phase: text('phase').notNull().default('claimed'),
    revision: integer('revision').notNull().default(1),
    state: jsonb('state').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('feedback_work_product_phase_idx').on(t.productKey, t.phase),
    check(
      'feedback_work_phase_check',
      sql`${t.phase} in ('claimed','planned','approved','implementing','ready','deployed','released')`
    ),
    foreignKey({
      name: 'feedback_work_canonical_post_id_fkey',
      columns: [t.canonicalPostId],
      foreignColumns: [posts.id],
    }),
  ]
)
