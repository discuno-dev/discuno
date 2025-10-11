'use server'
import 'server-only'

import { revalidatePath } from 'next/cache'
import Stripe from 'stripe'
import type { Availability, DateOverride, WeeklySchedule } from '~/app/types/availability'
import { availabilitySchema, dateOverrideSchema } from '~/app/types/availability'
import { env } from '~/env'
import { ExternalApiError, requireAuth } from '~/lib/auth/auth-utils'
import {
  createCalcomUser as createCalcomUserCore,
  updateCalcomUser as updateCalcomUserCore,
} from '~/lib/calcom'
import type { CreateCalcomUserInput, UpdateCalcomUserInput } from '~/lib/calcom/schemas'
import { MINIMUM_PAID_BOOKING_PRICE } from '~/lib/constants'
import { type UpdateCalcomToken, type UpdateMentorEventType } from '~/lib/schemas/db'
import {
  getFullProfile,
  getMentorBookings,
  getMentorCalcomTokens,
  getMentorEventTypes,
  getMentorStripeAccount,
  updateCalcomTokensByUserId,
  updateMentorEventType,
  upsertMentorStripeAccount,
} from '~/server/queries'

/**
 * Get user's current Cal.com access token
 */
const getCalcomAccessToken = async (): Promise<{
  success: boolean
  accessToken?: string
  refreshToken?: string
  username?: string
  error?: string
}> => {
  try {
    console.log('getCalcomAccessToken')
    const tokens = await getMentorCalcomTokens()
    console.log('tokens', tokens)

    if (!tokens) {
      return {
        success: false,
        error: 'No Cal.com tokens found',
      }
    }

    console.log('tokens.accessToken', tokens.accessToken)

    return {
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      username: tokens.calcomUsername,
    }
  } catch (error) {
    console.error('Get Cal.com token error:', error)
    return {
      success: false,
      error: 'Failed to get token',
    }
  }
}

/**
 * Refresh Cal.com access token
 */
const refreshCalcomToken = async (): Promise<{
  success: boolean
  accessToken?: string
  error?: string
}> => {
  try {
    const tokenRecord = await getMentorCalcomTokens()
    if (!tokenRecord) {
      return { success: false, error: 'Token not found' }
    }

    const now = new Date()
    if (tokenRecord.refreshTokenExpiresAt < now) {
      return forceRefreshCalcomToken(tokenRecord.calcomUserId, tokenRecord.userId)
    }

    const refreshResponse = await fetch(
      `${env.NEXT_PUBLIC_CALCOM_API_URL}/oauth/${env.NEXT_PUBLIC_X_CAL_ID}/refresh`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cal-secret-key': env.X_CAL_SECRET_KEY,
        },
        body: JSON.stringify({ refreshToken: tokenRecord.refreshToken }),
      }
    )

    if (!refreshResponse.ok) {
      const errorText = await refreshResponse.text()
      console.error('Normal refresh failed:', refreshResponse.status, errorText)
      return forceRefreshCalcomToken(tokenRecord.calcomUserId, tokenRecord.userId)
    }

    const refreshData = await refreshResponse.json()

    if (refreshData.status !== 'success') {
      console.error('Refresh response error:', refreshData)
      return forceRefreshCalcomToken(tokenRecord.calcomUserId, tokenRecord.userId)
    }

    const token: UpdateCalcomToken = {
      accessToken: refreshData.data.accessToken as string,
      refreshToken: refreshData.data.refreshToken as string,
      accessTokenExpiresAt: new Date(refreshData.data.accessTokenExpiresAt),
      refreshTokenExpiresAt: new Date(refreshData.data.refreshTokenExpiresAt),
    }

    await updateCalcomTokensByUserId(tokenRecord.userId, token)

    console.log('Token refresh successful')
    return { success: true, accessToken: token.accessToken }
  } catch (error) {
    console.error('Cal.com refresh token error:', error)
    return { success: false, error: 'Token refresh failed' }
  }
}

/**
 * Force refresh Cal.com tokens when refresh token is expired
 */
