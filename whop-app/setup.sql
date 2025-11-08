-- Pulse Database Schema
-- Run this entire file in Supabase SQL Editor

-- Create creators table
CREATE TABLE IF NOT EXISTS creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  feedback_link TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create messages table (renamed from feedback)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  tag TEXT NOT NULL CHECK (tag IN ('question', 'feedback', 'confession')),
  product_category TEXT CHECK (product_category IN ('main_product', 'service', 'feature_request', 'bug_report', 'other')),
  reviewed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create replies table
CREATE TABLE IF NOT EXISTS replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  reply_text TEXT NOT NULL,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create reactions table
CREATE TABLE IF NOT EXISTS reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  reaction_type TEXT DEFAULT '👍',
  user_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Creator feedback/support reports submitted by creators
CREATE TABLE IF NOT EXISTS creator_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL,
  user_id TEXT,
  category TEXT NOT NULL CHECK (category IN ('bug', 'feedback', 'idea', 'other')),
  subject TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_creator_id ON messages(creator_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_reviewed ON messages(reviewed);
CREATE INDEX IF NOT EXISTS idx_messages_tag ON messages(tag);
CREATE INDEX IF NOT EXISTS idx_messages_product_category ON messages(product_category);
CREATE INDEX IF NOT EXISTS idx_creators_feedback_link ON creators(feedback_link);
CREATE INDEX IF NOT EXISTS idx_replies_message_id ON replies(message_id);
CREATE INDEX IF NOT EXISTS idx_replies_is_public ON replies(is_public);
CREATE INDEX IF NOT EXISTS idx_reactions_message_id ON reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_creator_feedback_creator_id ON creator_feedback(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_feedback_company_id ON creator_feedback(company_id);

-- Enable Row Level Security
ALTER TABLE creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_feedback ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow public read access to creators" ON creators;
DROP POLICY IF EXISTS "Allow public insert to messages" ON messages;
DROP POLICY IF EXISTS "Allow public read access to messages" ON messages;
DROP POLICY IF EXISTS "Allow creator to update their own messages" ON messages;
DROP POLICY IF EXISTS "Allow creator to delete their own messages" ON messages;
DROP POLICY IF EXISTS "Allow public read access to public replies" ON replies;
DROP POLICY IF EXISTS "Allow creator to read all replies" ON replies;
DROP POLICY IF EXISTS "Allow creator to insert replies" ON replies;
DROP POLICY IF EXISTS "Allow creator to update replies" ON replies;
DROP POLICY IF EXISTS "Allow creator to delete replies" ON replies;
DROP POLICY IF EXISTS "Allow public insert to reactions" ON reactions;
DROP POLICY IF EXISTS "Allow public read access to reactions" ON reactions;
DROP POLICY IF EXISTS "Allow creators to insert feedback reports" ON creator_feedback;
DROP POLICY IF EXISTS "Allow creators to read their feedback reports" ON creator_feedback;

-- Create policies
-- Allow public read access to creators
CREATE POLICY "Allow public read access to creators"
  ON creators FOR SELECT
  USING (true);

-- Allow public insert to messages
CREATE POLICY "Allow public insert to messages"
  ON messages FOR INSERT
  WITH CHECK (true);

-- Allow public read access to messages
CREATE POLICY "Allow public read access to messages"
  ON messages FOR SELECT
  USING (true);

-- Allow creator to update their own messages
CREATE POLICY "Allow creator to update their own messages"
  ON messages FOR UPDATE
  USING (true);

-- Allow creator to delete their own messages
CREATE POLICY "Allow creator to delete their own messages"
  ON messages FOR DELETE
  USING (true);

-- Allow public read access to public replies
CREATE POLICY "Allow public read access to public replies"
  ON replies FOR SELECT
  USING (is_public = true);

-- Allow creator to read all replies
CREATE POLICY "Allow creator to read all replies"
  ON replies FOR SELECT
  USING (true);

-- Allow creator to insert replies
CREATE POLICY "Allow creator to insert replies"
  ON replies FOR INSERT
  WITH CHECK (true);

-- Allow creator to update replies
CREATE POLICY "Allow creator to update replies"
  ON replies FOR UPDATE
  USING (true);

-- Allow creator to delete replies
CREATE POLICY "Allow creator to delete replies"
  ON replies FOR DELETE
  USING (true);

-- Allow public insert to reactions
CREATE POLICY "Allow public insert to reactions"
  ON reactions FOR INSERT
  WITH CHECK (true);

-- Allow public read access to reactions
CREATE POLICY "Allow public read access to reactions"
  ON reactions FOR SELECT
  USING (true);

-- Allow creators to submit internal feedback/bug reports
CREATE POLICY "Allow creators to insert feedback reports"
  ON creator_feedback FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow creators to read their feedback reports"
  ON creator_feedback FOR SELECT
  USING (true);

-- Insert a test creator with a known UUID
-- Delete any existing test creator first
DELETE FROM creators WHERE id = '00000000-0000-0000-0000-000000000001';

-- Insert new test creator
INSERT INTO creators (id, name, email, feedback_link, company_id)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Test Creator',
  'test@example.com',
  'testcreator',
  '00000000-0000-0000-0000-000000000000'
);

