-- Creator feedback table for internal bug reports/support tickets
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

-- Helpful indexes for filtering
CREATE INDEX IF NOT EXISTS idx_creator_feedback_creator_id ON creator_feedback(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_feedback_company_id ON creator_feedback(company_id);

-- Enable row level security (application handles access control)
ALTER TABLE creator_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow creators to insert feedback reports" ON creator_feedback;
DROP POLICY IF EXISTS "Allow creators to read their feedback reports" ON creator_feedback;

CREATE POLICY "Allow creators to insert feedback reports"
  ON creator_feedback FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow creators to read their feedback reports"
  ON creator_feedback FOR SELECT
  USING (true);
