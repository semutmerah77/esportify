import { mockSquads } from "./mock/squadMock";
export const SQUAD_CAPACITY = 7;
export const SEARCH_PAGE_SIZE = 8;
export const MY_PAGE_SIZE = 5;

const squads = mockSquads.map((s) => ({ ...s, capacity: SQUAD_CAPACITY }));

const isFull = (s) => s.members >= s.capacity;
const normalize = (v) =>
  String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/^#/, "");

export async function searchSquads(query = "") {
  const q = normalize(query);
  return squads
    .filter(
      (s) =>
        !q ||
        s.id.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q),
    )
    .map((s) => ({ ...s, full: isFull(s) }));
}

// GET squad milik user (leader atau anggota)
export async function getMySquads() {
  return squads.filter((s) => s.role).map((s) => ({ ...s, full: isFull(s) }));
}

// POST squad baru. values: { name, description, logoFile }
export async function createSquad({ name, description, logoFile }) {
  const taken = squads.some(
    (s) => s.name.toLowerCase() === name.trim().toLowerCase(),
  );
  if (taken) {
    const err = new Error("Nama squad sudah dipakai.");
    err.field = "name";
    throw err;
  }
  let id;
  do {
    id = `SQ-${Math.floor(1000 + Math.random() * 9000)}`;
  } while (squads.some((s) => s.id === id));

  const squad = {
    id,
    name: name.trim(),
    description: description.trim(),
    logo: logoFile ? URL.createObjectURL(logoFile) : null,
    icon: "shield",
    tone: "blue",
    members: 1,
    capacity: SQUAD_CAPACITY,
    role: "leader",
  };
  squads.unshift(squad);
  return { ...squad, full: false };
}
