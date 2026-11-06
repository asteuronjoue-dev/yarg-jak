-- YARG / Owner-only removal of archived parties and their calculated title progress
-- Install via Supabase SQL Editor. Does NOT delete anything on installation.
-- The existing public.yarg_owner_guard() must be present.
-- This migration intentionally does not alter yarg_legacy_achievement_credits:
-- these are manually awarded historical credits not traceable to a single session.
--
-- IMPORTANT: If other tables reference these rows with RESTRICT/NO ACTION FK constraints,
-- deletion fails atomically. Inspect the error and add explicit dependent-table cleanup
-- rather than dropping constraints.

CREATE OR REPLACE FUNCTION public.yarg_owner_archived_sessions()
RETURNS TABLE(id uuid, name text, started_at timestamptz, request_count bigint, played_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
BEGIN
  PERFORM public.yarg_owner_guard();
  RETURN QUERY
  SELECT s.id,s.name::text,s.started_at,
    (SELECT count(*) FROM public.performance_requests r WHERE r.party_session_id=s.id),
    (SELECT count(*) FROM public.performance_requests r WHERE r.party_session_id=s.id AND r.status IN ('completed','played'))
  FROM public.party_sessions s
  WHERE NOT coalesce(s.is_active,false)
    AND s.id IS DISTINCT FROM (SELECT ps.current_session_id FROM public.party_settings ps WHERE ps.id=1)
  ORDER BY s.started_at DESC, s.id DESC;
END;
$function$;
REVOKE ALL ON FUNCTION public.yarg_owner_archived_sessions() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.yarg_owner_archived_sessions() TO authenticated;

CREATE OR REPLACE FUNCTION public.yarg_owner_delete_archived_session(
  p_session_id uuid, p_expected_name text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE
  v_name text;
  v_deleted integer := 0;
  v_members integer := 0;
  v_affected uuid[];
  v_user uuid;
  v_original_sub text;
  v_original_claims text;
  v_reconciled integer := 0;
BEGIN
  PERFORM public.yarg_owner_guard();
  IF p_session_id IS NULL OR p_expected_name IS NULL OR length(p_expected_name)<1 THEN
    RAISE EXCEPTION 'Identifiant et nom de session requis';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(21082026,3);
  SELECT s.name INTO v_name FROM public.party_sessions s
    WHERE s.id=p_session_id AND NOT coalesce(s.is_active,false) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Soirée introuvable ou encore active'; END IF;
  IF v_name IS DISTINCT FROM p_expected_name THEN
    RAISE EXCEPTION 'Nom de soirée modifié : actualise la liste avant de supprimer';
  END IF;
  IF EXISTS (SELECT 1 FROM public.party_settings WHERE current_session_id=p_session_id) THEN
    RAISE EXCEPTION 'Impossible de supprimer la session courante';
  END IF;

  -- Affected accounts: both initiators and credited band members.
  -- to_jsonb avoids assuming a field exists in every historical schema revision.
  SELECT coalesce(array_agg(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL),ARRAY[]::uuid[])
    INTO v_affected
  FROM (
    SELECT nullif(to_jsonb(r)->>'requester_profile_id','')::uuid AS user_id
    FROM public.performance_requests r WHERE r.party_session_id=p_session_id
    UNION ALL
    SELECT nullif(to_jsonb(m)->>'rockstar_profile_id','')::uuid AS user_id
    FROM public.performance_members m
    JOIN public.performance_requests r ON r.id=m.performance_request_id
    WHERE r.party_session_id=p_session_id
  ) participants;

  -- Delete members first, so their session performance credits disappear.
  DELETE FROM public.performance_members m
  WHERE m.performance_request_id IN
    (SELECT r.id FROM public.performance_requests r WHERE r.party_session_id=p_session_id);
  GET DIAGNOSTICS v_members=ROW_COUNT;

  DELETE FROM public.performance_requests r WHERE r.party_session_id=p_session_id;
  GET DIAGNOSTICS v_deleted=ROW_COUNT;

  -- Deletion may be rejected by FK dependencies; PostgreSQL rolls back the
  -- entire call, preserving all data if any dependent row still exists.
  DELETE FROM public.party_sessions s WHERE s.id=p_session_id;

  -- Reconcile non-secret earned titles using the SAME metrics as the profile.
  -- For the owner-only function, scope auth.uid() to each affected participant.
  -- Save and restore JWT settings before returning.
  v_original_sub := pg_catalog.current_setting('request.jwt.claim.sub',true);
  v_original_claims := pg_catalog.current_setting('request.jwt.claims',true);
  FOREACH v_user IN ARRAY v_affected LOOP
    PERFORM pg_catalog.set_config('request.jwt.claim.sub',v_user::text,true);
    -- Auth user must be available in both representations for clients using
    -- request.jwt.claims JSON instead of request.jwt.claim.sub.
    IF v_original_claims IS NOT NULL AND v_original_claims <> '' THEN
      PERFORM pg_catalog.set_config('request.jwt.claims',
       pg_catalog.jsonb_set(v_original_claims::jsonb,'{sub}',to_jsonb(v_user::text),true)::text,true);
    END IF;

    -- Preserve manually-granted special/secret titles, remove ONLY ordinary
    -- progress awards that no longer meet the underlying metric threshold.
    UPDATE public.rockstar_profiles p SET equipped_title=NULL, updated_at=now()
    WHERE p.user_id=v_user
      AND EXISTS (
        SELECT 1 FROM public.yarg_profile_titles t
        JOIN public.yarg_title_catalog c ON c.code=t.title_code
        WHERE t.user_id=p.user_id AND c.code=p.equipped_title
          AND c.category <> 'secret' AND
          (CASE WHEN c.metric='past_parties'
             THEN CASE WHEN coalesce(public.yarg_my_initie_status(),false) THEN 1 ELSE 0 END
             ELSE coalesce((SELECT x.amount FROM public.yarg_profile_progress() x WHERE x.metric=c.metric),0)
           END) < c.threshold
      );

    DELETE FROM public.yarg_profile_titles t USING public.yarg_title_catalog c
    WHERE t.user_id=v_user AND t.title_code=c.code AND c.category <> 'secret'
      AND (CASE WHEN c.metric='past_parties'
          THEN CASE WHEN coalesce(public.yarg_my_initie_status(),false) THEN 1 ELSE 0 END
          ELSE coalesce((SELECT x.amount FROM public.yarg_profile_progress() x WHERE x.metric=c.metric),0)
       END) < c.threshold;
    v_reconciled:=v_reconciled+1;
  END LOOP;

  PERFORM pg_catalog.set_config('request.jwt.claim.sub',coalesce(v_original_sub,''),true);
  IF v_original_claims IS NOT NULL THEN
    PERFORM pg_catalog.set_config('request.jwt.claims',v_original_claims,true);
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'name',v_name,
    'deleted_requests',v_deleted,
    'deleted_members',v_members,
    'reconciled_accounts',v_reconciled
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.yarg_owner_delete_archived_session(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.yarg_owner_delete_archived_session(uuid,text) TO authenticated;

-- Check permissions and intended targets from the OWNER's admin panel.
-- No public DELETE policy is added.
