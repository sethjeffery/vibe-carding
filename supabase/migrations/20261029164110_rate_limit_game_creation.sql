create or replace function public.commit_game(
  p_game_id uuid, p_code text, p_state jsonb, p_expected integer,
  p_action_id uuid, p_actor uuid
) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare current_revision integer;
begin
  if p_expected = -1 then
    if (select count(*) from public.game_updates as u join public.games as g on g.id = u.game_id where u.user_id = p_actor and g.created_at > now() - interval '1 hour') >= 30 then
      raise exception 'Too many games this hour. Try again later.';
    end if;
    insert into public.games (id, code, state, revision)
    values (p_game_id, p_code, p_state, (p_state->>'revision')::integer);
  else
    select revision into current_revision from public.games
    where id = p_game_id for update;
    if exists (select 1 from public.game_actions where game_id = p_game_id and action_id = p_action_id) then
      return true;
    end if;
    if current_revision is distinct from p_expected then return false; end if;
    update public.games set state = p_state, revision = (p_state->>'revision')::integer,
      updated_at = now() where id = p_game_id;
  end if;
  insert into public.game_actions values (p_game_id, p_action_id);
  insert into public.game_updates (game_id, user_id, revision)
    select p_game_id, (player->>'id')::uuid, (p_state->>'revision')::integer
    from jsonb_array_elements(p_state->'players') as player
  on conflict (game_id, user_id) do update set revision = excluded.revision;
  return true;
end;
$$;
