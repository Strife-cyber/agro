import cloudinary from '@/lib/cloudinary';
import { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const timestamp = Math.floor(Date.now() / 1000);

  // Parameters you want to sign (add more if needed, e.g., folder, tags)
  const paramsToSign = {
    timestamp,
    folder: 'agros'
  };

  if (!process.env.CLOUDINARY_API_SECRET) {
    return res.status(500).json({ error: 'Cloudinary API secret is not set' });
  }

  const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET);

  res.status(200).json({
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  });
}