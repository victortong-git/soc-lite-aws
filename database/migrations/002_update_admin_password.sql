-- Update admin password to 'socDemo2025!'
UPDATE user_accts
SET password_hash = '$2b$10$VHlbncDueXPf0JYhadpniOMBACvkcXBZsl1fep60ZgZHhW7O68FAm'
WHERE username = 'admin';

-- Verify the update
SELECT username, full_name, role, is_active, created_at
FROM user_accts
WHERE username = 'admin';
