-- Migration: Add doctor-related fields to consultations table
-- Run this in your Supabase SQL Editor if you already have a consultations table

-- Add doctor_notes column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'consultations' 
        AND column_name = 'doctor_notes'
    ) THEN
        ALTER TABLE consultations ADD COLUMN doctor_notes TEXT;
    END IF;
END $$;

-- Add prescription column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'consultations' 
        AND column_name = 'prescription'
    ) THEN
        ALTER TABLE consultations ADD COLUMN prescription TEXT;
    END IF;
END $$;

-- Add approved_by column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'consultations' 
        AND column_name = 'approved_by'
    ) THEN
        ALTER TABLE consultations ADD COLUMN approved_by UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- Create doctor_points table if it doesn't exist
CREATE TABLE IF NOT EXISTS doctor_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
  points INTEGER DEFAULT 0,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on doctor_points if not already enabled
ALTER TABLE doctor_points ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Doctors can view their own points" ON doctor_points;
DROP POLICY IF EXISTS "Doctors can insert their own points" ON doctor_points;
DROP POLICY IF EXISTS "Doctors can view all consultations" ON consultations;
DROP POLICY IF EXISTS "Doctors can update consultations" ON consultations;

-- Create policies for doctor_points table
CREATE POLICY "Doctors can view their own points"
  ON doctor_points FOR SELECT
  USING (auth.uid() = doctor_id);

CREATE POLICY "Doctors can insert their own points"
  ON doctor_points FOR INSERT
  WITH CHECK (auth.uid() = doctor_id);

-- Create policies for consultations table (if they don't exist)
CREATE POLICY "Doctors can view all consultations"
  ON consultations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'doctor'
    )
  );

CREATE POLICY "Doctors can update consultations"
  ON consultations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'doctor'
    )
  );

