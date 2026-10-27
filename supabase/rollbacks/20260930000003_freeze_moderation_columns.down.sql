DROP TRIGGER IF EXISTS freeze_moderation_columns ON public.applications;
DROP TRIGGER IF EXISTS freeze_moderation_columns ON public.jobs;
DROP TRIGGER IF EXISTS freeze_moderation_columns ON public.employers;
DROP FUNCTION IF EXISTS public.freeze_moderation_columns();
