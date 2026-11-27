# Farmacia Tech: website & platform

AI-guided medicine vending. Doctors issue e-prescriptions to a patient's family member; operators run vending machines and Medicine Checkers; Farmacia Tech staff verify doctors and register devices.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Supabase (Postgres, sign-in, row-level security) · Vercel.

## The five parts

The platform is split into modules. Each has its own database file and a one-page guide. **Start here: [`modules/README.md`](modules/README.md).**

| # | Module | In one line |
|---|---|---|
| 1 | [accounts](modules/1-accounts/README.md) | sign-in and roles |
| 2 | [admin](modules/2-admin/README.md) | admin sign-in (email + authenticator), doctors, enquiries, devices |
| 3 | [patients](modules/3-patients/README.md) | family members, reading prescriptions |
| 4 | [doctors](modules/4-doctors/README.md) | doctor verification, writing prescriptions |
| 5 | [devices](modules/5-devices/README.md) | vending machines, Medicine Checkers, stock, device API |

## Run it locally

```bash
npm install
cp .env.example .env.local   # add the Supabase URL and the publishable (anon) key
npm run dev                  # http://localhost:3000
```

The public website works without Supabase. Sign-in and the portal need it.

## Set up Supabase

1. Create a project (region **Mumbai, ap-south-1**).
2. **SQL Editor:** run `modules/1-accounts/database.sql`, then 2, 3, 4, 5. Every file is safe to run again.
3. Follow the **Set up** section of each module's README (phone sign-in, admin email and authenticator, and so on).

## Deploy

Pushing to `main` deploys on Vercel. In Vercel → Settings → Environment Variables set:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the **publishable** key, never the secret key)
- `NEXT_PUBLIC_SITE_URL`

## Folders

```
modules/        the five parts: database.sql + README.md each (device software in 5-devices)
src/app/        website pages
  (marketing)/  public site (home, how it works, contact, …)
  (auth)/login  sign-in pages (module 1; admin sign-in is module 2)
  app/          the portal: admin/, patient/, doctor/, vendor/ (modules 2–5)
  api/device/   the device API (module 5)
src/lib/        shared helpers (each module README lists which are its own)
```
