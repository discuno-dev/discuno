import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import type { Stripe } from 'stripe'
import { handlePaymentIntentWebhook } from '~/app/(app)/(public)/mentor/[username]/book/actions'
import { env } from '~/env'
import { stripe } from '~/lib/stripe'
import { upsertMentorStripeAccount } from '~/server/queries'

export async function POST(req: Request) {
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

  console.log(`🔔 Received Stripe event: ${event.type}`)

  try {
    switch (event.type) {
      case 'account.updated':
        await handleAccountUpdated(event.data.object)
        break

      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object)
        break

      case 'transfer.created':
        await handleTransferCreated(event.data.object)
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
 * Handle Stripe account updates
 */
async function handleAccountUpdated(account: Stripe.Account) {
  try {
    const userId = account.metadata?.userId

    if (!userId) {
      console.error(`❌ Stripe account ${account.id} has no userId in metadata.`)
      return
    }

    await upsertMentorStripeAccount({
      userId,
      stripeAccountId: account.id,
      stripeAccountStatus:
        account.charges_enabled && account.payouts_enabled ? 'active' : 'pending',
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      requirements: account.requirements as unknown as Record<string, unknown>,
    })

    console.log(`✅ Successfully handled account update for Stripe account: ${account.id}`)
  } catch (error) {
    console.error(`❌ Error handling account update for Stripe account ${account.id}:`, error)
    // Re-throw the error to be caught by the main POST function's error handler
    throw error
  }
}

/**
 * Handle successful payment intents
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log(`Handling successful payment intent: ${paymentIntent.id}`)
  try {
    const result = await handlePaymentIntentWebhook(paymentIntent)

    if (result.success) {
      console.log(`✅ Successfully handled payment intent: ${paymentIntent.id}`)
    } else {
      console.error(`❌ Failed to handle payment intent ${paymentIntent.id}: ${result.error}`)
      // Throw an error to indicate a processing failure
      throw new Error(`Failed to handle payment intent ${paymentIntent.id}: ${result.error}`)
    }
  } catch (error) {
    console.error(`❌ Error handling payment intent ${paymentIntent.id}:`, error)
    // Re-throw the error to be caught by the main POST function's error handler
    throw error
  }
}

/**
 * Handle transfer creation (when funds are sent to mentors)
 */
async function handleTransferCreated(transfer: Stripe.Transfer) {
  try {
    console.log(`Transfer created: ${transfer.id} for ${transfer.amount} ${transfer.currency}`)
    // Update transfer status in database if needed
    // This can be used for additional monitoring and reconciliation
    console.log(`✅ Successfully handled transfer created event: ${transfer.id}`)
  } catch (error) {
    console.error(`❌ Error handling transfer created event ${transfer.id}:`, error)
    // Re-throw the error to be caught by the main POST function's error handler
    throw error
  }
}
