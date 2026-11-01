import { USE_ADMIN_MOCK, USE_GAME_MOCK, API_BASE_URL } from "../config/env";
import { apiRequest, ApiError } from "./httpClient";
import {
  mockUsers,
  mockRoles,
  mockAllPermissions,
  mockPermissionRoles,
  mockDirectPermissions,
  mockCategories,
  mockGames,
  mockPermissionList,
  mockRoleList,
  mockSubmissions,
  mockSubmissionDetail,
} from "./mock/adminMock";

const copy = (data) => JSON.parse(JSON.stringify(data));
const wait = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

const toList = (response) => {
  const inner = response?.data ?? response;
  if (Array.isArray(inner)) return inner;
  if (Array.isArray(inner?.data)) return inner.data; // paginator Laravel
  return [];
};

// Mengambil nama role.
const roleName = (r) => (typeof r === "string" ? r : (r?.name ?? ""));

// Backend -> frontend.
const mapUser = (u) => ({
  id: u.id_user,
  username: u.username,
  email: u.email,
  role: roleName(u.roles?.[0]),
  status: u.status,
});

// GET /api/admin/users
export async function getUsers() {
  if (USE_ADMIN_MOCK) {
    await wait();
    return copy(mockUsers);
  }

  const response = await apiRequest("/admin/users");
  return toList(response).map(mapUser);
}

// GET /api/admin/roles
export async function getRoles() {
  if (USE_ADMIN_MOCK) return [...mockRoles];

  const response = await apiRequest("/admin/roles");
  return toList(response).map(roleName);
}

// Update beberapa user.
export async function updateUsers(changes) {
  if (USE_ADMIN_MOCK) {
    await wait();

    changes.forEach((c) => {
      const target = mockUsers.find((u) => u.id === c.id);
      if (target) {
        Object.assign(target, {
          role: c.role,
          status: c.status,
        });
      }
    });

    return {
      succeeded: changes.map((c) => c.id),
      failed: [],
    };
  }

  const succeeded = [];
  const failed = [];

  for (const c of changes) {
    try {
      if (c.roleChanged) {
        await apiRequest(`/admin/users/${c.id}/roles`, {
          method: "POST",
          body: { role: c.role },
        });
      }

      if (c.statusChanged) {
        await apiRequest(`/admin/users/${c.id}`, {
          method: "PATCH",
          body: { status: c.status },
        });
      }

      succeeded.push(c.id);
    } catch (err) {
      failed.push({
        id: c.id,
        message: err instanceof ApiError ? err.message : "Gagal menyimpan.",
      });
    }
  }

  return { succeeded, failed };
}

// DELETE /api/admin/users/{id}
export async function deleteUser(id) {
  if (USE_ADMIN_MOCK) {
    await wait();

    const index = mockUsers.findIndex((u) => u.id === id);
    if (index >= 0) mockUsers.splice(index, 1);

    return true;
  }

  await apiRequest(`/admin/users/${id}`, {
    method: "DELETE",
  });

  return true;
}

// POST /api/admin/users (role wajib, dikirim bersamaan sesuai backend)
export async function createUser({
  username,
  email,
  password,
  confirmPassword,
  role,
}) {
  if (USE_ADMIN_MOCK) {
    await wait();
    if (mockUsers.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      throw new ApiError("Data tidak valid.", 422, {
        email: ["Email sudah terdaftar."],
      });
    }
    mockUsers.push({
      id: Date.now(),
      username,
      email,
      role,
      status: "aktif",
    });
    return true;
  }

  return apiRequest("/admin/users", {
    method: "POST",
    body: {
      username,
      email,
      password,
      password_confirmation: confirmPassword,
      role,
    },
  });
}

// POST /api/admin/users/{id}/roles
export async function setUserRole(id, role) {
  if (USE_ADMIN_MOCK) {
    await wait();

    const target = mockUsers.find((u) => u.id === id);
    if (target) target.role = role;

    return true;
  }

  return apiRequest(`/admin/users/${id}/roles`, {
    method: "POST",
    body: { role },
  });
}

// ==================================================
// PERMISSIONS
// ==================================================

const permName = (p) => (typeof p === "string" ? p : (p?.name ?? ""));

const namesOf = (list) => (Array.isArray(list) ? list : []).map(permName);

