-- Update Jeff's profile email to match the new auth email
UPDATE public.users 
SET email = 'jeff@test.com'
WHERE username = 'jeff' AND email = 'jeff@example.com';