import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import Stripe from 'stripe'
import {
  calcomTokens,
  majors,
  mentorEventTypes,
  mentorReviews,
  mentorStripeAccounts,
  posts,
  schools,
  userMajors,
  userProfiles,
  users,
  userSchools,
} from '~/server/db/schema'

/**
 * Database seeding utility for Railway PostgreSQL using manual insertion
 * Only runs for development and preview environments for safety
 *
 * This seeder creates comprehensive, realistic data including:
 * - 50 mentor users with detailed profiles and diverse backgrounds (all with Cal.com accounts)
 * - 40+ majors across STEM, liberal arts, business, and other fields
 * - 15 prestigious schools with locations and images
 * - User-school and user-major relationships (30% double majors)
 * - All users create posts with engaging titles and descriptions
 * - All users are mentors with realistic reviews (2-8 reviews each)
 * - Realistic mentor review ratings (70% 5-star, 20% 4-star, 10% lower)
 * - Smart graduation year calculation based on current school year
 * - Diverse, realistic user bios covering different academic paths
 * - Cal.com managed user accounts and tokens for all users
 */

type Environment = 'local' | 'preview' | 'production' | 'test'

const loadEnvironmentConfig = (environment?: Environment) => {
  if (!environment) {
    // Load default .env if no environment specified
    config({ path: '.env' })
    return
  }

  const envFiles = {
    local: '.env.local',
    preview: '.env.preview',
    production: '.env.production',
    test: '.env.test',
  }

  const envFile = envFiles[environment]
  console.log(`📄 Loading environment config from: ${envFile}`)

  try {
    // Load environment-specific file first with override
    config({ path: envFile, override: true })

    // Load default .env as fallback for any missing variables
    config({ path: '.env' })
  } catch {
    console.log(`⚠️  Could not load ${envFile}, trying .env as fallback`)
    config({ path: '.env' })
  }
}

const createSeedConnection = (environment?: Environment) => {
  // Load the appropriate environment configuration
  loadEnvironmentConfig(environment)

  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error(`DATABASE_URL environment variable is not set for environment: ${environment}`)
  }

  const seedClient = postgres(databaseUrl, {
    max: 1,
  })
  const db = drizzle(seedClient, { casing: 'snake_case' })

  return { client: seedClient, db }
}

// Enhanced sample data arrays
const majorNames = [
  'Computer Science',
  'Software Engineering',
  'Data Science',
  'Cybersecurity',
  'Business Administration',
  'Marketing',
  'Finance',
  'Economics',
  'Psychology',
  'Cognitive Science',
  'Mechanical Engineering',
  'Electrical Engineering',
  'Chemical Engineering',
  'Biomedical Engineering',
  'Civil Engineering',
  'Pre-Medicine',
  'Biology',
  'Biochemistry',
  'Neuroscience',
  'Public Health',
  'English Literature',
  'Creative Writing',
  'Journalism',
  'Communications',
  'Political Science',
  'International Relations',
  'Public Policy',
  'History',
  'Philosophy',
  'Art History',
  'Fine Arts',
  'Graphic Design',
  'Mathematics',
  'Statistics',
  'Physics',
  'Astronomy',
  'Chemistry',
  'Environmental Science',
  'Architecture',
  'Urban Planning',
]

import schoolData from '~/../scripts/unis-with-colors.json'

const userImages = [
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1494790108755-2616c65a0c3e?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1506794778491-fd4f5e7a1e3e?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1592206167183-d9aca75c0999?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1521119989659-a83eee488004?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150&h=150&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&h=150&fit=crop&crop=face',
]

const schoolYears = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'] as const

const firstName = [
  'Alex',
  'Jordan',
  'Taylor',
  'Casey',
  'Morgan',
  'Riley',
  'Avery',
  'Quinn',
  'Sage',
  'River',
  'Emma',
  'Liam',
  'Olivia',
  'Noah',
  'Ava',
  'Ethan',
  'Sophia',
  'Mason',
  'Isabella',
  'William',
  'Mia',
  'James',
  'Charlotte',
  'Benjamin',
  'Amelia',
  'Lucas',
  'Harper',
  'Henry',
  'Evelyn',
  'Alexander',
  'Abigail',
  'Michael',
  'Emily',
  'Daniel',
  'Elizabeth',
  'Jacob',
  'Sofia',
  'Logan',
  'Madison',
  'Jackson',
  'Scarlett',
  'David',
  'Victoria',
  'Owen',
  'Aria',
  'Matthew',
  'Grace',
  'Wyatt',
  'Chloe',
  'Aiden',
]

