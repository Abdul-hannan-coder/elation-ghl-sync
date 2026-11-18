import { config } from './config.js';

function clean(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

async function ghlPost(path, payload) {
  const res = await fetch(`${config.ghl.baseUrl}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.ghl.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(clean(payload)),
  });
  if (!res.ok) {
    throw new Error(`GHL POST ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function upsertContact(contact) {
  const data = await ghlPost('/contacts/', contact);
  return data.contact || data;
}

export function createOpportunity(opp) {
  return ghlPost(`/pipelines/${config.ghl.pipelineId}/opportunities/`, opp);
}
