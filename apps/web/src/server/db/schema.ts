import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { type AdapterAccount } from 'next-auth/adapters'
import { softDeleteTimestamps, timestamps } from '~/server/db/columns.helpers'

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */

export const users = pgTable('discuno_user', {
  id: uuid().defaultRandom().primaryKey(),
  name: varchar({ length: 255 }),
  email: varchar({ length: 255 }).unique(),
  emailVerified: timestamp({
    mode: 'date',
    withTimezone: true,
  }).default(sql`CURRENT_TIMESTAMP`),
  image: varchar({ length: 255 }),
  ...softDeleteTimestamps,
})

export const posts = pgTable(
  'discuno_post',
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    name: varchar({ length: 256 }),
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    random_sort_key: real('random_sort_key').default(Math.random()).notNull(),
    ...softDeleteTimestamps,
  },
  example => [
    index('created_by_idx').on(example.createdById),
    index('name_idx').on(example.name),
    index('created_at_created_by_idx').on(example.createdAt, example.createdById),
    index('posts_created_at_partial_idx')
      .on(example.createdAt)
      .where(sql`deleted_at IS NULL`),
  ]
)

export const postsRelations = relations(posts, ({ one }) => ({
  creator: one(users, { fields: [posts.createdById], references: [users.id] }), // Link 'createdById' with 'users.id'
}))

export const usersRelations = relations(users, ({ many, one }) => ({
  accounts: many(accounts),
  calcomTokens: one(calcomTokens),
  stripeAccount: one(mentorStripeAccounts),
  mentorEventTypes: many(mentorEventTypes),
}))

export const accounts = pgTable(
  'discuno_account',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: varchar({ length: 255 }).$type<AdapterAccount['type']>().notNull(),
    provider: varchar({ length: 255 }).notNull(),
    // NextAuth requires snake case for these fields
    providerAccountId: varchar({ length: 255 }).notNull(),
    refresh_token: text(''),
    access_token: text(''),
    expires_at: integer(),
    token_type: varchar({ length: 255 }),
    scope: varchar({ length: 255 }),
    id_token: text(),
    session_state: varchar({ length: 255 }),
  },
  account => [
    primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
    index('account_user_id_idx').on(account.userId),
  ]
)

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}))

export const sessions = pgTable(
  'discuno_session',
  {
    sessionToken: varchar({ length: 255 }).notNull().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expires: timestamp({
      mode: 'date',
      withTimezone: true,
    }).notNull(),
  },
  session => [index('session_user_id_idx').on(session.userId)]
)

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))

export const verificationTokens = pgTable(
  'discuno_verification_token',
  {
    identifier: varchar({ length: 255 }).notNull(),
    token: varchar({ length: 255 }).notNull(),
    expires: timestamp({
      mode: 'date',
      withTimezone: true,
    }).notNull(),
  },
  vt => [primaryKey({ columns: [vt.identifier, vt.token] })]
)

export const schoolYearEnum = pgEnum('school_year', [
  'Freshman',
  'Sophomore',
  'Junior',
  'Senior',
  'Graduate',
] as const)

export const userProfiles = pgTable(
  'discuno_user_profile',
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    bio: varchar({ length: 1000 }),
    schoolYear: schoolYearEnum().notNull(),
    graduationYear: integer().notNull(), // E.g., 2027
    timezone: varchar({ length: 255 }).notNull().default('UTC'),
    rankingScore: real('ranking_score').default(0).notNull(),
    ...softDeleteTimestamps,
  },
  table => [
    index('graduation_school_year_idx').on(table.graduationYear, table.schoolYear),
    check('grad_year_check', sql`${table.graduationYear} >= EXTRACT(YEAR FROM CURRENT_DATE)`),
    index('user_profiles_compound_idx').on(table.userId, table.graduationYear, table.schoolYear),
    index('user_profiles_grad_year_partial_idx')
      .on(table.graduationYear)
      .where(sql`deleted_at IS NULL`),
  ]
)

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, { fields: [userProfiles.userId], references: [users.id] }),
}))

