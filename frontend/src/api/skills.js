import api from "./client";

export async function getSkillCatalog() {
  const { data } = await api.get("/public/skills");
  return data; // [{ id, slug, name }, ...]
}