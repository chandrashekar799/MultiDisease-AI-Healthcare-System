# AI Doctor - Setup Guide

## Quick Start

Follow these steps to get your AI Doctor application up and running:

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Your `.env.local` file should already be created with:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
- `NEXT_PUBLIC_GEMINI_API_KEY` - Your Gemini API key

### 3. Set Up Supabase Database

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Navigate to **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy and paste the entire contents of `supabase-setup.sql`
5. Click **Run** (or press Ctrl+Enter)

This will create:
- `users` table - Stores user profiles with roles
- `consultations` table - Stores patient consultation history
- Row Level Security (RLS) policies for data protection

### 4. Start the Development Server

```bash
npm run dev
```

The application will be available at: **http://localhost:3000**

### 5. Test the Application

1. **Sign Up** as a Patient:
   - Go to http://localhost:3000
   - Click "Sign Up"
   - Enter your name, select "Patient" role
   - Enter email and password
   - Click "Sign Up"

2. **Test Chat Mode**:
   - After login, you'll see the Patient Dashboard
   - Click "Chat Mode" (default)
   - Enter symptoms manually or select from dropdown
   - Click "Send" to get AI analysis
   - The consultation will be saved automatically

3. **View History**:
   - Click "History" tab
   - See all your past consultations as cards
   - Click "Show More" to expand long analyses

## Project Structure

```
aidoctor/
├── app/
│   ├── api/
│   │   └── analyze-symptoms/    # API route for Gemini AI
│   ├── dashboard/
│   │   ├── patient/             # Patient dashboard
│   │   ├── doctor/              # Doctor dashboard (placeholder)
│   │   └── fundraiser/          # Fundraiser dashboard (placeholder)
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Login/Signup page
│   └── globals.css              # Global styles
├── lib/
│   ├── supabase.ts              # Supabase client
│   └── gemini.ts                # Gemini API wrapper
├── types/
│   └── index.ts                 # TypeScript types
└── supabase-setup.sql           # Database setup script
```

## Features Implemented

### ✅ Patient Portal
- **Chat Mode**: 
  - Manual symptom input
  - Dropdown symptom selection
  - Real-time AI analysis using Gemini
  - Automatic consultation saving
  
- **History**:
  - View all past consultations
  - Expandable cards for long analyses
  - Date/time stamps

### ✅ Authentication
- Three user types: Doctor, Patient, Fundraiser
- Secure sign up and sign in
- Role-based routing

### 🔄 Coming Soon
- Doctor dashboard functionality
- Fundraiser dashboard functionality
- Additional features as requested

## Troubleshooting

### Database Connection Issues
- Verify your Supabase URL and API key in `.env.local`
- Check that you've run the SQL setup script
- Ensure Row Level Security is enabled

### Gemini API Errors
- Verify your API key is correct
- Check your API quota/limits
- Ensure network connectivity

### Authentication Issues
- Clear browser cache and cookies
- Verify Supabase Auth is enabled in your project
- Check browser console for errors

## Next Steps

Once the basic setup is working, you can:
1. Test all three user types (Doctor, Patient, Fundraiser)
2. Add more symptoms to the dropdown
3. Customize the UI/UX
4. Implement Doctor and Fundraiser features

## Support

If you encounter any issues:
1. Check the browser console for errors
2. Check the terminal for server errors
3. Verify all environment variables are set correctly
4. Ensure Supabase database is properly configured

