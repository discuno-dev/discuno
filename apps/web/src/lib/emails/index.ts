import 'server-only'

import { Resend } from 'resend'
import { env } from '~/env'

let resendInstance: Resend | null = null

export const getResend = () => {
  if (!resendInstance) {
    resendInstance = new Resend(env.RESEND_API_KEY)
  }
  return resendInstance
}

// Export a proxy that lazily initializes Resend  
export const resend = new Proxy({} as Resend, {
  get: (_, prop) => {
    const instance = getResend()
    const value = instance[prop as keyof Resend]
    // If it's a function, bind it to the instance
    if (typeof value === 'function') {
      return value.bind(instance)
    }
    return value
  },
})
