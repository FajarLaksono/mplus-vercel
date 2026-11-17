'use strict';

const { scoreLead, validateInput } = require('../lib/scoring');

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok', service: 'mplus-lead-scoring' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON body.' });
    }
  }

  const v = validateInput(body);
  if (!v.ok) {
    return res.status(400).json({ error: 'Invalid input.', details: v.errors });
  }

  try {
    const result = scoreLead(body);
    return res.status(200).json(result);
  } catch (err) {
    console.error('scoring error:', err);
    return res.status(500).json({ error: 'Internal scoring error.' });
  }
};
