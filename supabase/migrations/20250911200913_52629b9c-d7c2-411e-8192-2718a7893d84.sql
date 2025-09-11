-- Fix the analyze_progress function to use SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.analyze_progress()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY INVOKER -- Changed from DEFINER to INVOKER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- For now, return a simple success response since the edge function handles the logic
  RETURN json_build_object(
    'status', 'success',
    'message', 'Progress analysis available'
  );
END;
$function$;