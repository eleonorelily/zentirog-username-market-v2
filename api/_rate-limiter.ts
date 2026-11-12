// Memory-based sliding window rate limiter for Serverless API
const ipRequests = new Map<string, number[]>();

export function checkRateLimit(ip: string, limit = 5, windowMs = 60000): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const timestamps = ipRequests.get(ip) || [];

  // Filter timestamps within the window
  const validTimestamps = timestamps.filter(t => now - t < windowMs);

  if (validTimestamps.length >= limit) {
    ipRequests.set(ip, validTimestamps);
    return { allowed: false, remaining: 0 };
  }

  validTimestamps.push(now);
  ipRequests.set(ip, validTimestamps);
  return { allowed: true, remaining: limit - validTimestamps.length };
}