const lastName = [
  'Smith',
  'Johnson',
  'Williams',
  'Brown',
  'Jones',
  'Garcia',
  'Miller',
  'Davis',
  'Rodriguez',
  'Martinez',
  'Hernandez',
  'Lopez',
  'Gonzalez',
  'Wilson',
  'Anderson',
  'Thomas',
  'Taylor',
  'Moore',
  'Jackson',
  'Martin',
  'Lee',
  'Perez',
  'Thompson',
  'White',
  'Harris',
  'Sanchez',
  'Clark',
  'Ramirez',
  'Lewis',
  'Robinson',
  'Walker',
  'Young',
  'Allen',
  'King',
  'Wright',
  'Scott',
  'Torres',
  'Nguyen',
  'Hill',
  'Flores',
  'Green',
  'Adams',
  'Nelson',
  'Baker',
  'Hall',
  'Rivera',
  'Campbell',
  'Mitchell',
  'Carter',
  'Roberts',
]

const userBios = [
  'Passionate about AI and machine learning. Currently working on computer vision projects and exploring the intersection of technology and healthcare. Love hiking and photography in my free time.',
  'Pre-med student with a focus on pediatrics. Volunteer at local hospitals and participate in medical mission trips. Interested in global health disparities and healthcare accessibility.',
  'Business major with an entrepreneurial mindset. Co-founded a sustainable fashion startup and love connecting with like-minded innovators. Always looking for the next big opportunity.',
  'Psychology student fascinated by human behavior and mental health advocacy. Research assistant in cognitive psychology lab. Passionate about making mental health resources more accessible.',
  'Engineering student specializing in renewable energy systems. Part of the solar car team and actively involved in sustainability initiatives on campus. Future goal: climate tech startup.',
  'English literature major with a love for creative writing. Editor of the campus literary magazine and aspiring novelist. Believe in the power of storytelling to create change.',
  'Economics student interested in behavioral economics and public policy. Intern at a think tank focused on education reform. Dream of working in government to make systemic change.',
  'Computer science student with a passion for cybersecurity. Member of the ethical hacking club and volunteer teaching coding to underrepresented youth. Interested in digital privacy rights.',
  'Biology major on the pre-vet track. Work at an animal rescue and volunteer at the campus veterinary clinic. Passionate about animal welfare and wildlife conservation.',
  'Art history major with a focus on contemporary art and museum studies. Intern at a local gallery and aspiring curator. Love exploring the cultural significance of visual art.',
  'Mathematics major interested in cryptography and number theory. Tutor for calculus and participate in math competitions. Plan to pursue a PhD in pure mathematics.',
  'Philosophy major exploring ethics and political philosophy. Debate team captain and involved in social justice advocacy. Interested in law school and public interest law.',
  'International relations major with focus on conflict resolution. Study abroad experience in three countries. Fluent in four languages and passionate about diplomacy.',
  'Environmental science major working on climate change research. Leader of campus sustainability club and organizer of Earth Day events. Committed to environmental justice.',
  'Finance major with interest in sustainable investing. Treasurer of investment club and intern at impact investing firm. Want to align financial success with social good.',
  'Data science major working on machine learning applications in healthcare. Research assistant analyzing medical imaging data. Excited about the potential of AI in medicine.',
  'Communications major specializing in digital marketing and social media strategy. Run a successful lifestyle blog and freelance for small businesses. Love creative content creation.',
  'Chemical engineering major interested in pharmaceutical development. Work in a drug discovery lab and volunteer with patients in clinical trials. Goal: develop life-saving medications.',
  'Political science major with focus on voting rights and democracy. Intern with voter registration organizations and campus political advocacy groups. Plan to work in campaign management.',
  'Architecture major passionate about sustainable design and urban planning. Part of design competition teams and volunteer with Habitat for Humanity. Dream of creating equitable housing.',
]

