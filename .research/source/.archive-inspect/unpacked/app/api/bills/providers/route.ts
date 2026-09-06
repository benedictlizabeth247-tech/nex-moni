
import { NextResponse } from 'next/server';

const PROVIDERS: Record<string, any[]> = {
  electricity: [
    { id: 'ikedc', name: 'Ikeja Electric (IKEDC)' },
    { id: 'ekedc', name: 'Eko Electricity (EKEDC)' },
    { id: 'aedc', name: 'Abuja Electricity (AEDC)' },
    { id: 'ibedc', name: 'Ibadan Electricity (IBEDC)' },
  ],
  cable: [
    { id: 'dstv', name: 'DStv' },
    { id: 'gotv', name: 'GOtv' },
    { id: 'startimes', name: 'Startimes' },
  ],
  internet: [
    { id: 'spectranet', name: 'Spectranet' },
    { id: 'smile', name: 'Smile' },
    { id: 'fibreone', name: 'FibreOne' },
  ],
  betting: [
    { id: 'bet9ja', name: 'Bet9ja' },
    { id: 'betking', name: 'BetKing' },
    { id: 'sportybet', name: 'SportyBet' },
  ],
  education: [
    { id: 'waec', name: 'WAEC ePIN' },
    { id: 'neco', name: 'NECO ePIN' },
    { id: 'jamb', name: 'JAMB ePIN' },
  ]
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');

  if (!category || !PROVIDERS[category]) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  return NextResponse.json(PROVIDERS[category]);
}
