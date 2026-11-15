<?php

use App\Services\BracketService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// ==========================================
// MODUL 4: MULAI TURNAMEN OTOMATIS (keputusan SA Sprint 2)
// Saat jadwal_main tiba dan semua pendaftaran sudah diverifikasi:
// bentuk bracket (kalau belum), publikasikan, status "berlangsung".
// Lokal: php artisan schedule:work
// ==========================================

Artisan::command('turnamen:mulai', function (BracketService $bracket) {
    $jumlah = $bracket->prosesTurnamenSiapMulai();
    $this->info("Turnamen dimulai: {$jumlah}");
})->purpose('Memulai turnamen yang jadwal mainnya sudah tiba');

Schedule::command('turnamen:mulai')->everyMinute()->withoutOverlapping();