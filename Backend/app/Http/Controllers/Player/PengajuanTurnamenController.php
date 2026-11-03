<?php

namespace App\Http\Controllers\Player;

use App\Http\Controllers\Controller;
use App\Models\PengajuanTurnamen;
use App\Models\SumberPendanaan;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PengajuanTurnamenController extends Controller
{
    /**
     * Menampilkan semua pengajuan milik Player yang sedang login.
     */
    public function index(Request $request)
    {
        $player = $request->user()->player;

        if (!$player) {
            return response()->json([
                'success' => false,
                'message' => 'Data Player tidak ditemukan.',
            ], 404);
        }

        $pengajuan = PengajuanTurnamen::with([
            'game',
            'kota.provinsi',
            'pendanaan',
            'sumberPendanaan',
            'turnamen',
        ])
            ->where('id_player', $player->id_player)
            ->latest()
            ->get();

        $pengajuan->makeHidden(['ktp']);

        return response()->json([
            'success' => true,
            'message' => 'Daftar pengajuan turnamen berhasil diambil.',
            'data' => $pengajuan,
        ]);
    }

    /**
     * Menampilkan detail pengajuan milik Player.
     */
    public function show(Request $request, $id)
    {
        $player = $request->user()->player;

        if (!$player) {
            return response()->json([
                'success' => false,
                'message' => 'Data Player tidak ditemukan.',
            ], 404);
        }

        $pengajuan = PengajuanTurnamen::with([
            'game',
            'kota.provinsi',
            'pendanaan',
            'pembayaran',
            'sponsor',
            'rincian',
            'sumberPendanaan',
            'turnamen',
        ])
            ->where('id_player', $player->id_player)
            ->where('id_pengajuan', $id)
            ->first();

        if (!$pengajuan) {
            return response()->json([
                'success' => false,
                'message' => 'Pengajuan turnamen tidak ditemukan.',
            ], 404);
        }

        $pengajuan->makeHidden(['ktp']);

        return response()->json([
            'success' => true,
            'message' => 'Detail pengajuan turnamen berhasil diambil.',
            'data' => $pengajuan,
        ]);
    }

    public function lihatKtp(Request $request, $id)
    {
        $player = $request->user()->player;

        if (!$player) {
            return response()->json([
                'success' => false,
                'message' => 'Profil player tidak ditemukan.'
            ], 404);
        }

        $pengajuan = PengajuanTurnamen::where('id_player', $player->id_player)
            ->where('id_pengajuan', $id)
            ->first();

        if (!$pengajuan) {
            return response()->json([
                'success' => false,
                'message' => 'Pengajuan turnamen tidak ditemukan.'
            ], 404);
        }

        $path = $pengajuan->ktp;

        if (!$path || !Storage::disk('local')->exists($path)) {
            return response()->json([
                'success' => false,
                'message' => 'File KTP tidak ditemukan.'
            ], 404);
        }

        return response()->file(
            Storage::disk('local')->path($path),
            [
                'Content-Type' => Storage::disk('local')->mimeType($path),
                'Cache-Control' => 'private, no-store',
                'X-Content-Type-Options' => 'nosniff',
            ]
        );
    }

    /**
     * Membuat pengajuan turnamen baru.
     */
    public function store(Request $request)
    {
        $player = $request->user()->player;

        if (!$player) {
            return response()->json([
                'success' => false,
                'message' => 'Data Player tidak ditemukan.',
            ], 404);
        }

        $validated = $request->validate([
            'poster' => [
                'required',
                'image',
                'mimes:jpg,jpeg,png,webp',
                'max:5120',
            ],
            'nama_turnamen' => ['required', 'string', 'max:150'],
            'nama_penanggung_jawab' => ['required', 'string', 'max:150'],
            'perwakilan_instansi' => ['nullable', 'boolean'],
            'nama_instansi' => [
                'nullable',
                'required_if:perwakilan_instansi,1',
                'string',
                'max:150',
            ],
            'nomor_instansi' => [
                'nullable',
                'required_if:perwakilan_instansi,1',
                'string',
                'regex:/^\+?[0-9\s\-]{8,20}$/',
            ],
            'id_game' => ['required', 'exists:games,id_game'],
            'tipe_turnamen' => [
                'required',
                Rule::in(['online', 'offline']),
            ],
            'id_kota' => [
                'nullable',
                'required_if:tipe_turnamen,offline',
                'integer',
                'exists:kota,id_kota',
            ],
            'deskripsi_lokasi' => ['nullable', 'string'],
            'slot' => ['required', 'integer', 'min:1'],
            'jadwal_pendaftaran_tutup' => ['required', 'date'],
            'jadwal_main' => [
                'required',
                'date',
                'after:jadwal_pendaftaran_tutup',
            ],
            'deskripsi_turnamen' => ['required', 'string'],
            'total_hadiah' => ['required', 'numeric', 'min:0'],
            'ktp' => [
                'required',
                'file',
                'mimes:jpg,jpeg,png,pdf',
                'max:5120',
            ],
            'setuju_pertanggungjawaban' => ['required', 'accepted'],

            // Kolom lama (narasi). Tidak lagi dikirim frontend, dibiarkan opsional.
            'rincian_pendanaan' => ['nullable', 'string'],

            'sumber_pendanaan' => ['required', 'array', 'min:1'],
            'sumber_pendanaan.*' => [
                'required',
                'distinct',
                'exists:sumber_pendanaan,id_sumber',
            ],

            'sponsor' => ['nullable', 'array', 'min:1', 'max:20'],
            'sponsor.*.nama_sponsor' => ['required', 'string', 'max:255'],
            'sponsor.*.kontak_sponsor' => ['required', 'string', 'max:255'],

            'rincian' => ['required', 'array', 'min:2', 'max:20'],
            'rincian.*.peruntukanDana' => ['required', 'string', 'max:100'],
            'rincian.*.keterangan' => ['nullable', 'string', 'max:255'],
            'rincian.*.nominal' => ['required', 'numeric', 'min:1'],

            'jenis_biaya' => [
                'required',
                Rule::in(['gratis', 'berbayar']),
            ],
            'biaya_pendaftaran' => [
                'nullable',
                'required_if:jenis_biaya,berbayar',
                'numeric',
                'min:0',
            ],
            'metode_pembayaran' => [
                'nullable',
                'required_if:jenis_biaya,berbayar',
                Rule::in(['qris', 'transfer', 'qris_transfer']),
            ],
            'qris' => [
                'nullable',
                'required_if:metode_pembayaran,qris,qris_transfer',
                'image',
                'mimes:jpg,jpeg,png,webp',
                'max:5120',
            ],
            'no_rekening' => [
                'nullable',
                'required_if:metode_pembayaran,transfer,qris_transfer',
                'string',
                'max:50',
            ],
        ]);

        $this->validateSponsorSelection(
            $validated['sumber_pendanaan'],
            $validated['sponsor'] ?? []
        );

        $this->validateSchedule(
            $validated['jadwal_pendaftaran_tutup'],
            $validated['jadwal_main']
        );

        // Apakah penanggung jawab mewakili instansi.
        $perwakilan = filter_var(
            $validated['perwakilan_instansi'] ?? false,
            FILTER_VALIDATE_BOOLEAN
        );

        $posterPath = null;
        $ktpPath = null;
        $qrisPath = null;

        try {
            $posterPath = $request->file('poster')
                ->store('poster-turnamen', 'public');

            // KTP disimpan pada disk local yang tidak dapat diakses publik.
            $ktpPath = $request->file('ktp')
                ->store('ktp-pengajuan', 'local');

            // Foto QRIS merupakan gambar yang diunggah oleh Player.
            if ($request->hasFile('qris')) {
                $qrisPath = $request->file('qris')
                    ->store('qris-pengajuan', 'public');
            }

            $pengajuan = DB::transaction(function () use (
                $validated,
                $player,
                $posterPath,
                $ktpPath,
                $qrisPath,
                $perwakilan
            ) {
                /*
                 * Kunci baris Player agar dua request pengajuan
                 * bersamaan tidak melewati batas kuota.
                 */
                DB::table('players')
                    ->where('id_player', $player->id_player)
                    ->lockForUpdate()
                    ->first();

                $jumlahPengajuanAktif = PengajuanTurnamen::where(
                    'id_player',
                    $player->id_player
                )
                    ->whereIn('status', [
                        'Menunggu Verifikasi',
                        'Sedang diedit',
                        'Sedang ditinjau',
                        'Revisi',
                    ])
                    ->count();

                if ($jumlahPengajuanAktif >= 3) {
                    throw ValidationException::withMessages([
                        'pengajuan' => 'Kamu sudah mencapai batas maksimal 3 pengajuan turnamen aktif.',
                    ]);
                }

                $pengajuan = PengajuanTurnamen::create([
                    'id_player' => $player->id_player,
                    'id_game' => $validated['id_game'],
                    'poster' => $posterPath,
                    'nama_turnamen' => $validated['nama_turnamen'],
                    'nama_penanggung_jawab' => $validated['nama_penanggung_jawab'],
                    'nama_instansi' => $perwakilan
                        ? $validated['nama_instansi']
                        : null,
                    'nomor_instansi' => $perwakilan
                        ? $validated['nomor_instansi']
                        : null,
                    'tipe_turnamen' => $validated['tipe_turnamen'],
                    'id_kota' => $validated['tipe_turnamen'] === 'offline'
                        ? ($validated['id_kota'] ?? null)
                        : null,
                    'deskripsi_lokasi' => $validated['tipe_turnamen'] === 'offline'
                        ? ($validated['deskripsi_lokasi'] ?? null)
                        : null,
                    'slot' => $validated['slot'],
                    'jadwal_pendaftaran_tutup' => $validated['jadwal_pendaftaran_tutup'],
                    'jadwal_main' => $validated['jadwal_main'],
                    'deskripsi_turnamen' => $validated['deskripsi_turnamen'],
                    'total_hadiah' => $validated['total_hadiah'],
                    'ktp' => $ktpPath,
                    'setuju_pertanggungjawaban' => true,
                    'rincian_pendanaan' => $validated['rincian_pendanaan'] ?? null,
                    'status' => 'Menunggu Verifikasi',
                ]);

                $pengajuan->sumberPendanaan()->sync(
                    $validated['sumber_pendanaan']
                );

                foreach ($validated['sponsor'] ?? [] as $sponsor) {
                    $pengajuan->sponsor()->create([
                        'nama_sponsor' => $sponsor['nama_sponsor'],
                        'kontak_sponsor' => $sponsor['kontak_sponsor'],
                    ]);
                }

                foreach ($validated['rincian'] as $r) {
                    $pengajuan->rincian()->create([
                        'peruntukanDana' => $r['peruntukanDana'],
                        'keterangan' => $r['keterangan'] ?? null,
                        'nominal' => $r['nominal'],
                    ]);
                }

                $pengajuan->pendanaan()->create([
                    'jenis_biaya' => $validated['jenis_biaya'],
                    'biaya_pendaftaran' => $validated['jenis_biaya'] === 'berbayar'
                        ? $validated['biaya_pendaftaran']
                        : null,
                ]);

                if ($validated['jenis_biaya'] === 'berbayar') {
                    $pengajuan->pembayaran()->create([
                        'metode_pembayaran' => $validated['metode_pembayaran'],
                        'qris' => $qrisPath,
                        'no_rekening' => $validated['no_rekening'] ?? null,
                    ]);
                }

                return $pengajuan;
            });

            return response()->json([
                'success' => true,
                'message' => 'Pengajuan turnamen berhasil dikirim dan menunggu verifikasi.',
                'data' => $pengajuan->load([
                    'game',
                    'kota.provinsi',
                    'pendanaan',
                    'pembayaran',
                    'sponsor',
                    'rincian',
                    'sumberPendanaan',
                ])->makeHidden(['ktp']),
            ], 201);
        } catch (\Throwable $e) {
            $this->deleteStoredFile('public', $posterPath);
            $this->deleteStoredFile('local', $ktpPath);
            $this->deleteStoredFile('public', $qrisPath);

            throw $e;
        }
    }

    /**
     * Menandai bahwa Player mulai mengedit pengajuan.
     *
     * Edit biasa: 5 menit sejak created_at.
     * Revisi: 5 menit sejak revisi_diminta_pada.
     */
    public function startEdit(Request $request, $id)
    {
        $player = $request->user()->player;

        if (!$player) {
            return response()->json([
                'success' => false,
                'message' => 'Data Player tidak ditemukan.',
            ], 404);
        }

        $pengajuan = PengajuanTurnamen::where('id_player', $player->id_player)
            ->where('id_pengajuan', $id)
            ->first();

        if (!$pengajuan) {
            return response()->json([
                'success' => false,
                'message' => 'Pengajuan turnamen tidak ditemukan.',
            ], 404);
        }

        $isRevisi = $pengajuan->status === 'Revisi'
            || (
                $pengajuan->status === 'Sedang diedit'
                && !empty($pengajuan->revisi_diminta_pada)
            );

        if (
            $pengajuan->status === 'Revisi'
            && empty($pengajuan->revisi_diminta_pada)
        ) {
            return response()->json([
                'success' => false,
                'message' => 'Waktu permintaan revisi belum tercatat. Silakan hubungi Admin.',
            ], 422);
        }

        if (!in_array($pengajuan->status, [
            'Menunggu Verifikasi',
            'Revisi',
            'Sedang diedit',
        ], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Pengajuan ini tidak dapat diedit berdasarkan status saat ini.',
            ], 422);
        }

        $waktuAcuan = $isRevisi
            ? Carbon::parse($pengajuan->revisi_diminta_pada)
            : Carbon::parse($pengajuan->created_at);

        $batasWaktuEdit = $waktuAcuan->copy()->addMinutes(5);

        if (now()->greaterThan($batasWaktuEdit)) {
            $pengajuan->status = $isRevisi
                ? 'Ditolak'
                : 'Menunggu Verifikasi';

            $pengajuan->save();

            return response()->json([
                'success' => false,
                'message' => $isRevisi
                    ? 'Batas waktu revisi sudah habis. Pengajuan otomatis ditolak.'
                    : 'Waktu untuk mengedit pengajuan sudah habis.',
            ], 422);
        }

        if ($pengajuan->status !== 'Sedang diedit') {
            $pengajuan->status = 'Sedang diedit';
            $pengajuan->save();
        }

        return response()->json([
            'success' => true,
            'message' => $isRevisi
                ? 'Pengajuan revisi berhasil masuk ke mode edit.'
                : 'Pengajuan berhasil masuk ke mode edit.',
            'data' => [
                'id_pengajuan' => $pengajuan->id_pengajuan,
                'status' => $pengajuan->status,
                'batas_waktu_edit' => $batasWaktuEdit->toDateTimeString(),
                'is_revisi' => $isRevisi,
                'alasan_admin' => $pengajuan->alasan_admin,
            ],
        ]);
    }

    /**
     * Memperbarui pengajuan yang sedang diedit oleh Player.
     */
    public function update(Request $request, $id)
    {
        $player = $request->user()->player;

        if (!$player) {
            return response()->json([
                'success' => false,
                'message' => 'Data Player tidak ditemukan.',
            ], 404);
        }

        $pengajuan = PengajuanTurnamen::where('id_player', $player->id_player)
            ->where('id_pengajuan', $id)
            ->first();

        if (!$pengajuan) {
            return response()->json([
                'success' => false,
                'message' => 'Pengajuan turnamen tidak ditemukan.',
            ], 404);
        }

        if ($pengajuan->status !== 'Sedang diedit') {
            return response()->json([
                'success' => false,
                'message' => 'Pengajuan tidak sedang dalam mode edit.',
            ], 422);
        }

        $isRevisi = !empty($pengajuan->revisi_diminta_pada);

        $waktuAcuan = $isRevisi
            ? Carbon::parse($pengajuan->revisi_diminta_pada)
            : Carbon::parse($pengajuan->created_at);

        $batasWaktuEdit = $waktuAcuan->copy()->addMinutes(5);

        // Jika waktu revisi habis, pengajuan otomatis ditolak.
        // Jika edit biasa habis, status dikembalikan ke antrean verifikasi.
        if (now()->greaterThan($batasWaktuEdit)) {
            $pengajuan->status = $isRevisi
                ? 'Ditolak'
                : 'Menunggu Verifikasi';

            $pengajuan->save();

            return response()->json([
                'success' => false,
                'message' => $isRevisi
                    ? 'Batas waktu revisi sudah habis. Pengajuan otomatis ditolak.'
                    : 'Waktu untuk mengedit pengajuan sudah habis.',
            ], 422);
        }

        $validated = $request->validate([
            'poster' => [
                'sometimes',
                'image',
                'mimes:jpg,jpeg,png,webp',
                'max:5120',
            ],

            'nama_turnamen' => ['sometimes', 'required', 'string', 'max:150'],
            'nama_penanggung_jawab' => ['sometimes', 'required', 'string', 'max:150'],
            'perwakilan_instansi' => ['sometimes', 'boolean'],
            'nama_instansi' => [
                'nullable',
                'required_if:perwakilan_instansi,1',
                'string',
                'max:150',
            ],
            'nomor_instansi' => [
                'nullable',
                'required_if:perwakilan_instansi,1',
                'string',
                'regex:/^\+?[0-9\s\-]{8,20}$/',
            ],
            'id_game' => ['sometimes', 'required', 'exists:games,id_game'],

            'tipe_turnamen' => [
                'sometimes',
                'required',
                Rule::in(['online', 'offline']),
            ],

            'id_kota' => ['sometimes', 'nullable', 'integer', 'exists:kota,id_kota'],
            'deskripsi_lokasi' => ['nullable', 'string'],

            'slot' => ['sometimes', 'required', 'integer', 'min:1'],
            'jadwal_pendaftaran_tutup' => ['sometimes', 'required', 'date'],
            'jadwal_main' => ['sometimes', 'required', 'date'],
            'deskripsi_turnamen' => ['sometimes', 'required', 'string'],
            'total_hadiah' => ['sometimes', 'required', 'numeric', 'min:0'],

            'ktp' => [
                'sometimes',
                'file',
                'mimes:jpg,jpeg,png,pdf',
                'max:5120',
            ],

            'setuju_pertanggungjawaban' => ['sometimes', 'accepted'],

            // Kolom lama (narasi). Tidak lagi dikirim frontend, dibiarkan opsional.
            'rincian_pendanaan' => ['nullable', 'string'],

            'sumber_pendanaan' => ['sometimes', 'required', 'array', 'min:1'],
            'sumber_pendanaan.*' => [
                'required',
                'distinct',
                'exists:sumber_pendanaan,id_sumber',
            ],

            'sponsor' => ['sometimes', 'nullable', 'array', 'max:20'],
            'sponsor.*.nama_sponsor' => [
                'required_with:sponsor',
                'string',
                'max:255',
            ],
            'sponsor.*.kontak_sponsor' => [
                'required_with:sponsor',
                'string',
                'max:255',
            ],

            'rincian' => ['sometimes', 'required', 'array', 'min:2', 'max:20'],
            'rincian.*.peruntukanDana' => [
                'required_with:rincian',
                'string',
                'max:100',
            ],
            'rincian.*.keterangan' => ['nullable', 'string', 'max:255'],
            'rincian.*.nominal' => [
                'required_with:rincian',
                'numeric',
                'min:1',
            ],

            'jenis_biaya' => [
                'sometimes',
                'required',
                Rule::in(['gratis', 'berbayar']),
            ],

            'biaya_pendaftaran' => [
                'nullable',
                'required_if:jenis_biaya,berbayar',
                'numeric',
                'min:0',
            ],

            'metode_pembayaran' => [
                'nullable',
                'required_if:jenis_biaya,berbayar',
                Rule::in(['qris', 'transfer', 'qris_transfer']),
            ],

            'qris' => [
                'nullable',
                'image',
                'mimes:jpg,jpeg,png,webp',
                'max:5120',
            ],

            'no_rekening' => ['nullable', 'string', 'max:50'],
        ]);

        $oldPoster = $pengajuan->poster;
        $oldKtp = $pengajuan->ktp;
        $oldQris = $pengajuan->pembayaran?->qris;

        $newPoster = null;
        $newKtp = null;
        $newQris = null;

        // Ambil nilai relasi yang sudah ada jika tidak dikirim ulang.
        $pendanaanLama = $pengajuan->pendanaan;
        $pembayaranLama = $pengajuan->pembayaran;

        $jenisBiaya = $validated['jenis_biaya']
            ?? $pendanaanLama?->jenis_biaya
            ?? 'gratis';

        $metodePembayaran = $validated['metode_pembayaran']
            ?? $pembayaranLama?->metode_pembayaran;

        $sumberPendanaan = $validated['sumber_pendanaan']
            ?? $pengajuan->sumberPendanaan()
                ->pluck('sumber_pendanaan.id_sumber')
                ->toArray();

        // array_key_exists membedakan "tidak dikirim" dan "dikirim kosong".
        $sponsor = array_key_exists('sponsor', $validated)
            ? ($validated['sponsor'] ?? [])
            : $pengajuan->sponsor()
                ->get()
                ->map(fn ($item) => [
                    'nama_sponsor' => $item->nama_sponsor,
                    'kontak_sponsor' => $item->kontak_sponsor,
                ])
                ->toArray();

        $tipeTurnamen = $validated['tipe_turnamen']
            ?? $pengajuan->tipe_turnamen;

        // Turnamen offline wajib memiliki kota. Saat berpindah dari online ke offline,
        // Player harus memilih kota; untuk online, lokasi akan dikosongkan.
        if (
            $tipeTurnamen === 'offline'
            && empty($validated['id_kota'] ?? $pengajuan->id_kota)
        ) {
            throw ValidationException::withMessages([
                'id_kota' => 'Kota wajib dipilih untuk turnamen offline.',
            ]);
        }

        $this->validateSponsorSelection(
            $sumberPendanaan,
            $sponsor
        );

        $jadwalTutup = $validated['jadwal_pendaftaran_tutup']
            ?? $pengajuan->jadwal_pendaftaran_tutup;

        $jadwalMain = $validated['jadwal_main']
            ?? $pengajuan->jadwal_main;

        $this->validateSchedule($jadwalTutup, $jadwalMain);

        try {
            if ($request->hasFile('poster')) {
                $newPoster = $request->file('poster')
                    ->store('poster-turnamen', 'public');
            }

            if ($request->hasFile('ktp')) {
                $newKtp = $request->file('ktp')
                    ->store('ktp-pengajuan', 'local');
            }

            if ($request->hasFile('qris')) {
                $newQris = $request->file('qris')
                    ->store('qris-pengajuan', 'public');
            }

            DB::transaction(function () use (
                $validated,
                $pengajuan,
                $tipeTurnamen,
                $jenisBiaya,
                $metodePembayaran,
                $sumberPendanaan,
                $newPoster,
                $newKtp,
                $newQris,
                $isRevisi
            ) {
                $fieldPengajuan = [
                    'nama_turnamen',
                    'nama_penanggung_jawab',
                    'id_game',
                    'slot',
                    'jadwal_pendaftaran_tutup',
                    'jadwal_main',
                    'deskripsi_turnamen',
                    'total_hadiah',
                    'rincian_pendanaan',
                ];

                $dataPengajuan = [];

                foreach ($fieldPengajuan as $field) {
                    if (array_key_exists($field, $validated)) {
                        $dataPengajuan[$field] = $validated[$field];
                    }
                }

                // Perwakilan instansi: isi kalau dicentang, kosongkan kalau tidak.
                if (array_key_exists('perwakilan_instansi', $validated)) {
                    $perwakilan = filter_var(
                        $validated['perwakilan_instansi'],
                        FILTER_VALIDATE_BOOLEAN
                    );

                    $dataPengajuan['nama_instansi'] = $perwakilan
                        ? ($validated['nama_instansi'] ?? null)
                        : null;
                    $dataPengajuan['nomor_instansi'] = $perwakilan
                        ? ($validated['nomor_instansi'] ?? null)
                        : null;
                }

                if (array_key_exists('tipe_turnamen', $validated)) {
                    $dataPengajuan['tipe_turnamen'] = $tipeTurnamen;
                }

                if ($tipeTurnamen === 'offline') {
                    if (array_key_exists('id_kota', $validated)) {
                        $dataPengajuan['id_kota'] = $validated['id_kota'];
                    }

                    if (array_key_exists('deskripsi_lokasi', $validated)) {
                        $dataPengajuan['deskripsi_lokasi'] = $validated['deskripsi_lokasi'];
                    }
                } else {
                    $dataPengajuan['id_kota'] = null;
                    $dataPengajuan['deskripsi_lokasi'] = null;
                }

                if ($newPoster) {
                    $dataPengajuan['poster'] = $newPoster;
                }

                if ($newKtp) {
                    $dataPengajuan['ktp'] = $newKtp;
                }

                if (array_key_exists('setuju_pertanggungjawaban', $validated)) {
                    $dataPengajuan['setuju_pertanggungjawaban'] = true;
                }

                // Setelah berhasil diedit, pengajuan kembali ke antrean verifikasi.
                $dataPengajuan['status'] = 'Menunggu Verifikasi';

                // Jika Player berhasil mengirim ulang revisi,
                // catat waktu pengajuan ulang.
                if ($isRevisi) {
                    $dataPengajuan['diajukan_ulang_pada'] = now();
                }

                // Penanda waktu revisi dibersihkan setelah revisi selesai.
                $dataPengajuan['revisi_diminta_pada'] = null;

                $pengajuan->update($dataPengajuan);

                if (array_key_exists('sumber_pendanaan', $validated)) {
                    $pengajuan->sumberPendanaan()->sync($sumberPendanaan);
                }

                if (array_key_exists('sponsor', $validated)) {
                    $pengajuan->sponsor()->delete();

                    foreach ($validated['sponsor'] ?? [] as $sponsor) {
                        $pengajuan->sponsor()->create([
                            'nama_sponsor' => $sponsor['nama_sponsor'],
                            'kontak_sponsor' => $sponsor['kontak_sponsor'],
                        ]);
                    }
                }

                if (array_key_exists('rincian', $validated)) {
                    $pengajuan->rincian()->delete();

                    foreach ($validated['rincian'] as $r) {
                        $pengajuan->rincian()->create([
                            'peruntukanDana' => $r['peruntukanDana'],
                            'keterangan' => $r['keterangan'] ?? null,
                            'nominal' => $r['nominal'],
                        ]);
                    }
                }

                if (
                    array_key_exists('jenis_biaya', $validated)
                    || array_key_exists('biaya_pendaftaran', $validated)
                ) {
                    $pengajuan->pendanaan()->updateOrCreate(
                        ['id_pengajuan' => $pengajuan->id_pengajuan],
                        [
                            'jenis_biaya' => $jenisBiaya,
                            'biaya_pendaftaran' => $jenisBiaya === 'berbayar'
                                ? ($validated['biaya_pendaftaran']
                                    ?? $pengajuan->pendanaan?->biaya_pendaftaran)
                                : null,
                        ]
                    );
                }

                if ($jenisBiaya === 'gratis') {
                    $pengajuan->pembayaran()->delete();
                } elseif (
                    array_key_exists('metode_pembayaran', $validated)
                    || array_key_exists('no_rekening', $validated)
                    || $newQris
                    || array_key_exists('jenis_biaya', $validated)
                ) {
                    $pembayaranLama = $pengajuan->pembayaran;

                    $gunakanQris = in_array(
                        $metodePembayaran,
                        ['qris', 'qris_transfer']
                    );

                    $gunakanTransfer = in_array(
                        $metodePembayaran,
                        ['transfer', 'qris_transfer']
                    );

                    $pengajuan->pembayaran()->updateOrCreate(
                        ['id_pengajuan' => $pengajuan->id_pengajuan],
                        [
                            'metode_pembayaran' => $metodePembayaran,
                            'qris' => $gunakanQris
                                ? ($newQris ?? $pembayaranLama?->qris)
                                : null,
                            'no_rekening' => $gunakanTransfer
                                ? ($validated['no_rekening']
                                    ?? $pembayaranLama?->no_rekening)
                                : null,
                        ]
                    );
                }
            });

            // Hapus file lama hanya setelah transaksi database berhasil.
            if ($newPoster && $oldPoster) {
                $this->deleteStoredFile('public', $oldPoster);
            }

            if ($newKtp && $oldKtp) {
                $this->deleteStoredFile('local', $oldKtp);
            }

            // QRIS lama dihapus jika diganti atau metode menjadi gratis/tidak menggunakannya.
            $qrisMasihDigunakan = $jenisBiaya === 'berbayar'
                && in_array($metodePembayaran, ['qris', 'qris_transfer']);

            if ($oldQris && ($newQris || !$qrisMasihDigunakan)) {
                $this->deleteStoredFile('public', $oldQris);
            }

            return response()->json([
                'success' => true,
                'message' => 'Pengajuan berhasil diperbarui dan kembali menunggu verifikasi.',
                'data' => $pengajuan->fresh()->load([
                    'game',
                    'kota.provinsi',
                    'pendanaan',
                    'pembayaran',
                    'sponsor',
                    'rincian',
                    'sumberPendanaan',
                    'turnamen',
                ])->makeHidden(['ktp']),
            ]);
        } catch (\Throwable $e) {
            $this->deleteStoredFile('public', $newPoster);
            $this->deleteStoredFile('local', $newKtp);
            $this->deleteStoredFile('public', $newQris);

            throw $e;
        }
    }

    /**
     * Memastikan sumber Sponsor memiliki informasi sponsor.
     */
    private function validateSponsorSelection(
        array $sumberPendanaan,
        array $sponsor
    ): void {
        $idSponsor = SumberPendanaan::where('nama_sumber', 'Sponsor')
            ->value('id_sumber');

        if (!$idSponsor) {
            return;
        }

        $memilihSponsor = in_array(
            (int) $idSponsor,
            array_map('intval', $sumberPendanaan),
            true
        );

        if ($memilihSponsor && count($sponsor) === 0) {
            throw ValidationException::withMessages([
                'sponsor' => 'Informasi minimal satu sponsor wajib diisi jika sumber pendanaan Sponsor dipilih.',
            ]);
        }

        if (!$memilihSponsor && count($sponsor) > 0) {
            throw ValidationException::withMessages([
                'sponsor' => 'Data sponsor hanya boleh diisi jika sumber pendanaan Sponsor dipilih.',
            ]);
        }
    }

    /**
     * Memastikan jadwal main setelah jadwal penutupan pendaftaran.
     */
    private function validateSchedule($jadwalTutup, $jadwalMain): void
    {
        if (strtotime($jadwalMain) <= strtotime($jadwalTutup)) {
            throw ValidationException::withMessages([
                'jadwal_main' => 'Jadwal main harus setelah jadwal penutupan pendaftaran.',
            ]);
        }
    }

    /**
     * Menghapus file dari disk jika path tersedia.
     */
    private function deleteStoredFile(string $disk, ?string $path): void
    {
        if ($path && Storage::disk($disk)->exists($path)) {
            Storage::disk($disk)->delete($path);
        }
    }
}