<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Turnamen;
use App\Models\PendaftaranTurnamen;
use App\Models\Player;
use App\Models\Penyelenggara;
use App\Services\PendaftaranTurnamenService;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Carbon\Carbon;

class TurnamenController extends Controller
{
    /**
     * Satu aturan status untuk list, kelolaan, dan detail.
     *
     * Status "selesai" hanya ditetapkan saat bracket menemukan
     * pemenang (Sprint 3), supaya status turnamen selalu sejalan
     * dengan pembukaan roster. Sebelum itu, setelah jadwal_main
     * statusnya "berlangsung".
     */
    private function hitungStatus($jadwalMain, ?string $statusTersimpan = null): string
    {
        if ($statusTersimpan === 'selesai') {
            return 'selesai';
        }

        if (!$jadwalMain) {
            return 'pendaftaran';
        }

        return now()->lt(Carbon::parse($jadwalMain))
            ? 'pendaftaran'
            : 'berlangsung';
    }

    /**
     * Menampilkan daftar turnamen yang sudah dipublikasikan.
     * Endpoint ini dapat diakses oleh Guest maupun Player.
     * Turnamen berstatus "selesai" tidak ditampilkan.
     */
    public function index()
    {
        $turnamen = Turnamen::query()
            ->whereHas('pengajuan')
            ->with([
                'pengajuan:id_pengajuan,id_game,id_kota,nama_turnamen,nama_penyelenggara,nama_instansi,poster,tipe_turnamen,slot,total_hadiah,jadwal_pendaftaran_tutup,jadwal_main,deskripsi_lokasi',
                'pengajuan.game:id_game,nama_game',
                'pengajuan.game.kategoris:id_kategori,nama_kategori',
                'pengajuan.kota:id_kota,id_provinsi,nama_kota',
                'pengajuan.kota.provinsi:id_provinsi,nama_provinsi',
                'pengajuan.pendanaan',
            ])
            ->get()
            ->map(function ($item) {
                $pengajuan = $item->pengajuan;
                $game = $pengajuan->game;
                $kota = $pengajuan->kota;
                $pendanaan = $pengajuan->pendanaan;

                return [
                    'id_turnamen' => $item->id_turnamen,
                    'status' => $this->hitungStatus($pengajuan->jadwal_main, $item->status),
                    'created_at' => $item->created_at,

                    'pengajuan' => [
                        'id_pengajuan' => $pengajuan->id_pengajuan,
                        'nama_turnamen' => $pengajuan->nama_turnamen,
                        'nama_penyelenggara' => $pengajuan->nama_penyelenggara,
                        'nama_instansi' => $pengajuan->nama_instansi,
                        'poster' => $pengajuan->poster,
                        'tipe_turnamen' => $pengajuan->tipe_turnamen,
                        'slot' => $pengajuan->slot,
                        'total_hadiah' => $pengajuan->total_hadiah,
                        'jadwal_pendaftaran_tutup' => $pengajuan->jadwal_pendaftaran_tutup,
                        'jadwal_main' => $pengajuan->jadwal_main,
                        'deskripsi_lokasi' => $pengajuan->deskripsi_lokasi,

                        'pendaftaran_terbuka' => $pengajuan->jadwal_pendaftaran_tutup
                            ? now()->lt($pengajuan->jadwal_pendaftaran_tutup)
                            : true,

                        'game' => $game
                            ? [
                                'id_game' => $game->id_game,
                                'nama_game' => $game->nama_game,
                                'kategoris' => $game->kategoris->map(fn ($k) => [
                                    'id_kategori' => $k->id_kategori,
                                    'nama_kategori' => $k->nama_kategori,
                                ])->values(),
                            ]
                            : null,

                        'kota' => $kota
                            ? [
                                'id_kota' => $kota->id_kota,
                                'id_provinsi' => $kota->id_provinsi,
                                'nama_kota' => $kota->nama_kota,
                                'provinsi' => $kota->provinsi
                                    ? [
                                        'id_provinsi' => $kota->provinsi->id_provinsi,
                                        'nama_provinsi' => $kota->provinsi->nama_provinsi,
                                    ]
                                    : null,
                            ]
                            : null,

                            'pendanaan' => $pendanaan
                            ? [
                                'jenis_biaya' => $pendanaan->jenis_biaya,
                                'biaya_pendaftaran' => $pendanaan->biaya_pendaftaran,
                            ]
                            : null,
                    ],
                ];
            })

            // Daftar & pencarian publik: sembunyikan turnamen yang sudah
            // selesai, atau yang hari mainnya sudah lewat (perilaku
            // Modul 2). Status di detail tetap "berlangsung" sampai
            // bracket menemukan pemenang (Sprint 3).
            ->filter(function ($t) {
                if ($t['status'] === 'selesai') {
                    return false;
                }

                $jadwal = $t['pengajuan']['jadwal_main'];

                return !$jadwal || now()->lt(Carbon::parse($jadwal)->endOfDay());
            })
            
            ->sortByDesc(fn ($t) => $t['pengajuan']['jadwal_main']?->timestamp ?? PHP_INT_MAX)
            ->values();

        return response()->json([
            'success' => true,
            'message' => 'Daftar turnamen berhasil diambil.',
            'data' => $turnamen,
        ]);
    }