// GET /api/admin/users/permissions
// Mengambil permission banyak user dalam SATU request.
export async function getUsersPermissions(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return {};
  }

  if (USE_ADMIN_MOCK) {
    await wait(150);

    const result = {};

    ids.forEach((id) => {
      const user = mockUsers.find((u) => String(u.id) === String(id));

      if (!user) return;

      const viaRoles =
        mockPermissionRoles.find((r) => r.name === user.role)?.permissions ??
        [];

      const direct = mockDirectPermissions[id] ?? [];

      result[id] = {
        direct: [...direct],
        viaRoles: [...viaRoles],
        effective: [...new Set([...direct, ...viaRoles])],
      };
    });

    return copy(result);
  }

  // Kirim sebagai ids[]=1&ids[]=2 agar sesuai validasi Laravel.
  const query = new URLSearchParams();

  ids.forEach((id) => {
    query.append("ids[]", String(id));
  });

  const response = await apiRequest(
    `/admin/users/permissions?${query.toString()}`,
  );

  const data = response?.data ?? {};
  const result = {};

  Object.entries(data).forEach(([id, permission]) => {
    result[id] = {
      direct: namesOf(permission.direct),
      viaRoles: namesOf(permission.via_roles),
      effective: namesOf(permission.effective),
    };
  });

  return result;
}

// GET /api/admin/users/{id}/permissions
// Mengambil permission satu user.
export async function getUserPermissions(id) {
  if (USE_ADMIN_MOCK) {
    await wait(150);

    const user = mockUsers.find((u) => u.id === id);

    const viaRoles =
      mockPermissionRoles.find((r) => r.name === user?.role)?.permissions ?? [];

    const direct = mockDirectPermissions[id] ?? [];

    return copy({
      direct,
      viaRoles,
      effective: [...new Set([...viaRoles, ...direct])],
    });
  }

  const response = await apiRequest(`/admin/users/${id}/permissions`);

  const data = response?.data ?? {};

  return {
    direct: namesOf(data.direct),
    viaRoles: namesOf(data.via_roles),
    effective: namesOf(data.effective),
  };
}

// POST /api/admin/users/{id}/permissions
export async function setUserPermissions(id, permissions) {
  if (USE_ADMIN_MOCK) {
    await wait();
    mockDirectPermissions[id] = [...permissions];
    return true;
  }

  return apiRequest(`/admin/users/${id}/permissions`, {
    method: "POST",
    body: { permissions },
  });
}

// ----- Permission (CRUD) -----
// ASSUMPTION: response berisi objek { id, name }. Body POST/PATCH: { name }.
const mapPermission = (p) => ({
  id: Number(p.id ?? p.id_permission),
  name: permName(p),
});

export async function getPermissions() {
  if (USE_ADMIN_MOCK) {
    await wait(200);
    return copy(mockPermissionList);
  }
  const response = await apiRequest("/admin/permissions");
  return toList(response).map(mapPermission);
}

// Hanya nama, dipakai bagian lain yang butuh daftar nama permission
export async function getAllPermissions() {
  return (await getPermissions()).map((p) => p.name);
}

const duplicateError = () =>
  new ApiError("Data tidak valid.", 422, { name: ["Permission sudah ada."] });

export async function createPermission(name) {
  if (USE_ADMIN_MOCK) {
    await wait();
    if (mockPermissionList.some((p) => p.name === name)) throw duplicateError();
    mockPermissionList.push({ id: Date.now(), name });
    return true;
  }
  return apiRequest("/admin/permissions", { method: "POST", body: { name } });
}

export async function updatePermission(id, name) {
  if (USE_ADMIN_MOCK) {
    await wait();
    if (mockPermissionList.some((p) => p.id !== id && p.name === name))
      throw duplicateError();
    const target = mockPermissionList.find((p) => p.id === id);
    if (target) target.name = name;
    return true;
  }
  return apiRequest(`/admin/permissions/${id}`, {
    method: "PATCH",
    body: { name },
  });
}

export async function deletePermission(id) {
  if (USE_ADMIN_MOCK) {
    await wait();
    const index = mockPermissionList.findIndex((p) => p.id === id);
    if (index >= 0) mockPermissionList.splice(index, 1);
    return true;
  }
  await apiRequest(`/admin/permissions/${id}`, { method: "DELETE" });
  return true;
}

// ==================================================
// KELOLA GAME
// Respons: { success, message, data }.
// Request tambah/edit game: multipart/form-data
//   nama_game, avatar, category_ids[], status
// Edit multipart: POST + _method=PATCH
// ==================================================
const API_ORIGIN = API_BASE_URL ? new URL(API_BASE_URL).origin : "";

