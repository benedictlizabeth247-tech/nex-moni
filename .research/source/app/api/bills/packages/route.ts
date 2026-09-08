
import { NextResponse } from 'next/server';

const PACKAGES: Record<string, any[]> = {
  dstv: [
    { id: 'padi', name: 'DStv Padi', price: 2500 },
    { id: 'yanga', name: 'DStv Yanga', price: 4200 },
    { id: 'confam', name: 'DStv Confam', price: 6200 },
    { id: 'compact', name: 'DStv Compact', price: 12500 },
    { id: 'compact_plus', name: 'DStv Compact Plus', price: 19800 },
    { id: 'premium', name: 'DStv Premium', price: 29500 },
  ],
  gotv: [
    { id: 'smallie', name: 'GOtv Smallie', price: 1100 },
    { id: 'jinja', name: 'GOtv Jinja', price: 2700 },
    { id: 'jolli', name: 'GOtv Jolli', price: 3950 },
    { id: 'max', name: 'GOtv Max', price: 5700 },
    { id: 'supa', name: 'GOtv Supa', price: 7600 },
    { id: 'supa_plus', name: 'GOtv Supa Plus', price: 12500 },
  ],
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get('provider');

  if (!provider || !PACKAGES[provider]) {
    return NextResponse.json([]);
  }

  return NextResponse.json(PACKAGES[provider]);
}
