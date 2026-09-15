import api from "./client";

export async function getMyProfile() {
  const { data } = await api.get("/me/profile");
  return data; // { resume_url, cv_uploaded_at, skills, profile_complete }
}

export async function updateMyProfile(formData) {
  const { data } = await api.put("/me/profile", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
// Partial update — only send whatever field(s) are actually changing.
// Unlike updateMyProfile (PUT), this doesn't require both cv and skills
// together — the backend relaxes both fields to optional on PATCH.
export async function patchMyProfile(formData) {
  const { data } = await api.patch("/me/profile", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data; // { resume_url, cv_uploaded_at, skills, profile_complete }
}