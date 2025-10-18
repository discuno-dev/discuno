import crypto from 'crypto'
import { connection } from 'next/server'
import { env } from '~/env'
import { markAsNoShow } from '~/lib/calcom'
import {
  CalcomBookingPayloadSchema,
  type CalcomBookingPayload,
  type CalcomWebhookEvent,
} from '~/lib/schemas/calcom'
import {
  cancelLocalBooking,
  createLocalBooking,
  updateLocalBookingStatus,
} from '~/lib/services/booking-service'
import { getUserIdByCalcomUserId } from '~/lib/services/calcom-tokens-service'
import { createAnalyticsEvent } from '~/server/dal/analytics'

export async function POST(req: Request) {
  await connection()
  const signature = req.headers.get('x-cal-signature-256') ?? ''
  const bodyText = await req.text()

  // Verify signature authenticity
  const expectedSignature = crypto
    .createHmac('sha256', env.CALCOM_WEBHOOK_SECRET)
    .update(bodyText)
    .digest('hex')

  if (
    !crypto.timingSafeEqual(Buffer.from(expectedSignature, 'utf8'), Buffer.from(signature, 'utf8'))
  ) {
    console.error('❌ Webhook signature verification failed for Cal.com payload')
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let event: CalcomWebhookEvent
  try {
    event = JSON.parse(bodyText)
  } catch (err) {
    console.error('❌ Failed to parse Cal.com webhook payload:', err)
    return Response.json({ error: 'Invalid payload' }, { status: 400 })
  }

  console.log('Received Cal.com webhook event:', {
    triggerEvent: event.triggerEvent,
    payload: event.payload,
  })

  const { triggerEvent, payload } = event
  console.log(`✅ Received Cal.com webhook event: ${triggerEvent}`)

  try {
    switch (triggerEvent) {
      case 'BOOKING_CREATED':
        return await storeBooking(payload)
      // Attempt to refund no show
      case 'AFTER_HOSTS_CAL_VIDEO_NO_SHOW':
        {
          const { bookingUid, attendees } = event.payload
          // Mark the booking as a no-show in both our local database and Cal.com
          await markAsNoShow(
            bookingUid,
            attendees.map(attendee => ({
              email: attendee.email,
              absent: true,
            })),
            true // Mark the host as absent
          )
          await updateLocalBookingStatus(bookingUid, 'NO_SHOW', {
            hostNoShow: true,
            attendeeNoShow: true,
          })
        }
        break
      case 'RECORDING_TRANSCRIPTION_GENERATED':
        console.log(`✅ Transcription generated for event: ${triggerEvent}`)
        console.log(`✅ Transcription text: ${JSON.stringify(payload)}`)
        break
      case 'RECORDING_READY':
        console.log(`✅ Recording is ready for event: ${triggerEvent}`)
        console.log(`✅ Recording details: ${JSON.stringify(payload)}`)
        break
      case 'MEETING_STARTED':
        console.log(`✅ Meeting started for event: ${triggerEvent}`)
        console.log(`✅ Meeting details: ${JSON.stringify(payload)}`)
        break
      case 'MEETING_ENDED':
        console.log(`✅ Meeting ended for event: ${triggerEvent}`)
        console.log(`✅ Meeting details: ${JSON.stringify(payload)}`)
        if (payload.metadata.mentorUserId) {
          await createAnalyticsEvent({
            eventType: 'COMPLETED_BOOKING',
            targetUserId: payload.metadata.mentorUserId,
            actorUserId: payload.metadata.actorUserId ?? null,
          })
        }
        break
      case 'BOOKING_CANCELLED':
        {
          console.log(`✅ Booking canceled for event: ${triggerEvent}`)
          await cancelLocalBooking(event.payload.uid)
          const mentorUserId = await getUserIdByCalcomUserId(event.payload.organizer.id)
          if (mentorUserId) {
            await createAnalyticsEvent({
              eventType: 'CANCELLED_BOOKING',
              targetUserId: mentorUserId,
              actorUserId: mentorUserId,
            })
          }
        }
        break
      default:
        console.log(`ℹ️ Unhandled webhook event type: ${triggerEvent}`)
        break
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`❌ Error processing webhook event ${triggerEvent}:`, errorMessage)
    return Response.json({ error: 'Failed to process webhook' }, { status: 500 })
  }

  return Response.json({ received: true })
}

async function storeBooking(event: CalcomBookingPayload) {
  console.log('Processing Cal.com BOOKING_CREATED event...')
  try {
    const validation = CalcomBookingPayloadSchema.safeParse(event)
    if (!validation.success) {
      console.warn('❌ Invalid Cal.com booking payload:', validation.error.flatten())
      return Response.json({ error: 'Invalid booking payload' }, { status: 400 })
    }

    const {
      bookingId,
      uid,
      title,
      attendees,
      startTime,
      length,
      organizer,
      eventTypeId,
      metadata,
    } = validation.data

    const [attendee] = attendees

    const start = new Date(startTime)

    const booking = await createLocalBooking({
      calcomBookingId: bookingId,
      calcomUid: uid,
      title,
      description: validation.data.description,
      startTime: start,
      duration: length,
      endTime: new Date(start.getTime() + length * 60000),
      meetingUrl: validation.data.metadata.videoCallUrl,
      calcomEventTypeId: eventTypeId,
      paymentId: metadata.paymentId ? Number(metadata.paymentId) : undefined,
      organizer: {
        userId: metadata.mentorUserId,
        email: organizer.email,
        username: organizer.username,
        name: organizer.name,
      },
      attendee: {
        name: attendee.name,
        email: attendee.email,
        phoneNumber: attendee.phoneNumber,
        timeZone: attendee.timeZone,
      },
      webhookPayload: event,
    })

    console.log(`✅ Successfully stored booking ${booking.id} for Cal.com event ${uid}`)
    return Response.json(booking, { status: 201 })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`❌ Failed to store booking for Cal.com event:`, errorMessage)
    console.error('Raw payload:', JSON.stringify(event, null, 2))
    return Response.json({ error: 'Failed to process booking' }, { status: 500 })
  }
}
