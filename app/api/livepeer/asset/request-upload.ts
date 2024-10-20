'use server';

import { NextApiRequest, NextApiResponse } from 'next';
import { fullLivepeer } from '@app/lib/sdk/livepeer/fullClient';
import { NewAssetFromUrlPayload } from 'livepeer/models/components';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === 'POST') {
    try {
      const { filename, filetype } = req.body;
      const asset = await fullLivepeer.asset.create({ name: filename });

      res.status(200).json({
        uploadUrl: asset.data?.tusEndpoint,
      });
    } catch (error) {
      console.error('Error creating Livepeer upload URL:', error);
      res.status(500).json({ error: 'Failed to create upload URL' });
    }
  } else {
    res.status(405).end(); // Method Not Allowed
  }
}
