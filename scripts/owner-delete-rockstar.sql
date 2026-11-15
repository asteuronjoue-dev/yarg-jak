-- Apply before publishing the dashboard change.
create schema if not exists yarg_private;
revoke all on schema yarg_private from public, anon;
grant usage on schema yarg_private to authenticated;

create or replace function yarg_private.delete_rockstar_account(
  p_user_id uuid, p_expected_email text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  account_email text;
begin
  perform public.yarg_owner_guard();

  if not exists (
    select 1 from auth.sessions
    where id = nullif(auth.jwt()->>'session_id', '')::uuid and user_id = auth.uid()
  ) then
    raise exception 'Session expirée. Reconnecte-toi.' using errcode = '42501';
  end if;

  select u.email into account_email
  from auth.users u
  join public.rockstar_profiles p on p.user_id = u.id
  where u.id = p_user_id and not u.is_anonymous
  for update of u, p;

  if not found or nullif(p_expected_email, '') is null
    or lower(account_email) is distinct from lower(p_expected_email) then
    raise exception 'Compte introuvable ou courriel modifié. Actualise la liste.';
  end if;

  if exists (select 1 from public.yarg_owners where user_id = p_user_id) then
    raise exception 'Un compte propriétaire ne peut pas être supprimé.';
  end if;

  if exists (
    select 1
    from public.performance_requests r
    join public.party_sessions s on s.id = r.party_session_id and s.is_active
    where r.requester_profile_id = p_user_id or r.guest_user_id = p_user_id
    union all
    select 1
    from public.performance_members m
    join public.performance_requests r on r.id = m.performance_request_id
    join public.party_sessions s on s.id = r.party_session_id and s.is_active
    where m.rockstar_profile_id = p_user_id or m.guest_user_id = p_user_id
    union all
    select 1
    from public.yarg_member_accounts a
    join public.performance_requests r on r.id = a.performance_request_id
    join public.party_sessions s on s.id = r.party_session_id and s.is_active
    where a.user_id = p_user_id
    union all
    select 1
    from public.yarg_band_profile_invitations i
    join public.performance_members m on m.id = i.member_id
    join public.performance_requests r on r.id = m.performance_request_id
    join public.party_sessions s on s.id = r.party_session_id and s.is_active
    where i.profile_id = p_user_id
  ) then
    raise exception 'Ce compte est lié à une soirée active. Réessaie après sa fermeture.';
  end if;

  -- Historical guest rows retain their names and performances.
  update public.performance_requests set guest_user_id = null where guest_user_id = p_user_id;
  update public.performance_members set guest_user_id = null where guest_user_id = p_user_id;
  delete from auth.users where id = p_user_id;
end;
$function$;

revoke all on function yarg_private.delete_rockstar_account(uuid, text) from public, anon, authenticated;
grant execute on function yarg_private.delete_rockstar_account(uuid, text) to authenticated;

create or replace function public.yarg_owner_delete_rockstar_account(
  p_user_id uuid, p_expected_email text
)
returns void
language sql
security invoker
set search_path = ''
as $function$
  select yarg_private.delete_rockstar_account(p_user_id, p_expected_email);
$function$;

revoke all on function public.yarg_owner_delete_rockstar_account(uuid, text) from public, anon, authenticated;
grant execute on function public.yarg_owner_delete_rockstar_account(uuid, text) to authenticated;