export const userMajors = pgTable(
  'discuno_user_major',
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    majorId: integer()
      .notNull()
      .references(() => majors.id),
    ...softDeleteTimestamps,
  },
  table => [index('major_user_compound_idx').on(table.majorId, table.userId)]
)

export const userSchools = pgTable(
  'discuno_user_school',
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    schoolId: integer()
      .notNull()
      .references(() => schools.id),
    ...softDeleteTimestamps,
  },
  table => [
    index('user_school_idx').on(table.userId, table.schoolId),
    index('school_user_compound_idx').on(table.schoolId, table.userId),
  ]
)

export const majors = pgTable('discuno_major', {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
  name: varchar({ length: 255 }).notNull().unique(),
  ...timestamps,
})

export const schools = pgTable('discuno_school', {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
  name: varchar({ length: 255 }).unique().notNull(),
  domain: varchar({ length: 255 }).unique().notNull(),
  location: varchar({ length: 255 }).notNull(),
  image: varchar({ length: 255 }),
  primaryColor: varchar({ length: 7 }), // e.g., '#RRGGBB'
  secondaryColor: varchar({ length: 7 }), // e.g., '#RRGGBB'
  ...timestamps,
})

export const mentorReviews = pgTable(
  'discuno_mentor_review',
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    mentorId: uuid('mentor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    rating: integer().notNull(),
    review: varchar({ length: 1000 }),
    ...softDeleteTimestamps,
  },
  table => [check('rating_check', sql`${table.rating} >= 1 AND ${table.rating} <= 5`)]
)

export const calcomTokens = pgTable(
  'discuno_calcom_token',
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    calcomUserId: integer().notNull(), // Cal.com managed user ID
    calcomUsername: varchar({ length: 255 }).notNull(), // Cal.com generated username
    accessToken: text().notNull(),
    refreshToken: text().notNull(),
    accessTokenExpiresAt: timestamp({
      mode: 'date',
      withTimezone: true,
    }).notNull(),
    refreshTokenExpiresAt: timestamp({
      mode: 'date',
      withTimezone: true,
    }).notNull(),
    ...timestamps,
  },
  table => [
    index('calcom_tokens_user_id_idx').on(table.userId),
    index('calcom_tokens_access_token_idx').on(table.accessToken),
    index('calcom_tokens_username_idx').on(table.calcomUsername),
  ]
)

export const calcomTokensRelations = relations(calcomTokens, ({ one }) => ({
  user: one(users, { fields: [calcomTokens.userId], references: [users.id] }),
}))

// Mentor Stripe account information
export const stripeAccountStatusEnum = pgEnum('stripe_account_status', [
  'pending',
  'active',
  'restricted',
  'inactive',
] as const)

export const mentorStripeAccounts = pgTable(
  'discuno_mentor_stripe_account',
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    stripeAccountId: varchar({ length: 255 }).notNull().unique(),
    stripeAccountStatus: stripeAccountStatusEnum(),
    onboardingCompleted: timestamp({
      mode: 'date',
      withTimezone: true,
    }),
    payoutsEnabled: boolean().notNull().default(false),
    chargesEnabled: boolean().notNull().default(false),
    detailsSubmitted: boolean().notNull().default(false),
    requirements: jsonb().default('{}'),
    ...timestamps,
  },
  table => [
    index('mentor_stripe_accounts_user_id_idx').on(table.userId),
    index('mentor_stripe_accounts_stripe_account_id_idx').on(table.stripeAccountId),
  ]
)

export const mentorStripeAccountsRelations = relations(mentorStripeAccounts, ({ one }) => ({
  user: one(users, { fields: [mentorStripeAccounts.userId], references: [users.id] }),
}))

// Mentor event type preferences and pricing (junction table)
export const mentorEventTypes = pgTable(
  'discuno_mentor_event_type',
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    mentorUserId: uuid('mentor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    calcomEventTypeId: integer().unique().notNull(), // The mentor's individual Cal.com event type ID
    isEnabled: boolean().notNull().default(false), // Whether this mentor has enabled this event type
    customPrice: integer().default(0).notNull(), // Price in cents (e.g., 2500 = $25.00)
    currency: varchar({ length: 3 }).notNull().default('USD'),
    title: varchar({ length: 255 }).notNull(),
    description: varchar({ length: 500 }),
    duration: integer().notNull(),
    ...softDeleteTimestamps,
  },
  table => [
    index('mentor_event_types_user_idx').on(table.mentorUserId),
    index('mentor_event_types_calcom_idx').on(table.calcomEventTypeId),
  ]
)

