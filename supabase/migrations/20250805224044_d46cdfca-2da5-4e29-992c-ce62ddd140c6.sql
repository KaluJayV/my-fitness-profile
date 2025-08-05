-- Create the user profile for Jeff (auth user creation via admin will be done separately)
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