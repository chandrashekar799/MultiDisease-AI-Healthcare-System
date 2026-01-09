-- Supabase Database Setup Script
-- Run this in your Supabase SQL Editor

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('doctor', 'patient', 'fundraiser')),
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create consultations table
CREATE TABLE IF NOT EXISTS consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symptoms TEXT NOT NULL,
  analysis TEXT NOT NULL,
  doctor_approved BOOLEAN DEFAULT FALSE,
  fund_raised DECIMAL(10, 2) DEFAULT 0,
  doctor_notes TEXT,
  prescription TEXT,
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create doctor_points table for tracking doctor achievements
CREATE TABLE IF NOT EXISTS doctor_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
  points INTEGER DEFAULT 0,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create donations table for tracking fundraising
CREATE TABLE IF NOT EXISTS donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  fundraiser_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  donor_name TEXT,
  donor_email TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running script)
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Patients can view their own consultations" ON consultations;
DROP POLICY IF EXISTS "Patients can insert their own consultations" ON consultations;
DROP POLICY IF EXISTS "Doctors can view all consultations" ON consultations;
DROP POLICY IF EXISTS "Doctors can update consultations" ON consultations;
DROP POLICY IF EXISTS "Fundraisers can view all consultations" ON consultations;
DROP POLICY IF EXISTS "Fundraisers can update fund_raised" ON consultations;
DROP POLICY IF EXISTS "Doctors can view their own points" ON doctor_points;
DROP POLICY IF EXISTS "Doctors can insert their own points" ON doctor_points;
DROP POLICY IF EXISTS "Fundraisers can view all donations" ON donations;
DROP POLICY IF EXISTS "Fundraisers can insert donations" ON donations;
DROP POLICY IF EXISTS "Fundraisers can update fund_raised" ON consultations;

-- Create policies for users table
CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- Create policies for consultations table
CREATE POLICY "Patients can view their own consultations"
  ON consultations FOR SELECT
  USING (auth.uid() = patient_id);

CREATE POLICY "Patients can insert their own consultations"
  ON consultations FOR INSERT
  WITH CHECK (auth.uid() = patient_id);

-- Allow doctors to view all consultations
CREATE POLICY "Doctors can view all consultations"
  ON consultations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'doctor'
    )
  );

-- Allow fundraisers to view all consultations
CREATE POLICY "Fundraisers can view all consultations"
  ON consultations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'fundraiser'
    )
  );

-- Allow doctors to update consultations (approve, add notes, prescriptions)
CREATE POLICY "Doctors can update consultations"
  ON consultations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'doctor'
    )
  );

-- Allow fundraisers to update fund_raised in consultations
CREATE POLICY "Fundraisers can update fund_raised"
  ON consultations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'fundraiser'
    )
  );

-- Create policies for doctor_points table
CREATE POLICY "Doctors can view their own points"
  ON doctor_points FOR SELECT
  USING (auth.uid() = doctor_id);

CREATE POLICY "Doctors can insert their own points"
  ON doctor_points FOR INSERT
  WITH CHECK (auth.uid() = doctor_id);

-- Create policies for donations table
CREATE POLICY "Fundraisers can view all donations"
  ON donations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'fundraiser'
    )
  );

CREATE POLICY "Fundraisers can insert donations"
  ON donations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'fundraiser'
    )
    AND fundraiser_id = auth.uid()
  );


-- Create a function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, role, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient')::TEXT,
    COALESCE(NEW.raw_user_meta_data->>'name', COALESCE(NEW.email, 'User'))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger that fires when a new user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
