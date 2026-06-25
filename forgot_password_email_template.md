# Template Email Reset Lock Password - Clipboardy

Berikut adalah draf template email yang telah dioptimalkan untuk pengiriman email transaksional agar terhindar dari folder **Spam/Promosi** (Anti-Spam Friendly). Template ini siap disalin ke Firebase Console atau layanan SMTP pengirim email Anda.

---

### Detail Konfigurasi Email
- **Nama Pengirim (Sender Name):** `Clipboardy Support`
- **Email Pengirim (Sender Email):** `noreply@clipboardy.my.id` (Pastikan record SPF, DKIM, dan DMARC domain Anda telah terkonfigurasi di DNS)
- **Subject Email:** `Reset Kode Pengunci Akun Clipboardy Anda`

---

### Template HTML (Untuk Firebase Console / Email Editor)

```html
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Kode Pengunci - Clipboardy</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <!-- Header -->
        <tr>
            <td style="padding: 30px 40px; background-color: #0f172a; text-align: center; color: #ffffff;">
                <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Clipboardy</h1>
                <p style="margin: 5px 0 0 0; font-size: 14px; color: #94a3b8;">Secure Cross-Device Sync</p>
            </td>
        </tr>
        
        <!-- Body -->
        <tr>
            <td style="padding: 40px; color: #1f2937;">
                <h2 style="margin-top: 0; font-size: 18px; font-weight: 700; color: #0f172a;">Halo,</h2>
                <p style="font-size: 15px; line-height: 1.6; color: #4b5563; margin-bottom: 24px;">
                    Kami menerima permintaan untuk mereset kode pengunci aplikasi Clipboardy Anda. Untuk menyelesaikan permintaan ini dan melakukan konfirmasi email Anda, silakan klik tombol di bawah ini:
                </p>
                
                <!-- Action Button -->
                <div style="text-align: center; margin: 32px 0;">
                    <a href="https://clipboardy.my.id/reset-confirmation.html" style="background-color: #3b82f6; color: #ffffff; padding: 14px 28px; font-weight: 600; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 15px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25); transition: background-color 0.2s;">
                        Konfirmasi Reset Kode
                    </a>
                </div>
                
                <p style="font-size: 14px; line-height: 1.6; color: #4b5563;">
                    Link di atas akan mengarahkan Anda ke halaman khusus konfirmasi reset kode di <strong>clipboardy.my.id</strong>. Setelah email Anda terkonfirmasi di halaman tersebut, Anda dapat mengeklik tautan login kembali untuk masuk dan membuat kode pengunci baru.
                </p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
                <p style="font-size: 12px; line-height: 1.5; color: #9ca3af; margin-bottom: 0;">
                    Jika tombol di atas tidak berfungsi, silakan salin dan tempel link berikut ke browser Anda:<br>
                    <a href="https://clipboardy.my.id/reset-confirmation.html" style="color: #3b82f6; text-decoration: underline; word-break: break-all;">https://clipboardy.my.id/reset-confirmation.html</a>
                </p>
            </td>
        </tr>
        
        <!-- Footer -->
        <tr>
            <td style="padding: 24px 40px; background-color: #f9fafb; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0 0 8px 0;">Email ini dikirim secara otomatis sebagai tanggapan atas aktivitas akun Clipboardy Anda.</p>
                <p style="margin: 0;">&copy; 2026 Clipboardy. All rights reserved.</p>
            </td>
        </tr>
    </table>
</body>
</html>
```

---

### Versi Plain Text (Cadangan untuk Mail Client yang tidak mendukung HTML)

```text
Subject: Reset Kode Pengunci Akun Clipboardy Anda

Halo,

Kami menerima permintaan untuk mereset kode pengunci aplikasi Clipboardy Anda. Silakan buka tautan berikut untuk melakukan konfirmasi email Anda:

https://clipboardy.my.id/reset-confirmation.html

Link tersebut akan mengarahkan Anda ke halaman konfirmasi khusus reset kode. Setelah melakukan konfirmasi, Anda dapat mengeklik tombol kembali di halaman tersebut untuk masuk menggunakan akun Google Anda dan menyetel kode pengunci baru secara otomatis.

Jika Anda tidak meminta pengaturan ulang ini, Anda dapat mengabaikan email ini dengan aman.

--
Clipboardy Support
noreply@clipboardy.my.id
```

---

### ⚠️ Panduan Konfigurasi di Firebase Console / Custom Mailer
Agar tautan diarahkan ke halaman konfirmasi kustom Anda, lakukan penyesuaian sebagai berikut:

1. Di **Firebase Console** -> **Authentication** -> tab **Templates**.
2. Pilih bagian **Password reset** (atau template email kustom Anda).
3. Klik tombol edit di pojok kanan atas template.
4. Di bagian **Action URL** (atau di bagian Custom Link), ubah untuk mengarah ke halaman konfirmasi Anda:
   `https://clipboardy.my.id/reset-confirmation.html`
5. Jika menggunakan mailer kustom, set link tombol/tautan langsung ke `https://clipboardy.my.id/reset-confirmation.html`.
