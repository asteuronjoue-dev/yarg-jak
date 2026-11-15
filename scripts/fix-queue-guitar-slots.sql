-- Keep chart identity separate from the physical guitar limit for both joins and edits.
create schema if not exists yarg_private;

create or replace function yarg_private.assert_guitar_chart_slot(
  p_request public.performance_requests,
  p_mode text,
  p_member_id uuid,
  p_edit_legacy_requester boolean,
  p_retaining_chart boolean
)
returns void
language plpgsql
set search_path = ''
as $function$
declare
  available_roles text[];
  occupied_roles text[];
begin
  select coalesce(array_agg(role), array[]::text[]) into available_roles
  from unnest(coalesce(p_request.available_guitar_roles, p_request.fillable_instruments)) role
  where role in ('guitar','bass','rhythm_guitar')
    and (p_request.chart_mask is null or exists (
      select 1 from unnest(array['easy','medium','hard','expert']) difficulty
      where public.yarg_chart_difficulty_exists(p_request.chart_mask,role,difficulty)
    ));

  if not p_mode = any(available_roles) and not p_retaining_chart then
    raise exception 'Partie de guitare indisponible pour cette chanson';
  end if;

  select coalesce(array_agg(
    case when m.instrument='guitar' and m.instrument_mode='rhythm_guitar'
      then 'rhythm_guitar' else m.instrument end
  ), array[]::text[]) into occupied_roles
  from public.performance_members m
  where m.performance_request_id=p_request.id and m.withdrawn_at is null
    and m.id is distinct from p_member_id
    and m.instrument in ('guitar','bass','rhythm_guitar');

  if not p_edit_legacy_requester and not coalesce(p_request.is_group_request,false)
     and p_request.requester_withdrawn_at is null
     and p_request.requester_instrument in ('guitar','bass','rhythm_guitar')
     and not exists (
       select 1 from public.performance_members m
       where m.performance_request_id=p_request.id and m.withdrawn_at is null
         and lower(btrim(m.rockstar_name))=lower(btrim(p_request.rockstar_name))
     ) then
    occupied_roles:=array_append(occupied_roles,
      case when p_request.requester_instrument='guitar' and p_request.requester_instrument_mode='rhythm_guitar'
        then 'rhythm_guitar' else p_request.requester_instrument end);
  end if;

  if cardinality(occupied_roles)>=3 then
    raise exception 'Les trois guitares physiques sont déjà utilisées';
  end if;
  if not p_retaining_chart and p_mode=any(occupied_roles) and not available_roles <@ occupied_roles then
    raise exception 'Choisis d''abord une partie de guitare ou basse encore libre';
  end if;
end;
$function$;

