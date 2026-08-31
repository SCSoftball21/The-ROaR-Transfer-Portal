// pages/api/candidates.js
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_PAT = process.env.AIRTABLE_PAT;

  if (!AIRTABLE_BASE_ID || !AIRTABLE_PAT) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const response = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Transfer%20Candidates?maxRecords=1000&sort[0][field]=S3%20Seat%20Color&sort[0][direction]=asc&sort[1][field]=Total%20Hero%20Power&sort[1][direction]=desc`,
      {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_PAT}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch from Airtable');
    }

    const data = await response.json();

    res.status(200).json({
      success: true,
      records: data.records || [],
    });
  } catch (error) {
    console.error('Error fetching candidates:', error);
    res.status(500).json({ error: error.message });
  }
}
