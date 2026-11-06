-- YARG: revive "Introuvable" requests after 30 days.
-- Execute ONCE in the Supabase SQL Editor. Does not delete or modify songs.
-- Requires existing yarg_owner_guard() and library_requests table.
BEGIN;
ALTER TABLE public.library_requests
  ADD COLUMN IF NOT EXISTS unfindable_at timestamptz;

CREATE OR REPLACE FUNCTION public.yarg_library_unfindable_stamp()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $stamp$
BEGIN
 IF NEW.status='unfindable' THEN
   -- A fresh 30-day wait starts only on transition INTO "Introuvable".
   IF TG_OP='INSERT' THEN
     NEW.unfindable_at:=coalesce(NEW.unfindable_at,now());
   ELSIF OLD.status IS DISTINCT FROM 'unfindable' THEN
     NEW.unfindable_at:=now();
   ELSE
     NEW.unfindable_at:=coalesce(OLD.unfindable_at,now());
   END IF;
 ELSE
   -- Reset if downloaded or returned to pending.
   NEW.unfindable_at:=NULL;
 END IF;
 RETURN NEW;
END;
$stamp$;
DROP TRIGGER IF EXISTS yarg_library_unfindable_stamp ON public.library_requests;
CREATE TRIGGER yarg_library_unfindable_stamp
 BEFORE INSERT OR UPDATE OF status ON public.library_requests
 FOR EACH ROW EXECUTE FUNCTION public.yarg_library_unfindable_stamp();

-- Legacy "Introuvable" requests have an unknown original change date.
-- Give them a fresh 30-day window rather than invent an old date.
UPDATE public.library_requests
 SET unfindable_at=now()
 WHERE status='unfindable' AND unfindable_at IS NULL;

CREATE OR REPLACE FUNCTION public.yarg_owner_unfindable_dates()
RETURNS TABLE(id text,unfindable_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $read$
BEGIN
 PERFORM public.yarg_owner_guard();
 RETURN QUERY
 SELECT r.id::text,r.unfindable_at
 FROM public.library_requests r
 WHERE r.status='unfindable' AND r.unfindable_at IS NOT NULL;
END;
$read$;
REVOKE ALL ON FUNCTION public.yarg_owner_unfindable_dates() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.yarg_owner_unfindable_dates() TO authenticated;
COMMIT;
