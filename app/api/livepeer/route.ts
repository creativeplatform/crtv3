'use server';

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const livepeerUrl = `${process.env.LIVEPEER_API_URL}/api/asset`;
  const headers = {
    Authorization: `Bearer ${process.env.LIVEPEER_FULL_API_KEY}`,
  };
  const options = { headers };
  const response = await fetch(livepeerUrl, options);
  const json = await response.json();
  return NextResponse.json(json);
}

export async function POST(request: NextRequest) {
  const livepeerUpload = `${process.env.LIVEPEER_API_URL}/api/asset/request-upload`;
  const headers = {
    Authorization: `Bearer ${process.env.LIVEPEER_FULL_API_KEY}`,
    ContentType: 'application/json',
  };
  const options = { headers };
  const response = await fetch(livepeerUpload, options);
  const json = await response.json();
  return NextResponse.json(json);
}
