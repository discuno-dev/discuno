import 'server-only'

import { env } from '~/env'
import { ExternalApiError } from '~/lib/auth/auth-utils'
import {
  CreateCalcomUserResponseSchema,
  type CreateCalcomUserInput,
  type CreateCalcomUserResponse,
  type UpdateCalcomUserInput,
} from '~/lib/calcom/schemas'
import { storeCalcomTokensForUser } from '~/server/queries'

/**
 * Add user to college-mentors team (core implementation)
 */
export const createCalcomUser = async (
  data: CreateCalcomUserInput & { userId?: string }
): Promise<{
  calcomUserId: number
  username: string
  accessToken: string
}> => {
  try {
    const { email, name, timeZone, userId } = data

    // Step 1: Create managed user in Cal.com
    const userResponse = await fetch(
      `${env.NEXT_PUBLIC_CALCOM_API_URL}/oauth-clients/${env.NEXT_PUBLIC_X_CAL_ID}/users`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cal-secret-key': env.X_CAL_SECRET_KEY,
        },
        body: JSON.stringify({
          email,
          name,
          timeZone,
          timeFormat: 12,
          weekStart: 'Sunday',
        }),
      }
    )

    if (!userResponse.ok) {
      const errorText = await userResponse.text()
      console.error('Cal.com user creation failed:', userResponse.status, errorText)
      throw new ExternalApiError(`Cal.com API error: ${userResponse.status} - ${errorText}`)
    }

    const userResponseData: CreateCalcomUserResponse = await userResponse.json()

    const parsedResponse = CreateCalcomUserResponseSchema.safeParse(userResponseData)

    if (!parsedResponse.success) {
      console.error('Invalid Cal.com user creation response:', parsedResponse.error.flatten())
      throw new ExternalApiError('Invalid Cal.com user creation response')
    }

    const calcomUser = parsedResponse.data.data

    // Step 2: Add user to college-mentors team
    console.log(`Adding user ${calcomUser.user.id} to college-mentors team...`)
    const membershipResponse = await fetch(
      `${env.NEXT_PUBLIC_CALCOM_API_URL}/organizations/${env.CALCOM_ORG_ID}/teams/${env.COLLEGE_MENTOR_TEAM_ID}/memberships`,
      {
        method: 'POST',
        headers: {
          'x-cal-secret-key': env.X_CAL_SECRET_KEY,
          'x-cal-client-id': env.NEXT_PUBLIC_X_CAL_ID,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'MEMBER',
          accepted: true,
          disableImpersonation: false,
          userId: calcomUser.user.id,
        }),
      }
    )

    if (!membershipResponse.ok) {
      const errorText = await membershipResponse.text()
      console.error(
        `Failed to add user ${calcomUser.user.id} to college-mentors team: ${membershipResponse.status} ${errorText}`
      )

      throw new ExternalApiError(
        `Cal.com team membership creation failed: ${membershipResponse.status} - ${errorText}`
      )
    } else {
      const membershipData = await membershipResponse.json()
      console.log(`Successfully added user ${calcomUser.user.id} to college-mentors team`)
      console.log('Membership data:', membershipData)
    }

    // Step 3: Store Cal.com tokens if userId is provided
    if (userId) {
      await storeCalcomTokensForUser({
        userId,
        calcomUserId: calcomUser.user.id,
        calcomUsername: calcomUser.user.username,
        accessToken: calcomUser.accessToken,
        refreshToken: calcomUser.refreshToken,
        accessTokenExpiresAt: new Date(calcomUser.accessTokenExpiresAt),
        refreshTokenExpiresAt: new Date(calcomUser.refreshTokenExpiresAt),
      })

      console.log(`Stored Cal.com tokens for user ${userId}`)
    }

    return {
      calcomUserId: calcomUser.user.id,
      username: calcomUser.user.username,
      accessToken: calcomUser.accessToken,
    }
  } catch (error) {
    console.error('Error in createCalcomUser:', error)
    throw error
  }
}

/**
 * Update Cal.com user (core implementation)
 */
