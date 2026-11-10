# Staff Email/Password Authentication

Updated: 2026-11-10

## Policy

Frog Management is a private staff application. Only administrators provision staff logins. No social login, public signup page, customer accounts or shared staff credentials.

- The Supabase Auth user stores the password securely. Never put passwords in public tables, GitHub, client environment variables or the staff allowlist.
- Each employee gets a unique, confirmed email/password account in Supabase Authentication > Users.
- The separate `public.staff_allowlist` determines whether that email can access a workshop business unit and whether the role is Owner or Staff.
- Both an active allowlist entry **and** a confirmed Supabase email account with email provider are required. A revoked user loses database permissions even if their browser session remains active.
- Password changes, account deletion and account recovery must be completed through a secure administrator-managed process. Do not distribute reusable shared passwords.

## Hosted configuration

Project: `swkbnkazjxgvnhkwrcyx` (The Frog Art Space). Do not change Dioxyzine Frog.

Hosted acceptance on 2026-11-10: Email is enabled, social providers and public signup are disabled, and email confirmation is required. One Owner and two Staff accounts have confirmed email identities, passwords and matching active allowlist entries. Direct database checks verified their roles, blocked unapproved access and rejected forged Owner claims. The project owner reports that app sign-in and permissions work during regular testing; that browser acceptance was not independently repeated by the agent. Actual Auth-service hook invocation remains separate from direct SQL hook checks.

1. Under **Authentication > Providers**, keep **Email** enabled and disable Google and other social login providers.
2. Disable **Allow new users to sign up** in the project's Auth settings. The UI has no signup route, but this setting is essential to prevent direct public API signup.
3. Under **Authentication > Hooks**, configure **Before User Created** using Postgres function `public.before_user_created`. The function only approves an active email in `public.staff_allowlist`. The hook already has grants for `supabase_auth_admin` from the original migrations.
4. Use `Authentication > Users` to create a confirmed user with email and a unique strong password. Keep passwords out of chat and version control.
5. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local` or the deployment's environment configuration; do not add secret/service-role keys to the frontend.
6. Run the Next.js app at `http://localhost:3000/vi/login` for local acceptance. The login form uses `signInWithPassword` and checks `get_access_context` after signing in.

## Initial owner

After the database seed is present, run the following **once in the Frog Art Space SQL Editor**, replacing the email with the intended owner email:

```sql
insert into public.staff_allowlist (business_unit_id, email, role, active)
select id, lower('YOUR_OWNER_EMAIL'), 'owner', true
from public.business_units where slug = 'workshop'
on conflict (business_unit_id, email)
do update set role = 'owner', active = true;
```

Then provision the corresponding confirmed email/password user in Authentication > Users. Do not create a second owner login without an operational need.

## Adding staff

1. The Owner adds a new employee email as Staff in **Settings**. This adds an allowlist entry, **not** a password.
2. The administrator provisions the same email under **Supabase Authentication > Users**, setting a unique password and confirmed email.
3. The employee signs in using their own email and password. If disabled in Settings, RLS blocks all protected queries.

## Checks before acceptance

- Owner with correct credentials logs in and sees Owner-only pages.
- Staff with correct credentials logs in but cannot view or edit financial/owner-only data.
- Unknown email or incorrect password cannot log in.
- Signed-in but non-allowlisted email cannot load the workspace.
- Disabled staff loses access to business records immediately.
- Unconfirmed email does not pass database role checks.
- Social OAuth is disabled, and public email signup fails directly through Supabase Auth.
- The Before User Created hook allows approved email accounts and rejects unapproved or social-provider accounts.
- A database migration `supabase/migrations/20261109143532_staff_password_auth.sql` changes existing RLS helpers and the signup hook without recreating business tables.

Repeat this checklist when provisioning another environment or changing authentication. The 2026-11-10 owner-reported login acceptance and database permission checks apply to the existing Frog Art Space project, not to an unconfigured copy.