    /**
     * Menampilkan daftar seluruh turnamen yang dikelola
     * oleh Player yang sedang login.
     */
    public function kelolaan(Request $request)
    {
        // 1. Ambil data Player berdasarkan akun yang sedang login.
        $player = Player::where(
            'id_user',
            $request->user()->id_user
        )->first();

        // Jika akun belum memiliki data Player.
        if (!$player) {
            return response()->json([
                'success' => true,
                'message' => 'Anda belum memiliki data Player.',
                'data' => [],
            ]);
        }

        // 2. Ambil seluruh ID Penyelenggara milik Player.
        $idPenyelenggara = Penyelenggara::where(
            'id_player',
            $player->id_player
        )->pluck('id_penyelenggara');

        // Jika Player belum pernah menjadi penyelenggara.
        if ($idPenyelenggara->isEmpty()) {
            return response()->json([
                'success' => true,
                'message' => 'Anda belum memiliki turnamen kelolaan.',
                'data' => [],
            ]);
        }

        // 3. Ambil seluruh turnamen dari semua ID Penyelenggara.
        $turnamen = Turnamen::query()
            ->whereIn('id_penyelenggara', $idPenyelenggara)
            ->whereHas('pengajuan')
            ->with([
                'pengajuan:id_pengajuan,id_game,nama_turnamen,nama_penyelenggara,nama_instansi,poster,tipe_turnamen,slot,jadwal_pendaftaran_tutup,jadwal_main,deskripsi_lokasi',
                'pengajuan.game:id_game,nama_game',
            ])
            ->orderByDesc('created_at')
            ->get()
            ->map(function ($item) {
                $pengajuan = $item->pengajuan;

                return [
                    'id_turnamen' => $item->id_turnamen,
                    'status' => $this->hitungStatus($pengajuan->jadwal_main, $item->status),
                    'created_at' => $item->created_at,

                    'pengajuan' => [
                        'id_pengajuan' => $pengajuan->id_pengajuan,
                        'nama_turnamen' => $pengajuan->nama_turnamen,
                        'nama_penyelenggara' => $pengajuan->nama_penyelenggara,
                        'nama_instansi' => $pengajuan->nama_instansi,
                        'poster' => $pengajuan->poster,
                        'tipe_turnamen' => $pengajuan->tipe_turnamen,
                        'slot' => $pengajuan->slot,
                        'jadwal_pendaftaran_tutup' => $pengajuan->jadwal_pendaftaran_tutup,
                        'jadwal_main' => $pengajuan->jadwal_main,
                        'deskripsi_lokasi' => $pengajuan->deskripsi_lokasi,

                        'game' => $pengajuan->game
                            ? [
                                'id_game' => $pengajuan->game->id_game,
                                'nama_game' => $pengajuan->game->nama_game,
                            ]
                            : null,
                    ],
                ];
            });

        return response()->json([
            'success' => true,
            'message' => 'Daftar turnamen kelolaan berhasil diambil.',
            'data' => $turnamen,
        ]);
    }


