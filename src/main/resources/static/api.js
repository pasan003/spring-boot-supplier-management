/* Thin wrapper around fetch with uniform error handling.
   Every failed request becomes an ApiError carrying the backend's message,
   so the UI never exposes raw exception text. */
class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const API = {
  async request(path, options = {}) {
    const res = await fetch(path, {
      ...options,
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    });

    if (!res.ok) {
      let message = `Request failed (${res.status})`;
      try {
        const body = await res.json();
        if (body && body.message) message = body.message;
      } catch (e) { /* non-JSON error body */ }
      throw new ApiError(message, res.status);
    }

    if (res.status === 204) return null;
    return res.json();
  },

  get: (path) => API.request(path),
  post: (path, body) => API.request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => API.request(path, { method: 'PUT', body: JSON.stringify(body) }),
  putNoBody: (path) => API.request(path, { method: 'PUT' }),
  del: (path) => API.request(path, { method: 'DELETE' }),
};
