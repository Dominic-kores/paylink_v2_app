
const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001/api";

export async function api(path, options = {}) {
  const token = localStorage.getItem("paylink_token");

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || `Request failed (${response.status})`
    );
  }

  return data;
}

export const get = (path) => api(path);

export const post = (path, body) =>
  api(path, {
    method: "POST",
    body: JSON.stringify(body)
  });

export const patch = (path) =>
  api(path, { method: "PATCH" });
