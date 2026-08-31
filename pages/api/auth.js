// pages/api/auth.js - Simple auth endpoint
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body;

  // User credentials (stored in env variables)
  // Format: REVIEWER_{NAME}={PASSWORD}
  const users = {
    darrow: process.env.REVIEWER_DARROW,
    ali: process.env.REVIEWER_ALI,
    emmy: process.env.REVIEWER_EMMY,
    wp: process.env.REVIEWER_WP,
    kevin: process.env.REVIEWER_KEVIN,
    gil: process.env.REVIEWER_GIL,
    sammy: process.env.REVIEWER_SAMMY,
    slexx: process.env.REVIEWER_SLEXX,
    menoth: process.env.REVIEWER_MENOTH,
    kaiber: process.env.REVIEWER_KAIBER,
    'general-andraeus': process.env.REVIEWER_GENERAL_ANDRAEUS,
  };

  const readWriteUsers = ['darrow', 'ali', 'emmy'];

  const userLower = username.toLowerCase();
  const expectedPassword = users[userLower];

  if (!expectedPassword || password !== expectedPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const role = readWriteUsers.includes(userLower) ? 'read-write' : 'read-only';

  res.status(200).json({
    success: true,
    username: username,
    role: role,
    token: Buffer.from(`${username}:${role}`).toString('base64'),
  });
}
