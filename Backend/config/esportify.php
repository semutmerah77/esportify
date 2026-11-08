<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Pendaftaran Turnamen
    |--------------------------------------------------------------------------
    |
    | Jumlah minimal anggota aktif sebuah Squad agar dapat mendaftar turnamen.
    | Berlaku untuk semua turnamen. Ubah di sini saja, jangan di-hardcode.
    |
    */

    'min_anggota_turnamen' => (int) env('ESPORTIFY_MIN_ANGGOTA_TURNAMEN', 5),

];
?>