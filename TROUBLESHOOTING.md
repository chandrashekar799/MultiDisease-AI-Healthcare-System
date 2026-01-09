# Troubleshooting Guide

## Issue: User signup not stored in database

### Solution 1: Update Supabase Database

1. **Go to Supabase Dashboard** → Your Project → **SQL Editor**
2. **Run the updated `supabase-setup.sql` script**
   - This will recreate the trigger and fix RLS policies
   - The trigger automatically creates user profiles on signup

### Solution 2: Check if Trigger Exists

Run this query in Supabase SQL Editor to check if the trigger exists:

```sql
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
```

If it returns no rows, the trigger doesn't exist. Re-run `supabase-setup.sql`.

### Solution 3: Test the Trigger Manually

Run this to see if the trigger function exists:

```sql
SELECT proname FROM pg_proc WHERE proname = 'handle_new_user';
```

### Solution 4: Check RLS Policies

Verify RLS is enabled and policies exist:

```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users';

SELECT * FROM pg_policies WHERE tablename = 'users';
```

### Solution 5: Manual User Creation (Temporary Fix)

If the trigger isn't working, you can manually create a user profile:

1. Sign up a user
2. Go to Supabase Dashboard → **Table Editor** → `users` table
3. Click **Insert row**
4. Enter:
   - `id`: Copy from `auth.users` table (find the user by email)
   - `email`: User's email
   - `role`: 'patient', 'doctor', or 'fundraiser'
   - `name`: User's name

### Solution 6: Disable RLS Temporarily (Development Only)

⚠️ **WARNING: Only for development/testing!**

```sql
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
```

After testing, re-enable it:

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
```

## Issue: Sign in returns nothing

This usually means:
1. User profile doesn't exist in `users` table
2. RLS policy is blocking the query

**Fix**: The updated code now automatically creates a user profile if it doesn't exist during sign-in.

## Common Errors

### "new row violates row-level security policy"
- **Cause**: RLS policy is blocking the insert
- **Fix**: Make sure you've run the updated `supabase-setup.sql` script
- The trigger should handle this automatically

### "relation 'users' does not exist"
- **Cause**: Table hasn't been created
- **Fix**: Run `supabase-setup.sql` to create the table

### "function handle_new_user() does not exist"
- **Cause**: Trigger function wasn't created
- **Fix**: Run `supabase-setup.sql` to create the function

## Verification Steps

After running `supabase-setup.sql`, verify:

1. **Table exists**:
   ```sql
   SELECT * FROM users LIMIT 1;
   ```

2. **Trigger exists**:
   ```sql
   SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created';
   ```

3. **Function exists**:
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'handle_new_user';
   ```

4. **RLS is enabled**:
   ```sql
   SELECT tablename, rowsecurity FROM pg_tables 
   WHERE schemaname = 'public' AND tablename = 'users';
   ```

## Still Having Issues?

1. Check browser console for errors
2. Check Supabase logs: Dashboard → Logs → Postgres Logs
3. Verify environment variables in `.env.local`
4. Make sure you're using the correct Supabase project

