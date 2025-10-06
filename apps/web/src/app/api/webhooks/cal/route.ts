import crypto from 'crypto'
import { refundStripePaymentIntent } from '~/app/(app)/(public)/mentor/[username]/book/actions'
import { env } from '~/env'
import {
  CalcomBookingPayloadSchema,
  type CalcomBookingPayload,
  type CalcomWebhookEvent,
} from '~/lib/schemas/calcom'
import { createAnalyticsEvent, createLocalBooking } from '~/server/queries'

export async function POST(req: Request) {
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
        // Handle AFTER_HOSTS_CAL_VIDEO_NO_SHOW event
        if (!payload.metadata.paymentId) {
          console.error('❌ Missing paymentId in AFTER_HOSTS_CAL_VIDEO_NO_SHOW event')
          return Response.json({ error: 'Missing paymentId' }, { status: 400 })
        }
        // Attempt to refund the payment
        try {
          await refundStripePaymentIntent(payload.metadata.paymentId)
        } catch (err) {
          console.error(
            '❌ Failed to process refund for paymentId:',
            payload.metadata.paymentId,
            err
          )
          return Response.json({ error: 'Failed to process refund' }, { status: 500 })
        }
        break
      // TODO: Handle events
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
      case 'BOOKING_CANCELED':
        console.log(`✅ Booking canceled for event: ${triggerEvent}`)
        console.log(`✅ Booking details: ${JSON.stringify(payload)}`)
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
