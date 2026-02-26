-- Migration 014: Create login_history table for proper activity tracking
-- The users.last_login column only stores the MOST RECENT login time.
-- This table tracks ALL login events for historical reporting.

CREATE TABLE IF NOT EXISTS login_history (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    login_at TIMESTAMP NOT NULL DEFAULT NOW(),
    ip_address VARCHAR(45),
    user_agent TEXT,
    login_type VARCHAR(20) DEFAULT 'password' -- 'password', 'token_refresh', 'signup'
);

-- Index for fast lookups by user and date range
CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_login_at ON login_history(login_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_history_user_date ON login_history(user_id, login_at DESC);

-- Backfill: create a single login_history entry for users who have a last_login set
-- This preserves existing data as a starting point
INSERT INTO login_history (user_id, login_at, login_type)
SELECT id, last_login, 'password'
FROM users
WHERE last_login IS NOT NULL
ON CONFLICT DO NOTHING;