// ASSUMPTION: avatar bisa URL lengkap atau path. Kalau backend memakai /storage,
// ubah di sini saja.
const toMediaUrl = (value) => {
  if (!value) return null;
  if (/^(https?:|data:|blob:)/.test(value)) return value;
  return `${API_ORIGIN}/storage/${String(value).replace(/^\/?(storage\/)?/, "")}`;
};

// ID selalu dijadikan angka supaya perbandingan di checkbox
// (categoryIds.includes(c.id)) dan chip kategori selalu cocok.
const toId = (value) => Number(value);

const mapCategory = (c) => ({
  id: toId(c.id_kategori ?? c.id),
  name: c.nama_kategori ?? c.nama ?? c.name,
});

const mapGame = (g) => ({
  id: toId(g.id_game ?? g.id),
  name: g.nama_game ?? g.nama ?? g.name,
  avatar: g.avatar_url ?? toMediaUrl(g.avatar),
  categoryIds: (g.kategoris ?? g.categories ?? g.kategori ?? []).map((c) =>
    toId(c.id_kategori ?? c.id ?? c),
  ),
});

// ----- Kategori -----
export async function getCategories() {
  if (USE_GAME_MOCK) {
    await wait();
    return copy(mockCategories);
  }
  const response = await apiRequest("/admin/categories");
  return toList(response).map(mapCategory);
}

// ASSUMPTION: body { nama_kategori } belum dikonfirmasi
export async function createCategory(name) {
  if (USE_GAME_MOCK) {
    await wait();
    if (
      mockCategories.some((c) => c.name.toLowerCase() === name.toLowerCase())
    ) {
      throw new ApiError("Data tidak valid.", 422, {
        name: ["Kategori sudah ada."],
      });
    }
    mockCategories.push({ id: Date.now(), name });
    return true;
  }
  return apiRequest("/admin/categories", {
    method: "POST",
    body: { nama_kategori: name },
  });
}