revoke all on function yarg_private.assert_guitar_chart_slot(public.performance_requests,text,uuid,boolean,boolean) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.yarg_join_band_secure(p_request_id uuid, p_token text, p_name text, p_instrument text, p_difficulty text DEFAULT 'medium'::text, p_microphone boolean DEFAULT false, p_harmony integer DEFAULT NULL::integer, p_preferred_guitar text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  r public.performance_requests%ROWTYPE;
  mid uuid;
  cap integer;
  occupied integer;
  fixed_guitars int; fixed_drums int; fixed_keys int; fixed_mics int; flexible_players int;
  max_guitars int; max_drums int; max_keys int; max_mics int;
  has_legacy_requester boolean;
BEGIN
 IF length(coalesce(p_token,''))<>64 OR p_token !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Session invitée invalide'; END IF;
 IF length(btrim(coalesce(p_name,''))) NOT BETWEEN 1 AND 60 THEN RAISE EXCEPTION 'Nom de Rockstar invalide'; END IF;
 IF p_instrument NOT IN ('guitar','rhythm_guitar','bass','drums','drums_4lane','pro_drums','keys','pro_keys','vocals','flex') THEN RAISE EXCEPTION 'Instrument invalide'; END IF;
 IF p_difficulty NOT IN ('beginner','easy','medium','hard','expert','any') THEN RAISE EXCEPTION 'Difficulté invalide'; END IF;
 SELECT * INTO r FROM public.performance_requests WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND OR r.status NOT IN ('waiting','full') OR NOT r.allow_band_fill OR NOT (p_instrument=ANY(r.fillable_instruments) OR (p_instrument='flex' AND r.available_parts IS NOT NULL) OR (p_instrument IN ('guitar','bass','rhythm_guitar') AND p_instrument=ANY(r.available_guitar_roles))) THEN RAISE EXCEPTION 'Cette chanson ne peut plus être rejointe'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.party_settings s WHERE s.id=1 AND s.current_session_id=r.party_session_id AND s.performance_requests_enabled AND (s.party_mode_until IS NULL OR s.party_mode_until>now())) THEN RAISE EXCEPTION 'Inscriptions fermées'; END IF;
 IF EXISTS(SELECT 1 FROM public.yarg_band_ownership WHERE performance_request_id=p_request_id AND secret_hash=md5(p_token)) THEN RAISE EXCEPTION 'Tu participes déjà à cette chanson'; END IF;
 IF (auth.uid() IS NOT NULL AND (r.guest_user_id=auth.uid() OR r.requester_profile_id=auth.uid())) THEN RAISE EXCEPTION 'Tu es déjà le demandeur de cette chanson'; END IF;
 IF lower(btrim(p_name))=lower(btrim(r.rockstar_name)) THEN RAISE EXCEPTION 'Le demandeur participe déjà'; END IF;
 IF EXISTS(SELECT 1 FROM public.performance_members m WHERE m.performance_request_id=p_request_id AND m.withdrawn_at IS NULL AND lower(btrim(m.rockstar_name))=lower(btrim(p_name))) THEN RAISE EXCEPTION 'Ce nom participe déjà à cette chanson'; END IF;

 IF p_instrument IN ('guitar','rhythm_guitar','bass') THEN
   PERFORM yarg_private.assert_guitar_chart_slot(r,p_instrument,NULL,false,false);
 ELSIF p_instrument NOT IN ('vocals','flex') AND (
   (r.requester_withdrawn_at IS NULL AND r.requester_instrument=p_instrument)
   OR EXISTS (
       SELECT 1 FROM public.performance_members m
       WHERE m.performance_request_id=p_request_id AND m.withdrawn_at IS NULL
         AND m.instrument=p_instrument
   )
 ) THEN
   RAISE EXCEPTION 'Instrument déjà pris';
 END IF;

 IF p_instrument='flex' AND (p_microphone OR p_preferred_guitar IS NOT NULL OR p_harmony IS NOT NULL) THEN
   RAISE EXCEPTION 'Flex ne réserve aucun instrument ou micro';
 END IF;
 IF p_preferred_guitar IS NOT NULL AND p_preferred_guitar<>'' AND (
   p_preferred_guitar NOT IN ('osp uze','crkd','sunburst')
   OR EXISTS (
     SELECT 1 FROM public.performance_members m
     WHERE m.performance_request_id=p_request_id AND m.withdrawn_at IS NULL
       AND m.preferred_guitar=p_preferred_guitar
   )
 ) THEN RAISE EXCEPTION 'Guitare réservée ou invalide'; END IF;
 cap:=greatest(0,least(3,coalesce(r.vocal_parts,0)));
 IF p_instrument='vocals' OR p_microphone THEN
   IF cap=0 OR coalesce(p_harmony,0) NOT BETWEEN 1 AND cap THEN RAISE EXCEPTION 'Partie vocale invalide'; END IF;
   SELECT count(*) INTO occupied FROM public.performance_members m WHERE m.performance_request_id=p_request_id AND m.withdrawn_at IS NULL AND (m.instrument='vocals' OR m.microphone);
   IF r.requester_withdrawn_at IS NULL AND (r.requester_instrument='vocals' OR r.requester_microphone) AND NOT EXISTS (SELECT 1 FROM public.performance_members m WHERE m.performance_request_id=p_request_id AND m.withdrawn_at IS NULL AND lower(btrim(m.rockstar_name))=lower(btrim(r.rockstar_name))) THEN occupied:=occupied+1; END IF;
   IF occupied>=3 THEN RAISE EXCEPTION 'Les trois microphones sont déjà utilisés'; END IF;
 END IF;
 -- Atomic physical capacity: fixed players occupy actual slots;
 -- Flex players occupy a remaining slot without specifying its type.
 SELECT NOT EXISTS (
   SELECT 1 FROM public.performance_members m
   WHERE m.performance_request_id=p_request_id AND m.withdrawn_at IS NULL
     AND lower(btrim(m.rockstar_name))=lower(btrim(r.rockstar_name))
 ) INTO has_legacy_requester;
 SELECT count(*) FILTER (WHERE instrument IN ('guitar','bass','rhythm_guitar')),
        count(*) FILTER (WHERE instrument IN ('drums','drums_4lane','pro_drums')),
        count(*) FILTER (WHERE instrument IN ('keys','pro_keys')),
        count(*) FILTER (WHERE instrument='vocals' OR microphone),
        count(*) FILTER (WHERE instrument='flex')
   INTO fixed_guitars,fixed_drums,fixed_keys,fixed_mics,flexible_players
 FROM public.performance_members m
 WHERE m.performance_request_id=p_request_id AND m.withdrawn_at IS NULL;
 IF has_legacy_requester AND r.requester_withdrawn_at IS NULL THEN
   fixed_guitars:=fixed_guitars+CASE WHEN r.requester_instrument IN ('guitar','bass','rhythm_guitar') THEN 1 ELSE 0 END;
   fixed_drums:=fixed_drums+CASE WHEN r.requester_instrument IN ('drums','drums_4lane','pro_drums') THEN 1 ELSE 0 END;
   fixed_keys:=fixed_keys+CASE WHEN r.requester_instrument IN ('keys','pro_keys') THEN 1 ELSE 0 END;
   fixed_mics:=fixed_mics+CASE WHEN r.requester_instrument='vocals' OR r.requester_microphone THEN 1 ELSE 0 END;
   flexible_players:=flexible_players+CASE WHEN r.requester_instrument='flex' THEN 1 ELSE 0 END;
 END IF;
 max_guitars:=CASE WHEN coalesce(array_length(r.available_guitar_roles,1),0)>0 THEN 3 ELSE 0 END;
 max_drums:=CASE WHEN 'drums'=ANY(r.available_parts) THEN 1 ELSE 0 END;
 max_keys:=CASE WHEN 'keys'=ANY(r.available_parts) THEN 1 ELSE 0 END;
 max_mics:=CASE WHEN coalesce(r.vocal_parts,0)>0 THEN 3 ELSE 0 END;
 fixed_guitars:=fixed_guitars+CASE WHEN p_instrument IN ('guitar','bass','rhythm_guitar') THEN 1 ELSE 0 END;
 fixed_drums:=fixed_drums+CASE WHEN p_instrument IN ('drums','drums_4lane','pro_drums') THEN 1 ELSE 0 END;
 fixed_keys:=fixed_keys+CASE WHEN p_instrument IN ('keys','pro_keys') THEN 1 ELSE 0 END;
 fixed_mics:=fixed_mics+CASE WHEN p_instrument='vocals' OR p_microphone THEN 1 ELSE 0 END;
 flexible_players:=flexible_players+CASE WHEN p_instrument='flex' THEN 1 ELSE 0 END;
 IF fixed_guitars>max_guitars OR fixed_drums>max_drums OR fixed_keys>max_keys OR fixed_mics>max_mics
    OR flexible_players > (max_guitars-fixed_guitars)+(max_drums-fixed_drums)+(max_keys-fixed_keys)+(max_mics-fixed_mics) THEN
   RAISE EXCEPTION 'Groupe complet : plus de place pour ce participant';
 END IF;
 INSERT INTO public.performance_members(performance_request_id,rockstar_name,instrument,difficulty,microphone,vocal_harmony,preferred_guitar)
 VALUES (p_request_id,btrim(p_name),p_instrument,CASE WHEN p_instrument='flex' THEN 'any' ELSE p_difficulty END,case when p_instrument IN ('vocals','flex') then false else coalesce(p_microphone,false) end,p_harmony,nullif(p_preferred_guitar,'')) RETURNING id INTO mid;
 INSERT INTO public.yarg_band_ownership(performance_request_id,member_id,secret_hash) VALUES(p_request_id,mid,md5(p_token));
