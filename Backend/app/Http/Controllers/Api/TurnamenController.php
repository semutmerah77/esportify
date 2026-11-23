<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Turnamen;
use App\Models\PendaftaranTurnamen;
use App\Models\Player;
use App\Models\Penyelenggara;
use App\Models\PengajuanPembatalanTurnamen;
use App\Services\PembatalanTurnamenService;
use App\Services\BracketService;
use App\Services\PendaftaranTurnamenService;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Carbon\Carbon;

class TurnamenController extends Controller
{
    /**
     * Satu aturan status untuk list, kelolaan, dan detail.
     *
     * Status disimpan di turnamen.status (keputusan SA Sprint 2):
     * - "berlangsung" diset sistem saat jadwal_main tiba, semua
     *   pendaftaran sudah diverifikasi, dan bracket dipublikasikan
     *   (BracketService::terapkanBerlangsung, scheduler turnamen:mulai).
     * - "selesai" diset saat Penyelenggara menetapkan hasil akhir.
     * Selain itu "pendaftaran", walaupun jadwal_main sudah lewat.
     */
    private function hitungStatus($jadwalMain, ?string $statusTersimpan = null): string
    {
        // Status disimpan di turnamen.status (keputusan SA Sprint 2):
        // "berlangsung" diset BracketService::terapkanBerlangsung,
        // "selesai" saat hasil akhir ditetapkan.
        return in_array($statusTersimpan, ['berlangsung', 'selesai', 'dibatalkan'], true)
            ? $statusTersimpan
            : 'pendaftaran';
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
             ->withCount([
                'pendaftaran as jumlah_terdaftar' => fn ($q) => $q->aktif(),
            ])
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
                    'status' => $this->hitungStatus($item->jadwalMainAktif(), $item->status),
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

                        // Jadwal AKTIF (hasil perpanjangan kalau ada, PB-24)
                        'jadwal_pendaftaran_tutup' => $item->jadwalPendaftaranTutupAktif(),
                        'jadwal_main' => $item->jadwalMainAktif(),
                        'jadwal_diperpanjang' => $item->sudahDiperpanjang(),
                        'deskripsi_lokasi' => $pengajuan->deskripsi_lokasi,

                        'pendaftaran_terbuka' => $item->jadwalPendaftaranTutupAktif()
                            ? now()->lt($item->jadwalPendaftaranTutupAktif())
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
                if (in_array($t['status'], ['selesai', 'dibatalkan'], true)) {
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
                'pengajuanPembatalanTerakhir',
            ])
            // Bracket, jumlah menunggu/diterima, dan slot terisi dimuat sekaligus
            // (tidak query per turnamen).
            ->tap(fn ($q) => app(BracketService::class)->muatInfoPersiapan($q))
            ->orderByDesc('created_at')
            ->get()
            ->map(function ($item) {
                $pengajuan = $item->pengajuan;

                return [
                    'id_turnamen' => $item->id_turnamen,
                    'status' => $this->hitungStatus($item->jadwalMainAktif(), $item->status),
                    'created_at' => $item->created_at,
                 ] + app(BracketService::class)->infoPersiapan($item) + [

                   'pengajuan_pembatalan_terakhir' => $this->formatPembatalanTerakhir(
                        $item->pengajuanPembatalanTerakhir
                    ),

                    'pengajuan' => [
                        'id_pengajuan' => $pengajuan->id_pengajuan,
                        'nama_turnamen' => $pengajuan->nama_turnamen,
                        'nama_penyelenggara' => $pengajuan->nama_penyelenggara,
                        'nama_instansi' => $pengajuan->nama_instansi,
                        'poster' => $pengajuan->poster,
                        'tipe_turnamen' => $pengajuan->tipe_turnamen,
                        'slot' => $pengajuan->slot,
                        'slot_terisi' => $item->slotTerisi(),
                        // Jadwal AKTIF (hasil perpanjangan kalau ada, PB-24)
                        'jadwal_pendaftaran_tutup' => $item->jadwalPendaftaranTutupAktif(),
                        'jadwal_main' => $item->jadwalMainAktif(),
                        'jadwal_diperpanjang' => $item->sudahDiperpanjang(),
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
            'pengajuan.player:id_player,id_user,avatar',
            'pengajuan.player.user:id_user,username',
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
        $status = $this->hitungStatus($turnamen->jadwalMainAktif(), $turnamen->status);
        
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
                // Indikator "Persiapan tertunda" (tidak disimpan di DB)
                ...app(BracketService::class)->infoPersiapan($turnamen),
                'created_at' => $turnamen->created_at,

                'pengajuan' => [
                    'id_pengajuan' => $pengajuan->id_pengajuan,
                    'nama_turnamen' => $pengajuan->nama_turnamen,
                    'nama_penyelenggara' => $pengajuan->nama_penyelenggara,
                    // Nama instansi tampil publik. Nomor instansi sengaja
                    // tidak dikirim (hanya untuk admin dan pengaju).
                    'nama_instansi' => $pengajuan->nama_instansi,
                    'username_penyelenggara' => $pengajuan->player?->user?->username,
                    'avatar_penyelenggara'   => $pengajuan->player?->avatar
                    ? asset('storage/' . $pengajuan->player->avatar)
                    : null,
                    'poster' => $pengajuan->poster,
                    'tipe_turnamen' => $pengajuan->tipe_turnamen,
                    // Jumlah pemain per squad (diatur penyelenggara)
                    'min_roster' => $pengajuan->min_roster,
                    'maks_roster' => $pengajuan->maks_roster,
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
                    // Jadwal AKTIF (hasil perpanjangan kalau ada, PB-24)
                    'jadwal_pendaftaran_tutup' => $turnamen->jadwalPendaftaranTutupAktif(),
                    'jadwal_main' => $turnamen->jadwalMainAktif(),
                    'jadwal_diperpanjang' => $turnamen->sudahDiperpanjang(),
                    'deskripsi_turnamen' => $pengajuan->deskripsi_turnamen,
                    'deskripsi_lokasi' => $pengajuan->deskripsi_lokasi,

                    'pendaftaran_terbuka' => $turnamen->jadwalPendaftaranTutupAktif()
                        ? now()->lt($turnamen->jadwalPendaftaranTutupAktif())
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

    /**
     * PB-25: ringkasan pengajuan pembatalan terakhir untuk kartu turnamen kelolaan.
     * null kalau turnamen belum pernah diajukan pembatalan.
     */
    private function formatPembatalanTerakhir(?PengajuanPembatalanTurnamen $p): ?array
    {
        if (!$p) {
            return null;
        }

        return [
            'id_pengajuan_pembatalan' => $p->id_pengajuan_pembatalan,
            'status_pengajuan' => $p->status_pengajuan,
            'alasan_pembatalan' => $p->alasan_pembatalan,
            'label_alasan_pembatalan' => app(PembatalanTurnamenService::class)
                ->labelAlasan($p->alasan_pembatalan),
            'tanggal_pengajuan' => $p->tanggal_pengajuan?->toIso8601String(),
            'tanggal_verifikasi' => $p->tanggal_verifikasi?->toIso8601String(),
            // Catatan admin hanya relevan kalau pengajuan ditolak.
            'catatan_admin' => $p->status_pengajuan === PengajuanPembatalanTurnamen::STATUS_DITOLAK
                ? $p->catatan_admin
                : null,
        ];
    }
}
