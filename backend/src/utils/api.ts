const API_BASE_URL = 'http://localhost:3000';

export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);

  headers.set(
    'Content-Type',
    headers.get('Content-Type') || 'application/json'
  );

  const url =
    typeof input === 'string' && input.startsWith('/')
      ? `${API_BASE_URL}${input}`
      : input;

  return fetch(url, {
    ...init,
    headers,
  });
}