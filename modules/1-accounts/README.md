# 1 · Accounts and roles

**What it does.** Everyone signs in. Patients, doctors and operators use their mobile number and a one-time SMS code; admin uses an email (module 2). Each sign-in gets a **profile**, and the profile's **roles** say what that person may do:

| Role | Who gets it |
|---|---|
| patient | everyone |
| doctor | when admin approves their application (module 4) |
| vendor (operator) | when they link a device (module 5) |
| admin | only the email accounts listed in `admin_emails`; never a mobile number |

One number can have several roles. The sign-in door (Patient / Doctor / Machine operator) decides which **side** of the portal opens; people with more than one role get a switch in the top bar.

## Pages

| Page | File |
|---|---|
| `/login` (choose who you are) | `src/app/(auth)/login/page.tsx` |
| `/login/patient`, `/login/doctor`, `/login/vendor` | `src/app/(auth)/login/[role]/page.tsx` |
| `/login/verify` (SMS code) | `src/app/(auth)/login/verify/` |
| `/app/welcome` (your name) | `src/app/app/welcome/` |

## Code

| File | What it does |
|---|---|
| `src/app/(auth)/login/actions.ts` | send and check the SMS code, sign out |
| `src/app/(auth)/login/roles.ts` | the sign-in doors and their wording |
| `src/app/app/layout.tsx`, `PortalNav.tsx` | portal top bar, side switch, tabs |
| `src/app/app/actions.ts` | save your name, switch side |
| `src/lib/auth.ts` | who is signed in, their roles and side; page guards |
| `src/lib/side.ts` | the sides (patient / doctor / operator / admin) |
| `src/lib/supabase/*`, `src/proxy.ts` | Supabase connection; keeps you signed in; sends `/app` to your side's home |

## Database (`database.sql`)

- **Tables:** `profiles` (one per sign-in), `admin_emails` (who may be admin)
- **Functions:** `has_role()`, `is_admin()` (admin email account + authenticator app in the last 12 hours), `today_ist()`
- **Rules:** you can read only your own profile and change only your name. Nobody can give themselves a role.

## Set up

1. **SQL Editor:** run `database.sql`.
2. **Authentication → Sign In / Providers → Phone:** enable it and connect an SMS provider. For testing, add numbers with fixed codes under **Test OTPs** (e.g. `919876543210=123456`).
3. **Vercel** and `.env.local`: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Use the **publishable / anon** key, **never the secret key**.

## Test

1. Go to `/login`, choose **I'm a patient**, and sign in with a test number. You should be asked for your name, then land on **My prescriptions**.
2. Sign out, then sign in through **I'm a machine operator**. You should land on **Link your first device**: same number, other side.
