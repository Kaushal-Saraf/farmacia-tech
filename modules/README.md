# Modules

The platform is five parts. Each folder has one `database.sql` (that part's tables and rules) and one `README.md` (what it does, its pages, its code files, how to set it up and test it). You can work on one part without reading the others.

| # | Module | What it is | Who uses it |
|---|---|---|---|
| 1 | [accounts](1-accounts/README.md) | Sign-in, profiles, roles | everyone |
| 2 | [admin](2-admin/README.md) | Admin sign-in (email code + authenticator app), activity log, enquiries | Farmacia Tech staff |
| 3 | [patients](3-patients/README.md) | Family members on one number, prescriptions to read and print | patients |
| 4 | [doctors](4-doctors/README.md) | Doctor verification, prescription writer | doctors (admin approves them) |
| 5 | [devices](5-devices/README.md) | Vending machines and Medicine Checkers: devices, stock, scans, device API | operators (admin registers devices) |

## Set up the database

In Supabase → **SQL Editor**, run each `database.sql` in order: **1 → 2 → 3 → 4 → 5**. Paste the whole file, click **Run**, then do the next one.

- **Safe to run again.** If a module's file changes, paste the whole file again. Your data stays.
- Order matters only because later modules use earlier ones. For example, module 4 uses the family members from module 3.

## Other Supabase settings

Each module's README lists its own. In short:
- **Phone sign-in:** module 1
- **Admin email, SMTP, authenticator app:** module 2
- **Doctor document storage:** module 4 (created by its `database.sql`)

## Where the website code is

Next.js needs the pages under `src/app`, so they stay there. They are already grouped by part:

| Folder | Module |
|---|---|
| `src/app/(auth)/login` | 1 accounts, 2 admin (`login/admin`) |
| `src/app/app/admin` | 2 admin |
| `src/app/app/patient` | 3 patients |
| `src/app/app/doctor` | 4 doctors |
| `src/app/app/vendor`, `src/app/api/device` | 5 devices |

Each module README lists its exact files.
