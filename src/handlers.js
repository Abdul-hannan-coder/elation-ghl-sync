import { fetchPatient, fetchAppointment } from './elation.js';
import { upsertContact, createOpportunity, updateOpportunity, findOpportunityByContact } from './ghl.js';
import { config } from './config.js';

const processed = new Set();
const MAX_CACHE = 10000;

function markProcessed(id) {
  if (processed.size >= MAX_CACHE) processed.clear();
  processed.add(id);
}

function pickEmail(patient) {
  return patient?.emails?.[0]?.email;
}

function pickPhone(patient) {
  const phones = patient?.phones || [];
  const mobile = phones.find((p) => (p.phone_type || '').toLowerCase() === 'mobile');
  return (mobile || phones[0])?.phone;
}

function contactFromPatient(patient, extraTags = []) {
  return {
    firstName: patient.first_name,
    lastName: patient.last_name,
    email: pickEmail(patient),
    phone: pickPhone(patient),
    dateOfBirth: patient.dob,
    source: 'Elation EMR',
    tags: ['elation-patient', `elation-id-${patient.id}`, ...extraTags],
  };
}

function formatDate(iso) {
  if (!iso) return 'scheduled';
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

async function handlePatient(objectId) {
  const patient = await fetchPatient(objectId);
  console.log(`[handler] patient ${objectId}: ${patient.first_name} ${patient.last_name}`);
  const contact = await upsertContact(contactFromPatient(patient));
  await createOpportunity({
    title: `New patient: ${patient.first_name} ${patient.last_name}`,
    status: 'open',
    contactId: contact.id,
    monetaryValue: 0,
  });
  console.log(`[handler] patient ${objectId} synced → GHL contact ${contact.id}`);
}

async function handleAppointment(objectId) {
  const appt = await fetchAppointment(objectId);
  const patient = await fetchPatient(appt.patient);
  const apptStatus = appt.status?.status || 'Unknown';
  const when = formatDate(appt.scheduled_date);
  const reason = appt.reason || 'Appointment';

  console.log(`[handler] appointment ${objectId}: ${reason} — ${apptStatus} — ${when}`);

  const contact = await upsertContact(contactFromPatient(patient, ['elation-appointment']));

  if (apptStatus === 'Cancelled') {
    const existing = await findOpportunityByContact(contact.id);
    if (existing) {
      await updateOpportunity(existing.id, {
        name: `CANCELLED: ${reason} — ${when}`,
        status: 'lost',
      });
      console.log(`[handler] appointment ${objectId} cancelled → opportunity ${existing.id} set to lost`);
    } else {
      await createOpportunity({
        title: `CANCELLED: ${reason} — ${when}`,
        status: 'lost',
        contactId: contact.id,
        monetaryValue: 0,
      });
    }
    return;
  }

  // Scheduled or Rescheduled — check if opportunity exists, update or create
  const existing = await findOpportunityByContact(contact.id);
  if (existing) {
    await updateOpportunity(existing.id, {
      name: `${reason} — ${when}`,
      status: 'open',
    });
    console.log(`[handler] appointment ${objectId} updated → opportunity ${existing.id}`);
  } else {
    await createOpportunity({
      title: `${reason} — ${when}`,
      status: 'open',
      contactId: contact.id,
      monetaryValue: 0,
    });
    console.log(`[handler] appointment ${objectId} created new opportunity`);
  }
}

export async function handleEvent(payload) {
  const eventId = payload.id || payload.event_id || `${payload.resource}-${payload.object_id}-${payload.timestamp || ''}`;
  if (processed.has(eventId)) {
    console.log(`[handler] skip duplicate ${eventId}`);
    return;
  }
  markProcessed(eventId);

  const { resource, object_id } = payload;
  if (!resource || !object_id) {
    console.warn('[handler] missing resource or object_id', { resource, object_id });
    return;
  }

  switch (resource) {
    case 'patients':
      await handlePatient(object_id);
      break;
    case 'appointments':
      await handleAppointment(object_id);
      break;
    default:
      console.warn(`[handler] unhandled resource: ${resource}`);
  }
}
