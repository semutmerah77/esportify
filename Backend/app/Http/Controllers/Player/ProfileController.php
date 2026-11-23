<?php

namespace App\Http\Controllers\Player;

use App\Http\Controllers\Controller;
use App\Models\PendaftaranTurnamen;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class ProfileController extends Controller
{
    /**
     * Menampilkan profil Player yang sedang login.
     */
    public function show(Request $request)
    {
        $user = $request->user();
        $player = $user->player;

        if (!$player) {
            return response()->json([
                'success' => false,
                'message' => 'Profil Player tidak ditemukan.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Profil Player berhasil ditampilkan.',
            'data' => [
                'id_user' => $user->id_user,
                'username' => $user->username,
                'email' => $user->email,
                'id_player' => $player->id_player,
                'avatar' => $player->avatar,
                'bio' => $player->bio,
                'jenis_kelamin' => $player->jenis_kelamin,
                // PB-23 (R5.04): piala juga tampil di Profil Saya
                'piala' => PendaftaranTurnamen::getPrestasiByPlayer($player->id_player),
            ],
        ], 200);
    }

    /**
     * Memperbarui profil Player yang sedang login.
     */
    public function update(Request $request)
    {
        $user = $request->user();
        $player = $user->player;

        if (!$player) {
            return response()->json([
                'success' => false,
                'message' => 'Profil Player tidak ditemukan.',
            ], 404);
        }

        $validated = $request->validate([
            'username' => [
                'sometimes',
                'required',
                'string',
                'max:255',
                Rule::unique('users', 'username')
                    ->ignore($user->id_user, 'id_user'),
            ],

            'avatar' => [
                'sometimes',
                'nullable',
                'image',
                'mimes:jpg,jpeg,png',
                'max:2048',
            ],

            'bio' => [
                'sometimes',
                'nullable',
                'string',
                'max:1000',
            ],

            'jenis_kelamin' => [
                'sometimes',
                'nullable',
                'in:laki-laki,perempuan,rahasia',
            ],

            'current_password' => [
                'required_with:password',
                'string',
            ],

            'password' => [
                'sometimes',
                'required',
                'string',
                'min:8',
                'confirmed',
            ],
        ]);

        // Verifikasi password lama jika Player ingin mengganti password.
        if (isset($validated['password'])) {
            if (!Hash::check(
                $validated['current_password'],
                $user->password
            )) {
                return response()->json([
                    'success' => false,
                    'message' => 'Password lama tidak sesuai.',
                ], 422);
            }
        }

        // Siapkan data untuk tabel users.
        $userData = [];

        if (array_key_exists('username', $validated)) {
            $userData['username'] = $validated['username'];
        }

        if (isset($validated['password'])) {
            $userData['password'] = $validated['password'];
        }

        // Siapkan data untuk tabel players.
        $playerData = [];

        foreach (['bio', 'jenis_kelamin'] as $field) {
            if (array_key_exists($field, $validated)) {
                $playerData[$field] = $validated[$field];
            }
        }

        $oldAvatar = $player->avatar;
        $newAvatar = null;

        // Simpan avatar baru jika ada file yang diunggah.
        if ($request->hasFile('avatar')) {
            $newAvatar = $request->file('avatar')
                ->store('avatars', 'public');

            $playerData['avatar'] = $newAvatar;
        } elseif (
            array_key_exists('avatar', $validated)
            && $validated['avatar'] === null
        ) {
            // Mengizinkan avatar dihapus dengan nilai null.
            $playerData['avatar'] = null;
        }

        try {
            DB::transaction(function () use (
                $user,
                $player,
                $userData,
                $playerData
            ) {
                if (!empty($userData)) {
                    $user->update($userData);
                }

                if (!empty($playerData)) {
                    $player->update($playerData);
                }
            });
        } catch (\Throwable $e) {
            // Hapus file baru jika penyimpanan database gagal.
            if ($newAvatar) {
                Storage::disk('public')->delete($newAvatar);
            }

            throw $e;
        }

        // Hapus avatar lama setelah perubahan database berhasil.
        if (
            $newAvatar
            && $oldAvatar
            && $oldAvatar !== $newAvatar
        ) {
            Storage::disk('public')->delete($oldAvatar);
        }

        if (
            array_key_exists('avatar', $validated)
            && $validated['avatar'] === null
            && $oldAvatar
        ) {
            Storage::disk('public')->delete($oldAvatar);
        }

        return response()->json([
            'success' => true,
            'message' => 'Profil Player berhasil diperbarui.',
            'data' => [
                'id_user' => $user->id_user,
                'username' => $user->username,
                'email' => $user->email,
                'id_player' => $player->id_player,
                'avatar' => $player->avatar,
                'bio' => $player->bio,
                'jenis_kelamin' => $player->jenis_kelamin,
            ],
        ], 200);
    }
}
?>