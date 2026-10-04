# Database

Schema as migrations, applied in order. The database is permanent (D-0034): never
recreate it; add a new migration for every change.

## Applying a migration without the Supabase CLI

Open the project's SQL editor in the Supabase dashboard, paste the migration file's
contents, and run it. Apply files in filename order. Each file is written to be safe
to run once; running one twice will error on "already exists", which is harmless but
means it was already applied.

## Making the owner's account an administrator

After signing in to the site once (which creates the account row), run in the SQL
editor, replacing the email:

```sql
update accounts set role = 'owner', trusted = true
where id = (select id from auth.users where email = 'you@example.com');
```
