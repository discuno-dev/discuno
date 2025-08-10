'use server'

import { eq } from 'drizzle-orm'
import type Stripe from 'stripe'
import { z } from 'zod'
import { createTaxTransaction } from '~/app/(app)/(public)/mentor/[username]/book/tax-actions'
import { env } from '~/env'
import { createCalcomBooking } from '~/lib/calcom'
import { ExternalApiError } from '~/lib/errors'
import { stripe } from '~/lib/stripe'
import { db } from '~/server/db'
import { mentorStripeAccounts, payments } from '~/server/db/schema'
import { getMentorCalcomTokensByUsername, getMentorEnabledEventTypes } from '~/server/queries'

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

interface BookingData {
  name: string
  email: string
  timeZone?: string
}

interface CreateBookingInput {
  username: string
  eventTypeId: number
  startTime: string // ISO string
  attendee: BookingData
  metadata?: {
    stripePaymentIntentId?: string
  }
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
  url.searchParams.append('start', startDate.toISOString())
  url.searchParams.append('end', endDate.toISOString())
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
        time: new Date(s.start).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZone: timeZone ?? 'America/New_York',
        }),
        available: true,
      }))
    }
  }

  return availableSlots
}

/**
 * Create a booking via Cal.com API and store it locally
 */
export const createBooking = async (input: CreateBookingInput): Promise<string> => {
  // Transform input to match Cal.com v2 API format
  const calcomPayload = {
    start: input.startTime, // ISO string in UTC
    attendee: {
      name: input.attendee.name,
      email: input.attendee.email,
      timeZone: input.attendee.timeZone ?? 'America/New_York',
      language: 'en', // Default language
    },
    eventTypeId: input.eventTypeId,
    username: input.username,
    metadata: { stripePaymentIntentId: input.metadata?.stripePaymentIntentId ?? '' },
  }

  // Create booking via Cal.com API
  const response = await fetch(`${env.NEXT_PUBLIC_CALCOM_API_URL}/bookings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.X_CAL_SECRET_KEY}`,
      'Content-Type': 'application/json',
      'cal-api-version': '2024-08-13',
    },
    body: JSON.stringify(calcomPayload),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new ExternalApiError(`Failed to create booking: ${response.status} ${err}`)
  }

  const data = await response.json()

  if (data.status === 'success' && data.data?.uid) {
    // Booking successfully created in Cal.com
    // The webhook will handle storing the booking in our database
    return data.data.uid
  }

  throw new ExternalApiError(data.error ?? 'Unknown booking error')
}

/**
 * Create a paid booking with Stripe Payment Intent including tax calculation
 */
export const createStripePaymentIntent = async (
  input: BookingFormInput
): Promise<{
  success: boolean
  clientSecret?: string
  paymentIntentId?: string
  error?: string
}> => {
  try {
    const validatedInput = BookingFormInputSchema.parse(input)
    const {
      eventTypeId,
      startTimeIso,
      attendeeName,
      attendeeEmail,
      mentorUsername,
      mentorUserId,
      price,
      currency,
      timeZone,
    } = validatedInput

    console.log('Creating Stripe Payment Intent for:', { mentorUsername, attendeeEmail, price })

    if (price === 0) {
      console.log('Skipping Stripe for free booking.')
      return { success: false, error: 'Free bookings should use direct booking flow' }
    }

    const stripeAccount = await db
      .select()
      .from(mentorStripeAccounts)
      .where(eq(mentorStripeAccounts.userId, mentorUserId))
      .limit(1)

    if (!stripeAccount.length || !stripeAccount[0]?.stripeAccountId) {
      console.error(`Mentor ${mentorUsername} has not set up a Stripe account.`)
      return { success: false, error: 'Mentor has not set up payments' }
    }

    const stripeAccountData = stripeAccount[0]
    const mentorFee = Math.round(price * 0.1)
    const menteeFee = Math.round(price * 0.05)
    const mentorAmount = price - mentorFee
    const subtotal = Math.round(price + menteeFee)

    // Create payment intent; tax will be computed by Stripe from AddressElement data before confirm
    // Build params separately to attach automatic_tax while keeping TS types clean
    const createParams: Stripe.PaymentIntentCreateParams = {
      amount: subtotal,
      currency: currency.toLowerCase(),
      metadata: {
        mentorUserId: mentorUserId.toString(),
        eventTypeId: eventTypeId.toString(),
        startTime: startTimeIso,
        attendeeName: attendeeName,
        attendeeEmail: attendeeEmail,
        attendeeTimeZone: timeZone,
        mentorUsername: mentorUsername,
        mentorFee: mentorFee.toString(),
        menteeFee: menteeFee.toString(),
        mentorAmount: mentorAmount.toString(),
        mentorStripeAccountId: stripeAccountData.stripeAccountId,
        subtotal: subtotal.toString(),
      },
      payment_method_types: ['card' /*'apple_pay', 'google_pay'*/], // TODO: Configure other payment methods
    }

    const paymentIntent = await stripe.paymentIntents.create(createParams)

    console.log(`Successfully created Payment Intent: ${paymentIntent.id}`)
    return {
      success: paymentIntent.client_secret !== null,
      clientSecret: paymentIntent.client_secret ?? undefined,
      paymentIntentId: paymentIntent.id,
    }
  } catch (error) {
    console.error('Stripe payment intent creation failed:', error)
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Invalid input data.' }
    }
    return { success: false, error: 'Failed to create payment session.' }
  }
}

