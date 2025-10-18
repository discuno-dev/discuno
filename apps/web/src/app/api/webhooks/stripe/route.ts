import { headers } from 'next/headers'
import { connection } from 'next/server'
import { NextResponse } from 'next/server'
import type { Stripe } from 'stripe'
import { handleCheckoutSessionWebhook } from '~/app/(app)/(public)/mentor/[username]/book/actions'
import { env } from '~/env'
import { stripe } from '~/lib/stripe'

export async function POST(req: Request) {
  await connection()
  const signature = (await headers()).get('stripe-signature') ?? ''

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(await req.text(), signature, env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error(`❌ Webhook signature verification failed: ${errorMessage}`)
    return new Response(`Webhook Error: ${errorMessage}`, {
      status: 400,
    })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionSucceeded(event.data.object)
        break

      default:
        console.log(`🤷‍♀️ Unhandled event type: ${event.type}`)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`❌ Webhook handler failed: ${errorMessage}`)
    return new Response(`Webhook handler error: ${errorMessage}`, {
      status: 500,
    })
  }

  return NextResponse.json({ received: true })
}

/**
 * Handle successful checkout sessions
 */
async function handleCheckoutSessionSucceeded(checkoutSession: Stripe.Checkout.Session) {
  console.log(`Handling successful checkout session: ${checkoutSession.id}`)
  try {
    const result = await handleCheckoutSessionWebhook(checkoutSession)

    if (result.success) {
      console.log(`✅ Successfully handled checkout session: ${checkoutSession.id}`)
    } else {
      console.error(`❌ Failed to handle checkout session ${checkoutSession.id}: ${result.error}`)
      // Throw an error to indicate a processing failure
      throw new Error(`Failed to handle checkout session ${checkoutSession.id}: ${result.error}`)
    }
  } catch (error) {
    console.error(`❌ Error handling checkout session ${checkoutSession.id}:`, error)
    // Re-throw the error to be caught by the main POST function's error handler
    throw error
  }
}
