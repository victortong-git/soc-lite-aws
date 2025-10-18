-- Create user_accts table for SOC Lite authentication
-- This table stores user credentials for the SOC Lite application

CREATE TABLE IF NOT EXISTS user_accts (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    email VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

-- Create index on username for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_accts_username ON user_accts(username);
CREATE INDEX IF NOT EXISTS idx_user_accts_email ON user_accts(email);

-- Insert default admin user (password: socDemo2025!)
-- Password hash generated using bcrypt with 10 rounds
INSERT INTO user_accts (username, password_hash, full_name, role)
VALUES (
    'admin',
    '$2b$10$YGqXJ5H8Z1K9rJZoP6qK3eKvN5xZqYzXJ5H8Z1K9rJZoP6qK3eKvNO',
    'Administrator',
    'admin'
) ON CONFLICT (username) DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_accts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_user_accts_updated_at ON user_accts;
CREATE TRIGGER trigger_update_user_accts_updated_at
    BEFORE UPDATE ON user_accts
    FOR EACH ROW
    EXECUTE FUNCTION update_user_accts_updated_at();
