import api from "./client";

export async function getMyProfile() {
  const { data } = await api.get("/me/profile");
  return data; // { resume_url, cv_uploaded_at, skills, phone, full_name, auth_provider, profile_complete, missing_fields }
}

export async function updateMyProfile(formData) {
  const { data } = await api.put("/me/profile", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

// Partial update — only send whatever field(s) are actually changing.
// Unlike updateMyProfile (PUT), this doesn't require every field together —
// the backend relaxes everything to optional on PATCH.
export async function patchMyProfile(formData) {
  const { data } = await api.patch("/me/profile", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

// DELETE /me/profile/cv — clears resume_url/cv_uploaded_at and removes the
// stored file.
export async function deleteMyResume() {
  const { data } = await api.delete("/me/profile/cv");
  return data;
}

// DELETE /me/profile/phone — clears the phone number. Distinct from
// PATCHing an empty string, which the backend rejects outright
// (validate_phone disallows blank) — this is the only valid way to clear
// it. For a Google-signup candidate this puts phone back on
// missing_fields and re-gates them next time profile_complete is checked.
export async function deleteMyPhone() {
  const { data } = await api.delete("/me/profile/phone");
  return data;
}