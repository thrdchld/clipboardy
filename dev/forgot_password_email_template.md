# Reset Lock Password Email Template - Clipboardy

Below is the transactional email template optimized to prevent spam filters (Anti-Spam Friendly), translated completely into English. You can copy this directly to your Firebase Console or custom SMTP mailer settings.

---

### Email Configuration Details
- **Sender Name:** `Clipboardy Support`
- **Sender Email:** `noreply@clipboardy.my.id` (Ensure SPF, DKIM, and DMARC records are configured in your DNS for this domain)
- **Subject:** `Reset your Clipboardy lock code`

---

### HTML Template (For Firebase Console / Email Editor)

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Lock Code - Clipboardy</title>
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
                <h2 style="margin-top: 0; font-size: 18px; font-weight: 700; color: #0f172a;">Hello,</h2>
                <p style="font-size: 15px; line-height: 1.6; color: #4b5563; margin-bottom: 24px;">
                    We received a request to reset your Clipboardy application lock code. To complete this request and confirm your email ownership, please click the button below:
                </p>
                
                <!-- Action Button -->
                <div style="text-align: center; margin: 32px 0;">
                    <a href="https://clipboardy.my.id/reset-confirmation.html" style="background-color: #3b82f6; color: #ffffff; padding: 14px 28px; font-weight: 600; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 15px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25); transition: background-color 0.2s;">
                        Confirm Lock Code Reset
                    </a>
                </div>
                
                <p style="font-size: 14px; line-height: 1.6; color: #4b5563;">
                    This link will direct you to the secure confirmation page on <strong>clipboardy.my.id</strong>. Once confirmed, you can click the login button on that page to return to the app and set up your new lock code.
                </p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
                <p style="font-size: 12px; line-height: 1.5; color: #9ca3af; margin-bottom: 0;">
                    If the button above does not work, please copy and paste the following URL into your browser:<br>
                    <a href="https://clipboardy.my.id/reset-confirmation.html" style="color: #3b82f6; text-decoration: underline; word-break: break-all;">https://clipboardy.my.id/reset-confirmation.html</a>
                </p>
            </td>
        </tr>
        
        <!-- Footer -->
        <tr>
            <td style="padding: 24px 40px; background-color: #f9fafb; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0 0 8px 0;">This email was sent automatically in response to your account activity.</p>
                <p style="margin: 0;">&copy; 2026 Clipboardy. All rights reserved.</p>
            </td>
        </tr>
    </table>
</body>
</html>
```

---

### Plain Text Version (Fallback for basic mail clients)

```text
Subject: Reset your Clipboardy lock code

Hello,

We received a request to reset your Clipboardy application lock code. Please open the link below to confirm your email verification:

https://clipboardy.my.id/reset-confirmation.html

This link will direct you to a secure reset confirmation page. After confirming, you can click the button on that page to return, log in with Google, and automatically set up your new lock code.

If you did not request this reset, you can safely ignore this email.

--
Clipboardy Support
noreply@clipboardy.my.id
```

---

### ⚠️ Configuration Guidelines in Firebase Console / Custom Mailer
To route the link correctly to your custom confirmation page, configure the following:

1. In **Firebase Console** -> Go to **Authentication** -> **Templates** tab.
2. Select **Password reset** (or your custom email template).
3. Click the edit icon in the top-right corner of the template.
4. Locate the **Action URL** (or Custom Link) field, and change it to point to your page:
   `https://clipboardy.my.id/reset-confirmation.html`
5. If you are using a third-party custom mailer (e.g., SMTP/SendGrid), set the button/link URL directly to `https://clipboardy.my.id/reset-confirmation.html`.
