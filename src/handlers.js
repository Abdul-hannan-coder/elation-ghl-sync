import { fetchPatient, fetchAppointment } from './elation.js';
import { upsertContact, createOpportunity } from './ghl.js';
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

async function handlePatient(objectId) {
  const patient = await fetchPatient(objectId);
  const contact = await upsertContact(contactFromPatient(patient));
  await createOpportunity({
    title: `New patient: ${patient.first_name} ${patient.last_name}`,
    status: 'open',
    stageId: config.ghl.stageId,
    contactId: contact.id,
    monetaryValue: 0,
    name: `${patient.first_name} ${patient.last_name}`,
    email: pickEmail(patient),
    phone: pickPhone(patient),
  });
}

async function handleAppointment(objectId) {
  const appt = await fetchAppointment(objectId);
  const patient = await fetchPatient(appt.patient);
  const contact = await upsertContact(contactFromPatient(patient, ['elation-appointment']));
  const when = appt.scheduled_date
    ? new Date(appt.scheduled_date).toLocaleString('en-US')
    : 'scheduled';
  await createOpportunity({
    title: `${appt.reason || 'Appointment'} — ${when}`,
    status: 'open',
    stageId: config.ghl.stageId,
    contactId: contact.id,
    monetaryValue: 0,
    name: `${patient.first_name} ${patient.last_name}`,
    email: pickEmail(patient),
    phone: pickPhone(patient),
  });
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
