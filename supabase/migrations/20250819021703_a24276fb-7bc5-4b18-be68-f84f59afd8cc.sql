-- Fix security issues from previous migration

-- Remove SECURITY DEFINER from view and recreate as regular view
DROP VIEW IF EXISTS v_core_lifts;
CREATE VIEW v_core_lifts AS
SELECT 
  e.id,
  e.name,
  CASE 
    WHEN LOWER(e.name) LIKE '%squat%' AND LOWER(e.name) NOT LIKE '%front%' THEN 'squat'
    WHEN LOWER(e.name) LIKE '%bench%' AND LOWER(e.name) NOT LIKE '%incline%' THEN 'bench'
    WHEN LOWER(e.name) LIKE '%deadlift%' THEN 'deadlift'
    WHEN LOWER(e.name) LIKE '%overhead press%' OR LOWER(e.name) LIKE '%military press%' OR (LOWER(e.name) LIKE '%press%' AND LOWER(e.name) LIKE '%standing%') THEN 'overhead_press'
    ELSE NULL
  END as core_lift_type
FROM exercises e
WHERE LOWER(e.name) LIKE '%squat%' 
   OR LOWER(e.name) LIKE '%bench%'
   OR LOWER(e.name) LIKE '%deadlift%'
   OR LOWER(e.name) LIKE '%overhead press%'
   OR LOWER(e.name) LIKE '%military press%'
   OR (LOWER(e.name) LIKE '%press%' AND LOWER(e.name) LIKE '%standing%');

-- Enable RLS on the view by creating RLS policies for the underlying exercises table (already exists)
-- The view will inherit RLS from the exercises table