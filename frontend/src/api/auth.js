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

// Candidate-only. See .claude/specs/login-with-google.md.
export async function loginWithGoogle({ id_token }) {
  const { data } = await api.post("/auth/google", { id_token });
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

// PROPOSED endpoints — not yet in api_specification.yaml as of the
// co-founder's last sync. Added here following the exact same shape as
// forgot-password/reset-password. Confirm with co-founder before backend
// build; drop-in swap either way since this file is the only place the
// path/shape lives.
export async function verifyEmail({ token }) {
  const { data } = await api.post("/auth/verify-email", { token });
  return data; // { user, message }
}

export async function resendVerification({ email }) {
  const { data } = await api.post("/auth/resend-verification", { email });
  return data;
}
