import api from "./client";

export async function listJobs({ status, page } = {}) {
  const { data } = await api.get("/jobs", { params: { status, page } });
  return data; // { results, count, next }
}

export async function createJob(job) {
  const { data } = await api.post("/jobs", job);
  return data; // Job
}

// PROPOSED — GET /jobs/{job_id} isn't in api_specification.yaml as of the
// co-founder's last sync (only PATCH existed). Added so the job-detail
// screens have something to fetch a single job from. Confirm before backend
// build; drop-in swap either way since this file is the only place it lives.
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
