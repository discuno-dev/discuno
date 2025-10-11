import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { type DefaultSession, type NextAuthConfig } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id'

import { eq } from 'drizzle-orm'
import Nodemailer from 'next-auth/providers/nodemailer'
import { env } from '~/env'
import { downloadAndUploadProfileImage } from '~/lib/blob'
import { resend } from '~/lib/emails'
import { SignInEmail } from '~/lib/emails/templates/SignInEmail'
import { enforceCalcomIntegration, syncMentorEventTypesForUser } from '~/server/auth/dal'
import { getAllowedDomains } from '~/server/auth/domain-cache'
import { db } from '~/server/db'
import {
  accounts,
  schools,
  sessions,
  users,
  userSchools,
  verificationTokens,
} from '~/server/db/schema'

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      id: string
      // ...other properties
      // role: UserRole;
    } & DefaultSession['user']
  }

  // interface User {
  //   // ...other properties
  //   // role: UserRole;
  // }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
  providers: [
    MicrosoftEntraID({
      clientId: env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
      allowDangerousEmailAccountLinking: true, // Ok because trusted
    }),
    GoogleProvider({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),

    // Email provider cannot run in edge runtime in middleware
    Nodemailer({
      server: env.AUTH_EMAIL_SERVER,
      from: env.AUTH_EMAIL_FROM,
      sendVerificationRequest: async ({ identifier: email, url }) => {
        const { host } = new URL(url)
        await resend.emails.send({
          from: env.AUTH_EMAIL_FROM,
          to: email,
          subject: `Sign in to ${host}`,
          react: SignInEmail({ url, host }),
        })
      },
    }),
    /**
     * ...add more providers here.
     *
     * Most other providers require a bit more work than the Discord provider. For example, the
     * GitHub provider requires you to add the `refresh_token_expires_in` field to the Account
     * model. Refer to the NextAuth.js docs for the provider you want to use. Example:
     *
     * @see https://next-auth.js.org/providers/github
     */
  ],
  session: {
    maxAge: 2 * 60 * 60, // 2 hours
    updateAge: 30 * 60, // 30 minutes
  },
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  pages: {
    error: '/auth/error',
    signIn: '/auth',
  },
  callbacks: {
    session: ({ session, user }: { session: DefaultSession; user: { id: string } }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
      },
    }),
    async signIn({ user }) {
      if (!user.email || !user.id) {
        console.error('Sign-in failed: missing user email or ID')
        return '/auth/error?error=MissingEmailOrID'
      }
      try {
        // Ensure the user has a valid .edu email format
        const eduEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.edu$/
        if (!eduEmailRegex.test(user.email ?? '')) {
          console.log(`Sign-in rejected for invalid .edu email format: ${user.email ?? 'unknown'}`)
          return '/auth/rejected'
        }

        // Check if email domain matches a known school domain (in-memory check)
        const emailDomain = user.email.split('@')[1]?.toLowerCase()
        const allowedDomains = await getAllowedDomains()
        if (!emailDomain || !allowedDomains.has(emailDomain)) return '/auth/rejected'
        console.log(`Sign-in approved for recognized school domain: ${emailDomain}`)
        return true
      } catch (error) {
        console.error('Error in signIn callback:', error)
        return '/auth/error'
      }
    },
  },
  events: {
    async signIn({ user, isNewUser }) {
      if (isNewUser && user.id && user.email && user.image) {
        console.log(`New user signed in, processing profile image: ${user.email ?? 'unknown'}`)

        // Download the image and upload it to Vercel Blob
        const newImageUrl = await downloadAndUploadProfileImage(user.image, user.id)

        if (newImageUrl !== user.image) {
          console.log(`Updating user image in database for: ${user.email ?? 'unknown'}`)
          // Update the user's image URL in the database
          await db.update(users).set({ image: newImageUrl }).where(eq(users.id, user.id))
          user.image = newImageUrl // Update the user object for the next step
        }
      }

      // This event is called AFTER the user record is created in the database
      if (user.id && user.email && isNewUser) {
        console.log(
          `Creating Cal.com integration for user: ${user.email ?? 'unknown'} (isNewUser: ${isNewUser})`
        )

        const result = await enforceCalcomIntegration({
          userId: user.id,
          email: user.email || '',
          name: user.name ?? null,
          image: user.image ?? null,
        })

        if (result.success) {
          console.log(`Cal.com integration created successfully for: ${user.email ?? 'unknown'}`)

          try {
            const syncResult = await syncMentorEventTypesForUser(user.id, result.accessToken)
            if (syncResult.success) {
              console.log(
                `Synced Cal.com event types for user ${user.email ?? 'unknown'}: ` +
                  `created=${syncResult.created}, updated=${syncResult.updated}, deleted=${syncResult.deleted}`
              )
            } else {
              console.error(
                `Failed to sync event types for ${user.email ?? 'unknown'}: ${syncResult.error}`
              )
            }
          } catch (err) {
            console.error('Unexpected error syncing mentor event types:', err)
          }
        } else {
          console.error(
            `Cal.com integration failed for: ${user.email ?? 'unknown'} - ${result.error}`
          )
        }
      }

      // Assign user to school based on email domain if new user
      if (isNewUser && user.id && user.email) {
        const emailDomain = user.email.split('@')[1]?.toLowerCase()
        if (emailDomain) {
          const school = await db.query.schools.findFirst({
            where: eq(schools.domain, emailDomain),
          })
          if (school) {
            await db.insert(userSchools).values({ userId: user.id, schoolId: school.id })
            console.log(`Assigned user to school ${school.name} (domain: ${emailDomain})`)
          } else {
            console.error(`No school found for domain: ${emailDomain}. User not assigned.`)
          }
        } else {
          console.error(`Cannot assign school: invalid email ${user.email}`)
        }
      }
    },
  },
  secret: env.NEXTAUTH_SECRET,
} satisfies NextAuthConfig
