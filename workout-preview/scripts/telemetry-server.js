const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const TELEMETRY_DIR = path.join(__dirname, '..', '.dev-telemetry');

if (!fs.existsSync(TELEMETRY_DIR)) {
    fs.mkdirSync(TELEMETRY_DIR, { recursive: true });
}

const server = http.createServer((req, res) => {
    // Enable CORS for local dev server
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/api/telemetry') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const { type, payload } = data;
                if (type) {
                    const targetFile = path.join(TELEMETRY_DIR, `${type}.json`);
                    const content = {
                        timestamp: new Date().toISOString(),
                        type,
                        ...payload
                    };
                    fs.writeFileSync(targetFile, JSON.stringify(content, null, 2), 'utf-8');
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok' }));
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(PORT, () => {
    console.log(`[Dev Telemetry Server] Listening on http://localhost:${PORT} -> Syncing to .dev-telemetry/`);
});