const mentorReviewComments = [
  'Incredible mentor! Their guidance helped me land my dream internship. Always responsive and genuinely cares about student success.',
  'Amazing experience. They provided practical advice for navigating pre-med requirements and shared valuable insights about medical school applications.',
  'So grateful for their mentorship. They helped me switch majors with confidence and provided excellent career guidance throughout the process.',
  'Fantastic mentor who really understands the entrepreneurship journey. Their network connections and startup advice were invaluable.',
  'They provided excellent guidance for graduate school applications. Their feedback on my personal statement made a huge difference.',
  'Wonderful mentor who helped me develop confidence in technical interviews. Their mock interview sessions were incredibly helpful.',
  'Great experience overall. They shared practical tips for work-life balance and helped me navigate my first professional job.',
  "Outstanding mentor! They helped me overcome imposter syndrome and develop leadership skills I didn't know I had.",
  'Very knowledgeable about the finance industry. Their career advice and networking tips were spot-on and actionable.',
  'Excellent mentor who provided valuable insights into the research world. Helped me secure my first research position.',
  'Amazing support throughout my college journey. They helped me develop study strategies that significantly improved my grades.',
  'Fantastic mentor for anyone interested in tech. Their industry insights and interview preparation were incredibly valuable.',
  'Great experience! They helped me navigate difficult family expectations while staying true to my own goals and interests.',
  'Wonderful mentorship experience. They provided excellent guidance for building a professional network and finding opportunities.',
  'Outstanding mentor who helped me develop public speaking skills and confidence. Their feedback was always constructive and encouraging.',
  'Very helpful for understanding the realities of graduate student life. Their advice helped me make an informed decision about my future.',
  'Excellent mentor who provided practical advice for managing academic stress and maintaining mental health during challenging times.',
  "Great experience overall. They helped me explore different career paths and discover opportunities I hadn't considered before.",
  'Fantastic mentor who provided valuable insights into the consulting industry. Their case interview preparation was extremely helpful.',
  'Amazing support for navigating diversity challenges in STEM. They helped me find my voice and build confidence in academic settings.',
  'Excellent mentor who helped me develop project management skills and learn to work effectively in team environments.',
  'Great experience! They provided practical advice for building a strong portfolio and showcasing skills to potential employers.',
  'Wonderful mentor who helped me navigate the transition from college to professional life. Their insights were incredibly valuable.',
  'Outstanding mentorship experience. They helped me develop research skills and think critically about complex academic questions.',
  'Very knowledgeable about the nonprofit sector. Their advice helped me find meaningful volunteer opportunities and career paths.',
]

// Helper functions
const getRandomElement = <T>(array: readonly T[]): T => {
  const index = Math.floor(Math.random() * array.length)
  const value = array[index]

  if (value === undefined) {
    throw new Error('Cannot get random element from empty array')
  }

  return value
}

const getRandomElements = <T>(array: readonly T[], count: number): T[] => {
  const shuffled = [...array].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, count)
}

const generateUserData = (count: number) => {
  const users = []
  for (let i = 0; i < count; i++) {
    const first = getRandomElement(firstName)
    const last = getRandomElement(lastName)
    const name = `${first} ${last}`
    const email = `${first.toLowerCase()}.${last.toLowerCase()}${i + 1}@university.edu`

    users.push({
      name,
      email,
      image: getRandomElement(userImages),
    })
  }
  return users
}

const generateGraduationYear = (schoolYear: string): number => {
  const currentYear = new Date().getFullYear()
  const baseYear = currentYear + 1 // Most people graduate after current academic year

  switch (schoolYear) {
    case 'Freshman':
      return baseYear + 3
    case 'Sophomore':
      return baseYear + 2
    case 'Junior':
      return baseYear + 1
    case 'Senior':
      return baseYear
    case 'Graduate':
      return baseYear + Math.floor(Math.random() * 3) + 1 // 1-4 years for grad programs
    default:
      return baseYear
  }
}

