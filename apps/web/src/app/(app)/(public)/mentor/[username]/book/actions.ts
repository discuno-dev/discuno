'use server'
import 'server-only'

import { eq } from 'drizzle-orm'
import type Stripe from 'stripe'
import { z } from 'zod'
import { env } from '~/env'
import { createCalcomBooking } from '~/lib/calcom'
import { MINIMUM_PAID_BOOKING_PRICE } from '~/lib/constants'
import {
  alertAdminForManualRefund,
  sendBookingFailureEmail,
} from '~/lib/emails/booking-notifications'
import { BadRequestError, ExternalApiError, StripeError } from '~/lib/errors'
import { stripe } from '~/lib/stripe'
import { db } from '~/server/db'
import { mentorStripeAccounts, payments } from '~/server/db/schema'
import { getMentorCalcomTokensByUsername, getMentorEnabledEventTypes } from '~/server/queries'

interface BookingData {
  name: string
  email: string
  timeZone?: string
}

export interface CreateBookingInput {
  username: string
  eventTypeId: number
  startTime: string // ISO string
  attendee: BookingData
  mentorUserId: string
}

export const createBooking = async (input: CreateBookingInput): Promise<string> => {
  const { eventTypeId, startTime, attendee, mentorUserId } = input

  const booking = await createCalcomBooking({
    calcomEventTypeId: eventTypeId,
    start: startTime,
    attendeeName: attendee.name,
    attendeeEmail: attendee.email,
    timeZone: attendee.timeZone ?? 'America/New_York',
    mentorUserId,
  })

  return booking.uid
}

export interface TimeSlot {
  time: string
  available: boolean
}

export interface EventType {
  id: number
  title: string
  length: number
  description?: string
  price?: number
  currency?: string
}

// Enhanced interface for payment bookings
// Zod schema for payment booking validation
const BookingFormInputSchema = z.object({
  eventTypeId: z.number().int().positive('Event type ID must be a positive integer'),
  startTimeIso: z.string().refine(val => !isNaN(Date.parse(val)), {
    message: 'Start time must be a valid ISO date string',
  }),
  attendeeName: z
    .string()
    .trim()
    .min(1, 'Attendee name is required')
    .max(100, 'Name must be at most 100 characters'),
  attendeeEmail: z.string().trim().email('Valid email is required'),
  attendeePhone: z
    .string()
    .trim()
    .optional()
    .refine(val => !val || /^\+?[0-9\s\-()]{7,20}$/.test(val), {
      message: 'Phone number must be a valid international phone number',
    }),
  mentorUsername: z
    .string()
    .trim()
    .min(3, 'Mentor username must be at least 3 characters')
    .max(100, 'Mentor username must be at most 100 characters')
    .regex(
      /^[a-zA-Z0-9.-]+$/,
      'Mentor username can only contain letters, numbers, dots, and dashes'
    ),
  mentorUserId: z.string().uuid('Mentor userId must be a valid UUID'),
  price: z
    .number()
    .int()
    .nonnegative('Price must be a non-negative integer')
    .max(1000000, 'Price exceeds maximum allowed value'),
  currency: z
    .string()
    .length(3, 'Currency must be exactly 3 characters')
    .toUpperCase()
    .refine(val => /^[A-Z]{3}$/.test(val), {
      message: 'Currency must be a valid 3-letter ISO code',
    }),
  timeZone: z.string().min(1, 'Time zone is required'),
})

export type BookingFormInput = z.infer<typeof BookingFormInputSchema>

type AvailableSlotsResponse = {
  status: 'success' | 'error'
  data: {
    [date: string]: {
      start: string // ISO 8601 string with timezone offset
    }[]
  }
}

/**
 * Fetch available event types for a given username (using database with joins)
 */
