-- Create authorized_emails table with pre-approved users
CREATE TABLE IF NOT EXISTS authorized_emails (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'viewer',
    department VARCHAR(100),
    added_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- Add authentication columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP,
ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;

-- Make email unique in users table
ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);

-- Seed authorized emails (add your team members here)
INSERT INTO authorized_emails (email, role, department, notes) VALUES
('admin@tlink.com', 'admin', 'Administration', 'System Administrator'),
('manager@tlink.com', 'manager', 'Operations', 'Operations Manager'),
('tech@tlink.com', 'technician', 'Laboratory', 'Lab Technician'),
('viewer@tlink.com', 'viewer', 'General', 'Read-only access')
ON CONFLICT (email) DO NOTHING;

-- Create index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_authorized_emails_email ON authorized_emails(email);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

COMMENT ON TABLE authorized_emails IS 'Pre-approved email addresses that can register for system access';
COMMENT ON COLUMN users.password_hash IS 'Bcrypt hashed password';
COMMENT ON COLUMN users.is_active IS 'Whether user account is active';
COMMENT ON COLUMN users.email_verified IS 'Whether email has been verified';
COMMENT ON COLUMN users.failed_login_attempts IS 'Counter for failed login attempts (locks at 5)';
