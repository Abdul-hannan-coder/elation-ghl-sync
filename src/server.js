import express from 'express';
import { config } from './config.js';
import { verifySignature } from './verifySignature.js';
import { handleEvent } from './handlers.js';

const app = express();

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.post(
  '/webhooks/elation',
  express.raw({ type: '*/*', limit: '1mb' }),
  (req, res) => {
    const signature = req.get('X-Elation-Signature');
    if (!verifySignature(req.body, signature)) {
      return res.status(401).json({ error: 'invalid signature' });
    }

    let payload;
    try {
      payload = JSON.parse(req.body.toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'invalid json' });
    }

    res.status(200).json({ received: true });

    handleEvent(payload).catch((err) => {
      console.error('[webhook] processing failed', err);
    });
  }
);

app.listen(config.port, () => {
  console.log(`[server] listening on :${config.port} (${config.env})`);
});
