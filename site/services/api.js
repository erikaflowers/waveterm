/**
 * API Service
 * All external data fetching goes through here.
 * Swap this implementation to change your backend.
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api';

/**
 * Make an API request
 * @param {string} endpoint - API endpoint (without base URL)
 * @param {object} options - Fetch options
 * @returns {Promise<any>} Response data
 */
async function request(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * GET request
 */
export function get(endpoint) {
  return request(endpoint, { method: 'GET' });
}

/**
 * POST request
 */
export function post(endpoint, data) {
  return request(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * PUT request
 */
export function put(endpoint, data) {
  return request(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * DELETE request
 */
export function del(endpoint) {
  return request(endpoint, { method: 'DELETE' });
}
