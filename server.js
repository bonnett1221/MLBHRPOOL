const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const COMMISSIONER_KEY = 'commissioner123';

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'league.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(
      {
        poolName: 'MLB HR Pool',
        teams: []
      },
      null,
      2
    )
  );
}

function readLeague() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (err) {
    return { poolName: 'MLB HR Pool', teams: [] };
  }
}

function writeLeague(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { 'Content-Type': 'text/plain' });
  res.end(text);
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendText(res, 404, 'Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const map = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml'
    };

    res.writeHead(200, { 'Content-Type': map[ext] || 'text/plain' });
    res.end(data);
  });
}

function collectBody(req, callback) {
  let body = '';

  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', () => {
    try {
      callback(JSON.parse(body || '{}'));
    } catch (err) {
      callback({});
    }
  });
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  if (pathname === '/api/league' && req.method === 'GET') {
    return sendJson(res, 200, readLeague());
  }

  if (pathname === '/api/add-player' && req.method === 'POST') {
    return collectBody(req, body => {
      const league = readLeague();

      if (!Array.isArray(league.players)) {
        league.players = [];
      }

      league.players.push(body);
      writeLeague(league);

      sendText(res, 200, 'OK');
    });
  }

  if (pathname === '/api/admin/league' && req.method === 'GET') {
    if (query.key !== COMMISSIONER_KEY) {
      return sendText(res, 403, 'Forbidden');
    }

    return sendJson(res, 200, readLeague());
  }

  if (pathname === '/api/admin/save' && req.method === 'POST') {
    return collectBody(req, body => {
      if (body.key !== COMMISSIONER_KEY) {
        return sendText(res, 403, 'Forbidden');
      }

      const updatedLeague = {
        poolName: body.poolName || 'MLB HR Pool',
        teams: Array.isArray(body.teams) ? body.teams : []
      };

      writeLeague(updatedLeague);
      sendText(res, 200, 'Saved');
    });
  }

  if (pathname === '/api/refresh' && req.method === 'POST') {
    return collectBody(req, body => {
      if (body.key !== COMMISSIONER_KEY) {
        return sendText(res, 403, 'Forbidden');
      }

      return sendText(res, 200, 'Refreshed');
    });
  }

  if (pathname === '/api/search' && req.method === 'GET') {
    return sendJson(res, 200, []);
  }

  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    return sendText(res, 403, 'Forbidden');
  }

  serveFile(res, filePath);
});

server.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
