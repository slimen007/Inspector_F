const DEFAULT_API_BASE_URL = "http://localhost:8081/api";

export function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;
}

export function getServerBaseUrl() {
  return getApiBaseUrl().replace(/\/api\/?$/, "");
}

export function resolveServerUrl(path = "") {
  if (!path) {
    return getServerBaseUrl();
  }

  if (/^https?:\/\//i.test(path) || path.startsWith("data:")) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getServerBaseUrl()}${normalizedPath}`;
}
