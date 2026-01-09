# How to Disable Email Confirmation in Supabase

For development purposes, you can disable email confirmation so users can sign up and use the app immediately.

## Steps to Disable Email Confirmation:

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard
   - Select your project

2. **Open Authentication Settings**
   - Click on **Authentication** in the left sidebar
   - Click on **Settings** (or go to Authentication → Configuration)

3. **Disable Email Confirmation**
   - Scroll down to **Email Auth** section
   - Find **"Enable email confirmations"** toggle
   - **Turn it OFF** (disable it)

4. **Save Changes**
   - The changes are saved automatically

5. **Test Again**
   - Go back to your application
   - Try signing up again
   - You should now be able to sign in immediately without email confirmation

## Alternative: Keep Email Confirmation Enabled

If you want to keep email confirmation enabled (recommended for production):

1. Users will receive a confirmation email after signup
2. They need to click the confirmation link in the email
3. After confirming, they can sign in normally

## For Production

In production, you should:
- Keep email confirmation enabled for security
- Add a "Resend confirmation email" feature
- Show a clear message that users need to confirm their email

## Current Behavior

With the current code:
- If email confirmation is **disabled**: Users can sign up and use the app immediately
- If email confirmation is **enabled**: Users see a message to check their email, then they need to confirm before signing in

