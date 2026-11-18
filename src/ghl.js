import { config } from './config.js';

function clean(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null));
}

function headers() {
  return {
    Authorization: `Bearer ${config.ghl.apiKey}`,
    Version: config.ghl.apiVersion,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function ghlFetch(method, path, body) {
  const res = await fetch(`${config.ghl.baseUrl}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(clean(body)) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`GHL ${method} ${path} failed: ${res.status} ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

// v2 contacts upsert: POST /contacts/upsert — matches on email/phone within the location
export async function upsertContact(contact) {
  const payload = {
    locationId: config.ghl.locationId,
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email,
    phone: contact.phone,
    dateOfBirth: contact.dateOfBirth,
    source: contact.source,
    tags: contact.tags,
  };
  const data = await ghlFetch('POST', '/contacts/upsert', payload);
  return data.contact || data;
}

// v2 opportunities: POST /opportunities/
export function createOpportunity(opp) {
  const payload = {
    locationId: config.ghl.locationId,
    pipelineId: config.ghl.pipelineId,
    pipelineStageId: config.ghl.stageId,
    name: opp.title,
    status: opp.status || 'open',
    contactId: opp.contactId,
    monetaryValue: opp.monetaryValue ?? 0,
  };
  return ghlFetch('POST', '/opportunities/', payload);
}
