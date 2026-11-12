import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';

const CRYPTOMUS_MERCHANT_ID = process.env.CRYPTOMUS_MERCHANT_ID || '';
const CRYPTOMUS_PAYMENT_KEY = process.env.CRYPTOMUS_PAYMENT_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { usernameId, username, amount, customerEmail } = req.body;

    if (!username || !amount || !customerEmail) {
      return res.status(400).json({ error: 'Missing required checkout parameters.' });
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      return res.status(400).json({ error: 'Invalid email address provided.' });
    }

    // Parse numeric price cleanly (strip $, commas, etc.)
    const cleanAmount = parseFloat(String(amount).replace(/[^0-9.]/g, ''));
    if (!cleanAmount || cleanAmount <= 0) {
      return res.status(400).json({ error: 'Invalid amount for checkout.' });
    }

    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const host = req.headers['x-forwarded-host'] || req.headers.host || 'users.zentirog.lol';
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const baseUrl = `${protocol}://${host}`;

    const payload = {
      amount: cleanAmount.toFixed(2),
      currency: 'USD',
      order_id: orderId,
      url_return: `${baseUrl}/order-success?order_id=${orderId}&handle=${encodeURIComponent(username)}`,
      url_callback: `${baseUrl}/api/cryptomus-webhook`,
      is_payment_multiple: false,
      lifetime: 3600, // 1 hour expiration
      additional_data: JSON.stringify({
        usernameId: usernameId || '',
        username,
        customerEmail: customerEmail.trim().toLowerCase(),
      }),
    };

    const jsonPayload = JSON.stringify(payload);
    const sign = crypto
      .createHash('md5')
      .update(Buffer.from(jsonPayload).toString('base64') + CRYPTOMUS_PAYMENT_KEY)
      .digest('hex');

    const cryptomusResponse = await fetch('https://api.cryptomus.com/v1/payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        merchant: CRYPTOMUS_MERCHANT_ID,
        sign,
      },
      body: jsonPayload,
    });

    const data = await cryptomusResponse.json();

    if (!cryptomusResponse.ok || data.state !== 0 || !data.result?.url) {
      console.error('Cryptomus API invoice error:', data);
      return res.status(502).json({
        error: data.message || 'Failed to initiate Cryptomus invoice.',
        details: data,
      });
    }

    return res.status(200).json({
      success: true,
      orderId,
      paymentUrl: data.result.url,
    });
  } catch (error: any) {
    console.error('Create payment handler error:', error);
    return res.status(500).json({ error: error.message || 'Internal payment error.' });
  }
}
