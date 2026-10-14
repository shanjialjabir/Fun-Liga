# Fun Mini Soccer

**Every Match Matters.** Web app mini soccer berbahasa Indonesia dengan tema Dark Sports, Next.js App Router, TypeScript, Tailwind CSS, Radix Dialog, Zod, dan React Hook Form.

## Website online

**https://fun-liga.vercel.app** — deployment produksi menggunakan Vercel dan Supabase.

Lihat `docs/deployment.md` untuk hasil verifikasi dan konfigurasi. Login serta operasi kompetisi telah diuji pada server produksi. Pendaftaran mandiri Fun Liga ditutup: akun dibuat melalui Akun saya → Kelola akun oleh admin utama `sanjifile@gmail.com`. Pengiriman email reset kata sandi masih memerlukan layanan email yang sesuai; jangan menganggap pengiriman email sudah teruji.

## Coba demo tanpa instalasi

File `demo-output/Fun-Mini-Soccer-Demo.html` dapat diunduh dan dibuka langsung di browser desktop (Chrome, Edge, atau Firefox). Tidak memerlukan Node, Supabase, internet, atau pengaturan port. Demo membuka akun lokal otomatis dan dimulai tanpa kompetisi contoh.

Klik **Buat kompetisi**, masukkan nama dan empat tim, buat jadwal, publikasikan, lalu coba skor live/final dan klasemen. Data demo tersimpan di browser perangkat tersebut, bukan di server atau SQLite; tidak tersinkron antarperangkat. Jika browser melarang penyimpanan file lokal, data hanya bertahan selama tab dibuka. Peran/undangan dalam file ini hanya simulasi lokal, bukan autentikasi produksi.

Untuk membuat ulang artifact setelah perubahan: jalankan `pnpm build`, kemudian `pnpm demo:build`. `pnpm demo:check` memeriksa HTML yang sama pada origin browser terisolasi: 12 fixture, skor 2–1, poin pemenang 3, hasil tetap ada setelah reload, tampilan seluler, tanpa request eksternal. Protokol `file:` tidak dapat diuji langsung di browser cloud karena kebijakan browser memblokir navigasi file; gunakan browser biasa pada perangkat Anda untuk membukanya.

## Jalankan demo lokal

Prasyarat: Node.js **24.x** (divalidasi dengan 24.19.0) dan pnpm **11.25+**.

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Buka aplikasi pada port 3000. Klik **Masuk**, gunakan nama dan email fiktif, lalu **Buat kompetisi**. Aplikasi dimulai kosong; tidak ada tim, jadwal, atau hasil contoh yang otomatis dipublikasikan.

Demo menggunakan SQLite bawaan Node.js di `.data/demo.sqlite`. Data dan session bertahan setelah server dimulai ulang. `DEMO_DATA_DIR` dapat menunjuk direktori lain. Jangan menghapus direktori tersebut jika ingin mempertahankan data. Data pengujian E2E memakai direktori sementara tersendiri.

**Demo bukan autentikasi produksi.** Tidak ada kata sandi; email yang sama bisa digunakan siapa pun yang mengakses mesin demo untuk menggunakan identitas yang sama. Jangan mengaktifkan `DEMO_MODE=true` pada deployment publik. Dalam mode development tanpa URL Supabase, demo aktif otomatis; dalam mode production, demo hanya aktif jika dipilih secara eksplisit.

## Alur yang tersedia

