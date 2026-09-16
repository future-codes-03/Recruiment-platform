import api from "./client";

export async function listJobs({ status, page } = {}) {
  const { data } = await api.get("/jobs", { params: { status, page } });
  return data; // { results, count, next }
}

// --- Candidate-facing / public browsing -----------------------------------
// GET /jobs above is company-scoped ("jobs belonging to the authenticated
// user's company" per api_specification.yaml) — that's the employer side
// only. Candidates browse through the separate /public/jobs endpoints,
// which are unauthenticated and already exclude closed jobs server-side.
// Do not point candidate pages at listJobs/getJob above — use these instead.
export async function listPublicJobs({ skill, page } = {}) {
  const { data } = await api.get("/public/jobs", { params: { skill, page } });
  return data; // { results, count }
}

export async function getPublicJob(jobId) {
  const { data } = await api.get(`/public/jobs/${jobId}`);
  return data; // Job
}

export async function createJob(job) {
  const { data } = await api.post("/jobs", job);
  return data; // Job
}

// PROPOSED — still not in api_specification.yaml (only PATCH /jobs/{job_id}
// is defined there). Kept for the employer job-detail screen; confirm with
// co-founder before backend build.
export async function getJob(jobId) {
  const { data } = await api.get(`/jobs/${jobId}`);
  return data; // Job
}

export async function updateJob(jobId, job) {
  const { data } = await api.patch(`/jobs/${jobId}`, job);
  return data; // Job
}

export async function publishJob(jobId) {
  const { data } = await api.post(`/jobs/${jobId}/publish`);
  return data; // Job
}

// PROPOSED — no endpoint existed anywhere to close a published job.
export async function closeJob(jobId) {
  const { data } = await api.post(`/jobs/${jobId}/close`);
  return data; // Job
}

export async function acceptGuaranteeAgreement(jobId, { agreement_version }) {
  const { data } = await api.post(`/jobs/${jobId}/guarantee-agreement`, {
    agreement_version,
    accepted: true,
  });
  return data;
}

export async function suggestBlueprint(jobId, roleDescription) {
  const { data } = await api.post(`/jobs/${jobId}/blueprint/suggest`, {
    role_description: roleDescription,
  });
  return data; // SkillRequirement[]
}

export async function getJobSubmissions(jobId, { status, sort } = {}) {
  const { data } = await api.get(`/jobs/${jobId}/submissions`, { params: { status, sort } });
  return data; // Submission[] — includes candidate_name/ai_summary/flags/transcript (PROPOSED fields)
}
