-- Create test user Jeff with email/password auth
-- Note: This creates the auth user which will automatically trigger user profile creation

INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  'jeff@example.com',
  '$2a$10$Q9ZjP9PQKl.fWyW4Rz1qeOj8yYq4tZnZYzFzKyZrBZrPzBxZqVqZy',  -- This is 'password' hashed
  NOW(),
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
) ON CONFLICT (email) DO NOTHING;

-- Create the user profile for Jeff
INSERT INTO public.users (
  id,
  username,
  email,
  goal,
  experience,
  equipment,
  injuries
) VALUES (
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  'jeff',
  'jeff@example.com',
  'Muscle Building',
  'Intermediate',
  ARRAY['Dumbbells', 'Barbell', 'Bench'],
  ARRAY[]::text[]
) ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  email = EXCLUDED.email,
  goal = EXCLUDED.goal,
  experience = EXCLUDED.experience,
  equipment = EXCLUDED.equipment,
  injuries = EXCLUDED.injuries;