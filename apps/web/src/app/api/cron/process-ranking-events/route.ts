import { connection } from 'next/server'
import { NextResponse } from 'next/server'
import { processAnalyticsEvents } from '~/server/ranking/service'

export async function GET() {
  await connection()
  try {
    await processAnalyticsEvents()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error processing ranking events:', error)
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}
