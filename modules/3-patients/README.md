# 3 · Patients and family

**What it does.** One mobile number can hold a whole family: the account holder ("self"), spouse, children, parents. Doctors write each prescription for **one family member**. The account holder sees everyone's prescriptions, can filter by person, and can print any of them.

## Pages

| Page | File |
|---|---|
| `/app/patient` (My prescriptions, filter by person) | `src/app/app/patient/page.tsx` |
| `/app/patient/family` (My family: add, edit, remove) | `src/app/app/patient/family/` |
| `/app/prescriptions/[id]` (one prescription, printable) | `src/app/app/prescriptions/[id]/` |

## Code

| File | What it does |
|---|---|
| `src/app/app/patient/actions.ts` | add, edit and remove family members |
| `src/app/app/MemberFields.tsx` | the name / relation / birth date / gender fields (doctors use them too) |
| `src/lib/family.ts`, `src/lib/family-form.ts` | relation labels, age text, form checks |

## Database (`database.sql`)

- **Tables:**
  - `family_members`
  - `prescriptions`: each one is for a family member; name, age, gender and relation are copied in when it's written
  - `prescription_items`
- **Rules:**
  - The account holder manages their own family. "Self" can't be removed.
  - A prescription is visible to its family's number and to the doctor who wrote it. Nobody else can see it.
  - Doctors' write rules are in module 4.

## Set up

**SQL Editor:** run `database.sql`, after modules 1 and 2.

## Test

1. As a patient, open **My family** and add a child.
2. As a doctor (module 4), write a prescription for that child.
3. As the patient, check **My prescriptions** shows "For <child>", the filter works, and the printout shows the age and gender.
