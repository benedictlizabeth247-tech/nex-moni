import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'This provider funding route is disabled. Use the nexMonie manual bank-transfer deposit workflow.' },
    { status: 410 },
  )
}
