-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tables with app_e2e1 prefix
CREATE TABLE IF NOT EXISTS app_e2e1_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_e2e1_workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  duration INTEGER NOT NULL CHECK (duration > 0),
  intensity TEXT CHECK (intensity IN ('low', 'moderate', 'high')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_app_e2e1_workouts_user_id ON app_e2e1_workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_app_e2e1_workouts_created_at ON app_e2e1_workouts(created_at);

-- Enable RLS
ALTER TABLE app_e2e1_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_e2e1_workouts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
DROP POLICY IF EXISTS "Users can view own profile" ON app_e2e1_profiles;
CREATE POLICY "Users can view own profile" ON app_e2e1_profiles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON app_e2e1_profiles;
CREATE POLICY "Users can insert own profile" ON app_e2e1_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON app_e2e1_profiles;
CREATE POLICY "Users can update own profile" ON app_e2e1_profiles
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own profile" ON app_e2e1_profiles;
CREATE POLICY "Users can delete own profile" ON app_e2e1_profiles
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for workouts
DROP POLICY IF EXISTS "Users can view own workouts" ON app_e2e1_workouts;
CREATE POLICY "Users can view own workouts" ON app_e2e1_workouts
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own workouts" ON app_e2e1_workouts;
CREATE POLICY "Users can create own workouts" ON app_e2e1_workouts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own workouts" ON app_e2e1_workouts;
CREATE POLICY "Users can update own workouts" ON app_e2e1_workouts
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own workouts" ON app_e2e1_workouts;
CREATE POLICY "Users can delete own workouts" ON app_e2e1_workouts
  FOR DELETE USING (auth.uid() = user_id);

-- Add to realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'app_e2e1_workouts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_e2e1_workouts;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'app_e2e1_profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_e2e1_profiles;
  END IF;
END $$;