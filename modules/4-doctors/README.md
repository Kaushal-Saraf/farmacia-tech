# 4 · Doctors

**What it does.**
1. A doctor signs in through **I'm a doctor** and submits their medical registration (number, council, qualification, certificate).
2. Admin approves it (module 2, Doctors tab), which adds the doctor role.
3. The doctor then finds a family by mobile number, picks the family member (or adds one, e.g. a child's first visit), and writes the prescription.

## Pages

| Page | File |
|---|---|
| `/app/doctor` (verification form; after approval, prescriptions issued) | `src/app/app/doctor/page.tsx`, `ApplicationForm.tsx` |
| `/app/doctor/new` (write a prescription) | `src/app/app/doctor/new/` |

## Code

| File | What it does |
|---|---|
| `src/app/app/doctor/actions.ts` | apply as doctor (with document upload), find a family, add a family member, save a prescription |
| `src/app/app/admin/actions.ts` | admin approves or rejects (module 2's page uses it) |

## Database (`database.sql`)

- **Tables:** `doctor_applications`
- **Storage:** private bucket `doctor-docs`. Each doctor uploads only to their own folder; admin can read.
- **Functions:**
  - `review_doctor_application()`: admin only, and logged
  - `find_family_by_phone()`: doctors get only names, relations, ages and genders
  - `doctor_add_family_member()`
  - `create_prescription()`
- **Rules:** only approved doctors can write prescriptions.

## Set up

**SQL Editor:** run `database.sql`, after modules 1–3. It also creates the `doctor-docs` storage bucket.

## Test

1. With a test number, sign in through **I'm a doctor** and submit the form with a PDF.
2. As admin, go to the Doctors tab, use **View document**, then **Approve**.
3. Back as the doctor, you should see **New prescription**. Enter a patient's number → **Find family** → pick a person → issue.
