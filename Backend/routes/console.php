<?php

use Illuminate\Foundation\Inspiring;
use App\Services\BracketService;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// ==========================================
// MODUL 4: PROSES OTOMATIS BRACKET (keputusan SA/TL Sprint 2)
// - Bracket draft disesuaikan dengan peserta diterima.
// - Grace period 1 jam (mulai saat jadwal_main tiba, atau saat
//   verifikasi terakhir kalau lewat jadwal_main) → publikasi otomatis.
// - Bracket dipublikasikan & jadwal_main tiba → status "berlangsung".
// Lokal: php artisan schedule:work
// ==========================================

Artisan::command('turnamen:mulai', function (BracketService $bracket) {
    $hasil = $bracket->prosesSemuaTurnamen();
    $this->info("Dipublikasikan otomatis: {$hasil['dipublikasikan']} | Berlangsung: {$hasil['berlangsung']}");
})->purpose('Publikasi bracket otomatis dan memulai turnamen');

Schedule::command('turnamen:mulai')->everyMinute()->withoutOverlapping();


// ==========================================
// PB-21: PENETAPAN HASIL AKHIR TURNAMEN
// Masa koreksi 30 menit sejak hasil final & perebutan Juara 3 lengkap
// (waktu_mulai_koreksi). Setelah lewat → turnamen selesai: juara permanen,
// bracket terkunci, roster pemain dibuka.
// Lokal: php artisan schedule:work
// ==========================================

Artisan::command('turnamen:tetapkan-hasil', function (BracketService $bracket) {
    $jumlah = $bracket->prosesHasilAkhirSemuaTurnamen();
    $this->info("Turnamen selesai: {$jumlah}");
})->purpose('Menetapkan hasil akhir turnamen setelah masa koreksi 30 menit');

Schedule::command('turnamen:tetapkan-hasil')->everyMinute()->withoutOverlapping();

// ==========================================
// PB-27/28 (R8.06): pesan chat disimpan 6 bulan, lebih dari itu dihapus otomatis.
// ==========================================

Artisan::command('chat:hapus-pesan-lama', function () {
    $jumlah = \App\Models\Pesan::hapusPesanLama();
    $this->info("Pesan dihapus: {$jumlah}");
})->purpose('Menghapus pesan chat yang lebih dari 6 bulan (R8.06)');

Schedule::command('chat:hapus-pesan-lama')->dailyAt('02:00')->withoutOverlapping();