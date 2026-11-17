'use strict';

/**
 * Deterministic lead scorer for Northern Coast Beverages inbound leads.
 * No external calls: fast, reliable, no secrets required.
 *
 * Weights (max 100):
 *   volume      0-25   (>=1 FCL/month and up)
 *   license     0-20   (import license / in-process)
 *   productFit  0-15   (portfolio brand match)
 *   business    0-35   (B2B distributor/importer signals)
 *   engagement  0-15   (specificity / multi-turn)
 */
function scoreLead(input) {
  const conv = Array.isArray(input.conversation) ? input.conversation : [];
  const leadTexts = conv
    .filter((m) => m && m.role === 'lead' && typeof m.text === 'string')
    .map((m) => m.text);
  const allText = conv
    .filter((m) => m && typeof m.text === 'string')
    .map((m) => m.text)
    .join(' \n ');
  const leadBlob = leadTexts.join(' ').toLowerCase();
  // Score on what the lead actually said, not the agent's prompts.
  const text = leadBlob || allText.toLowerCase();

  // --- consumer flag (kills score) ---
  const consumerFlag = /\b(few cans|office party|for (my|our) party|personal use|just (a few|some)|sample cans|tasting|gift)\b/.test(text);

  // --- volume ---
  let volumeFCL = null;
  const rangeMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*fcl/);
  const singleMatch = text.match(/(\d+(?:\.\d+)?)\s*fcl/);
  if (rangeMatch) {
    volumeFCL = Math.max(parseFloat(rangeMatch[1]), parseFloat(rangeMatch[2]));
  } else if (singleMatch) {
    volumeFCL = parseFloat(singleMatch[1]);
  }
  const hasContainer = /container|40ft|20ft|\bfcl\b/.test(text);
  let volumeScore = 0;
  if (!consumerFlag) {
    if (volumeFCL !== null) {
      if (volumeFCL >= 3) volumeScore = 25;
      else if (volumeFCL >= 2) volumeScore = 20;
      else if (volumeFCL >= 1) volumeScore = 12;
      else volumeScore = 5;
    } else if (hasContainer) {
      volumeScore = 15;
    } else if (/wholesale|bulk|container load/.test(text)) {
      volumeScore = 10;
    }
  }

  // --- license ---
  let licenseScore = 0;
  let licensedYears = null;
  const licYears = text.match(/licensed\s+(?:for\s+)?(\d+)\s*years?/);
  if (licYears) {
    licensedYears = parseInt(licYears[1], 10);
    licenseScore = licensedYears >= 1 ? 20 : 10;
  } else if (/license in process|licen[sc]e.*process|expected \d+ weeks/.test(text)) {
    licenseScore = 8;
  } else if (/licensed/.test(text)) {
    licenseScore = 15;
  } else if (/import licen/.test(text)) {
    licenseScore = 5;
  }

  // --- product fit ---
  const portfolio = ['coca-cola', 'coke', 'monster', 'red bull', 'redbull', 'energy drink', 'beverage'];
  const productFit = portfolio.some((p) => text.includes(p)) ? 15 : 0;
  const matchedBrands = portfolio.filter((p) => text.includes(p));

  // --- real-business signals ---
  let businessScore = 0;
  if (/distributor|wholesaler|importer|wholesale/.test(text)) businessScore += 20;
  const accounts = text.match(/(\d+)\s*(?:retail\s*)?accounts/);
  if (accounts) {
    const n = parseInt(accounts[1], 10);
    businessScore += n >= 50 ? 10 : 5;
  }
  if (/import (?:history|experience)|years importing|importing|import license/.test(text)) businessScore += 10;
  if (/\d+\s*brands/.test(text) || /multiple brands|2 brands|3 brands/.test(text)) businessScore += 5;
  if (/retail/.test(text)) businessScore += 3;
  businessScore = Math.min(35, businessScore);

  // --- engagement / specificity ---
  let engagementScore = 0;
  if (leadTexts.length >= 2) engagementScore += 4;
  if (leadTexts.some((t) => /\d/.test(t))) engagementScore += 3;
  if (text.length > 150) engagementScore += 3;

  // --- total ---
  let score = volumeScore + licenseScore + productFit + businessScore + engagementScore;
  if (consumerFlag) score = Math.min(score, 15);
  score = Math.max(0, Math.min(100, Math.round(score)));

  // --- tier / routing ---
  let tier, routing;
  if (consumerFlag || score < 35) {
    tier = 'Cold';
    routing = 'auto_archive';
  } else if (score >= 85) {
    tier = 'Hot';
    routing = 'kam_handoff';
  } else {
    tier = 'Warm';
    routing = 'nurture_pool';
  }

  // --- reasoning ---
  const reasoning = buildReasoning({
    consumerFlag,
    volumeFCL,
    licensedYears,
    licenseScore,
    productFit,
    matchedBrands,
    businessScore,
    tier,
    score,
  });

  return {
    lead_id: input.lead_id,
    score,
    tier,
    routing,
    reasoning,
  };
}

function buildReasoning(ctx) {
  if (ctx.consumerFlag) {
    return 'Consumer-level request with no wholesale/import or volume signals — auto-archive.';
  }
  const parts = [];
  if (ctx.volumeFCL) parts.push(`${ctx.volumeFCL} FCL/month volume`);
  if (ctx.licensedYears) parts.push(`licensed importer (${ctx.licensedYears} yrs)`);
  else if (ctx.licenseScore === 8) parts.push('license in process');
  if (ctx.productFit) parts.push('portfolio product fit');
  if (ctx.businessScore >= 20) parts.push('B2B distributor signals');
  const summary = parts.length ? parts.join(', ') : 'limited qualifying signals';
  const phrase =
    ctx.tier === 'Hot'
      ? 'eligible for KAM follow-up.'
      : ctx.tier === 'Warm'
      ? 'nurture-pool candidate.'
      : 'auto-archive.';
  const sentence = `${summary.charAt(0).toUpperCase() + summary.slice(1)} — ${phrase}`;
  return sentence;
}

function validateInput(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    errors.push('body must be a JSON object');
    return { ok: false, errors };
  }
  if (typeof body.lead_id !== 'string' || !body.lead_id.trim()) {
    errors.push('lead_id must be a non-empty string');
  }
  if (!Array.isArray(body.conversation) || body.conversation.length === 0) {
    errors.push('conversation must be a non-empty array');
  } else {
    body.conversation.forEach((m, i) => {
      if (!m || typeof m !== 'object') {
        errors.push(`conversation[${i}] must be an object`);
        return;
      }
      if (typeof m.role !== 'string') errors.push(`conversation[${i}].role must be a string`);
      if (typeof m.text !== 'string' || !m.text.trim()) errors.push(`conversation[${i}].text must be a non-empty string`);
    });
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true };
}

module.exports = { scoreLead, validateInput };