const forceRefreshCalcomToken = async (
  calcomUserId: number,
  userId: string
): Promise<{
  success: boolean
  accessToken?: string
  error?: string
}> => {
  try {
    console.log('Attempting force refresh for user:', userId, 'calcom user:', calcomUserId)

    // Correct endpoint from Cal.com API v2 docs
    const forceRefreshResponse = await fetch(
      `${env.NEXT_PUBLIC_CALCOM_API_URL}/oauth-clients/${env.NEXT_PUBLIC_X_CAL_ID}/users/${calcomUserId}/force-refresh`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cal-secret-key': env.X_CAL_SECRET_KEY,
        },
        body: JSON.stringify({}),
      }
    )

    if (!forceRefreshResponse.ok) {
      const errorText = await forceRefreshResponse.text()
      console.error('Force refresh failed:', forceRefreshResponse.status, errorText)
      return {
        success: false,
        error: `Force refresh failed: ${forceRefreshResponse.status} - ${errorText}`,
      }
    }

    const forceRefreshData = await forceRefreshResponse.json()

    if (forceRefreshData.status !== 'success') {
      console.error('Force refresh response error:', forceRefreshData)
      return {
        success: false,
        error: `Force refresh API error: ${JSON.stringify(forceRefreshData)}`,
      }
    }

    // Use the expiration times from the API response
    const newAccessTokenExpiresAt = new Date(forceRefreshData.data.accessTokenExpiresAt)
    const newRefreshTokenExpiresAt = new Date(forceRefreshData.data.refreshTokenExpiresAt)

    const token: UpdateCalcomToken = {
      accessToken: forceRefreshData.data.accessToken,
      refreshToken: forceRefreshData.data.refreshToken,
      accessTokenExpiresAt: newAccessTokenExpiresAt,
      refreshTokenExpiresAt: newRefreshTokenExpiresAt,
    }

    await updateCalcomTokensByUserId(userId, token)

    console.log('Force refresh successful for user:', userId)

    return {
      success: true,
      accessToken: forceRefreshData.data.accessToken,
    }
  } catch (error) {
    console.error('Cal.com force refresh error:', error)
    return {
      success: false,
      accessToken: '',
      error: 'Token refresh failed',
    }
  }
}

/**
 * Check if user has Cal.com integration set up
 */
const hasCalcomIntegration = async () => {
  try {
    const tokens = await getMentorCalcomTokens()
    return !!tokens
  } catch (error) {
    console.error('Check Cal.com integration error:', error)
    return false
  }
}

/**
 * Get user's Cal.com token
 */
const getUserCalcomToken = async (): Promise<{
  success: boolean
  accessToken?: string
  refreshToken?: string
  error?: string
}> => {
  try {
    return await getCalcomAccessToken()
  } catch (error) {
    console.error('Get user Cal.com token error:', error)
    return {
      success: false,
      error: 'Failed to get token',
    }
  }
}

/**
 * Create Cal.com user (server action wrapper)
 */
const createCalcomUser = async (
  data: CreateCalcomUserInput
): Promise<{
  success: boolean
  calcomUserId?: number
  username?: string
  error?: string
}> => {
  try {
    const result = await createCalcomUserCore(data)
    return {
      success: true,
      calcomUserId: result.calcomUserId,
      username: result.username,
    }
  } catch (error) {
    console.error('Cal.com user creation error:', error)
    if (error instanceof ExternalApiError) {
      return {
        success: false,
        error: error.message,
      }
    }
    return {
      success: false,
      error: `Failed to create Cal.com user: ${error}`,
    }
  }
}

/**
 * Update Cal.com user (server action wrapper)
 */
const updateCalcomUser = async (
  data: UpdateCalcomUserInput
): Promise<{
  success: boolean
  error?: string
}> => {
  try {
    await updateCalcomUserCore(data)
    return {
      success: true,
    }
  } catch (error) {
    console.error('Cal.com user update error:', error)
    if (error instanceof ExternalApiError) {
      return {
        success: false,
        error: error.message,
      }
    }
    return {
      success: false,
      error: `Failed to update Cal.com user: ${error}`,
    }
  }
}

/**
 * Fetches the user's availability schedule from Cal.com.
 * @see https://cal.com/docs/enterprise/api-reference/v2/openapi#/paths/~1schedules/get
 */