export const mentorEventTypesRelations = relations(mentorEventTypes, ({ one, many }) => ({
  user: one(users, { fields: [mentorEventTypes.mentorUserId], references: [users.id] }),
  bookings: many(bookings),
}))

// Booking status enum
export const bookingStatusEnum = pgEnum('booking_status', [
  'ACCEPTED',
  'PENDING',
  'CANCELLED',
  'REJECTED',
  'COMPLETED',
  'NO_SHOW',
] as const)

// Bookings table to store Cal.com booking data
export const bookings = pgTable(
  'discuno_booking',
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    // Cal.com booking identifiers
    calcomBookingId: integer().notNull().unique(), // Cal.com booking ID
    calcomUid: varchar({ length: 255 }).notNull().unique(), // Cal.com UID

    // Booking details snapshot
    title: varchar({ length: 500 }).notNull(),
    description: varchar({ length: 1000 }),
    startTime: timestamp({
      mode: 'date',
      withTimezone: true,
    }).notNull(),
    endTime: timestamp({
      mode: 'date',
      withTimezone: true,
    }).notNull(),
    status: bookingStatusEnum().notNull().default('PENDING'),
    meetingUrl: varchar({ length: 255 }),
    hostNoShow: boolean('host_no_show').default(false),
    attendeeNoShow: boolean('attendee_no_show').default(false),

    // Event type reference
    mentorEventTypeId: integer().references(() => mentorEventTypes.id, {
      onDelete: 'set null',
    }),

    // Payment reference (will be set after payment is processed)
    paymentId: integer().references(() => payments.id, { onDelete: 'set null' }),

    // Response data (name, email, location, notes, etc.)
    responses: jsonb().default('{}'),

    // Full webhook payload for auditing and future-proofing
    webhookPayload: jsonb().notNull(),

    ...softDeleteTimestamps,
  },
  table => [
    index('bookings_calcom_booking_id_idx').on(table.calcomBookingId),
    index('bookings_calcom_uid_idx').on(table.calcomUid),
    index('bookings_start_time_idx').on(table.startTime),
    index('bookings_status_idx').on(table.status),
    index('bookings_mentor_event_type_id_idx').on(table.mentorEventTypeId),
  ]
)

// Booking attendees table to store attendee information separately
export const bookingAttendees = pgTable(
  'discuno_booking_attendee',
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    bookingId: integer()
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    // Future proofing for logged in users
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    name: varchar({ length: 255 }).notNull(),
    email: varchar({ length: 255 }).notNull(),
    phoneNumber: varchar({ length: 255 }),
    timeZone: varchar({ length: 100 }),
    ...softDeleteTimestamps,
  },
  table => [
    index('booking_attendees_booking_id_idx').on(table.bookingId),
    index('booking_attendees_user_id_idx').on(table.userId),
    index('booking_attendees_email_idx').on(table.email),
  ]
)

// Booking organizers table to store organizer (mentor) information separately
export const bookingOrganizers = pgTable(
  'discuno_booking_organizer',
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    bookingId: integer()
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar({ length: 255 }).notNull(),
    email: varchar({ length: 255 }).notNull(),
    username: varchar({ length: 255 }).notNull(),
    ...softDeleteTimestamps,
  },
  table => [
    index('booking_organizers_booking_id_idx').on(table.bookingId),
    index('booking_organizers_user_id_idx').on(table.userId),
    index('booking_organizers_email_idx').on(table.email),
  ]
)

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  mentorEventType: one(mentorEventTypes, {
    fields: [bookings.mentorEventTypeId],
    references: [mentorEventTypes.id],
  }),
  payment: one(payments, { fields: [bookings.paymentId], references: [payments.id] }),
  attendees: many(bookingAttendees),
  organizers: many(bookingOrganizers),
}))

