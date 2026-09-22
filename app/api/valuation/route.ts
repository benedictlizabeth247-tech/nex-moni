import { NextResponse } from "next/server"
import { getValuationMetadata } from "@/services/fxValuationService"

export async function GET() {
  const valuation = await getValuationMetadata()
  return NextResponse.json(valuation, { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } })
}
