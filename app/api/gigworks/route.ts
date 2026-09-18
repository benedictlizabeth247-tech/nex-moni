import { GET as discoveryGet } from '@/app/api/discovery/route'

export const dynamic = 'force-dynamic'

export function GET(request: Request) {
  return discoveryGet(request)
}