END;
$function$;

CREATE OR REPLACE FUNCTION public.yarg_manage_my_band_participation(p_request_id uuid, p_action text, p_instrument text DEFAULT NULL::text, p_difficulty text DEFAULT NULL::text, p_microphone boolean DEFAULT NULL::boolean, p_harmony integer DEFAULT NULL::integer, p_preferred_guitar text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  r public.performance_requests%ROWTYPE;
  m public.performance_members%ROWTYPE;
  own_member_id uuid;
  is_requester boolean;
  occupied integer;
  vocal_cap integer;
  own_instrument text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connecte-toi à ton compte Rockstar'; END IF;
  SELECT * INTO r FROM public.performance_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND OR r.status NOT IN ('waiting','full') THEN RAISE EXCEPTION 'Cette chanson ne peut plus être modifiée'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.party_settings ps
    WHERE ps.id=1 AND ps.current_session_id=r.party_session_id
      AND ps.performance_requests_enabled IS TRUE
      AND (ps.party_mode_until IS NULL OR ps.party_mode_until>now()))
  THEN RAISE EXCEPTION 'La soirée est fermée'; END IF;

  -- A member row linked to the signed-in account always takes precedence.
  SELECT * INTO m FROM public.performance_members pm
    WHERE pm.performance_request_id=p_request_id
      AND pm.rockstar_profile_id=auth.uid() AND pm.withdrawn_at IS NULL
    ORDER BY pm.created_at,pm.id LIMIT 1 FOR UPDATE;
  IF FOUND THEN own_member_id:=m.id; END IF;
  IF own_member_id IS NULL THEN
    SELECT pm.* INTO m FROM public.performance_members pm
    JOIN public.yarg_member_accounts a ON a.member_id=pm.id
    WHERE a.performance_request_id=p_request_id AND a.user_id=auth.uid()
      AND pm.withdrawn_at IS NULL
    LIMIT 1 FOR UPDATE OF pm;
    IF FOUND THEN own_member_id:=m.id; END IF;
  END IF;
  is_requester := (r.requester_profile_id = auth.uid() AND r.requester_withdrawn_at IS NULL);
  -- Group requesters are often represented by a member row without a profile link.
  -- The request UUID, not a public nickname, proves authority to manage that leader slot.
  IF own_member_id IS NULL AND is_requester AND coalesce(r.is_group_request,false) THEN
    SELECT * INTO m FROM public.performance_members pm
      WHERE pm.performance_request_id=p_request_id AND pm.withdrawn_at IS NULL
        AND lower(btrim(pm.rockstar_name))=lower(btrim(r.rockstar_name))
    ORDER BY pm.created_at,pm.id LIMIT 1 FOR UPDATE;
    IF FOUND THEN own_member_id:=m.id; END IF;
  END IF;
  IF own_member_id IS NULL AND NOT is_requester THEN
    RAISE EXCEPTION 'Cette participation n’est pas associée à ton compte Rockstar';
  END IF;

  IF p_action='leave' THEN
    IF own_member_id IS NOT NULL THEN
      UPDATE public.performance_members SET withdrawn_at=now() WHERE id=own_member_id;
      -- Token owners for this member can no longer edit the withdrawn slot.
      DELETE FROM public.yarg_band_ownership WHERE member_id=own_member_id;
    ELSE
      UPDATE public.performance_requests SET requester_withdrawn_at=now() WHERE id=p_request_id;
    END IF;
    RETURN;
  END IF;
  IF p_action <> 'edit' THEN RAISE EXCEPTION 'Action non autorisée'; END IF;
  IF p_instrument NOT IN ('guitar','rhythm_guitar','bass','drums','drums_4lane','pro_drums','keys','pro_keys','vocals','flex') THEN
    RAISE EXCEPTION 'Instrument invalide';
  END IF;
  IF p_difficulty NOT IN ('beginner','easy','medium','hard','expert','any') THEN
    RAISE EXCEPTION 'Difficulté invalide';
  END IF;
  IF r.chart_mask IS NOT NULL AND NOT public.yarg_chart_difficulty_exists(r.chart_mask,p_instrument,p_difficulty) THEN
    RAISE EXCEPTION 'Aucune partition de cette difficulté pour cet instrument';
  END IF;
  -- The original requester may retain their own existing instrument even when
  -- it is absent from fillable_instruments; for other choices, respect the song's slots.
  own_instrument:=CASE WHEN own_member_id IS NULL THEN r.requester_instrument ELSE m.instrument END;
  IF own_instrument='guitar' AND
     (CASE WHEN own_member_id IS NULL THEN r.requester_instrument_mode ELSE m.instrument_mode END)='rhythm_guitar' THEN
    own_instrument:='rhythm_guitar';
  END IF;
  IF p_instrument IS DISTINCT FROM own_instrument
     AND NOT (
  p_instrument=ANY(coalesce(r.fillable_instruments,ARRAY[]::text[]))
  OR (p_instrument IN ('guitar','bass','rhythm_guitar') AND p_instrument=ANY(coalesce(r.available_guitar_roles,ARRAY[]::text[])))
  OR (p_instrument='flex' AND cardinality(coalesce(r.available_parts,ARRAY[]::text[]))>0)
  OR (
   NOT coalesce(r.allow_band_fill,false) AND coalesce(r.is_group_request,false)
   AND (
     (p_instrument IN ('guitar','rhythm_guitar') AND 'guitar'=ANY(coalesce(r.available_parts,ARRAY[]::text[])) AND p_instrument=ANY(coalesce(r.available_guitar_roles,ARRAY[]::text[])))
     OR (p_instrument='bass' AND 'bass'=ANY(coalesce(r.available_parts,ARRAY[]::text[])) AND 'bass'=ANY(coalesce(r.available_guitar_roles,ARRAY[]::text[])))
     OR (p_instrument IN ('drums','drums_4lane','pro_drums') AND 'drums'=ANY(coalesce(r.available_parts,ARRAY[]::text[])))
     OR (p_instrument IN ('keys','pro_keys') AND 'keys'=ANY(coalesce(r.available_parts,ARRAY[]::text[])))
     OR (p_instrument='vocals' AND 'vocals'=ANY(coalesce(r.available_parts,ARRAY[]::text[])) AND coalesce(r.vocal_parts,0)>0)
   )
 )
 ) THEN
    RAISE EXCEPTION 'Instrument indisponible pour cette chanson';
  END IF;
  IF p_instrument IN ('guitar','bass','rhythm_guitar') THEN
    PERFORM yarg_private.assert_guitar_chart_slot(r,p_instrument,own_member_id,own_member_id IS NULL,p_instrument=own_instrument);
  ELSIF p_instrument NOT IN ('vocals','flex') AND (
    EXISTS(SELECT 1 FROM public.performance_members pm
      WHERE pm.performance_request_id=p_request_id AND pm.withdrawn_at IS NULL
      AND (own_member_id IS NULL OR pm.id<>own_member_id) AND pm.instrument=p_instrument)
    OR (own_member_id IS NOT NULL AND r.requester_withdrawn_at IS NULL
        AND r.requester_instrument=p_instrument
        AND (r.requester_profile_id IS DISTINCT FROM auth.uid() OR NOT coalesce(r.is_group_request,false)))
  ) THEN RAISE EXCEPTION 'Instrument déjà occupé'; END IF;

  IF nullif(p_preferred_guitar,'') IS NOT NULL THEN
    IF p_instrument NOT IN ('guitar','rhythm_guitar','bass')
       OR p_preferred_guitar NOT IN ('osp uze','crkd','sunburst') THEN
      RAISE EXCEPTION 'Guitare physique invalide';
    END IF;
    IF EXISTS(SELECT 1 FROM public.performance_members pm
      WHERE pm.performance_request_id=p_request_id AND pm.withdrawn_at IS NULL
      AND (own_member_id IS NULL OR pm.id<>own_member_id)
      AND pm.preferred_guitar=p_preferred_guitar) THEN
      RAISE EXCEPTION 'Cette guitare est déjà réservée';
    END IF;
  END IF;

  vocal_cap:=greatest(0,least(3,coalesce(r.vocal_parts,0)));
  IF p_instrument='vocals' OR coalesce(p_microphone,false) THEN
    IF vocal_cap=0 OR coalesce(p_harmony,0) NOT BETWEEN 1 AND vocal_cap THEN
      RAISE EXCEPTION 'Partie vocale indisponible';
    END IF;
    SELECT count(*) INTO occupied FROM public.performance_members pm
      WHERE pm.performance_request_id=p_request_id AND pm.withdrawn_at IS NULL
        AND (own_member_id IS NULL OR pm.id<>own_member_id)
        AND (pm.instrument='vocals' OR pm.microphone);
    IF own_member_id IS NOT NULL AND NOT coalesce(r.is_group_request,false)
       AND r.requester_withdrawn_at IS NULL
       AND (r.requester_instrument='vocals' OR r.requester_microphone) THEN
      occupied:=occupied+1;
    END IF;
    IF occupied>=3 THEN RAISE EXCEPTION 'Les trois microphones sont déjà utilisés'; END IF;
  END IF;

  IF p_instrument='flex' AND (p_difficulty<>'any' OR coalesce(p_microphone,false) OR p_harmony IS NOT NULL OR nullif(p_preferred_guitar,'') IS NOT NULL) THEN
    RAISE EXCEPTION 'Flex ne réserve aucun instrument ou micro';
  END IF;

 DECLARE
   v_guitars integer;v_drums integer;v_keys integer;v_mics integer;v_flex integer;
   v_max_guitars integer;v_max_drums integer;v_max_keys integer;v_max_mics integer;
 BEGIN
   SELECT count(*) FILTER (WHERE instrument IN ('guitar','bass','rhythm_guitar')),
          count(*) FILTER (WHERE instrument IN ('drums','drums_4lane','pro_drums')),
          count(*) FILTER (WHERE instrument IN ('keys','pro_keys')),
          count(*) FILTER (WHERE instrument='vocals' OR microphone),
          count(*) FILTER (WHERE instrument='flex')
     INTO v_guitars,v_drums,v_keys,v_mics,v_flex
   FROM public.performance_members x
   WHERE x.performance_request_id=p_request_id AND x.withdrawn_at IS NULL
     AND x.id IS DISTINCT FROM own_member_id;
   IF NOT coalesce(r.is_group_request,false) AND r.requester_withdrawn_at IS NULL AND own_member_id IS NOT NULL AND NOT EXISTS(
       SELECT 1 FROM public.performance_members x
       WHERE x.performance_request_id=p_request_id AND x.withdrawn_at IS NULL
         AND lower(btrim(x.rockstar_name))=lower(btrim(r.rockstar_name))
     ) THEN
     v_guitars:=v_guitars+CASE WHEN r.requester_instrument IN ('guitar','rhythm_guitar','bass') THEN 1 ELSE 0 END;
     v_drums:=v_drums+CASE WHEN r.requester_instrument IN ('drums','drums_4lane','pro_drums') THEN 1 ELSE 0 END;
     v_keys:=v_keys+CASE WHEN r.requester_instrument IN ('keys','pro_keys') THEN 1 ELSE 0 END;
     v_mics:=v_mics+CASE WHEN r.requester_instrument='vocals' OR r.requester_microphone THEN 1 ELSE 0 END;
     v_flex:=v_flex+CASE WHEN r.requester_instrument='flex' THEN 1 ELSE 0 END;
   END IF;
   v_max_guitars:=CASE WHEN cardinality(coalesce(r.available_guitar_roles,ARRAY[]::text[]))>0 THEN 3 ELSE 0 END;
   v_max_drums:=CASE WHEN 'drums'=ANY(coalesce(r.available_parts,ARRAY[]::text[])) THEN 1 ELSE 0 END;
   v_max_keys:=CASE WHEN 'keys'=ANY(coalesce(r.available_parts,ARRAY[]::text[])) THEN 1 ELSE 0 END;
   v_max_mics:=CASE WHEN coalesce(r.vocal_parts,0)>0 THEN 3 ELSE 0 END;
   v_guitars:=v_guitars+CASE WHEN p_instrument IN ('guitar','rhythm_guitar','bass') THEN 1 ELSE 0 END;
   v_drums:=v_drums+CASE WHEN p_instrument IN ('drums','drums_4lane','pro_drums') THEN 1 ELSE 0 END;
   v_keys:=v_keys+CASE WHEN p_instrument IN ('keys','pro_keys') THEN 1 ELSE 0 END;
   v_mics:=v_mics+CASE WHEN p_instrument='vocals' OR coalesce(p_microphone,false) THEN 1 ELSE 0 END;
   v_flex:=v_flex+CASE WHEN p_instrument='flex' THEN 1 ELSE 0 END;
   IF v_guitars>v_max_guitars OR v_drums>v_max_drums OR v_keys>v_max_keys OR v_mics>v_max_mics OR
      v_flex>(v_max_guitars-v_guitars)+(v_max_drums-v_drums)+(v_max_keys-v_keys)+(v_max_mics-v_mics) THEN
     RAISE EXCEPTION 'Cette place est déjà occupée ou le groupe est complet';
   END IF;
 END;

  IF own_member_id IS NOT NULL THEN
    UPDATE public.performance_members SET
      instrument=p_instrument,instrument_mode=p_instrument,difficulty=p_difficulty,
      microphone=CASE WHEN p_instrument='vocals' THEN false ELSE coalesce(p_microphone,false) END,
      vocal_harmony=CASE WHEN p_instrument='vocals' OR coalesce(p_microphone,false) THEN p_harmony ELSE NULL END,
      preferred_guitar=CASE WHEN p_instrument IN ('guitar','rhythm_guitar','bass') THEN nullif(p_preferred_guitar,'') ELSE NULL END
    WHERE id=own_member_id;
  ELSE
    -- Old-style individual request: the original player is in performance_requests.
    UPDATE public.performance_requests SET
      requester_instrument=p_instrument,requester_instrument_mode=p_instrument,
      requester_difficulty=p_difficulty,
      requester_microphone=CASE WHEN p_instrument='vocals' THEN false ELSE coalesce(p_microphone,false) END,
      vocal_harmony=CASE WHEN p_instrument='vocals' OR coalesce(p_microphone,false) THEN p_harmony ELSE NULL END
    WHERE id=p_request_id;
  END IF;
