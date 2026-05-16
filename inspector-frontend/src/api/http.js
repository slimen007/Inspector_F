import axios from "axios";
import { getToken, clearSession } from "../auth/session";
import { getApiBaseUrl } from "./urls";

const http = axios.create({
  baseURL: getApiBaseUrl(),
});

http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearSession();
      try {
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      } catch {
        // window might not be available in some environments
      }
    }
    return Promise.reject(error);
  }
);

export default http;