/**
 * Refund a Stripe Payment Intent and update the payment record.
 */
export const refundStripePaymentIntent = async (
  paymentIntentId: string,
  reason: 'duplicate' | 'fraudulent' | 'requested_by_customer'
): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log(`Refunding payment intent ${paymentIntentId} for reason: ${reason}`)
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      reason: reason,
    })

    await db
      .update(payments)
      .set({
        platformStatus: 'REFUNDED',
        stripeStatus: 'canceled', // Or another appropriate status
      })
      .where(eq(payments.stripePaymentIntentId, paymentIntentId))

    console.log(`Successfully refunded ${refund.id} for payment intent ${paymentIntentId}`)
    return { success: true }
  } catch (error) {
    console.error(`Failed to refund payment intent ${paymentIntentId}:`, error)
    return { success: false, error: 'Failed to process refund.' }
  }
}

/**
 * Handle completed payment intents and create bookings
 */
export const handlePaymentIntentWebhook = async (
  paymentIntent: Stripe.PaymentIntent
): Promise<{ success: boolean; error?: string }> => {
  const { metadata, id: paymentIntentId } = paymentIntent
  console.log(`Handling payment intent webhook for: ${paymentIntentId}`)

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
    console.error('Missing required metadata in payment intent:', paymentIntentId)
    return { success: false, error: 'Missing required metadata' }
  }

  const disputePeriodEnd = new Date()
  disputePeriodEnd.setHours(disputePeriodEnd.getHours() + 72)

  const paymentRecord = await db
    .insert(payments)
    .values({
      stripePaymentIntentId: paymentIntentId,
      mentorUserId: metadata.mentorUserId,
      customerEmail: metadata.attendeeEmail,
      customerName: metadata.attendeeName,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency.toUpperCase(),
      mentorFee: parseInt(metadata.mentorFee),
      menteeFee: parseInt(metadata.menteeFee),
      mentorAmount: parseInt(metadata.mentorAmount),
      platformStatus: 'SUCCEEDED',
      stripeStatus: paymentIntent.status,
      disputePeriodEnds: disputePeriodEnd,
      metadata: { paymentIntentMetadata: metadata },
    })
    .returning()

  if (!paymentRecord[0]) {
    console.error('Failed to create payment record for payment intent:', paymentIntentId)
    return { success: false, error: 'Failed to create payment record' }
  }

  console.log(`Payment record created for intent ${paymentIntentId}`)

  try {
    // If a tax calculation was performed prior to confirmation, record the final tax transaction now
    const calculationId = metadata.tax_calculation_id
    if (calculationId) {
      const taxTx = await createTaxTransaction({ calculationId, paymentIntentId })
      if (!taxTx.success) {
        console.error(
          `Failed to create tax transaction for PI ${paymentIntentId} from calculation ${calculationId}: ${taxTx.error}`
        )
      } else {
        console.log(`Created tax transaction ${taxTx.transactionId} for PI ${paymentIntentId}`)
      }
    }

    console.log(`Attempting to create Cal.com booking for payment intent: ${paymentIntentId}`)

    const bookingArgs = {
      calcomEventTypeId: Number(metadata.eventTypeId),
      start: new Date(metadata.startTime).toISOString(),
      attendeeName: metadata.attendeeName,
      attendeeEmail: metadata.attendeeEmail,
      timeZone: metadata.attendeeTimeZone,
      stripePaymentIntentId: paymentIntentId,
      paymentId: paymentRecord[0].id,
      mentorUserId: metadata.mentorUserId,
    }

    console.log('Calling createCalcomBooking with:', JSON.stringify(bookingArgs, null, 2))

    await createCalcomBooking(bookingArgs)
    console.log(`Successfully created Cal.com booking for payment intent: ${paymentIntentId}`)
    return { success: true }
  } catch (error) {
    console.error(
      `Cal.com booking failed for payment intent ${paymentIntentId}. Initiating refund.`,
      error
    )

    await refundStripePaymentIntent(paymentIntentId, 'requested_by_customer')

    await db
      .update(payments)
      .set({ platformStatus: 'FAILED' })
      .where(eq(payments.stripePaymentIntentId, paymentIntentId))

    return { success: false, error: 'Failed to create booking, payment has been refunded.' }
  }
}