    /**
     * Menampilkan detail turnamen berdasarkan ID.
     * Digunakan oleh Player maupun Penyelenggara.
     */
    public function show(Request $request, $id)
    {
        $turnamen = Turnamen::with([
            'pengajuan.game.kategoris:id_kategori,nama_kategori',
            'pengajuan.kota.provinsi',
            'pengajuan.pendanaan',
            'pengajuan.sponsor',
            'pengajuan.pembayaran',
            'pengajuan.hadiahLainnya',
            'penyelenggara',
        ])->find($id);

        if (!$turnamen) {
            return response()->json([
                'success' => false,
                'message' => 'Turnamen tidak ditemukan.',
            ], 404);
        }

        $pengajuan = $turnamen->pengajuan;

        if (!$pengajuan) {
            return response()->json([
                'success' => false,
                'message' => 'Data pengajuan turnamen tidak ditemukan.',
            ], 404);
        }

        // Status dihitung dengan aturan yang sama seperti list.
        $status = $this->hitungStatus($pengajuan->jadwal_main, $turnamen->status);
        
        // US27: slot terisi = pendaftaran menunggu + diterima.
        // Pendaftaran ditolak tidak dihitung (slot kembali).
        $slotTerisi = $turnamen->slotTerisi();
        $sisaSlot = max(0, (int) $pengajuan->slot - $slotTerisi);

        return response()->json([
            'success' => true,
            'message' => 'Detail turnamen berhasil diambil.',
            'data' => [
                'id_turnamen' => $turnamen->id_turnamen,
                'status' => $status,
                'created_at' => $turnamen->created_at,

                'pengajuan' => [
                    'id_pengajuan' => $pengajuan->id_pengajuan,
                    'nama_turnamen' => $pengajuan->nama_turnamen,
                    'nama_penyelenggara' => $pengajuan->nama_penyelenggara,
                    // Nama instansi tampil publik. Nomor instansi sengaja
                    // tidak dikirim (hanya untuk admin dan pengaju).
                    'nama_instansi' => $pengajuan->nama_instansi,
                    'poster' => $pengajuan->poster,
                    'tipe_turnamen' => $pengajuan->tipe_turnamen,
                    'slot' => $pengajuan->slot,
                    'slot_terisi' => $slotTerisi,
                    'sisa_slot' => $sisaSlot,
                    'slot_penuh' => $sisaSlot <= 0,
                    'total_hadiah' => $pengajuan->total_hadiah,
                    'hadiah_lainnya' => $pengajuan->hadiahLainnya
    ->map(fn ($h) => [
        'nama_hadiah' => $h->nama_hadiah,
        'keterangan' => $h->keterangan,
    ])
    ->values(),
                    'jadwal_pendaftaran_tutup' => $pengajuan->jadwal_pendaftaran_tutup,
                    'jadwal_main' => $pengajuan->jadwal_main,
                    'deskripsi_turnamen' => $pengajuan->deskripsi_turnamen,
                    'deskripsi_lokasi' => $pengajuan->deskripsi_lokasi,

                    'pendaftaran_terbuka' => $pengajuan->jadwal_pendaftaran_tutup
                        ? now()->lt($pengajuan->jadwal_pendaftaran_tutup)
                        : true,

                    'game' => $pengajuan->game
                        ? [
                            'id_game' => $pengajuan->game->id_game,
                            'nama_game' => $pengajuan->game->nama_game,
                            'kategoris' => $pengajuan->game->kategoris->map(fn ($k) => [
                                'id_kategori' => $k->id_kategori,
                                'nama_kategori' => $k->nama_kategori,
                            ])->values(),
                        ]
                        : null,

                    'kota' => $pengajuan->kota,

                    'pendanaan' => $pengajuan->pendanaan
                        ? [
                            'jenis_biaya' => $pengajuan->pendanaan->jenis_biaya,
                            'biaya_pendaftaran' => $pengajuan->pendanaan->biaya_pendaftaran,
                        ]
                        : null,

                    // Hanya nama sponsor, kontak sponsor tidak dikirim.
                    'sponsor' => Collection::wrap($pengajuan->sponsor)
                        ->pluck('nama_sponsor')
                        ->filter()
                        ->values(),

                    'pembayaran' => $pengajuan->pembayaran
                        ? [
                            'metode_pembayaran' => $pengajuan->pembayaran->metode_pembayaran,
                            'qris' => $pengajuan->pembayaran->qris,
                            'no_rekening' => $pengajuan->pembayaran->no_rekening,
                        ]
                        : null,
                ],
                // true = user login adalah penyelenggara turnamen ini,
                // FE menyembunyikan form/tombol daftar.
                'is_penyelenggara' => app(PendaftaranTurnamenService::class)
                    ->isPenyelenggara($turnamen, $request->user()?->player),

                // Pendaftaran aktif yang memuat Player login (null kalau belum).
                'pendaftaran_saya' => $this->pendaftaranSaya($request, $turnamen->id_turnamen),
            ],
        ]);
    }


     /**
     * Pendaftaran terakhir yang roster-nya memuat Player login,
     * dipakai FE untuk tombol Daftar / Lihat Pendaftaran (US23, US24).
     */
    private function pendaftaranSaya(Request $request, int $idTurnamen): ?array
    {
        $player = $request->user()?->player;

        if (!$player) {
            return null;
        }

        $pendaftaran = PendaftaranTurnamen::with(['squad', 'pendaftar.user'])
            ->where('id_turnamen', $idTurnamen)
            ->whereHas('anggota', fn ($q) => $q->where('id_player', $player->id_player))
            ->orderByRaw("CASE WHEN status_pendaftaran IN ('menunggu', 'diterima') THEN 0 ELSE 1 END")
            ->latest('tanggal_daftar')
            ->first();

        if (!$pendaftaran) {
            return null;
        }

        return [
            'id_pendaftaran' => $pendaftaran->id_pendaftaran,
            'status_pendaftaran' => $pendaftaran->status_pendaftaran,
            'alasan_penolakan' => $pendaftaran->alasan_penolakan,
            'squad' => [
                'id_squad' => $pendaftaran->id_squad,
                'nama_squad' => $pendaftaran->squad?->nama_squad,
            ],
            'pendaftar' => [
                'id_player' => $pendaftaran->id_player,
                'username' => $pendaftaran->pendaftar?->user?->username,
            ],
            'didaftarkan_oleh_saya' => (int) $pendaftaran->id_player === (int) $player->id_player,
        ];
    }
}