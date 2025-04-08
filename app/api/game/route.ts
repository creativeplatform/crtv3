import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  // Use the correct port numbers here
  const response = await fetch(`http://localhost:${process.env.PORT || 3000}/api/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

    if (!response.ok) {
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: response.status });
    }   
  const data = await response.json();
  return NextResponse.json(data);
}