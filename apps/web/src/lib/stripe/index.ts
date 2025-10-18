import 'server-only'

import Stripe from 'stripe'
import { env } from '~/env'

let stripeInstance: Stripe | null = null

export const getStripe = () => {
  if (!stripeInstance) {
    stripeInstance = new Stripe(env.STRIPE_SECRET_KEY)
  }
  return stripeInstance
}

// Export a proxy that lazily initializes Stripe
export const stripe = new Proxy({} as Stripe, {
  get: (_, prop) => {
    const instance = getStripe()
    const value = instance[prop as keyof Stripe]
    // If it's a function, bind it to the instance
    if (typeof value === 'function') {
      return value.bind(instance)
    }
    return value
  },
})
