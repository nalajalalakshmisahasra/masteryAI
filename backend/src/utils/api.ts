import { auth } from '../firebase';

const API_BASE_URL = 'https://masteryai.onrender.com';

export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : null;

  const headers = new Headers(init.headers);
  headers.set(
    'Content-Type',
    headers.get('Content-Type') || 'application/json'
  );

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const url =
    typeof input === 'string' && input.startsWith('/')
      ? `${API_BASE_URL}${input}`
      : input;

  return fetch(url, { ...init, headers });
}