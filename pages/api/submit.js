// pages/api/submit.js
import { put } from '@vercel/blob';

// The screenshot arrives as base64 inside the JSON body, so raise Next's default 1mb limit
export const config = {
  api: {
    bodyParser: { sizeLimit: '4mb' },
  },
};

const MAX_SCREENSHOT_BYTES = 3 * 1024 * 1024;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_PAT = process.env.AIRTABLE_PAT;

  if (!AIRTABLE_BASE_ID || !AIRTABLE_PAT) {
    console.error('Missing Airtable credentials in environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Map language codes to full names
  const languageMap = {
    en: 'English',
    pt: 'Português',
    es: 'Español',
    fr: 'Français',
    de: 'Deutsch',
    ar: 'العربية',
    ko: '한국어',
    ja: '日本語',
    zh: '中文',
    vi: 'Tiếng Việt',
  };

  try {
    // Separate the screenshot payload so it is not sent to Airtable as a text field
    const { screenshotData, screenshotName, ...fields } = req.body || {};
    const formData = { ...fields };

    if (formData.Languages && languageMap[formData.Languages]) {
      formData.Languages = languageMap[formData.Languages];
    }

    // Season 4 screenshot: store in Vercel Blob, then attach the public URL to Airtable
    if (screenshotData) {
      const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(screenshotData);
      if (!match) {
        return res.status(400).json({ error: 'Invalid screenshot' });
      }

      const [, contentType, base64] = match;
      const buffer = Buffer.from(base64, 'base64');

      if (buffer.length > MAX_SCREENSHOT_BYTES) {
        return res.status(413).json({ error: 'Screenshot is too large' });
      }

      const ext = contentType.split('/')[1].replace('jpeg', 'jpg');
      const blob = await put(`season4-defeat/${Date.now()}.${ext}`, buffer, {
        access: 'public',
        contentType,
        addRandomSuffix: true,
      });

      formData['Screenshot: Season Contributions'] = [{ url: blob.url }];
    }

    const response = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Transfer%20Candidates`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AIRTABLE_PAT}`,
        },
        body: JSON.stringify({
          records: [{ fields: formData }],
          typecast: true,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || 'Airtable error');
    }

    const result = await response.json();
    res.status(200).json({ success: true, recordId: result.records[0].id });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
}
