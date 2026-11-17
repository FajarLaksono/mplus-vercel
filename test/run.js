'use strict';
const { scoreLead } = require('../lib/scoring');

const samples = {
  S001: {
    lead_id: 'S001',
    channel: 'whatsapp',
    conversation: [
      { role: 'lead', text: 'UAE distributor, 3 FCL/month Red Bull, 8 years importing energy drinks. Looking for original Austrian product.' },
      { role: 'agent', text: 'Volume target on Red Bull specifically?' },
      { role: 'lead', text: '2-3 FCL/month sustained. ~250 retail accounts across UAE.' },
    ],
  },
  S002: {
    lead_id: 'S002',
    channel: 'email',
    conversation: [{ role: 'lead', text: 'hey can I get a few cans of red bull for my office party' }],
  },
  S003: {
    lead_id: 'S003',
    channel: 'email',
    conversation: [
      { role: 'lead', text: 'Ghana-based distributor looking for Coca-Cola products. New entrant, license in process — expected 6 weeks. Initial volume 1 FCL/month.' },
    ],
  },
  L001: {
    lead_id: 'L001',
    channel: 'whatsapp',
    conversation: [
      { role: 'lead', text: 'Hi, looking for wholesale Monster Energy supply for Singapore. 1 FCL/month.' },
      { role: 'agent', text: 'Could you confirm your import license and history?' },
      { role: 'lead', text: 'Yes, licensed 4 years. Currently import 2 brands.' },
    ],
  },
};

let ok = true;
for (const [k, v] of Object.entries(samples)) {
  const r = scoreLead(v);
  console.log(k, JSON.stringify(r));
  if (typeof r.score !== 'number' || r.score < 0 || r.score > 100) { ok = false; console.error('bad score', k); }
  if (!['Hot', 'Warm', 'Cold'].includes(r.tier)) { ok = false; console.error('bad tier', k); }
  if (!['kam_handoff', 'nurture_pool', 'auto_archive'].includes(r.routing)) { ok = false; console.error('bad routing', k); }
}
// expected tiers
const exp = { S001: 'Hot', S002: 'Cold', S003: 'Warm', L001: 'Warm' };
for (const [k, v] of Object.entries(samples)) {
  const r = scoreLead(v);
  if (r.tier !== exp[k]) { ok = false; console.error('UNEXPECTED TIER', k, r.tier, 'expected', exp[k]); }
}
console.log(ok ? 'ALL TESTS PASSED' : 'FAILURES PRESENT');
process.exit(ok ? 0 : 1);
