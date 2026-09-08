
import { NextResponse } from 'next/server';

const MOCK_PLANS: Record<string, Array<{ id: string; title: string; validity: string; price: number }>> = {
  MTN: [
    { id: 'm1', title: '500MB', validity: '2 Days', price: 250 },
    { id: 'm2', title: '1GB', validity: '7 Days', price: 500 },
    { id: 'm3', title: '2GB', validity: '14 Days', price: 1000 },
    { id: 'm4', title: '4GB', validity: '30 Days', price: 2500 },
    { id: 'm5', title: '10GB', validity: '30 Days', price: 5000 },
  ],
  Airtel: [
    { id: 'a1', title: '500MB', validity: '2 Days', price: 250 },
    { id: 'a2', title: '1GB', validity: '7 Days', price: 500 },
    { id: 'a3', title: '4.5GB', validity: '30 Days', price: 2500 },
    { id: 'a4', title: '15GB', validity: '30 Days', price: 7500 },
  ],
  Glo: [
    { id: 'g1', title: '1.25GB', validity: '14 Days', price: 500 },
    { id: 'g2', title: '2.5GB', validity: '30 Days', price: 1000 },
    { id: 'g3', title: '7GB', validity: '30 Days', price: 2500 },
    { id: 'g4', title: '25GB', validity: '60 Days', price: 12000 },
  ],
  '9mobile': [
    { id: '9-1', title: '1GB', validity: '7 Days', price: 500 },
    { id: '9-2', title: '2GB', validity: '30 Days', price: 1200 },
    { id: '9-3', title: '10GB', validity: '30 Days', price: 5000 },
  ],
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const network = searchParams.get('network');

  if (!network || !MOCK_PLANS[network]) {
    return NextResponse.json({ error: 'Network not found' }, { status: 404 });
  }

  return NextResponse.json(MOCK_PLANS[network]);
}
