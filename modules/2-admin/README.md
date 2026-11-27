# 2 · Admin

**What it does.** Farmacia Tech staff sign in with the **admin email** (`medvendors01@gmail.com`). That's two steps: a code sent to that email, then the code from an **authenticator app** (Google or Microsoft Authenticator), which is asked again every 12 hours. A mobile number can never be admin.

Admin has three jobs:

| Tab | Job | Data lives in |
|---|---|---|
| **Doctors** | approve or reject doctor applications | module 4 |
| **Enquiries** | read Contact-page messages | this module (`leads`) |
| **Devices** | register devices and manage them (new pairing code, new key, deactivate) | module 5 |

Every admin sign-in and action is written to the **admin activity** log, shown on the Doctors page.

## Pages

| Page | File |
|---|---|
| `/login/admin` (email) → `/login/admin/verify` (email code) | `src/app/(auth)/login/admin/` |
| `/app/admin/verify` (authenticator app) | `src/app/app/admin/verify/` |
| `/app/admin` (Doctors), `/app/admin/enquiries` | `src/app/app/admin/page.tsx`, `enquiries/page.tsx` |
| `/app/vendor`, `/app/vendor/new`, `/app/vendor/[id]` (Devices) | module 5 files |

## Code

| File | What it does |
|---|---|
| `src/app/(auth)/login/admin/actions.ts` | send and check the email code; only admin accounts may continue |
| `src/app/app/admin/verify/actions.ts` | set up and check the authenticator app; sign out of admin |
| `src/app/app/admin/actions.ts` | approve or reject a doctor |
| `src/lib/auth.ts` (`getAdminStatus`, `requireSide`) | admin pages open only after both steps |

## Database (`database.sql`)

- **Tables:** `admin_audit` (activity log), `leads` (enquiries)
- **Functions:** `admin_status()`, `admin_note_verified()`, `admin_log()`. The admin check itself, `is_admin()`, is in module 1.

## Set up (once)

1. **Create the admin account:** **Authentication → Users → Add user → Create new user**, enter `medvendors01@gmail.com`, tick **Auto Confirm User**.
2. **SQL Editor:** run **module 1** again (it gives that account the admin role), then this module's `database.sql`.
   Check it: `select roles from public.profiles where id = (select id from auth.users where email = 'medvendors01@gmail.com');` should show `{patient,admin}`.
3. **Email sending:** **Authentication → Emails → SMTP Settings**. Supabase's built-in sender only mails your Supabase team, a few times an hour, so set your own:

   | Field | Value |
   |---|---|
   | Host | `smtp.gmail.com` |
   | Port | `587` |
   | Username | `medvendors01@gmail.com` |
   | Password | a Gmail **app password** (Google account → 2-Step Verification → App passwords) |
   | Sender email | `medvendors01@gmail.com` |
   | Sender name | `Farmacia Tech` |

4. **Email text:** **Authentication → Emails → Templates → Magic Link**. The body must contain `{{ .Token }}`, e.g. `Your Farmacia Tech admin code is {{ .Token }}`.
5. **Authentication → Multi-Factor:** TOTP (authenticator app) enabled.

## Test

1. **Email only:** Supabase → **Users** → the admin user → **Send magic link**. A code should arrive.
2. **Full sign-in:** `/login` → **Admin sign in** → email → code → authenticator (scan the QR code the first time). The **Doctors · Enquiries · Devices** tabs should appear.
3. **Sign out of admin, then sign in again.** Both codes should be asked again.

**If something fails,** look in Vercel → **Logs** (search `admin sign-in`) and Supabase → **Authentication → Logs**.

**Lost the phone with the authenticator app?** In Supabase → **Users** → admin user, remove its MFA factor, then set it up again.
