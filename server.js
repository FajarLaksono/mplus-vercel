'use strict';
const http = require('http');
const handler = require('./api/score');

const port = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  let data = '';
  req.on('data', (c) => (data += c));
  req.on('end', () => {
    try { req.body = data ? JSON.parse(data) : undefined; } catch (e) { req.body = data; }
    // vercel-like res helpers
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (obj) => {
      if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(obj));
    };
    handler(req, res);
  });
});
server.listen(port, () => console.log('listening on', port));
