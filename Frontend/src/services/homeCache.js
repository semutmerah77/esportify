import { getToken } from "./tokenStorage";

// Cache respons Home di memori. Terikat ke token, jadi ganti akun tidak memakai data akun lain.
let entry = null;

export const homeCache = {
  get(ttlMs) {
    if (!entry) return null;
    if (entry.token !== getToken()) return null;
    if (Date.now() - entry.at > ttlMs) return null;
    return entry.data;
  },
  set(data) {
    entry = { data, at: Date.now(), token: getToken() };
  },
  clear() {
    entry = null;
  },
};
