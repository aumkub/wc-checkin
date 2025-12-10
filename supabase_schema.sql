-- Supabase table schemas for WC Check-in app
-- Run these SQL commands in your Supabase SQL Editor

-- Create attendees table
CREATE TABLE IF NOT EXISTS attendees (
  id TEXT PRIMARY KEY,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  email TEXT NOT NULL,
  "ticketType" TEXT NOT NULL,
  "checkedIn" BOOLEAN DEFAULT FALSE,
  "checkInTime" TIMESTAMPTZ,
  "purchaseDate" TEXT,
  country TEXT,
  "severeAllergy" TEXT,
  "accessibilityNeeds" TEXT,
  "firstTimeAttending" TEXT,
  notes TEXT
);

-- Create ticket_config table
CREATE TABLE IF NOT EXISTS ticket_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  "activeTypes" JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_attendees_email ON attendees(email);
CREATE INDEX IF NOT EXISTS idx_attendees_ticket_type ON attendees("ticketType");
CREATE INDEX IF NOT EXISTS idx_attendees_checked_in ON attendees("checkedIn");

-- Enable Row Level Security (RLS) - adjust policies as needed
ALTER TABLE attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_config ENABLE ROW LEVEL SECURITY;

-- Create policies to allow anonymous access (since we're using anon key)
-- Adjust these policies based on your security requirements
CREATE POLICY "Allow anonymous read access to attendees" ON attendees
  FOR SELECT USING (true);

CREATE POLICY "Allow anonymous insert/update to attendees" ON attendees
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous update to attendees" ON attendees
  FOR UPDATE USING (true);

CREATE POLICY "Allow anonymous read access to ticket_config" ON ticket_config
  FOR SELECT USING (true);

CREATE POLICY "Allow anonymous update to ticket_config" ON ticket_config
  FOR UPDATE USING (true);

CREATE POLICY "Allow anonymous insert to ticket_config" ON ticket_config
  FOR INSERT WITH CHECK (true);

