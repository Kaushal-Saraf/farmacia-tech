# 2 · Admin

**What it does.** Farmacia Tech staff sign in with the **admin email** (`medvendors01@gmail.com`). That's two steps: a code sent to that email, then the code from an **authenticator app** (Google or Microsoft Authenticator), which is asked again every 12 hours. A mobile number can never be admin.

Admin has three jobs:

| Tab | Job | Data lives in |
|---|---|---|
| **Doctors** | approve or reject doctor applications | module 4 |
| **Enquiries** | read Contact-page messages | this module (`leads`) |
| **Devices** | register devices and manage them (replace key, pairing code for a no-screen device, deactivate) | module 5 |

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
3. **Sign out (top bar), then sign in again.** Both codes should be asked again.

## Troubleshooting

The sign-in pages only show a short message, sometimes with a code. What it means and how to fix it:

| Message on the site | Code | Cause | Fix |
|---|---|---|---|
| This email isn't an admin account. | none | No Supabase user with this email (often a typo, e.g. `gamail.com`) | **Supabase → Authentication → Users → Add user → Create new user**, enter the email exactly, tick **Auto Confirm User**. Then run **module 1** again. |
| This email isn't an admin account. | `ADM-ROLE` | The user exists but doesn't have the admin role | Make sure the email is in `admin_emails` (module 1 adds `medvendors01@gmail.com`), then run **module 1** again. Check with the query in step 2 above. |
| We couldn't send the code. | `ADM-EMAIL` | Supabase couldn't send the email | Check **SMTP Settings** (step 3). The exact reason is in **Supabase → Logs → Auth**, e.g. `535 Username and Password not accepted` means a wrong app password. |
| Too many codes requested. | none | One code per minute per email | Wait a minute and try again. |
| That code is wrong or has expired. | none | Wrong or old code | **Email code:** use the newest email; codes work once. **App code:** turn on automatic date & time on the phone, and use the newest "Farmacia Tech" entry in the app. |
| Couldn't start the setup. | `ADM-MFA` | Authenticator apps are turned off | **Authentication → Multi-Factor:** enable **TOTP**. |
| Admin couldn't be opened. | `ADM-SESSION` | The database doesn't see the signed-in session, usually because the site uses the **secret** key | In Vercel set `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the **publishable** key (`sb_publishable_…`) and redeploy. |
| Admin couldn't be opened. | `ADM-ROLE` | The database doesn't give this account the admin role | Run **module 1** again. |
| Admin couldn't be opened. | `ADM-CHECK` | The database has an older admin check | Run **module 1** and **module 2** again (from GitHub), then sign in again. |

**More detail:** Vercel → **Logs** (search `admin sign-in`) and Supabase → **Authentication → Logs** show the full error.

**Lost the phone with the authenticator app?** Supabase → **Authentication → Users** → the admin user → remove its **MFA factor**. Sign in again and set up the app afresh.