export const updateCalcomUser = async (data: UpdateCalcomUserInput): Promise<void> => {
  const { calcomUserId, email, ...rest } = data

  const response = await fetch(
    `${env.NEXT_PUBLIC_CALCOM_API_URL}/oauth-clients/${env.NEXT_PUBLIC_X_CAL_ID}/users/${calcomUserId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-cal-secret-key': env.X_CAL_SECRET_KEY,
      },
      body: JSON.stringify({ email, ...rest }),
    }
  )

  const responseData = await response.json()

  if (responseData.status !== 'success') {
    throw new ExternalApiError(`Cal.com API error: ${responseData.error}`)
  }

  // User's .edu email is already verified through the auth process
}

/**
 * Delete Cal.com user (core implementation)
 */
export const deleteCalcomUser = async (calcomUserId: number): Promise<void> => {
  const response = await fetch(
    `${env.NEXT_PUBLIC_CALCOM_API_URL}/oauth-clients/${env.NEXT_PUBLIC_X_CAL_ID}/users/${calcomUserId}`,
    {
      method: 'DELETE',
      headers: {
        'x-cal-secret-key': env.X_CAL_SECRET_KEY,
      },
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`Cal.com user deletion failed: ${response.status} ${errorText}`)
    throw new ExternalApiError(`Cal.com API error: ${response.status} - ${errorText}`)
  }

  console.log(`Successfully deleted Cal.com user ${calcomUserId}`)
}
/**
 * Create a booking via Cal.com API
 */
export const createCalcomBooking = async (input: {
  calcomEventTypeId: number
  start: string
  attendeeName: string
  attendeeEmail: string
  attendeePhone?: string
  timeZone: string
  paymentId?: number
  mentorUserId: string
}): Promise<{ id: number; uid: string }> => {
  const {
    calcomEventTypeId,
    start,
    attendeeName,
    attendeeEmail,
    attendeePhone,
    timeZone,
    paymentId,
    mentorUserId,
  } = input

  const calcomPayload = {
    start, // ISO string in UTC
    attendee: {
      name: attendeeName,
      email: attendeeEmail,
      phoneNumber: attendeePhone,
      timeZone: timeZone,
      language: 'en', // Default language
    },
    eventTypeId: calcomEventTypeId,
    metadata: {
      paymentId: paymentId?.toString() ?? '',
      mentorUserId,
    },
  }

  const response = await fetch(`${env.NEXT_PUBLIC_CALCOM_API_URL}/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'cal-api-version': '2024-08-13',
      'x-cal-client-id': env.NEXT_PUBLIC_X_CAL_ID,
      'x-cal-secret-key': env.X_CAL_SECRET_KEY,
    },
    body: JSON.stringify(calcomPayload),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new ExternalApiError(`Failed to create Cal.com booking: ${response.status} ${err}`)
  }

  const data = await response.json()

  if (data.status === 'success' && data.data?.uid) {
    return { id: data.data.id, uid: data.data.uid }
  }

  throw new ExternalApiError(data.error ?? 'Unknown Cal.com booking error')
}

/**
 * Fetch Cal.com event types for any username
 */
export const fetchCalcomEventTypesByUsername = async (
  username: string,
  accessToken: string
): Promise<
  Array<{
    id: number
    title: string
    lengthInMinutes: number
    description?: string
  }>
> => {
  const response = await fetch(
    `${env.NEXT_PUBLIC_CALCOM_API_URL}/event-types?username=${encodeURIComponent(username)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'cal-api-version': '2024-06-14',
      },
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new ExternalApiError(
      `Failed to fetch event types from Cal.com: ${response.status} ${errorText}`
    )
  }

  const data = await response.json()

  if (data.status !== 'success' || !Array.isArray(data.data)) {
    throw new ExternalApiError('Invalid Cal.com event types response')
  }

  return data.data as Array<{
    id: number
    title: string
    lengthInMinutes: number
    description?: string
  }>
}

/**
 * Mark a booking as a no-show in Cal.com
 */
export const markAsNoShow = async (
  bookingUid: string,
  attendees: { email: string; absent: boolean }[],
  host: boolean
): Promise<void> => {
  const response = await fetch(
    `${env.NEXT_PUBLIC_CALCOM_API_URL}/bookings/${bookingUid}/mark-absent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'cal-api-version': '2024-08-13',
        Authorization: `Bearer ${env.X_CAL_SECRET_KEY}`,
      },
      body: JSON.stringify({
        attendees,
        host,
      }),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`Cal.com mark as no-show failed: ${response.status} ${errorText}`)
    throw new ExternalApiError(`Cal.com API error: ${response.status} - ${errorText}`)
  }

  console.log(`Successfully marked booking ${bookingUid} as no-show in Cal.com`)
}