export async function getSchedule(): Promise<{
  success: boolean
  data?: Availability
  error?: string
}> {
  try {
    const tokenResult = await getValidCalcomToken()

    if (!tokenResult.success || !tokenResult.accessToken) {
      return {
        success: false,
        error: 'Failed to get valid Cal.com token',
      }
    }

    const response = await fetch(`${env.NEXT_PUBLIC_CALCOM_API_URL}/schedules/default`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenResult.accessToken}`,
      },
    })

    if (!response.ok) {
      const errorBody = await response.text()
      return {
        success: false,
        error: `Failed to fetch schedule: ${errorBody}`,
      }
    }

    const data = await response.json()

    if (!data.data) {
      return {
        success: true,
        data: undefined,
      }
    }

    // The /schedules/default endpoint returns a single schedule object
    const calcomSchedule = data.data

    // Map Cal.com v2 availability (array of per-day interval arrays) into our WeeklySchedule format
    const weeklySchedule: WeeklySchedule = {
      sunday: [],
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
    }
    const dayNames: (keyof WeeklySchedule)[] = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ]
    dayNames.forEach((dayKey, idx) => {
      const dayIntervals = calcomSchedule.availability?.[idx]
      if (Array.isArray(dayIntervals)) {
        for (const interval of dayIntervals) {
          const list = weeklySchedule[dayKey]
          // Convert ISO datetime to HH:mm for time inputs
          const startRaw: string = interval.start
          const endRaw: string = interval.end
          const start = startRaw.length >= 16 ? startRaw.substring(11, 16) : startRaw
          const end = endRaw.length >= 16 ? endRaw.substring(11, 16) : endRaw
          list.push({ start, end })
        }
      }
    })

    // Map Cal.com v2 overrides into our DateOverride[]
    const dateOverrides: DateOverride[] = []
    for (const ov of calcomSchedule.dateOverrides ?? []) {
      // Each override can include multiple ranges per date
      for (const range of ov.ranges ?? []) {
        // Derive date: use ov.date or fallback to range start date (YYYY-MM-DD)
        const date = ov.date ?? (range.start.split('T')[0] as string)
        const startRaw: string = range.start
        const endRaw: string = range.end
        const start = startRaw.length >= 16 ? startRaw.substring(11, 16) : startRaw
        const end = endRaw.length >= 16 ? endRaw.substring(11, 16) : endRaw
        const interval = { start, end }
        // Group by date
        const existing = dateOverrides.find(d => d.date === date)
        if (existing) {
          existing.intervals.push(interval)
        } else {
          dateOverrides.push({ date, intervals: [interval] })
        }
      }
    }

    return {
      success: true,
      data: {
        id: calcomSchedule.id.toString(),
        weeklySchedule,
        dateOverrides,
      },
    }
  } catch (error) {
    console.error('Error fetching schedule:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching the schedule',
    }
  }
}

/**
 * Updates an existing availability schedule in Cal.com.
 * @see https://cal.com/docs/enterprise/api-reference/v2/openapi#/paths/~1schedules~1{schedule_id}/patch
 */
export async function updateSchedule(schedule: Availability): Promise<{
  success: boolean
  data?: Availability
  error?: string
}> {
  console.log('updateSchedule called with:', schedule)
  try {
    // Validate input using canonical schema with safeParse
    const validationResult = availabilitySchema.safeParse(schedule)
    if (!validationResult.success) {
      return {
        success: false,
        error: `Invalid schedule data: ${validationResult.error.issues.map(i => i.message).join(', ')}`,
      }
    }

    const tokenResult = await getValidCalcomToken()

    if (!tokenResult.success || !tokenResult.accessToken) {
      return {
        success: false,
        error: 'Failed to get valid Cal.com token',
      }
    }

    const payload = {
      // Cal.com v2 expects an array of slots with days array
      availability: Object.entries(schedule.weeklySchedule).flatMap(([day, intervals]) =>
        intervals.map(interval => ({
          days: [day.charAt(0).toUpperCase() + day.slice(1)],
          startTime: interval.start,
          endTime: interval.end,
        }))
      ),
      overrides: schedule.dateOverrides.flatMap(o =>
        o.intervals.map(i => ({
          date: o.date,
          startTime: i.start,
          endTime: i.end,
        }))
      ),
    }

    const response = await fetch(`${env.NEXT_PUBLIC_CALCOM_API_URL}/schedules/${schedule.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenResult.accessToken}`,
        'cal-api-version': '2024-06-14',
      },
      body: JSON.stringify(payload),
    })

    console.log('updateSchedule response status:', response.status)

    if (!response.ok) {
      const errorBody = await response.text()
      return {
        success: false,
        error: `Failed to update schedule: ${errorBody}`,
      }
    }

    revalidatePath('/scheduling')

    return {
      success: true,
      data: schedule,
    }
  } catch (error) {
    console.error('Error updating schedule:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while updating the schedule',
    }
  }
}

/**
 * Adds a new date-specific override to the user's schedule.
 */
export async function createDateOverride(override: DateOverride): Promise<{
  success: boolean
  data?: DateOverride[]
  error?: string
}> {
  try {
    // Validate input using safeParse
    const validationResult = dateOverrideSchema.safeParse(override)
    if (!validationResult.success) {
      return {
        success: false,
        error: `Invalid override data: ${validationResult.error.issues.map(i => i.message).join(', ')}`,
      }
    }

    const scheduleResult = await getSchedule()
    if (!scheduleResult.success || !scheduleResult.data) {
      return {
        success: false,
        error: scheduleResult.error ?? 'Could not find schedule to update',
      }
    }

    const newOverrides = [...scheduleResult.data.dateOverrides, override]
    const newSchedule: Availability = {
      ...scheduleResult.data,
      dateOverrides: newOverrides,
    }

    const updateResult = await updateSchedule(newSchedule)
    if (!updateResult.success) {
      return {
        success: false,
        error: updateResult.error ?? 'Failed to update schedule',
      }
    }

    return {
      success: true,
      data: newOverrides,
    }
  } catch (error) {
    console.error('Error creating date override:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while creating the override',
    }
  }
}

/**
 * Updates an existing date-specific override in the user's schedule.
 */
export async function updateDateOverride(override: DateOverride): Promise<{
  success: boolean
  data?: DateOverride[]
  error?: string
}> {
  try {
    // Validate input using safeParse
    const validationResult = dateOverrideSchema.safeParse(override)
    if (!validationResult.success) {
      return {
        success: false,
        error: `Invalid override data: ${validationResult.error.issues.map(i => i.message).join(', ')}`,
      }
    }

    const scheduleResult = await getSchedule()
    if (!scheduleResult.success || !scheduleResult.data) {
      return {
        success: false,
        error: scheduleResult.error ?? 'Could not find schedule to update',
      }
    }

    const newOverrides = scheduleResult.data.dateOverrides.map(o =>
      o.date === override.date ? override : o
    )
    const newSchedule: Availability = {
      ...scheduleResult.data,
      dateOverrides: newOverrides,
    }

    const updateResult = await updateSchedule(newSchedule)
    if (!updateResult.success) {
      return {
        success: false,
        error: updateResult.error ?? 'Failed to update schedule',
      }
    }

    return {
      success: true,
      data: newOverrides,
    }
  } catch (error) {
    console.error('Error updating date override:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while updating the override',
    }
  }
}

/**
 * Deletes a date-specific override from the user's schedule.
 */
export async function deleteDateOverride(date: string): Promise<{
  success: boolean
  data?: DateOverride[]
  error?: string
}> {
  try {
    if (!date || typeof date !== 'string') {
      return {
        success: false,
        error: 'Invalid date provided',
      }
    }

    const scheduleResult = await getSchedule()
    if (!scheduleResult.success || !scheduleResult.data) {
      return {
        success: false,
        error: scheduleResult.error ?? 'Could not find schedule to update',
      }
    }

    const newOverrides = scheduleResult.data.dateOverrides.filter(o => o.date !== date)
    const newSchedule: Availability = {
      ...scheduleResult.data,
      dateOverrides: newOverrides,
    }

    const updateResult = await updateSchedule(newSchedule)
    if (!updateResult.success) {
      return {
        success: false,
        error: updateResult.error ?? 'Failed to update schedule',
      }
    }

    return {
      success: true,
      data: newOverrides,
    }
  } catch (error) {
    console.error('Error deleting date override:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while deleting the override',
    }
  }
}

/**
 * Get mentor's event type preferences with team event types
 */
export const getMentorEventTypePreferences = async (): Promise<{
  success: boolean
  data?: Array<{
    id: number
    calcomEventTypeId: number
    title: string
    length: number
    description?: string
    isEnabled: boolean
    customPrice: number | null
    currency: string
  }>
  error?: string
}> => {
  try {
    // Fetch mentor's preferences directly from database (includes event type details via joins)
    const mentorPreferences = await getMentorEventTypes()

    // Transform the data to match the expected format
    const combined = mentorPreferences.map(pref => ({
      id: pref.id,
      calcomEventTypeId: pref.calcomEventTypeId,
      title: pref.title,
      length: pref.duration,
      description: pref.description ?? undefined,
      isEnabled: pref.isEnabled,
      customPrice: pref.customPrice,
      currency: pref.currency,
    }))

    return {
      success: true,
      data: combined.map(c => ({ ...c, id: c.calcomEventTypeId })),
    }
  } catch (error) {
    console.error('Error getting mentor event type preferences:', error)
    return {
      success: false,
      error: 'Failed to get event type preferences',
    }
  }
}

/**
 * Update mentor's event type preferences
 */
export const updateMentorEventTypePreferences = async (
  eventTypeId: number,
  data: UpdateMentorEventType
): Promise<{
  success: boolean
  error?: string
}> => {
  try {
    if (data.customPrice && data.customPrice < 0) {
      return {
        success: false,
        error: 'Price cannot be negative.',
      }
    }
    if (data.customPrice && data.customPrice > 0 && data.customPrice < MINIMUM_PAID_BOOKING_PRICE) {
      return {
        success: false,
        error: 'The minimum price for a paid booking is $5.00.',
      }
    }
    await updateMentorEventType(eventTypeId, {
      ...data,
    })

    return {
      success: true,
    }
  } catch (error) {
    console.error('Error updating mentor event type preferences:', error)
    return {
      success: false,
      error: 'Failed to update event type preferences',
    }
  }
}

/**
 * Create Stripe Connect account for mentor or resume onboarding
 */
export const createStripeConnectAccount = async (): Promise<{
  success: boolean
  accountId?: string
  onboardingUrl?: string
  error?: string
}> => {
  try {
    const { id: userId } = await requireAuth()
    const profile = await getFullProfile()

    if (!profile?.email) {
      return {
        success: false,
        error: 'Email is required for Stripe account creation',
      }
    }

    // Check if user already has a Stripe account
    const existingAccount = await getMentorStripeAccount()

    const stripe = new Stripe(env.STRIPE_SECRET_KEY)

    if (existingAccount) {
      // If account exists but is not active, return account ID for embedded onboarding
      if (existingAccount.stripeAccountStatus !== 'active') {
        return {
          success: true,
          accountId: existingAccount.stripeAccountId,
        }
      } else {
        return {
          success: false,
          error: 'Stripe account is already active',
        }
      }
    }

    // Create new Stripe Connect account
    const account = await stripe.accounts.create({
      type: 'express',
      email: profile.email,
      country: 'US',
      business_type: 'individual',
      metadata: {
        userId,
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_profile: {
        mcc: '8299',
        url: 'https://discuno.com',
        product_description: 'Provides college advice and guidance via the Discuno platform',
      },
    })

    await upsertMentorStripeAccount({
      userId,
      stripeAccountId: account.id,
      stripeAccountStatus: 'pending',
      payoutsEnabled: false,
      chargesEnabled: false,
    })

    return {
      success: true,
      accountId: account.id,
    }
  } catch (error) {
    console.error('Error creating Stripe Connect account:', error)
    return {
      success: false,
      error: 'Failed to create Stripe account',
    }
  }
}

/**
 * Get mentor's Stripe account status
 */
export const getMentorStripeStatus = async (): Promise<{
  success: boolean
  data?: {
    hasAccount: boolean
    isActive: boolean
    onboardingCompleted: boolean
    payoutsEnabled: boolean
    chargesEnabled: boolean
    accountId?: string
  }
  error?: string
}> => {
  try {
    const stripeAccount = await getMentorStripeAccount()

    if (!stripeAccount) {
      return {
        success: true,
        data: {
          hasAccount: false,
          isActive: false,
          onboardingCompleted: false,
          payoutsEnabled: false,
          chargesEnabled: false,
        },
      }
    }

    return {
      success: true,
      data: {
        hasAccount: true,
        isActive: stripeAccount.stripeAccountStatus === 'active',
        onboardingCompleted: stripeAccount.chargesEnabled,
        payoutsEnabled: stripeAccount.payoutsEnabled,
        chargesEnabled: stripeAccount.chargesEnabled,
        accountId: stripeAccount.stripeAccountId,
      },
    }
  } catch (error) {
    console.error('Error getting mentor Stripe status:', error)
    return {
      success: false,
      error: 'Failed to get Stripe status',
    }
  }
}

/**
 * Get a valid Cal.com access token
 * Automatically refreshes if expired
 */
export const getValidCalcomToken = async (): Promise<{
  success: boolean
  accessToken?: string
  error?: string
}> => {
  try {
    // First, get current tokens from database
    const tokens = await getMentorCalcomTokens()
    if (!tokens) {
      return {
        success: false,
        error: 'No Cal.com tokens found',
      }
    }

    // Check if access token is expired
    const now = new Date()
    if (tokens.accessTokenExpiresAt > now) {
      // Token is still valid
      return {
        success: true,
        accessToken: tokens.accessToken,
      }
    }

    // Token is expired, refresh it
    console.log('🔄 Access token expired, refreshing...')
    const refreshResult = await refreshCalcomToken()

    if (refreshResult.success) {
      return {
        success: true,
        accessToken: refreshResult.accessToken,
      }
    }

    return {
      success: false,
      error: refreshResult.error,
    }
  } catch (error) {
    console.error('Get valid Cal.com token error:', error)
    return {
      success: false,
      error: 'Failed to get valid token',
    }
  }
}

/**
 * Create Stripe Account Session for embedded onboarding
 */
export const createStripeAccountSession = async ({
  accountId,
  accountManagement,
  accountOnboarding,
  notificationBanner,
  payouts,
}: {
  accountId: string
  accountManagement?: boolean
  accountOnboarding?: boolean
  notificationBanner?: boolean
  payouts?: boolean
}): Promise<{
  success: boolean
  client_secret?: string
  error?: string
}> => {
  try {
    const stripe = new Stripe(env.STRIPE_SECRET_KEY)

    const accountSession = await stripe.accountSessions.create({
      account: accountId,
      components: {
        account_management: {
          enabled: accountManagement ?? false,
        },
        account_onboarding: {
          enabled: accountOnboarding ?? false,
        },
        notification_banner: {
          enabled: notificationBanner ?? false,
        },
        payouts: {
          enabled: payouts ?? false,
        },
      },
    })

    return {
      success: true,
      client_secret: accountSession.client_secret,
    }
  } catch (error) {
    console.error('Error creating Stripe Account Session:', error)
    return {
      success: false,
      error: 'Failed to create Account Session',
    }
  }
}
/**
 * Fetches all bookings for the current user from Cal.com.
 * @see https://cal.com/docs/enterprise/api-reference/v2/openapi#/paths/~1bookings/get
 */

export const getBookings = async (): Promise<{
  success: boolean
  data?: Awaited<ReturnType<typeof getMentorBookings>>
  error?: string
}> => {
  try {
    const { id: userId } = await requireAuth()
    const bookings = await getMentorBookings(userId)

    return {
      success: true,
      data: bookings,
    }
  } catch (error) {
    console.error('Error fetching bookings:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while fetching bookings',
    }
  }
}

export const cancelBooking = async ({
  bookingUid,
  cancellationReason,
}: {
  bookingUid: string
  cancellationReason: string
}): Promise<{
  success: boolean
  error?: string
}> => {
  try {
    const tokenResult = await getValidCalcomToken()

    if (!tokenResult.success || !tokenResult.accessToken) {
      return {
        success: false,
        error: 'Failed to get valid Cal.com token',
      }
    }

    const response = await fetch(
      `${env.NEXT_PUBLIC_CALCOM_API_URL}/bookings/${bookingUid}/cancel`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenResult.accessToken}`,
          'cal-api-version': '2024-08-13',
        },
        body: JSON.stringify({ cancellationReason }),
      }
    )

    if (!response.ok) {
      const errorBody = await response.text()
      return {
        success: false,
        error: `Failed to cancel booking: ${errorBody}`,
      }
    }

    revalidatePath('/settings/bookings')

    return {
      success: true,
    }
  } catch (error) {
    console.error('Error cancelling booking:', error)
    return {
      success: false,
      error: 'An unexpected error occurred while cancelling the booking',
    }
  }
}

export const getFullProfileAction = async () => {
  return await getFullProfile()
}

export {
  createCalcomUser,
  forceRefreshCalcomToken,
  getCalcomAccessToken,
  getUserCalcomToken,
  hasCalcomIntegration,
  refreshCalcomToken,
  updateCalcomUser,
}
