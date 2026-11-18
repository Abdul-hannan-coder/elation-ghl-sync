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

async function ghlFetch(method, path, body, { allowDuplicate = false } = {}) {
  const res = await fetch(`${config.ghl.baseUrl}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(clean(body)) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    if (allowDuplicate && res.status === 400) {
      const err = text ? JSON.parse(text) : {};
      if (err.code === 'OPPORTUNITY_NO_DUPLICATE' && err.meta?.existingId) {
        console.log(`[ghl] opportunity already exists: ${err.meta.existingId}`);
        return { opportunity: { id: err.meta.existingId }, duplicate: true };
      }
    }
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
    customFields: contact.customFields || [],
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
  return ghlFetch('POST', '/opportunities/', payload, { allowDuplicate: true });
}

export function updateOpportunity(id, fields) {
  return ghlFetch('PUT', `/opportunities/${id}`, {
    locationId: config.ghl.locationId,
    ...fields,
  });
}

export async function findOpportunityByContact(contactId) {
  const data = await ghlFetch('GET',
    `/opportunities/search?location_id=${config.ghl.locationId}&contact_id=${contactId}&pipeline_id=${config.ghl.pipelineId}&limit=1`
  );
  return data.opportunities?.[0] || null;
}