- Buat beberapa kompetisi independen: Fourfeo, liga, grup, gugur, grup + gugur.
- Wizard nama/format/visibilitas → tim/aturan → tinjauan → draft.
- Fourfeo tepat 4 tim; 1–10 pertemuan per pasangan. Liga 2–32 tim. Grup mendukung alokasi tidak sama dengan batas minimal dan kualifikasi yang divalidasi.
- Jadwal circle method, sisi bergantian antarpertemuan, bye untuk jumlah tim non-pangkat dua, opsional perebutan tempat ketiga.
- Mode Atur urutan menampilkan drag/drop dan tombol naik/turun hanya saat dibutuhkan. Optimalkan jeda diganti Acak jadwal: pratinjau, acak ulang, lalu konfirmasi. Putaran 1 adalah seluruh pertemuan pertama antar-tim, Putaran 2 adalah pertemuan ulang dengan kandang/tandang dibalik. Pengacakan memakai Web Crypto untuk mengacak blok pekan lengkap dan pertandingan di dalamnya, menjaga satu pertandingan per tim per pekan, giliran grup, pasangan lawan, slot waktu, identitas fixture, serta posisi pertandingan live/final/cancelled. Pilihan bawaan Urutan sama antarputaran menyelaraskan pasangan lawan kedua paruh musim; pilihan Acak masing-masing putaran mengacak setiap paruh secara terpisah. Pilihan tersimpan pada kompetisi. Putaran pertama harus selesai sebelum putaran berikutnya dimulai. Final utama dan perebutan tempat ketiga tidak saling ditukar.
- Daftar pertandingan mobile memakai dua baris ringkas (tim/skor, lalu grup/putaran/status), sekitar 96 px untuk nama pendek. Nama panjang tetap boleh membungkus; petunjuk ketuk hanya tampil sekali dan browser zoom tetap tersedia.
- Ubah nama, tambah/hapus tim (selain Fourfeo), alokasi grup, serta aturan pada draft. Perubahan struktur memerlukan tinjauan dan konfirmasi sebelum membuat ulang jadwal.
- Publikasi eksplisit; publik ditemukan di Jelajahi, tautan saja hanya melalui URL, privat hanya untuk panitia. Draft tidak terlihat oleh penonton.
- Mulai live, simpan skor, masukkan hasil final langsung, konfirmasi final, koreksi dengan alasan, tunda/batalkan, serta waktu pertandingan.
- Ketuk baris pertandingan untuk mencatat gol. Nama pencetak gol dan assist memakai saran nama bersama per tim; huruf besar/kecil dan spasi berlebih tidak membuat pemain baru. Skor mengikuti penambahan, pengeditan, dan penghapusan gol. Gol bunuh diri masuk ke tim lawan tanpa statistik gol/assist. Tab Top skor & assist hanya menghitung pertandingan final. Gol lama dapat dilengkapi tanpa menambah skor; koreksi setelah final memerlukan alasan dan konfirmasi.
- Klasemen resmi hanya menghitung final; multi-team head-to-head menggunakan mini-table. Seri tetap ditandai dan dapat diresolusikan melalui keputusan panitia yang diaudit.
- Bracket maju otomatis; koreksi yang mengubah pemenang diblokir jika pertandingan turunannya sudah dimulai. Grup + gugur memerlukan persetujuan kualifikasi.
- Undangan sekali pakai selama 72 jam, batasan email opsional, admin/operator per kompetisi, pencabutan undangan/akses, dan transfer owner dengan konfirmasi.
- Version compare-and-swap untuk konflik pembaruan, audit sebelum/sesudah, penyelesaian dan arsip.
- Akun hanya dibuat/diberi akses oleh admin utama. Server memerlukan email terverifikasi serta `app_metadata.fun_liga_access=true` untuk akun lain. Metadata yang dapat diedit pengguna tidak memberikan akses. Akun yang sudah menjadi pemilik/panitia sebelum pembatasan tetap diberi akses; pengaturan Auth aplikasi lain pada proyek Supabase bersama dipertahankan.
- Jadwal grup bergiliran A, B, C, D dan mengulang; grup yang sudah habis dilewati. Tombol Seimbangkan giliran grup merapikan jadwal lama tanpa memindahkan pertandingan yang sudah berjalan/final. Slot waktu dipertahankan, identitas fixture dan hasil tidak dibuat ulang.
- Pemilik dapat menghapus permanen kompetisi, termasuk draft, melalui Pengaturan → Hapus kompetisi. Konfirmasi harus memakai nama kompetisi persis. Tim, jadwal, hasil, riwayat, akses panitia, dan undangan terkait ikut terhapus; kompetisi lainnya tetap tersimpan.
- Tampilan desktop/seluler, navigasi bawah, tombol skor 44 px, dialog dengan focus trap, menu seluler dengan keyboard/Escape, dan indikator koneksi.

## Supabase untuk deployment

Demo lokal dan API produksi Supabase telah diuji. Proyek produksi sudah dikonfigurasi; lihat `docs/deployment.md`. Google OAuth, pengiriman email verifikasi, dan pembaruan realtime di browser produksi belum diverifikasi. Migrasi SQL/RLS/RPC juga diuji dengan PostgreSQL lokal melalui PGlite.

1. Buat proyek Supabase. Jalankan `supabase/migrations/001_competitions.sql` di SQL Editor proyek baru. Alternatif: link proyek dengan Supabase CLI dan jalankan `supabase db push`.
2. Set variabel berikut di `.env.local` (lokal) atau environment hosting (deployment). Jangan commit kunci.

