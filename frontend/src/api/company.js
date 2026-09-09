import api from "./client";

export async function getVerificationStatus() {
  // Confirmed against the real backend: this is nested under /auth/, not at
  // the spec's documented path — his own code comments flag this as
  // unintentional, but matching it here beats a 404 either way.
  const { data } = await api.get("/auth/companies/me/verification-status");
  return data; // { is_verified, submitted_at }
}

// PROPOSED — GET/PATCH /companies/me weren't in the spec (only the
// verification-status sub-resource existed). Added so Settings has
// something real to load/save the company name against.
export async function getCompanyProfile() {
  const { data } = await api.get("/companies/me");
  return data; // Company
}

export async function updateCompanyProfile({ name }) {
  const { data } = await api.patch("/companies/me", { name });
  return data; // Company
}

// PROPOSED — replaces the original "employer billing/invoices" idea, which
// conflicted with the candidate-pays-per-attempt decision. This is a
// read-only view of candidate payment activity across the company's jobs,
// not a bill.
export async function getPaymentActivity({ page } = {}) {
  const { data } = await api.get("/companies/me/payments", { params: { page } });
  return data; // { results, count, next }
}
