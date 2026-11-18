import { config } from './config.js';

let tokenCache = { token: null, expiresAt: 0 };

async function getToken() {
  const now = Date.now();
  if (tokenCache.token && now < tokenCache.expiresAt) return tokenCache.token;

  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: config.elation.clientId,
    client_secret: config.elation.clientSecret,
    username: config.elation.username,
    password: config.elation.password,
  });

  const res = await fetch(`${config.elation.baseUrl}/oauth2/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    throw new Error(`Elation token request failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  tokenCache = {
    token: data.access_token,
    expiresAt: now + (data.expires_in - 60) * 1000,
  };
  return tokenCache.token;
}

async function elationGet(path) {
  const token = await getToken();
  const res = await fetch(`${config.elation.baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Elation GET ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export function fetchPatient(id) {
  return elationGet(`/patients/${id}/`);
}

export function fetchAppointment(id) {
  return elationGet(`/appointments/${id}/`);
}
