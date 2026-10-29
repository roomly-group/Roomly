# Email templates (Supabase Auth)

Supabase sends these emails, so the files here are copies to paste into the dashboard.

## confirm-signup.html

1. Supabase Dashboard → Authentication → Emails → Templates → **Confirm sign up**.
2. Subject: `Conferma la tua email per entrare in Roomly`
3. Paste the whole content of `confirm-signup.html` into the message body and save.

## change-email.html

1. Same place → **Change email address**.
2. Subject: `Conferma il tuo nuovo indirizzo email · Roomly`
3. Paste the whole content of `change-email.html` and save.

Both templates: the logo is loaded from `https://www.roomly.group/email/roomly-logo.png`
(`frontend/public/email/roomly-logo.png`), so the frontend must be deployed first.

Dark mode: Apple Mail, iOS Mail, Outlook and Thunderbird use the template's own dark
palette; the Gmail apps recolour the email themselves. The logo is an opaque mint pill
so it stays readable either way.
