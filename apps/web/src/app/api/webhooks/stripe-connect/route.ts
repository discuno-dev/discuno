import { headers } from 'next/headers'
import { connection } from 'next/server'
import { NextResponse } from 'next/server'
import type { Stripe } from 'stripe'
import { env } from '~/env'
import { upsertMentorStripeAccount } from '~/lib/services/stripe-service'
import { stripe } from '~/lib/stripe'

export async function POST(req: Request) {
  await connection()
  const signature = (await headers()).get('stripe-signature') ?? ''

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      await req.text(),
      signature,
      env.STRIPE_CONNECT_WEBHOOK_SECRET
    )
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error(`❌ Webhook signature verification failed: ${errorMessage}`)
    return new Response(`Webhook Error: ${errorMessage}`, {
      status: 400,
    })
  }

  try {
    switch (event.type) {
      case 'account.updated':
        await handleAccountUpdated(event.data.object)
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
