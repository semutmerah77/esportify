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