import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

export const config = {
  api: {
    bodyParser: false,
  },
};

// Translation function using Google Translate API
async function translateToEnglish(text, sourceLang) {
  if (sourceLang === 'en') return text;
  if (!text) return text;

  try {
    const response = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|en`
    );
    const data = await response.json();
    return data.responseData?.translatedText || text;
  } catch (error) {
    console.error('Translation error:', error);
    return text;
  }
}

// Upload file to Airtable
async function uploadFileToAirtable(fileBuffer, filename, token, baseId, tableId, recordId, fieldName) {
  try {
    // First, upload the file
    const fileFormData = new FormData();
    const blob = new Blob([fileBuffer], { type: 'application/octet-stream' });
    fileFormData.append('file', blob, filename);

    const uploadResponse = await fetch(
      `https://content.airtable.com/v0/${baseId}/${tableId}/${recordId}/${fieldName}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: fileFormData,
      }
    );

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.statusText}`);
    }

    return await uploadResponse.json();
  } catch (error) {
    console.error('File upload error:', error);
    throw error;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const form = formidable({ multiples: true });

  try {
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve([fields, files]);
      });
    });

    // Parse JSON data
    const jsonData = JSON.parse(fields.json[0]);
    const sourceLang = jsonData.Languages || 'en';

    // Translate text fields to English
    const translatedData = { ...jsonData };

    const textFields = [
      'Name',
      'Alliance',
      'Friend Details',
      'Explanation of Savings',
    ];

    for (const field of textFields) {
      if (translatedData[field]) {
        translatedData[field] = await translateToEnglish(
          translatedData[field],
          sourceLang
        );
      }
    }

    // Get Airtable credentials from environment variables
    const baseId = process.env.AIRTABLE_BASE_ID;
    const token = process.env.AIRTABLE_PAT;
    const tableName = 'ROaR Transfer Portal';

    if (!baseId || !token) {
      return res
        .status(500)
        .json({ error: 'Missing Airtable credentials' });
    }

    // Create record in Airtable (files will be attached separately)
    const recordData = {
      records: [
        {
          fields: translatedData,
        },
      ],
    };

    const createResponse = await fetch(
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(recordData),
      }
    );

    if (!createResponse.ok) {
      throw new Error(`Airtable error: ${createResponse.statusText}`);
    }

    const createdRecord = await createResponse.json();
    const recordId = createdRecord.records[0].id;

    // Upload files to the record
    const fileFields = ['PFP', 'Friend Details', 'Explanation of Savings', 'Screenshots of Savings', 'Screenshots of Season Stats'];

    for (const fieldName of fileFields) {
      if (files[fieldName]) {
        const fileArray = Array.isArray(files[fieldName]) ? files[fieldName] : [files[fieldName]];

        for (const file of fileArray) {
          const fileBuffer = fs.readFileSync(file.filepath);
          await uploadFileToAirtable(
            fileBuffer,
            file.originalFilename,
            token,
            baseId,
            tableName,
            recordId,
            fieldName
          );
        }
      }
    }

    return res.status(200).json({
      success: true,
      recordId,
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      error: error.message || 'An error occurred',
    });
  }
}