| Variabel                                | Fungsi                                                        |
| --------------------------------------- | ------------------------------------------------------------- |
| `DEMO_MODE=false`                       | Matikan demo untuk produksi                                   |
| `NEXT_PUBLIC_SUPABASE_URL`              | URL HTTPS proyek                                              |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`         | Kunci publik/anon proyek                                      |
| `SUPABASE_SERVICE_ROLE_KEY_SERVER_ONLY` | Kunci service role, **hanya server**                          |
| `NEXT_PUBLIC_SITE_URL`                  | Origin deployment final                                       |
| `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=true` | Opsional, tampilkan tombol Google setelah provider diaktifkan |

3. Aktifkan email/password di Supabase Auth. Atur Site URL dan allowlist Redirect URLs ke origin aplikasi. Bila email verification aktif, pengguna harus membuka email konfirmasi sebelum masuk.
4. Google opsional: aktifkan Google provider, masukkan kredensial OAuth melalui Supabase Dashboard, dan tambahkan callback Supabase ke Google Console. Tombol Google hanya muncul jika flag di atas aktif.
5. Migrasi memasukkan `competition_events` ke publikasi `supabase_realtime`. Periksa Realtime aktif pada tabel tersebut. Event hanya mengirim ID/version, bukan skor atau identitas panitia. RLS menentukan apakah subscriber boleh membaca event. Browser kemudian mengambil snapshot aman melalui API. Polling 5 detik tetap menjadi fallback/reconnect.
6. Jalankan `pnpm build` dengan variabel publik sudah tersedia, lalu `pnpm start`. Pada Vercel, import repositori, pilih Next.js dan konfigurasi environment tersebut sebelum build. SQLite tidak dipakai saat `DEMO_MODE=false`.
7. Siapkan akun admin utama lewat Supabase Auth Admin. Verifikasi pembuatan akun melalui admin, penolakan akun tanpa akses, login/logout, reset password, dua akun dengan peran berbeda, kompetisi privat, konflik pembaruan, dan realtime setelah deployment. Jangan menganggap hasil pengujian demo memverifikasi layanan eksternal ini.

Kunci service role diimpor oleh modul `server-only`, tidak dikirim ke browser. API memverifikasi JWT lewat Supabase `auth.getUser()` sebelum mengotorisasi perubahan. RLS menolak mutation langsung dari anon/authenticated; RPC mutation hanya dapat dieksekusi service role setelah pemeriksaan server. Payload publik menghapus anggota, audit, dan owner ID. Semua penyimpanan aggregate/version/audit dan membership dilakukan dalam satu transaksi.

## Pengujian

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

E2E menjalankan hasil **build produksi** pada port 3100 dengan demo eksplisit dan database sementara. Chromium digunakan dari `/usr/bin/chromium` di cloud ini. Pada komputer lain, set `CHROMIUM_PATH` ke executable Chromium atau sesuaikan Playwright config untuk browser yang dipasang melalui `pnpm exec playwright install chromium`.

Vitest: generator semua format, perhitungan poin/tie-break, stabilitas fixture, status/correction/bracket, permission/locking, rules/team regeneration dan transfer ownership; migrasi PostgreSQL, RLS dan transaksi diuji dengan PGlite. Playwright: panitia membuat/publikasi Fourfeo, skor live tanpa reload penonton, final/koreksi, undangan operator, pencabutan, arsip, akses privat, origin guard, layout mobile dan keyboard.

## Keputusan dan batasan versi ini

- Spesifikasi sumber: `docs/product-specification.json`. Implementasi ini adalah MVP fungsional untuk demo lokal, dengan adapter Supabase yang masih memerlukan konfigurasi dan uji provider.
- PostgreSQL menggunakan aggregate JSONB untuk tim/rules/stages/matches/audit, dengan tabel membership dan invitation terpisah. Ini berbeda dari rancangan seluruh tabel ternormalisasi pada blueprint. Update satu kompetisi, versi, dan audit bersifat atomik; untuk skala besar, pisahkan tabel pertandingan/audit dan tambahkan pagination/indeks yang lebih rinci.
- Browser publik tidak boleh membaca aggregate berisi email/audit langsung dari Supabase. API menyaringnya; tabel event aman digunakan untuk realtime.
- Tie-break default tetap: poin, selisih gol, gol memasukkan, mini-table head-to-head (poin/SG/GM), keputusan panitia. Pengurutan alfabet hanya membantu tampilan pada tie yang belum diselesaikan dan **tidak** menentukan juara/kualifikasi.
- Operasional dibatasi 32 tim, 10 pertemuan, 8 grup. Tim/rules terkunci setelah publikasi; perubahan skor final memakai correction flow. Resolusi administratif untuk membatalkan babak turunan yang sudah dimulai belum disediakan; koreksi tersebut ditolak dengan pesan jelas.
- Belum disediakan upload logo tim, moderasi platform/laporan penyalahgunaan, deklarasi juara liga opsional, tie-break yang dapat dikustomisasi penuh, atau format extra-time/keputusan pemenang manual (gugur memakai skor reguler atau penalti). Jangan mengklaim seluruh blueprint sudah selesai.
- Pengacakan mengunci seluruh paruh musim suatu grup jika sudah memiliki pertandingan live/final/cancelled. Paruh yang masih belum dimulai dapat diacak; hasil yang tidak dapat menjaga posisi terkunci dan opsi urutan antarputaran ditolak. Urutan kalender berbeda dari ID pertandingan.
- Live processes tidak bertahan setelah snapshot cloud dihidupkan kembali. Gunakan instruksi startup yang disimpan; tidak perlu worktree baru.

## Struktur

- `src/components/app.tsx`: shell, wizard, dashboard/publik, kontrol skor, tim, panitia, pengaturan.
- `src/components/ui.tsx`: dialog Radix, status, badge tim, empty/loading.
- `src/lib/competition.ts`: domain, Zod, generator, klasemen, permissions dan command handling.
- `src/lib/store.ts`: SQLite demo, session lokal, adapter Supabase dan undangan.
- `src/app/api/[...path]/route.ts`: batas server, autentikasi, origin guard, response sanitization.
- `supabase/migrations/001_competitions.sql`: schema, RLS, RPC transaksional dan safe realtime event.
