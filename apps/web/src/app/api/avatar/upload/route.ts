import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { connection } from 'next/server'
import { NextResponse } from 'next/server'
import { getUserId } from '~/server/queries/profiles'

export async function POST(request: Request): Promise<NextResponse> {
  await connection()
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const userId = await getUserId()
        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
          tokenPayload: JSON.stringify({
            userId,
          }),
          addRandomSuffix: true,
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log('blob upload completed', blob, tokenPayload)
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
