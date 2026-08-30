import api from "./client";

// Each function's request/response shape matches api_specification.yaml exactly,
// so swapping mock data for these real calls later is a drop-in change.

export async function signupCandidate({ email, password, full_name, phone }) {
  const { data } = await api.post("/auth/signup/candidate", { email, password, full_name, phone });
  return data; // { user, message }
}

export async function signupCompany({ company_name, admin_email, admin_password, admin_full_name }) {
  const { data } = await api.post("/auth/signup/company", { company_name, admin_email, admin_password, admin_full_name });
  return data; // { company, user }
}

export async function login({ email, password }) {
  const { data } = await api.post("/auth/login", { email, password });
  return data; // { access_token, refresh_token, expires_in, user }
}

export async function forgotPassword({ email }) {
  const { data } = await api.post("/auth/forgot-password", { email });
  return data;
}

export async function resetPassword({ reset_token, new_password }) {
  const { data } = await api.post("/auth/reset-password", { reset_token, new_password });
  return data;
}