END; $function$;

CREATE OR REPLACE FUNCTION public.yarg_respond_band_invitation(p_invitation_id uuid, p_accept boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_inv public.yarg_band_profile_invitations%ROWTYPE; v_req uuid; v_member_name text; v_request_status text;
BEGIN
 IF auth.uid() IS NULL OR coalesce((auth.jwt()->>'is_anonymous')::boolean,false) THEN
  RAISE EXCEPTION 'Connecte-toi à ton compte Rockstar.';
 END IF;
 SELECT r.status INTO v_request_status
 FROM public.yarg_band_profile_invitations i
 JOIN public.performance_members m ON m.id=i.member_id
 JOIN public.performance_requests r ON r.id=m.performance_request_id
 WHERE i.id=p_invitation_id AND i.profile_id=auth.uid() AND i.responded_at IS NULL
 FOR UPDATE OF r;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invitation introuvable.'; END IF;
 SELECT * INTO v_inv FROM public.yarg_band_profile_invitations
 WHERE id=p_invitation_id AND profile_id=auth.uid() AND responded_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invitation introuvable.'; END IF;
 IF p_accept IS TRUE THEN
  SELECT m.performance_request_id,m.rockstar_name INTO v_req,v_member_name
    FROM public.performance_members m JOIN public.rockstar_profiles p ON p.user_id=auth.uid()
    WHERE m.id=v_inv.member_id AND m.withdrawn_at IS NULL
      ;
  IF v_req IS NULL THEN RAISE EXCEPTION 'La place invitée n’est plus disponible.'; END IF;
 IF EXISTS(SELECT 1 FROM public.performance_members m WHERE m.performance_request_id=v_req AND m.withdrawn_at IS NULL AND m.rockstar_profile_id=auth.uid()) THEN RAISE EXCEPTION 'Tu participes déjà à cette chanson.'; END IF;
  UPDATE public.performance_members SET rockstar_profile_id=auth.uid()
   WHERE id=v_inv.member_id AND rockstar_profile_id IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cette place est déjà associée à un autre profil.'; END IF;
  -- Only the first requester's own profile may be linked as the request owner.
  UPDATE public.performance_requests SET requester_profile_id=auth.uid()
  WHERE id=v_req AND rockstar_name=v_member_name AND requester_profile_id IS NULL;
 ELSIF p_accept IS FALSE THEN
  IF v_request_status IN ('waiting','full') THEN
   UPDATE public.performance_members SET withdrawn_at=now()
   WHERE id=v_inv.member_id AND withdrawn_at IS NULL AND rockstar_profile_id IS NULL;
  END IF;
 ELSE
  RAISE EXCEPTION 'Réponse à l’invitation invalide.';
 END IF;
 UPDATE public.yarg_band_profile_invitations SET accepted=p_accept,responded_at=now()
 WHERE id=p_invitation_id;
END;$function$;