export const fetchEventTypes = async (username: string): Promise<EventType[]> => {
  const mentorTokens = await getMentorCalcomTokensByUsername(username)

  if (!mentorTokens) {
    throw new ExternalApiError(`No Cal.com tokens found for user: ${username}`)
  }

  const mentorPrefs = await getMentorEnabledEventTypes(mentorTokens.userId)

  if (!mentorPrefs.length) {
    console.log(`No enabled event types found for user: ${username}`)
    return []
  }

  return mentorPrefs.map(pref => ({
    id: pref.calcomEventTypeId,
    title: pref.title,
    length: pref.duration,
    description: pref.description ?? undefined,
    price: pref.customPrice ?? undefined, // Keep in cents for consistency with display logic
    currency: pref.currency,
  }))
}

/**
 * Fetch available slots for a given date range and username
 */
export const fetchAvailableSlots = async (
  eventTypeId: number,
  startDate: Date,
  endDate: Date,
  timeZone?: string
): Promise<Record<string, TimeSlot[]>> => {
  const url = new URL(`${env.NEXT_PUBLIC_CALCOM_API_URL}/slots`)
  url.searchParams.append('eventTypeId', eventTypeId.toString())
  url.searchParams.append('start', new Date(startDate).toISOString())
  url.searchParams.append('end', new Date(endDate).toISOString())
  if (timeZone) url.searchParams.append('timeZone', timeZone)

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${env.X_CAL_SECRET_KEY}`,
      'cal-api-version': '2024-09-04',
    },
  })

  if (!response.ok) {
    const err = await response.text()
    throw new ExternalApiError(`Failed to fetch slots: ${response.status} ${err}`)
  }

  const data: AvailableSlotsResponse = await response.json()

  if (data.status !== 'success' || typeof data.data !== 'object') {
    throw new ExternalApiError('Invalid slots response')
  }

  const availableSlots: Record<string, TimeSlot[]> = {}

  for (const dateKey in data.data) {
    const slots = data.data[dateKey]
    if (slots) {
      availableSlots[dateKey] = slots.map(s => ({
        time: s.start,
        available: true,
      }))
    }
  }

  return availableSlots
}

/**
 * Create a paid booking with Stripe Payment Intent including tax calculation
 */
export const createStripeCheckoutSession = async (
  input: BookingFormInput
): Promise<{
  success: boolean
  clientSecret?: string
  checkoutSessionId?: string
}> => {
  try {
    const validatedInput = BookingFormInputSchema.parse(input)
    const {
      eventTypeId,
      startTimeIso,
      attendeeName,
      attendeeEmail,
      attendeePhone,
      mentorUsername,
      mentorUserId,
      price: subtotal,
      currency,
      timeZone,
    } = validatedInput

    console.log('Creating Stripe checkout session for:', {
      mentorUsername,
      attendeeEmail,
      price: subtotal,
    })

    if (subtotal > 0 && subtotal < MINIMUM_PAID_BOOKING_PRICE) {
      throw new BadRequestError('The minimum price for a paid booking is $5.00.')
    }

    if (subtotal === 0) {
      console.log('Skipping Stripe for free booking.')
      throw new BadRequestError('Free bookings should use direct booking flow')
    }

    const stripeAccount = await db
      .select()
      .from(mentorStripeAccounts)
      .where(eq(mentorStripeAccounts.userId, mentorUserId))
      .limit(1)

    if (!stripeAccount.length || !stripeAccount[0]?.stripeAccountId) {
      console.error(`Mentor ${mentorUsername} has not set up a Stripe account.`)
      throw new BadRequestError('Mentor has not set up payments')
    }

    const stripeAccountData = stripeAccount[0]
    const menteeFee = Math.round(subtotal * 0.05)
    const mentorFee = Math.round(subtotal * 0.15)

    const existingCustomer = await stripe.customers.list({
      email: attendeeEmail,
      limit: 1,
    })

    const customerId = existingCustomer.data[0]?.id

    const createParams: Stripe.Checkout.SessionCreateParams = {
      automatic_tax: { enabled: true, liability: { type: 'self' } },
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: 'Mentor Session',
              metadata: {
                mentorUserId: mentorUserId.toString(),
                eventTypeId: eventTypeId.toString(),
                startTime: startTimeIso,
                attendeeName: attendeeName,
              },
            },
            unit_amount: subtotal,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      ui_mode: 'custom',
      allow_promotion_codes: true,
      adaptive_pricing: { enabled: true },
      consent_collection: {
        payment_method_reuse_agreement: { position: 'auto' },
        promotions: 'auto',
      },
      billing_address_collection: 'required',
      currency: currency.toLowerCase(),
      ...(customerId
        ? {
            customer: customerId,
            customer_update: {
              address: 'auto',
              name: 'auto',
            },
          }
        : {
            customer_email: attendeeEmail,
            customer_creation: 'if_required',
          }),
      // TODO: discounts
      payment_intent_data: {
        capture_method: 'automatic_async',
        transfer_data: {
          destination: stripeAccountData.stripeAccountId,
          amount: subtotal - mentorFee,
        },
        receipt_email: attendeeEmail,
        setup_future_usage: 'on_session',
        statement_descriptor_suffix: `MENTOR SESSION`,
      },
      invoice_creation: {
        enabled: true,
        invoice_data: {
          issuer: {
            type: 'self',
          },
        },
      },
      payment_method_options: {
        card: {},
        paypal: {},
      },
      saved_payment_method_options: {
        allow_redisplay_filters: ['always'],
        payment_method_remove: 'enabled',
        payment_method_save: 'enabled',
      },
      return_url: `${env.NEXT_PUBLIC_BASE_URL}/bookings/success`,

      metadata: {
        mentorUserId: mentorUserId.toString(),
        eventTypeId: eventTypeId.toString(),
        startTime: startTimeIso,
        attendeeName: attendeeName,
        attendeeEmail: attendeeEmail,
        attendeePhone: attendeePhone ?? '',
        attendeeTimeZone: timeZone,
        mentorUsername: mentorUsername,
        mentorFee: mentorFee.toString(),
        menteeFee: menteeFee.toString(),
        mentorAmount: (subtotal - mentorFee).toString(),
        mentorStripeAccountId: stripeAccountData.stripeAccountId,
      },
    }

    const session = await stripe.checkout.sessions.create(createParams)

    console.log(`Successfully created Checkout Session: ${session.id}`)
    return {
      success: session.client_secret !== null,
      clientSecret: session.client_secret ?? undefined,
      checkoutSessionId: session.id,
    }
  } catch (error) {
    console.error('Stripe checkout session creation failed:', error)
    if (error instanceof z.ZodError) {
      throw new BadRequestError('Invalid input data.')
    }

    // Handle specific Stripe errors
    if (error && typeof error === 'object' && 'type' in error) {
      const stripeError = error as { type: string; code?: string; message?: string }

      // Handle insufficient capabilities error specifically
      if (stripeError.code === 'insufficient_capabilities_for_transfer') {
        throw new StripeError(
          "The mentor's payment account needs additional capabilities to receive transfers. Please contact the mentor to complete their payment setup."
        )
      }

      // Handle other specific Stripe errors
      if (stripeError.type === 'StripeInvalidRequestError') {
        throw new StripeError(stripeError.message ?? 'Invalid request to Stripe')
      }
    }

    // Generic fallback for other errors
    throw new ExternalApiError('Failed to create checkout session.')
  }
}

/**
 * Handle completed payment intents and create bookings
 */
export const handleCheckoutSessionWebhook = async (
  session: Stripe.Checkout.Session
): Promise<{ success: boolean; error?: string }> => {
  const { metadata, id: sessionId } = session
  if (!metadata) {
    console.error('Missing metadata in checkout session:', sessionId)
    return { success: false, error: 'Missing metadata' }
  }

  console.log(`Handling checkout session webhook for: ${sessionId}`)

  if (
    !metadata.mentorUserId ||
    !metadata.attendeeEmail ||
    !metadata.attendeeName ||
    !metadata.mentorFee ||
    !metadata.menteeFee ||
    !metadata.mentorAmount ||
    !metadata.mentorUsername ||
    !metadata.startTime ||
    !metadata.attendeeTimeZone ||
    !metadata.mentorStripeAccountId
  ) {
    console.error('Missing required metadata in checkout session:', sessionId)
    return { success: false, error: 'Missing required metadata' }
  }

  const disputePeriodEnd = new Date()
  disputePeriodEnd.setHours(disputePeriodEnd.getHours() + 72)

  const paymentIntentId =
    typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id

  if (!paymentIntentId) {
    console.error('Missing payment intent id in checkout session:', sessionId)
    return { success: false, error: 'Missing payment intent id' }
  }

  const insertData: typeof payments.$inferInsert = {
    stripeCheckoutSessionId: sessionId,
    stripePaymentIntentId: paymentIntentId,
    mentorUserId: metadata.mentorUserId,
    customerEmail: metadata.attendeeEmail,
    customerName: metadata.attendeeName,
    amount: session.amount_total ?? 0,
    currency: session.currency?.toUpperCase() ?? 'USD',
    mentorFee: parseInt(metadata.mentorFee),
    menteeFee: parseInt(metadata.menteeFee),
    mentorAmount: parseInt(metadata.mentorAmount),
    platformStatus: 'SUCCEEDED',
    stripeStatus: session.status ?? undefined,
    disputePeriodEnds: disputePeriodEnd,
    metadata: { checkoutSessionMetadata: metadata },
  }

  const paymentRecord = await db.insert(payments).values(insertData).returning()

  if (!paymentRecord[0]) {
    console.error('Failed to create payment record for checkout session:', sessionId)
    return { success: false, error: 'Failed to create payment record' }
  }

  console.log(`Payment record created for checkout session: ${sessionId}`)

  const bookingArgs = {
    calcomEventTypeId: Number(metadata.eventTypeId),
    start: new Date(metadata.startTime).toISOString(),
    attendeeName: metadata.attendeeName,
    attendeeEmail: metadata.attendeeEmail,
    attendeePhone: metadata.attendeePhone,
    timeZone: metadata.attendeeTimeZone,
    paymentId: paymentRecord[0].id,
    mentorUserId: metadata.mentorUserId,
  }

  console.log('Calling createCalcomBooking with:', JSON.stringify(bookingArgs, null, 2))

  try {
    await createCalcomBooking(bookingArgs)
    console.log(`Successfully created Cal.com booking for checkout session: ${sessionId}`)
    return { success: true }
  } catch (error) {
    console.error(
      `Cal.com booking failed for checkout session ${sessionId}. Initiating refund.`,
      error
    )

    const refundResult = await refundStripePaymentIntent(paymentIntentId)

    if (!refundResult.success) {
      // Alert admin for manual refund if automatic refund fails
      console.error(
        `❌ CRITICAL: Automatic refund failed for ${sessionId}. Manual intervention required!`
      )

      try {
        await alertAdminForManualRefund(
          sessionId,
          error instanceof Error ? error : new Error('Cal.com booking failed'),
          new Error(refundResult.error ?? 'Unknown refund error')
        )
      } catch (alertError) {
        console.error('Failed to send admin alert:', alertError)
      }
    }

    await db
      .update(payments)
      .set({ platformStatus: 'FAILED' })
      .where(eq(payments.stripePaymentIntentId, paymentIntentId))

    // Send failure email
    await sendBookingFailureEmail({
      attendeeEmail: metadata.attendeeEmail,
      attendeeName: metadata.attendeeName,
      mentorName: metadata.mentorUsername,
      reason: refundResult.success
        ? 'An unexpected error occurred while creating your booking. Your payment has been refunded.'
        : 'An unexpected error occurred while creating your booking. Please contact support regarding your payment.',
    })

    return {
      success: false,
      error: refundResult.success
        ? 'Failed to create booking, payment has been refunded.'
        : 'Failed to create booking and refund. Please contact support.',
    }
  }
}

/**
 * Refund a Stripe payment intent
 */
export const refundStripePaymentIntent = async (
  paymentIntentId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      // refund full amount
      refund_application_fee: true,
      reverse_transfer: true,
    })

    console.log(`Successfully created refund ${refund.id} for payment intent ${paymentIntentId}`)
    return { success: true }
  } catch (error) {
    console.error(`Failed to refund payment intent ${paymentIntentId}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown refund error',
    }
  }
}