export async function updateCategory(id, name) {
  if (USE_GAME_MOCK) {
    await wait();
    if (
      mockCategories.some(
        (c) => c.id !== id && c.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      throw new ApiError("Data tidak valid.", 422, {
        name: ["Kategori sudah ada."],
      });
    }
    const target = mockCategories.find((c) => c.id === id);
    if (target) target.name = name;
    return true;
  }
  return apiRequest(`/admin/categories/${id}`, {
    method: "PATCH",
    body: { nama_kategori: name },
  });
}

// Belum dipakai di UI (desain tidak punya tombol hapus kategori).
// Kategori yang masih dipakai game akan ditolak backend.
export async function deleteCategory(id) {
  if (USE_GAME_MOCK) {
    await wait();
    const index = mockCategories.findIndex((c) => c.id === id);
    if (index >= 0) mockCategories.splice(index, 1);
    return true;
  }
  await apiRequest(`/admin/categories/${id}`, { method: "DELETE" });
  return true;
}

// ----- Game -----
export async function getGames() {
  if (USE_GAME_MOCK) {
    await wait();
    return copy(mockGames);
  }
  const response = await apiRequest("/admin/games");
  return toList(response).map(mapGame);
}

const buildGameForm = ({ name, avatarFile, categoryIds }) => {
  const form = new FormData();
  form.append("nama_game", name);
  if (avatarFile) form.append("avatar", avatarFile);
  categoryIds.forEach((id) => form.append("category_ids[]", String(id)));
  return form;
};

// values: { name, avatarFile (File | null), categoryIds }
export async function createGame(values) {
  if (USE_GAME_MOCK) {
    await wait();
    mockGames.push({
      id: Date.now(),
      name: values.name,
      avatar: values.avatarFile ? URL.createObjectURL(values.avatarFile) : null,
      categoryIds: values.categoryIds,
      status: "aktif",
      used: false,
    });
    return true;
  }
  return apiRequest("/admin/games", {
    method: "POST",
    body: buildGameForm(values),
  });
}

// values: { name, avatarFile (null = tidak diganti), categoryIds, status }
export async function updateGame(id, values) {
  if (USE_GAME_MOCK) {
    await wait();
    const target = mockGames.find((g) => g.id === id);
    if (target) {
      Object.assign(target, {
        name: values.name,
        categoryIds: values.categoryIds,
        status: values.status,
      });
      if (values.avatarFile)
        target.avatar = URL.createObjectURL(values.avatarFile);
    }
    return true;
  }
  const form = buildGameForm(values);
  form.append("_method", "PATCH"); // Laravel tidak membaca file dari PATCH asli
  return apiRequest(`/admin/games/${id}`, { method: "POST", body: form });
}

// Game yang dipakai turnamen dijawab HTTP 409 oleh backend
export async function deleteGame(id) {
  if (USE_GAME_MOCK) {
    await wait();
    const target = mockGames.find((g) => g.id === id);
    if (target?.used) {
      throw new ApiError(
        "Game sudah digunakan turnamen dan tidak dapat dihapus.",
        409,
      );
    }
    const index = mockGames.findIndex((g) => g.id === id);
    if (index >= 0) mockGames.splice(index, 1);
    return true;
  }
  await apiRequest(`/admin/games/${id}`, { method: "DELETE" });
  return true;
}

// ----- Role (CRUD) -----
// ASSUMPTION: body { name } dan { permissions: [nama] } belum dikonfirmasi backend.
const roleDuplicate = () =>
  new ApiError("Data tidak valid.", 422, { name: ["Role sudah ada."] });

// [{ id, name, permissions: [nama] }]
export async function getRolesWithPermissions() {
  if (USE_ADMIN_MOCK) {
    await wait();
    return copy(mockRoleList);
  }
  const response = await apiRequest("/admin/roles");
  const roles = toList(response).map((r) => ({
    id: Number(r.id),
    name: roleName(r),
  }));

  // Satu request per role. Kalau role banyak, minta backend menyertakan permissions di /roles.
  return Promise.all(
    roles.map(async (role) => {
      const res = await apiRequest(`/admin/roles/${role.id}/permissions`);
      const inner = res?.data ?? res;
      const list = Array.isArray(inner) ? inner : (inner?.permissions ?? []);
      return { ...role, permissions: list.map(permName) };
    }),
  );
}

export async function createRole(name) {
  if (USE_ADMIN_MOCK) {
    await wait();
    if (mockRoleList.some((r) => r.name.toLowerCase() === name.toLowerCase()))
      throw roleDuplicate();
    mockRoleList.push({ id: Date.now(), name, permissions: [] });
    return { id: null };
  }
  const response = await apiRequest("/admin/roles", {
    method: "POST",
    body: { name },
  });
  const data = response?.data ?? response;
  return { id: data?.id ? Number(data.id) : null };
}

export async function updateRoleName(id, name) {
  if (USE_ADMIN_MOCK) {
    await wait();
    if (
      mockRoleList.some(
        (r) => r.id !== id && r.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      throw roleDuplicate();
    }
    const target = mockRoleList.find((r) => r.id === id);
    if (target) target.name = name;
    return true;
  }
  return apiRequest(`/admin/roles/${id}`, { method: "PATCH", body: { name } });
}

// syncPermissions di backend: daftar ini MENGGANTIKAN seluruh permission role
export async function setRolePermissions(id, permissions) {
  if (USE_ADMIN_MOCK) {
    await wait();
    const target = mockRoleList.find((r) => r.id === id);
    if (target) target.permissions = [...permissions];
    return true;
  }
  return apiRequest(`/admin/roles/${id}/permissions`, {
    method: "POST",
    body: { permissions },
  });
}

export async function deleteRole(id) {
  if (USE_ADMIN_MOCK) {
    await wait();
    const index = mockRoleList.findIndex((r) => r.id === id);
    if (index >= 0) mockRoleList.splice(index, 1);
    return true;
  }
  await apiRequest(`/admin/roles/${id}`, { method: "DELETE" });
  return true;
}

// ----- Pengajuan turnamen (admin): SELALU memakai backend, tanpa mock -----
// Respons admin: { message, data }.
const fileName = (path) => (path ? String(path).split("/").pop() : "");
const mediaOf = (url, path) => url ?? toMediaUrl(path);

// GET /api/admin/pengajuan-turnamen
// Jangan panggil GET /{id} dari sini: endpoint itu mengubah status.
export async function getAdminSubmissions() {
  const url = "/admin/pengajuan-turnamen";
  const first = await apiRequest(url);
  const rows = [...toList(first)];

  // Backend memakai paginate(15): ambil semua halaman supaya pengajuan lama
  // (ada di halaman belakang) ikut dihitung. Batas 20 halaman = 300 data.
  const lastPage = Math.min(Number(first?.data?.last_page) || 1, 20);
  if (lastPage > 1) {
    const rest = await Promise.all(
      Array.from({ length: lastPage - 1 }, (_, i) =>
        apiRequest(`${url}?page=${i + 2}`),
      ),
    );
    rest.forEach((r) => rows.push(...toList(r)));
  }

  return rows.map((s) => ({
    id: Number(s.id_pengajuan),
    name: s.nama_turnamen ?? "-",
    tag: s.game?.kategoris?.[0]?.nama_kategori ?? "",
    organizer:
      s.nama_penyelenggara ??
      s.player?.user?.username ??
      s.player?.username ??
      "-",
    createdAt: s.created_at ?? "",
    // Terakhir kali player mengajukan ulang setelah revisi (null = belum pernah).
    resubmittedAt: s.diajukan_ulang_pada ?? null,
    status: s.status ?? "",
  }));
}

// GET /api/admin/pengajuan-turnamen/{id}
// "Menunggu Verifikasi" -> "Sedang ditinjau" (efek samping). 409 = sedang diedit.
export async function getAdminSubmissionDetail(id) {
  const response = await apiRequest(`/admin/pengajuan-turnamen/${id}`);
  const d = response?.data ?? response;
  const pay = d.pembayaran ?? {};
  const fee = d.pendanaan ?? {};

  return {
    id: Number(d.id_pengajuan),
    name: d.nama_turnamen ?? "-",
    organizer: d.nama_penyelenggara ?? d.player?.user?.username ?? "-",
    status: d.status ?? "",
    createdAt: d.created_at ?? "",
    // BARU
    resubmittedAt: d.diajukan_ulang_pada ?? null,
    posterUrl: mediaOf(d.poster_url, d.poster),
    game: d.game?.nama_game ?? "-",
    type: String(d.tipe_turnamen ?? "").toLowerCase(),
    province: d.kota?.provinsi?.nama_provinsi ?? "",
    city: d.kota?.nama_kota ?? "",
    address: d.deskripsi_lokasi ?? "",
    slot: d.slot ?? "",
    closeDate: d.jadwal_pendaftaran_tutup ?? "",
    matchDate: d.jadwal_main ?? "",
    description: d.deskripsi_turnamen ?? "",
    prize: d.total_hadiah,
    funding: (d.sumber_pendanaan ?? []).map((s) => s.nama_sumber ?? String(s)),
    sponsors: (d.sponsor ?? []).map((s) => ({
      name: s.nama_sponsor,
      contact: s.kontak_sponsor,
    })),
    rincian: (d.rincian ?? []).map((r) => ({
      peruntukanDana: r.peruntukanDana ?? "",
      keterangan: r.keterangan ?? "",
      nominal: r.nominal,
    })),
    feeType: String(fee.jenis_biaya ?? d.jenis_biaya ?? "").toLowerCase(),
    fee: fee.biaya_pendaftaran,
    // ASSUMPTION: nama field pembayaran belum ada contohnya
    paymentMethod: String(pay.metode_pembayaran ?? "").toLowerCase(),
    qrisUrl: mediaOf(pay.qris_url, pay.qris),
    qrisName: fileName(pay.qris),
    account: pay.no_rekening ?? "",
    // ASSUMPTION: KTP dibuka lewat ktp_url, atau path /storage/. Kalau backend
    // menyimpannya privat, URL ini 404 dan perlu endpoint khusus dari backend.
    ktpUrl: mediaOf(d.ktp_url, d.ktp),
    ktpName: fileName(d.ktp) || "ktp",
  };
}

export const approveSubmission = (id) =>
  apiRequest(`/admin/pengajuan-turnamen/${id}/approve`, { method: "POST" });

export const rejectSubmission = (id, alasan) =>
  apiRequest(`/admin/pengajuan-turnamen/${id}/reject`, {
    method: "POST",
    body: { alasan_admin: alasan },
  });

export const requestRevision = (id, alasan) =>
  apiRequest(`/admin/pengajuan-turnamen/${id}/revision`, {
    method: "POST",
    body: { alasan_admin: alasan },
  });

// POST /api/admin/pengajuan-turnamen/{id}/release (tanpa body)
// Mengembalikan status "Sedang ditinjau" -> "Menunggu Verifikasi" saat admin keluar tanpa keputusan.
export const releaseSubmission = (id) =>
  apiRequest(`/admin/pengajuan-turnamen/${id}/release`, { method: "POST" });
