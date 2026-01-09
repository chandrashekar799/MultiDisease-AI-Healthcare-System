-- Migration: Create donations table for fundraiser functionality
-- Run this in your Supabase SQL Editor

-- Create donations table if it doesn't exist
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
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Fundraisers can view all donations" ON donations;
DROP POLICY IF EXISTS "Fundraisers can insert donations" ON donations;
DROP POLICY IF EXISTS "Fundraisers can view all consultations" ON consultations;
DROP POLICY IF EXISTS "Fundraisers can update consultations" ON consultations;

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

-- Allow fundraisers to update fund_raised in consultations
CREATE POLICY "Fundraisers can update consultations"
  ON consultations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'fundraiser'
    )
  );

