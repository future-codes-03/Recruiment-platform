export function getErrorMessage(err, fallback = "Something went wrong. Please try again.") {
  const data = err?.response?.data;
  if (!data) return fallback;

  // New backend shape: real field errors live under details, message is
  // just a generic label like "Request could not be processed."
  if (data.details && typeof data.details === "object") {
    for (const key of Object.keys(data.details)) {
      const value = data.details[key];
      if (Array.isArray(value) && typeof value[0] === "string") return value[0];
      if (typeof value === "string") return value;
    }
  }

  // Spec shape / no details present — message is the real message.
  if (typeof data.message === "string") return data.message;

  // DRF raw default shape (no error_code/details wrapper at all).
  if (typeof data === "object") {
    for (const key of Object.keys(data)) {
      const value = data[key];
      if (Array.isArray(value) && typeof value[0] === "string") return value[0];
      if (typeof value === "string") return value;
    }
  }

  return fallback;
}