# Fix for Row Level Security Policy Error

## Problem
When signing up, you get the error: "new row violates row-level security policy for table 'users'"

## Solution
A database trigger has been added that automatically creates the user profile when a new user signs up. This bypasses RLS because it runs with `SECURITY DEFINER` privileges.

## Steps to Fix

1. **Go to your Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Run the Updated SQL Script**
   - Copy the entire contents of `supabase-setup.sql`
   - Paste it into the SQL Editor
   - Click "Run" (or press Ctrl+Enter)

   This will:
   - Create the tables if they don't exist
   - Set up Row Level Security policies
   - Create a trigger function that automatically creates user profiles on signup

4. **Test the Signup**
   - Go back to your application
   - Try signing up again
   - The user profile should be created automatically

## What Changed

The updated `supabase-setup.sql` now includes:
- A `handle_new_user()` function that runs with elevated privileges
- A trigger that fires when a new user is created in `auth.users`
- The trigger automatically inserts the user profile into the `users` table

This means you no longer need to manually insert into the `users` table from the client - it happens automatically!

## Alternative: If You Still Have Issues

If the trigger doesn't work, you can temporarily disable RLS for testing (NOT recommended for production):

```sql
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
```

But the trigger approach is the correct and secure solution.