export const bookingAttendeesRelations = relations(bookingAttendees, ({ one }) => ({
  booking: one(bookings, { fields: [bookingAttendees.bookingId], references: [bookings.id] }),
  user: one(users, { fields: [bookingAttendees.userId], references: [users.id] }),
}))

export const bookingOrganizersRelations = relations(bookingOrganizers, ({ one }) => ({
  booking: one(bookings, { fields: [bookingOrganizers.bookingId], references: [bookings.id] }),
  user: one(users, { fields: [bookingOrganizers.userId], references: [users.id] }),
}))

// Payment status enum
export const paymentStatusEnum = pgEnum('payment_status', [
  'PENDING',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED',
  'DISPUTED',
  'REFUNDED',
  'TRANSFERRED',
] as const)

export const stripePaymentStatusEnum = pgEnum('stripe_payment_status', [
  'open',
  'complete',
  'expired',
] as const)

// Payments table to track Stripe payments and transfers
export const payments = pgTable(
  'discuno_payment',
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),

    stripePaymentIntentId: varchar({ length: 255 }).notNull().unique(),

    stripeCheckoutSessionId: varchar({ length: 255 }).notNull().unique(),

    mentorUserId: uuid('mentor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    customerEmail: varchar({ length: 255 }).notNull(),
    customerName: varchar({ length: 255 }).notNull(),

    amount: integer().notNull(), // in cents
    currency: varchar({ length: 3 }).notNull().default('USD'),

    mentorFee: integer().notNull(), // in cents (amount - platformFee)
    menteeFee: integer().notNull(), // in cents (amount - platformFee)

    mentorAmount: integer().notNull(), // in cents (amount - platformFee)

    platformStatus: paymentStatusEnum().notNull().default('PENDING'),
    stripeStatus: stripePaymentStatusEnum().notNull().default('open'), // Stripe payment status

    transferId: varchar({ length: 255 }), // Stripe transfer ID when funds sent to mentor
    transferStatus: varchar({ length: 50 }), // Transfer status
    transferRetryCount: integer().notNull().default(0), // Number of transfer retry attempts

    disputeRequested: boolean().notNull().default(false), // Admin flag to prevent auto-transfer
    disputePeriodEnds: timestamp({
      mode: 'date',
      withTimezone: true,
    }).notNull(),

    metadata: jsonb().default('{}'),

    ...timestamps,
  },
  table => [
    index('payments_mentor_user_id_idx').on(table.mentorUserId),
    index('payments_platform_status_idx').on(table.platformStatus),
    index('payments_dispute_period_ends_idx').on(table.disputePeriodEnds),
    index('payments_stripe_payment_intent_id_idx').on(table.stripePaymentIntentId),
    index('payments_stripe_checkout_session_id_idx').on(table.stripeCheckoutSessionId),
  ]
)

export const paymentsRelations = relations(payments, ({ one }) => ({
  mentorUser: one(users, { fields: [payments.mentorUserId], references: [users.id] }),
}))

export const analyticsEventEnum = pgEnum('analytics_event_type', [
  'PROFILE_VIEW',
  'POST_LIKE',
  'DISCORD_ACTIVITY',
  'CHAT_REPLY',
  'COMPLETED_BOOKING',
  'CANCELLED_BOOKING',
])

export const analyticsEvents = pgTable(
  'discuno_analytics_event',
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    eventType: analyticsEventEnum('event_type').notNull(),
    actorUserId: uuid('actor_user_id').references(() => users.id, {
      onDelete: 'set null',
    }), // User performing the action (optional)
    targetUserId: uuid('target_user_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'no action',
      }), // User being acted upon
    postId: integer().references(() => posts.id, { onDelete: 'set null' }),
    distinctId: varchar({ length: 255 }), // PostHog distinct_id (anonymous or authenticated)
    processed: boolean('processed').default(false).notNull(),
    ...softDeleteTimestamps,
  },
  table => [
    index('analytics_events_event_type_idx').on(table.eventType),
    index('analytics_events_actor_user_id_idx').on(table.actorUserId),
    index('analytics_events_target_user_id_idx').on(table.targetUserId),
    index('analytics_events_post_id_idx').on(table.postId),
    index('analytics_events_distinct_id_idx').on(table.distinctId),
  ]
)
