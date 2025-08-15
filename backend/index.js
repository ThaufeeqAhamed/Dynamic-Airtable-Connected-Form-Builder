require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const axios = require('axios');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

const connectDB = require('./db');
const User = require('./models/userModel');
const Form = require('./models/formModel');

// Connect to the database
connectDB();

const app = express();
const PORT = process.env.PORT;

const sessionStore = {};

// Middleware
app.use(cors());
app.use(express.json());

// --- Helper Functions ---
function base64URLEncode(str) {
  return str.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest();
}

// Token refresh logic
const getAirtableToken = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  try {
    await axios.get('https://api.airtable.com/v0/meta/whoami', {
      headers: { 'Authorization': `Bearer ${user.accessToken}` },
    });
    return user.accessToken;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log('Access token expired. Refreshing token...');
      try {
        const tokenResponse = await axios.post('https://airtable.com/oauth2/v1/token',
          new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: user.refreshToken,
          }),
          {
            headers: {
              'Authorization': `Basic ${Buffer.from(`${process.env.AIRTABLE_CLIENT_ID}:${process.env.AIRTABLE_CLIENT_SECRET}`).toString('base64')}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          }
        );

        const { access_token: newAccessToken } = tokenResponse.data;
        user.accessToken = newAccessToken;
        await user.save();
        console.log('Token refreshed and updated in DB.');
        return newAccessToken;
      } catch (refreshError) {
        console.error('Failed to refresh token:', refreshError.response ? refreshError.response.data : refreshError.message);
        throw new Error('Could not refresh authentication token.');
      }
    }
    throw error;
  }
};

const sanitizeText = (text) => {
  if (text === null || typeof text === 'undefined') return '';
  return String(text).replace(/[^\u0000-\u00FF]/g, "?");
};

// --- AUTH ROUTES ---
app.get('/api/auth/airtable', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  const codeVerifier = base64URLEncode(crypto.randomBytes(32));
  sessionStore[state] = codeVerifier;
  const codeChallenge = base64URLEncode(sha256(codeVerifier));

  const authorizationUrl = new URL('https://airtable.com/oauth2/v1/authorize');
  authorizationUrl.searchParams.set('client_id', process.env.AIRTABLE_CLIENT_ID);
  authorizationUrl.searchParams.set('redirect_uri', process.env.OAUTH_REDIRECT_URI);
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('scope', 'data.records:read data.records:write schema.bases:read user.email:read');
  authorizationUrl.searchParams.set('state', state);
  authorizationUrl.searchParams.set('code_challenge', codeChallenge);
  authorizationUrl.searchParams.set('code_challenge_method', 'S256');

  res.redirect(authorizationUrl.toString());
});

app.get('/api/auth/airtable/callback', async (req, res) => {
  const { code, state } = req.query;
  const codeVerifier = sessionStore[state];

  if (!code || !codeVerifier) {
    return res.status(400).send('Error: Invalid request. Please try logging in again.');
  }
  delete sessionStore[state];

  try {
    const tokenResponse = await axios.post('https://airtable.com/oauth2/v1/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.OAUTH_REDIRECT_URI,
        code_verifier: codeVerifier,
      }),
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${process.env.AIRTABLE_CLIENT_ID}:${process.env.AIRTABLE_CLIENT_SECRET}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, refresh_token } = tokenResponse.data;

    const userResponse = await axios.get('https://api.airtable.com/v0/meta/whoami', {
      headers: { 'Authorization': `Bearer ${access_token}` },
    });

    const { id: airtableUserId, email } = userResponse.data;

    const user = await User.findOneAndUpdate(
      { airtableUserId: airtableUserId },
      { email: email, accessToken: access_token, refreshToken: refresh_token },
      { new: true, upsert: true }
    );

    res.redirect(`${process.env.FRONTEND_URL}?userId=${user._id}`);
  } catch (error) {
    console.error('Error during authentication:', error.response ? error.response.data : error.message);
    res.status(500).send('An error occurred during authentication.');
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-accessToken -refreshToken');
    if (user) res.json(user);
    else res.status(404).json({ message: 'User not found' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// --- AIRTABLE ROUTES ---
app.get('/api/airtable/bases/:userId', async (req, res) => {
  try {
    const accessToken = await getAirtableToken(req.params.userId);
    const response = await axios.get('https://api.airtable.com/v0/meta/bases', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    res.json(response.data.bases);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch Airtable bases' });
  }
});

app.get('/api/airtable/tables/:userId/:baseId', async (req, res) => {
  try {
    const accessToken = await getAirtableToken(req.params.userId);
    const { baseId } = req.params;
    const response = await axios.get(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    res.json(response.data.tables);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch Airtable tables' });
  }
});

// --- FORM ROUTES ---
app.post('/api/forms', async (req, res) => {
  try {
    const { formName, creatorId, airtableBaseId, airtableTableId, questions } = req.body;
    if (!formName || !creatorId || !airtableBaseId || !airtableTableId || !questions) {
      return res.status(400).json({ message: 'Missing required form data.' });
    }
    const newForm = new Form({ formName, creatorId, airtableBaseId, airtableTableId, questions });
    const savedForm = await newForm.save();
    res.status(201).json(savedForm);
  } catch (error) {
    res.status(500).json({ message: 'Failed to save form' });
  }
});

app.get('/api/forms/user/:userId', async (req, res) => {
  try {
    const forms = await Form.find({ creatorId: req.params.userId }).sort({ createdAt: -1 });
    res.json(forms);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch forms' });
  }
});

app.get('/api/forms/:formId', async (req, res) => {
  try {
    const form = await Form.findById(req.params.formId);
    if (!form) return res.status(404).json({ message: 'Form not found' });
    res.json(form);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch form' });
  }
});

app.post('/api/forms/:formId/submit', async (req, res) => {
  try {
    const { formId } = req.params;
    const submissionData = req.body;
    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json({ message: 'Form not found' });
    }
    const accessToken = await getAirtableToken(form.creatorId);
    const airtablePayload = { fields: submissionData };
    const url = `https://api.airtable.com/v0/${form.airtableBaseId}/${form.airtableTableId}`;
    await axios.post(url, airtablePayload, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    res.status(200).json({ message: 'Form submitted successfully!' });
  } catch (error) {
    const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
    console.error('Error submitting to Airtable:', errorMessage);
    res.status(500).json({ message: 'Failed to submit form to Airtable' });
  }
});

// --- PDF EXPORT ---
app.get('/api/forms/:formId/responses/pdf', async (req, res) => {
  try {
    const { formId } = req.params;
    const form = await Form.findById(formId);
    if (!form) return res.status(404).json({ message: 'Form not found' });

    const accessToken = await getAirtableToken(form.creatorId);
    const url = `https://api.airtable.com/v0/${form.airtableBaseId}/${form.airtableTableId}`;
    const airtableResponse = await axios.get(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
    const records = airtableResponse.data.records;

    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 12;
    let y = height - 50;

    page.drawText(sanitizeText(form.formName), { x: 50, y, font, size: 24, color: rgb(0, 0, 0) });
    y -= 50;

    if (records.length > 0) {
      for (const record of records) {
        page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
        y -= 20;

        for (const fieldName in record.fields) {
          if (y < 50) {
            page = pdfDoc.addPage();
            y = height - 50;
          }
          const fieldValue = record.fields[fieldName];
          const line = `${sanitizeText(fieldName)}: ${sanitizeText(fieldValue)}`;
          page.drawText(line, { x: 50, y, font, size: fontSize, color: rgb(0, 0, 0) });
          y -= 20;
        }
        y -= 10;
      }
    } else {
      page.drawText('No responses found for this form.', { x: 50, y, font, size: fontSize, color: rgb(0, 0, 0) });
    }

    const pdfBytes = await pdfDoc.save();
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizeText(form.formName)}-responses.pdf"`);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(Buffer.from(pdfBytes));

  } catch (error) {
    const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
    console.error('Error generating PDF:', errorMessage);
    res.status(500).json({ message: 'Failed to generate PDF' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
