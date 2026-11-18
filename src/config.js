import 'dotenv/config';

const REQUIRED = [
  'ELATION_BASE_URL',
  'ELATION_CLIENT_ID',
  'ELATION_CLIENT_SECRET',
  'ELATION_USERNAME',
  'ELATION_PASSWORD',
  'ELATION_SIGNING_PUB_KEYS',
  'GHL_BASE_URL',
  'GHL_API_KEY',
  'GHL_LOCATION_ID',
  'GHL_PIPELINE_ID',
  'GHL_PIPELINE_STAGE_ID',
];

const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`[config] Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

export const config = {
  elation: {
    baseUrl: process.env.ELATION_BASE_URL,
    clientId: process.env.ELATION_CLIENT_ID,
    clientSecret: process.env.ELATION_CLIENT_SECRET,
    username: process.env.ELATION_USERNAME,
    password: process.env.ELATION_PASSWORD,
    signingPubKeys: (process.env.ELATION_SIGNING_PUB_KEYS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },
  ghl: {
    baseUrl: process.env.GHL_BASE_URL,
    apiVersion: process.env.GHL_API_VERSION || '2021-07-28',
    apiKey: process.env.GHL_API_KEY,
    locationId: process.env.GHL_LOCATION_ID,
    pipelineId: process.env.GHL_PIPELINE_ID,
    stageId: process.env.GHL_PIPELINE_STAGE_ID,
  },
  port: Number(process.env.PORT) || 3000,
  env: process.env.NODE_ENV || 'development',
};
