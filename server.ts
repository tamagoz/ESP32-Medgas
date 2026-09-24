import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  // Proxy endpoint to relay commands to physical ESP32-C3 if browser faces CORS / mixed-content
  app.all('/api/esp-proxy', async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).json({ error: 'Missing ?url= parameter' });
    }

    try {
      const parsedUrl = new URL(targetUrl);
      const allowedProtocols = ['http:', 'https:'];
      if (!allowedProtocols.includes(parsedUrl.protocol)) {
        return res.status(400).json({ error: 'Invalid protocol' });
      }

      const fetchOptions: RequestInit = {
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
          ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {})
        },
        body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? JSON.stringify(req.body) : undefined,
        signal: AbortSignal.timeout(5000)
      };

      const response = await fetch(targetUrl, fetchOptions);
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        return res.status(response.status).json(data);
      } else {
        const text = await response.text();
        return res.status(response.status).send(text);
      }
    } catch (err: any) {
      return res.status(502).json({
        error: 'Proxy fetch failed',
        message: err.message || 'Cannot connect to device'
      });
    }
  });

  // Proxy for NTFY if direct client request is blocked
  app.post('/api/ntfy-proxy', async (req, res) => {
    const { serverUrl, topic, title, message, priority, tags } = req.body;
    if (!topic || !message) {
      return res.status(400).json({ error: 'Missing topic or message' });
    }

    try {
      const base = (serverUrl || 'https://ntfy.sh').replace(/\/+$/, '');
      const url = `${base}/${encodeURIComponent(topic)}`;

      const headers: Record<string, string> = {
        'Title': title || 'Medgas Master Alert',
        'Priority': priority || 'high',
        'Tags': tags || 'warning,hospital'
      };

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: message,
        signal: AbortSignal.timeout(6000)
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: 'NTFY returned error' });
      }

      return res.json({ success: true, timestamp: Date.now() });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'NTFY proxy dispatch failed' });
    }
  });

  // In development, hook Vite into express
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    // Production static files
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[Medgas Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
