# Farmacia Tech — website & platform

AI-guided medicine vending: doctors issue e-prescriptions, patients pay online, and the machine dispenses against a single-use QR code.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Supabase (Postgres, phone-OTP auth, row-level security) · deploy on Vercel.

## Run it locally

```bash
npm install
cp .env.example .env.local   # add Supabase keys (optional for the marketing pages)
npm run dev                  # http://localhost:3000
```

The marketing site works without Supabase. Sign-in and the `/app` portal show a setup notice until the keys are added.

## Connect Supabase (≈10 minutes)

1. Create a project at supabase.com. Pick the **Mumbai (ap-south-1)** region so health data stays in India.
2. **SQL Editor** → paste and run, in this order:
   1. `supabase/schema.sql`, `supabase/phase2.sql`, `supabase/vendor-devices.sql` (once each)
   2. `supabase/roles.sql`, `supabase/vendor-functions.sql`, `supabase/family.sql`. These three are safe to re-run; paste them again whenever they change, in this order.
3. **Authentication → Sign In / Providers → Phone**: enable it and connect an SMS provider (Twilio, MessageBird, Vonage or Textlocal).
   For testing without SMS, add test numbers + fixed OTPs under *Phone → Test OTPs*.
4. **Project Settings → API**: copy the URL and anon key into `.env.local`.
5. Sign in once on `/login` with your number, then make yourself admin in the SQL editor:
   ```sql
   update public.profiles set roles = roles || '{admin}' where phone = '+91XXXXXXXXXX';
   ```
6. **Authentication → Multi-Factor**: make sure **TOTP (authenticator app)** is enabled. Opening the Admin side (top-bar switch) asks for three factors every sign-in: the SMS code, a 6-digit code from an authenticator app (set up on first use), and an admin PIN (chosen on first use, asked again every 30 minutes, locked for 15 minutes after 5 wrong tries). The database refuses admin actions unless all three passed, and every admin action is logged on the Admin page. A lost authenticator app can be removed in Authentication → Users → the user → MFA factors.

## Project layout

```
src/
  app/
    (marketing)/     Public site: home, how-it-works, machine, locations, for-pharmacies, for-doctors, about, faq, updates, contact, privacy, terms
    (auth)/login/    Pick patient / doctor / operator → phone number → OTP (roles.ts holds the three doors)
    app/             Signed-in portal: patient · doctor · vendor · admin
  components/        Logo, header, footer, buttons, hero illustration
  lib/
    supabase/        Server client + session refresh used by src/proxy.ts
    auth.ts          getViewer / requireViewer(role) helpers
    content.ts       Shared marketing copy (steps, features)
    faq.ts           FAQ questions and answers
    updates.ts       News & milestones (add new posts at the top)
    machine.ts       Machine specs and installation steps
    site.ts          Name, contact email, links — edit this first
  proxy.ts           Refreshes the session and protects /app/*
supabase/            schema.sql → phase2.sql → vendor-devices.sql (once each), then roles.sql → vendor-functions.sql → family.sql (re-runnable)
```

## Roles

| Role | How you get it | Can |
|---|---|---|
| patient | sign in at `/login/patient` (default for new numbers) | see the prescriptions of everyone on their number; manage family members |
| doctor | sign in at `/login/doctor`, submit registration, admin approves | issue prescriptions to a family member found by mobile number |
| vendor | sign in at `/login/vendor` and link a device with its Device ID + pairing code | manage their own devices, stock and scans |
| admin | set manually in SQL | verify doctors, read enquiries, register devices (Device ID, pairing code, device key) |

One mobile number can hold several roles (everyone is a patient; doctor after approval; operator after linking a device; admin by hand). `/login` asks which side you want, and the portal shows only that side; numbers with more than one role get a switcher in the top bar.

Security is enforced in the database (RLS), not just the UI: users can't change their own role, patients only see their own prescriptions, and only verified doctors can insert prescriptions.

## Roadmap

- **Phase 1 ✓** marketing site, phone-OTP auth, roles, doctor verification, admin review, contact leads.
- **Phase 2 ✓** prescription writer (patient lookup by phone), printable prescriptions, doctor document upload (private storage), machines: create, assign operator, stock sheet with low-stock/expiry flags, public machine locator.
- **Phase 3:** Razorpay checkout, stock reservation, signed single-use QR tokens, authenticated ESP32 dispense API, live inventory + expiry alerts.

## Deploy

Push to GitHub → import on vercel.com → add the three env vars → deploy. In Supabase → Authentication → URL configuration, set the Site URL to your domain.
