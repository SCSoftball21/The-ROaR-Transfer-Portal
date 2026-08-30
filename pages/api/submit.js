import { IncomingForm } from 'formidable';
import fs from 'fs';
import path from 'path';

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_PAT = process.env.AIRTABLE_PAT;

async function translateToEnglish(text, sourceLanguage) {
  if (sourceLanguage === 'en') return text;
  if (!text) return text;

  try {
    const query = new URLSearchParams({
      q: text,
      langpair: `${sourceLanguage}|en`
    });
    
    const translationResponse = await fetch(
      `https://api.mymemory.translated.net/get?${query}`,
      { method: 'GET' }
    );
    
    const result = await translationResponse.json();
    return result.responseData?.translatedText || text;
  } catch (error) {
    console.error('Translation error:', error);
    return text;
  }
}

async function uploadFileToAirtable(fileBuffer, fileName, fieldName) {
  try {
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: 'application/octet-stream' });
    formData.append('file', blob, fileName);

    const response = await fetch('https://api.airtable.com/v0/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_PAT}`,
      },
      body: formData,
    });

    if (!response.ok) {
      // Fallback: return file as base64 for attachment
      const base64 = fileBuffer.toString('base64');
      return {
        url: `data:application/octet-stream;base64,${base64}`,
        filename: fileName,
      };
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('File upload error:', error);
    // Return file metadata without uploading
    return {
      filename: fileName,
      size: fileBuffer.length,
    };
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse form data
    const form = new IncomingForm();
    const { fields, files } = await form.parse(req);

    // Extract and translate text fields
    const recordData = {};
    const fieldsToTranslate = ['Name', 'Alliance', 'Friend Details', 'Explanation of Savings'];
    const sourceLanguage = fields.Languages?.[0] || 'en';

    for (const [key, values] of Object.entries(fields)) {
      const value = Array.isArray(values) ? values[0] : values;
      
      if (fieldsToTranslate.includes(key) && value) {
        recordData[key] = await translateToEnglish(value, sourceLanguage);
      } else {
        recordData[key] = value;
      }
    }

    // Handle file uploads
    const fileFields = ['Profile Picture', 'Screenshots of Savings', 'Screenshots of Season Stats', 'Battle Report Screenshots'];
    for (const fieldName of fileFields) {
      if (files[fieldName]) {
        const fileArray = Array.isArray(files[fieldName]) ? files[fieldName] : [files[fieldName]];
        const attachments = [];

        for (const file of fileArray) {
          try {
            const fileBuffer = fs.readFileSync(file.filepath);
            const uploaded = await uploadFileToAirtable(fileBuffer, file.originalFilename || file.filename, fieldName);
            attachments.push(uploaded);
          } catch (error) {
            console.error(`Error processing file ${file.filename}:`, error);
          }
        }

        if (attachments.length > 0) {
          recordData[fieldName] = attachments;
        }
      }
    }

    // Create Airtable record
    const airtableResponse = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ROaR%20Transfer%20Portal`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_PAT}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          records: [
            {
              fields: recordData,
            },
          ],
        }),
      }
    );

    if (!airtableResponse.ok) {
      const errorData = await airtableResponse.json();
      console.error('Airtable error:', errorData);
      throw new Error(`Airtable error: ${airtableResponse.status}`);
    }

    const result = await airtableResponse.json();
    return res.status(200).json({
      success: true,
      recordId: result.records[0].id,
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      error: error.message || 'An error occurred',
    });
  }
}
