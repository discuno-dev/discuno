import { Ratelimit } from '@upstash/ratelimit'
import { redis } from '~/lib/redis'

// Create a new ratelimiter, that allows 10 requests per 10 seconds
export const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(5, '10 s'),
  analytics: true,
})
