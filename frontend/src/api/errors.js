// The backend currently returns DRF's default validation-error shape —
// {"email": ["already exists"]} or {"non_field_errors": ["Invalid..."]}  —
// not the {error_code, message, details} shape the spec (and the rest of
// this codebase) expects. This adapts to whichever shape actually arrives,
// so we don't lose the backend's specific, helpful message and fall back
// to a generic one.
export function getErrorMessage(err, fallback = "Something went wrong. Please try again.") {
  const data = err?.response?.data;
  if (!data) return fallback;

  // Spec shape, once/if the backend adds it — checked first so nothing
  // needs to change here when that happens.
  if (typeof data.message === "string") return data.message;

  // DRF default shape: first key's first string (covers both a named
  // field like "email" and the field-less "non_field_errors").
  if (typeof data === "object") {
    for (const key of Object.keys(data)) {
      const value = data[key];
      if (Array.isArray(value) && typeof value[0] === "string") return value[0];
      if (typeof value === "string") return value;
    }
  }

  return fallback;
}
