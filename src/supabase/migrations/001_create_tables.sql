-- Float Plan App Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES TABLE (extends Supabase auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================
-- HOUSEHOLDS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS households (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE households ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HOUSEHOLD MEMBERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS household_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(household_id, user_id)
);

ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;

-- ============================================
-- BOATS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS boats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id UUID REFERENCES households(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  type TEXT,
  make TEXT,
  model TEXT,
  year INTEGER,
  length_ft DECIMAL,
  beam_ft DECIMAL,
  draft_ft DECIMAL,
  hull_color TEXT,
  registration_number TEXT,
  hin TEXT,
  engine_type TEXT,
  engine_count INTEGER DEFAULT 1,
  fuel_capacity_gallons DECIMAL,
  water_capacity_gallons DECIMAL,
  holding_capacity_gallons DECIMAL,
  home_port TEXT,
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE boats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own boats" ON boats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own boats" ON boats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own boats" ON boats FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own boats" ON boats FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- CONTACTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id UUID REFERENCES households(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  relationship TEXT,
  is_emergency_contact BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own contacts" ON contacts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own contacts" ON contacts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own contacts" ON contacts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own contacts" ON contacts FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- FLOAT PLANS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS float_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  boat_id UUID REFERENCES boats(id) ON DELETE SET NULL,
  household_id UUID REFERENCES households(id) ON DELETE SET NULL,
  
  -- Vessel info (copied from boat or entered manually)
  vessel_name TEXT NOT NULL,
  vessel_type TEXT,
  vessel_description TEXT,
  
  -- Route
  departure TEXT NOT NULL,
  departure_lat DECIMAL,
  departure_lng DECIMAL,
  destination TEXT NOT NULL,
  destination_lat DECIMAL,
  destination_lng DECIMAL,
  route_details TEXT,
  
  -- Timing
  departure_time TIMESTAMPTZ,
  expected_return_time TIMESTAMPTZ,
  check_in_deadline TIMESTAMPTZ NOT NULL,
  trip_duration_hours INTEGER,
  grace_period_minutes INTEGER DEFAULT 30,
  escalation_wait_minutes INTEGER DEFAULT 30,
  
  -- Emergency contacts
  primary_emergency_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  secondary_emergency_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  
  -- Crew (stored as JSONB array)
  crew JSONB DEFAULT '[]',
  
  -- Tank levels (stored as JSONB)
  departure_tanks JSONB DEFAULT '{}',
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'checked_in', 'overdue', 'cancelled')),
  checked_in_at TIMESTAMPTZ,
  
  -- Misc
  notes TEXT,
  weather_conditions TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE float_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own float plans" ON float_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own float plans" ON float_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own float plans" ON float_plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own float plans" ON float_plans FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- INVENTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  boat_id UUID REFERENCES boats(id) ON DELETE CASCADE,
  household_id UUID REFERENCES households(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  category TEXT,
  quantity INTEGER DEFAULT 1,
  location TEXT,
  expiration_date DATE,
  notes TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own inventory" ON inventory FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own inventory" ON inventory FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own inventory" ON inventory FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own inventory" ON inventory FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- TASKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  boat_id UUID REFERENCES boats(id) ON DELETE CASCADE,
  household_id UUID REFERENCES households(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tasks" ON tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tasks" ON tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks" ON tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tasks" ON tasks FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- TANK LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS tank_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  boat_id UUID NOT NULL REFERENCES boats(id) ON DELETE CASCADE,
  fuel_level DECIMAL,
  water_level DECIMAL,
  holding_level DECIMAL,
  notes TEXT,
  logged_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tank_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tank logs" ON tank_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tank logs" ON tank_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- TRIGGERS for updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_households_updated_at BEFORE UPDATE ON households FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_boats_updated_at BEFORE UPDATE ON boats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_float_plans_updated_at BEFORE UPDATE ON float_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INDEXES for better query performance
-- ============================================
CREATE INDEX idx_boats_user_id ON boats(user_id);
CREATE INDEX idx_contacts_user_id ON contacts(user_id);
CREATE INDEX idx_float_plans_user_id ON float_plans(user_id);
CREATE INDEX idx_float_plans_status ON float_plans(status);
CREATE INDEX idx_inventory_user_id ON inventory(user_id);
CREATE INDEX idx_inventory_boat_id ON inventory(boat_id);
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tank_logs_boat_id ON tank_logs(boat_id);
