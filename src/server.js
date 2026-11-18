import express from 'express';
import { config } from './config.js';
import { verifySignature } from './verifySignature.js';
import { handleEvent } from './handlers.js';
import { fetchPatient } from './elation.js';

const BUILD_VERSION = '2026-11-19-v2';
const app = express();

// Request logging
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.get('/health', (_req, res) => res.json({ status: 'ok', version: BUILD_VERSION }));

// Manual sync triggers — requires ELATION_CLIENT_SECRET as Bearer token
function testAuth(req, res, next) {
  const auth = (req.get('Authorization') || '').replace('Bearer ', '');
  if (!auth || auth !== config.elation.clientSecret) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

app.post('/test/sync-patient/:id', express.json(), testAuth, async (req, res) => {
  try {
    await handleEvent({ resource: 'patients', object_id: Number(req.params.id), id: `test-patient-${req.params.id}-${Date.now()}` });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/test/sync-appointment/:id', express.json(), testAuth, async (req, res) => {
  try {
    await handleEvent({ resource: 'appointments', object_id: Number(req.params.id), id: `test-appt-${req.params.id}-${Date.now()}` });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post(
  '/webhooks/elation',
  express.raw({ type: '*/*', limit: '1mb' }),
  (req, res) => {
    const signature =
      req.get('X-Elation-Signature') ||
      req.get('X-Elation-Sig') ||
      req.get('Signature');
    if (!verifySignature(req.body, signature)) {
      console.warn('[webhook] signature verification failed');
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
