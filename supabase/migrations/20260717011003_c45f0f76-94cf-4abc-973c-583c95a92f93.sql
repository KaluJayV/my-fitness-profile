
ALTER VIEW public.v_progress SET (security_invoker = true);
ALTER VIEW public.v_core_lifts SET (security_invoker = true);

REVOKE EXECUTE ON FUNCTION public.get_user_history(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_progress(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_exercise_history(uuid,integer,integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_exercise_1rm_data(uuid,integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_exercise_stats(uuid,integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_core_lift_progression(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_current_core_lift_maxes(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_workout_frequency_stats(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.analyze_progress() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_user_history(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_progress(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_exercise_history(uuid,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_exercise_1rm_data(uuid,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_exercise_stats(uuid,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_core_lift_progression(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_core_lift_maxes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_workout_frequency_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.analyze_progress() TO authenticated;
