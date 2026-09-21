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
2. **SQL Editor** → paste and run `supabase/schema.sql`, then `supabase/phase2.sql` (in that order, each once).
3. **Authentication → Sign In / Providers → Phone**: enable it and connect an SMS provider (Twilio, MessageBird, Vonage or Textlocal).
   For testing without SMS, add test numbers + fixed OTPs under *Phone → Test OTPs*.
4. **Project Settings → API**: copy the URL and anon key into `.env.local`.
5. Sign in once on `/login` with your number, then make yourself admin in the SQL editor:
   ```sql
   update public.profiles set role = 'admin' where phone = '+91XXXXXXXXXX';
   ```

## Project layout

```
src/
  app/
    (marketing)/     Public site: home, how-it-works, machine, locations, for-clinics, for-doctors, about, faq, updates, contact, privacy, terms
    (auth)/login/    Phone number → OTP sign-in (server actions)
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
supabase/            schema.sql then phase2.sql — tables, functions, RLS, storage
```

## Roles

| Role | How you get it | Can |
|---|---|---|
| patient | default on first sign-in | see own prescriptions |
| doctor | apply at `/app/doctor`, admin approves | issue prescriptions |
| vendor | admin sets it | see and restock their machines |
| admin | set manually in SQL | verify doctors, read enquiries, manage machines |

Security is enforced in the database (RLS), not just the UI: users can't change their own role, patients only see their own prescriptions, and only verified doctors can insert prescriptions.

## Roadmap

- **Phase 1 ✓** marketing site, phone-OTP auth, roles, doctor verification, admin review, contact leads.
- **Phase 2 ✓** prescription writer (patient lookup by phone), printable prescriptions, doctor document upload (private storage), machines: create, assign operator, stock sheet with low-stock/expiry flags, public machine locator.
- **Phase 3:** Razorpay checkout, stock reservation, signed single-use QR tokens, authenticated ESP32 dispense API, live inventory + expiry alerts.

## Deploy

Push to GitHub → import on vercel.com → add the three env vars → deploy. In Supabase → Authentication → URL configuration, set the Site URL to your domain.