export const seedDatabase = async (environment?: Environment) => {
  const targetEnv = environment

  if (targetEnv === 'test') {
    console.log('🌱 Skipping database seeding for test environment')
    return
  }

  // Safety check: don't allow seeding production unless explicitly enabled
  if (targetEnv === 'production') {
    const allowProdSeeding = process.env.ALLOW_PROD_SEEDING === 'true'
    if (!allowProdSeeding) {
      throw new Error('❌ Production seeding is disabled. Set ALLOW_PROD_SEEDING=true to enable.')
    }
    console.log('⚠️  PRODUCTION SEEDING ENABLED - Proceeding with caution')
  }

  console.log(`🌱 Starting database seeding for environment: ${targetEnv}`)

  const { client, db } = createSeedConnection(environment)

  try {
    console.log('🔄 Starting database seeding process...')

    // Keep track of successful seeds for summary
    const seedResults = {
      majors: false,
      schools: false,
      users: false,
      userProfiles: false,
      userMajors: false,
      userSchools: false,
      posts: false,
      mentorReviews: false,
      calcomTokens: false,
      stripeAccounts: false,
      mentorEventTypes: false,
      // Note: bookings, attendees, organizers, and payments will be created via webhooks/API, not seeded
    }

    type InsertedMajor = typeof majors.$inferSelect
    type InsertedSchool = typeof schools.$inferSelect
    type InsertedUser = typeof users.$inferSelect

    let insertedMajors: InsertedMajor[] = []
    let insertedSchools: InsertedSchool[] = []
    let insertedUsers: InsertedUser[] = []

    // Step 1: Insert majors
    try {
      console.log('📚 Inserting majors...')
      insertedMajors = await db
        .insert(majors)
        .values(majorNames.map(name => ({ name })))
        .returning()
      seedResults.majors = true
      console.log('✅ Majors seeded successfully')
    } catch (error) {
      console.error('❌ Failed to seed majors:', error)
    }

    // Step 2: Insert schools
    try {
      console.log('🏫 Inserting schools...')
      insertedSchools = await db.insert(schools).values(schoolData).returning()
      seedResults.schools = true
      console.log('✅ Schools seeded successfully')
    } catch (error) {
      console.error('❌ Failed to seed schools:', error)
    }

    // Step 3: Insert mentor users only (all users will have Cal.com accounts)
    try {
      console.log('👥 Inserting mentor users...')
      const userData = generateUserData(50) // Only create mentors
      insertedUsers = await db.insert(users).values(userData).returning()
      seedResults.users = true
      console.log('✅ Users seeded successfully')
    } catch (error) {
      console.error('❌ Failed to seed users:', error)
    }

    // Step 4: Insert user profiles
    if (insertedUsers.length > 0) {
      try {
        console.log('📋 Inserting user profiles...')
        const userProfileData = insertedUsers.map((user, index) => {
          const schoolYear = getRandomElement(schoolYears)
          const graduationYear = generateGraduationYear(schoolYear)
          const bioIndex = index % userBios.length

          return {
            userId: user.id,
            bio: userBios[bioIndex],
            schoolYear,
            graduationYear,
          }
        })
        await db.insert(userProfiles).values(userProfileData)
        seedResults.userProfiles = true
        console.log('✅ User profiles seeded successfully')
      } catch (error) {
        console.error('❌ Failed to seed user profiles:', error)
      }
    }

    // Step 5: Insert user majors (each user gets 1-2 majors)
    if (insertedUsers.length > 0 && insertedMajors.length > 0) {
      try {
        console.log('🎓 Inserting user majors...')
        const userMajorData = []
        for (const user of insertedUsers) {
          const numMajors = Math.random() > 0.7 ? 2 : 1 // 30% chance of double major
          const selectedMajors = getRandomElements(insertedMajors, numMajors)

          for (const major of selectedMajors) {
            userMajorData.push({
              userId: user.id,
              majorId: major.id,
            })
          }
        }
        await db.insert(userMajors).values(userMajorData)
        seedResults.userMajors = true
        console.log('✅ User majors seeded successfully')
      } catch (error) {
        console.error('❌ Failed to seed user majors:', error)
      }
    }

    // Step 6: Insert user schools (each user gets one school)
    if (insertedUsers.length > 0 && insertedSchools.length > 0) {
      try {
        console.log('🏛️ Inserting user schools...')
        const userSchoolData = insertedUsers.map(user => ({
          userId: user.id,
          schoolId: getRandomElement(insertedSchools).id,
        }))
        await db.insert(userSchools).values(userSchoolData)
        seedResults.userSchools = true
        console.log('✅ User schools seeded successfully')
      } catch (error) {
        console.error('❌ Failed to seed user schools:', error)
      }
    }

    // Step 7: Insert posts (all users get exactly one post)
    if (insertedUsers.length > 0) {
      try {
        console.log('📝 Inserting posts...')
        const postingUsers = insertedUsers // All users get exactly one post

        const postData = postingUsers.map(user => ({
          name: user.name ?? 'Untitled Post',
          createdById: user.id,
        }))
        await db.insert(posts).values(postData)
        seedResults.posts = true
        console.log('✅ Posts seeded successfully')
      } catch (error) {
        console.error('❌ Failed to seed posts:', error)
      }
    }

    // Step 8: Insert mentor reviews (all users are mentors, so they all get reviews)
    if (insertedUsers.length > 0) {
      try {
        console.log('⭐ Inserting mentor reviews...')
        const mentors = insertedUsers // All users are mentors
        const reviewData = []

        for (const mentor of mentors) {
          // Each mentor gets 2-8 reviews from other mentors
          const numReviews = Math.floor(Math.random() * 7) + 2
          const reviewers = getRandomElements(
            insertedUsers.filter(u => u.id !== mentor.id),
            Math.min(numReviews, insertedUsers.length - 1)
          )

          for (const reviewer of reviewers) {
            const rating =
              Math.random() > 0.1
                ? Math.random() > 0.3
                  ? 5
                  : 4 // 70% get 5 stars, 20% get 4 stars
                : Math.floor(Math.random() * 3) + 3 // 10% get 3, 2, or 1 stars

            reviewData.push({
              mentorId: mentor.id,
              userId: reviewer.id,
              rating,
              review: getRandomElement(mentorReviewComments),
            })
          }
        }
        await db.insert(mentorReviews).values(reviewData)
        seedResults.mentorReviews = true
        console.log('✅ Mentor reviews seeded successfully')
      } catch (error) {
        console.error('❌ Failed to seed mentor reviews:', error)
      }
    }

    // Step 9: Create Cal.com managed users and add them to college-mentors team
    if (insertedUsers.length > 0) {
      try {
        console.log('🌐 Creating Cal.com managed users and adding to college-mentors team...')
        const calcomApiBase = process.env.NEXT_PUBLIC_CALCOM_API_URL
        const calcomClientId = process.env.NEXT_PUBLIC_X_CAL_ID
        const calcomSecretKey = process.env.X_CAL_SECRET_KEY
        const calcomOrgId = process.env.CALCOM_ORG_ID
        const collegeMentorTeamId = process.env.COLLEGE_MENTOR_TEAM_ID
        if (!calcomClientId || !calcomSecretKey || !calcomOrgId || !collegeMentorTeamId) {
          throw new Error(
            'Missing Cal.com credentials: NEXT_PUBLIC_X_CAL_ID, X_CAL_SECRET_KEY, CALCOM_ORG_ID, and/or COLLEGE_MENTOR_TEAM_ID'
          )
        }
        const calcomTokenData: Array<{
          userId: string
          calcomUserId: number
          calcomUsername: string
          accessToken: string
          refreshToken: string
          accessTokenExpiresAt: Date
          refreshTokenExpiresAt: Date
        }> = []

        const mentors = insertedUsers // All users are mentors
        for (const mentor of mentors) {
          try {
            // Step 9a: Create Cal.com managed user
            const userResponse = await fetch(
              `${calcomApiBase}/oauth-clients/${calcomClientId}/users`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-cal-secret-key': calcomSecretKey,
                },
                body: JSON.stringify({
                  email: mentor.email,
                  name: mentor.name ?? '',
                  timeFormat: 12,
                  weekStart: 'Monday',
                  timeZone: 'UTC',
                  locale: 'en',
                  avatarUrl: mentor.image ?? undefined,
                  bio: '',
                  metadata: {},
                }),
              }
            )

            if (!userResponse.ok) {
              const errText = await userResponse.text()
              throw new Error(
                `Failed to create Cal.com user for ${mentor.email}: ${userResponse.status} ${errText}`
              )
            }

            const userJson = await userResponse.json()
            const {
              accessToken,
              refreshToken,
              accessTokenExpiresAt,
              refreshTokenExpiresAt,
              user: calUser,
            } = userJson.data

            // Step 9b: Add user to college-mentors team
            const membershipResponse = await fetch(
              `${calcomApiBase}/organizations/${calcomOrgId}/teams/${collegeMentorTeamId}/memberships`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-cal-secret-key': calcomSecretKey,
                  'x-cal-client-id': calcomClientId,
                },
                body: JSON.stringify({
                  role: 'MEMBER',
                  accepted: true,
                  disableImpersonation: false,
                  userId: calUser.id,
                }),
              }
            )

            if (!membershipResponse.ok) {
              const membershipErrorText = await membershipResponse.text()
              console.error(
                `Failed to add user ${calUser.id} to college-mentors team: ${membershipResponse.status} ${membershipErrorText}`
              )
              // Continue anyway - user is created even if team membership fails
            } else {
              const membershipData = await membershipResponse.json()
              console.log(`Successfully added user ${calUser.id} to college-mentors team`)
              console.log('Team membership data:', membershipData)
            }

            calcomTokenData.push({
              userId: mentor.id,
              calcomUserId: calUser.id,
              calcomUsername: calUser.username,
              accessToken,
              refreshToken,
              accessTokenExpiresAt: new Date(accessTokenExpiresAt),
              refreshTokenExpiresAt: new Date(refreshTokenExpiresAt),
            })
          } catch (error) {
            console.error(`Error processing mentor ${mentor.email}:`, error)
          }
        }

        if (calcomTokenData.length > 0) {
          console.log('📑 Inserting Cal.com tokens into DB...')
          await db.insert(calcomTokens).values(calcomTokenData)
        }
        seedResults.calcomTokens = true
        console.log('✅ Cal.com tokens seeded successfully')
      } catch (error) {
        console.error('❌ Failed to seed Cal.com tokens:', error)
      }
    }

    // Step 10: Seed Stripe Connect accounts for mentors
    if (insertedUsers.length > 0) {
      try {
        console.log('💳 Creating Stripe Connect test accounts for mentors...')
        type StripeAccountData = typeof mentorStripeAccounts.$inferInsert
        const stripeAccountData: StripeAccountData[] = []

        const stripeSecretKey = process.env.STRIPE_SECRET_KEY
        if (!stripeSecretKey) {
          throw new Error('STRIPE_SECRET_KEY environment variable is not set')
        }
        const stripe = new Stripe(stripeSecretKey)

        for (const user of insertedUsers) {
          try {
            const acct = await stripe.accounts.create({
              type: 'express',
              country: 'US',
              email: user.email ?? undefined,
              metadata: { userId: user.id },
              business_type: 'individual',
              individual: {
                first_name: user.name?.split(' ')[0] ?? 'Test',
                last_name: user.name?.split(' ')[1] ?? 'User',
                email: user.email ?? undefined,
                address: {
                  line1: '123 Test Street',
                  city: 'San Francisco',
                  state: 'CA',
                  postal_code: '94102',
                  country: 'US',
                },
                dob: {
                  day: 15,
                  month: 6,
                  year: 1995,
                },
                phone: '+14155551234',
                ssn_last_4: '0000',
              },
              business_profile: {
                mcc: '8299', // Educational services
                url: 'https://discuno.com',
                product_description: 'Educational mentoring services',
              },
              external_account: {
                object: 'bank_account',
                country: 'US',
                currency: 'usd',
                routing_number: '110000000', // Test routing number
                account_number: '000123456789', // Test account number
                account_holder_type: 'individual',
              },
            })
            stripeAccountData.push({
              userId: user.id,
              stripeAccountId: acct.id,
              stripeAccountStatus: 'active',
              onboardingCompleted: acct.created ? new Date(acct.created * 1000) : undefined,
              payoutsEnabled: true,
              chargesEnabled: true,
              detailsSubmitted: true,
              requirements: {},
            })
          } catch (err) {
            console.error(`Failed to create Stripe account for user ${user.id}:`, err)
          }
        }

        if (stripeAccountData.length > 0) {
          console.log('📑 Inserting Stripe Connect accounts into DB...')
          await db.insert(mentorStripeAccounts).values(stripeAccountData)
        }
        seedResults.stripeAccounts = true
        console.log('✅ Stripe Connect accounts seeded successfully')
      } catch (error) {
        console.error('❌ Failed to seed Stripe accounts:', error)
      }
    }

    // Step 11: Populate mentor event types from Cal.com team defaults
    if (insertedUsers.length > 0) {
      try {
        console.log('🔄 Populating mentor event types from Cal.com...')
        const calcomApiBase = process.env.NEXT_PUBLIC_CALCOM_API_URL
        const allCalcomTokens = await db.select().from(calcomTokens)

        const userToCalcomInfoMap = new Map(
          allCalcomTokens.map(token => [
            token.userId,
            { username: token.calcomUsername, accessToken: token.accessToken },
          ])
        )

        const mentorEventTypesData = []
        let totalFetched = 0

        for (const user of insertedUsers) {
          const calcomInfo = userToCalcomInfoMap.get(user.id)
          if (!calcomInfo) {
            console.warn(`⚠️ No Cal.com info for user ${user.id}, skipping event type sync.`)
            continue
          }

          try {
            const response = await fetch(
              `${calcomApiBase}/event-types?username=${calcomInfo.username}`,
              {
                headers: {
                  'cal-api-version': '2024-06-14',
                },
              }
            )

            if (!response.ok) {
              const errText = await response.text()
              throw new Error(
                `Failed to fetch event types for ${calcomInfo.username}: ${response.status} ${errText}`
              )
            }

            const calcomEventTypesData = await response.json()
            const calcomEventTypes = calcomEventTypesData.data as Array<{
              id: number
              title: string
              description: string | null
              lengthInMinutes: number
            }>

            for (const eventType of calcomEventTypes) {
              mentorEventTypesData.push({
                mentorUserId: user.id,
                calcomEventTypeId: eventType.id,
                title: eventType.title,
                description: eventType.description,
                duration: eventType.lengthInMinutes,
                isEnabled: true, // Enable by default
                customPrice: Math.floor(Math.random() * 20000) + 2500, // $25-$225 in cents
                currency: 'USD',
              })
              totalFetched++
            }
          } catch (error) {
            console.error(`❌ Error fetching event types for user ${user.id}:`, error)
          }
        }

        if (mentorEventTypesData.length > 0) {
          await db.insert(mentorEventTypes).values(mentorEventTypesData)
        }

        seedResults.mentorEventTypes = true
        console.log(`✅ Populated ${totalFetched} mentor event types from Cal.com successfully`)
      } catch (error) {
        console.error('❌ Failed to populate mentor event types from Cal.com:', error)
      }
    }

    console.log('🎉 Database seeding completed!')
    console.log('📊 Seeding Results:')
    Object.entries(seedResults).forEach(([key, success]) => {
      console.log(`  ${success ? '✅' : '❌'} ${key}`)
    })
    console.log('📊 Generated comprehensive realistic data including:')
    console.log(`  - 50 mentor users with detailed profiles (all added to college-mentors team)`)
    console.log(`  - Posts with engaging content for all users`)
    console.log(`  - ${majorNames.length} majors and ${schoolData.length} schools`)
    console.log(`  - Mentor reviews with ratings for all users`)
    console.log('  - Complete relationship mappings between all entities')
    console.log('  - Realistic graduation years based on school year')
    console.log('  - Diverse bio content and user backgrounds')
    console.log('  - Cal.com managed users added to college-mentors team')
    console.log('  - Stripe Connect test accounts created for all mentors')
  } catch (error) {
    console.error(`❌ Seeding failed for ${targetEnv}:`, error)
    throw error
  } finally {
    await client.end()
    console.log(`🔌 Database connection closed for ${targetEnv}`)
  }
}

export const seedProductionData = async () => {
  console.log('🌱 Starting production database seeding...')
  const { client, db } = createSeedConnection('production')

  try {
    console.log('📚 Inserting majors...')
    await db
      .insert(majors)
      .values(majorNames.map(name => ({ name })))
      .onConflictDoNothing()

    console.log('🏫 Inserting schools...')
    await db.insert(schools).values(schoolData).onConflictDoNothing()

    console.log('✅ Production data seeded successfully')
  } catch (error) {
    console.error('❌ Failed to seed production data:', error)
    throw error
  } finally {
    await client.end()
    console.log('🔌 Database connection closed for production')
  }
}

// CLI support
if (import.meta.url === `file://${process.argv[1]}`) {
  const environment = process.argv[2] as Environment | undefined

  if (environment && !['local', 'preview'].includes(environment)) {
    console.error(
      '❌ Invalid environment for seeding. Use: local or preview (production not allowed)'
    )
    process.exit(1)
  }

  seedDatabase(environment)
    .then(() => {
      console.log('🌟 Seeding process completed')
      process.exit(0)
    })
    .catch(error => {
      console.error('💥 Seeding process failed:', error)
      process.exit(1)
    })
}
