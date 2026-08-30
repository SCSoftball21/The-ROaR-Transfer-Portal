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
    vi: 'Tiếng Việt'
  };
 
  try {
    // Convert language code to full name if present
    const formData = { ...req.body };
    if (formData.Languages && languageMap[formData.Languages]) {
      formData.Languages = languageMap[formData.Languages];
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
          records: [
            {
              fields: formData
            }
          ],
          typecast: true
        })
      }
    );
 
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Airtable error');
    }
 
    const result = await response.json();
    res.status(200).json({ success: true, recordId: result.records[0].id });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
}
