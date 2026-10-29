create table public.games (
  id uuid primary key,
  code text not null unique check (code ~ '^[A-Z2-9]{6}$'),
  state jsonb not null,
  revision integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Only the server can read the authoritative state, including private hands.
alter table public.games enable row level security;
revoke all on public.games from anon, authenticated;
grant all on public.games to service_role;

create table public.game_updates (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  revision integer not null,
  primary key (game_id, user_id)
);
create index game_updates_user_id_idx on public.game_updates (user_id);
alter table public.game_updates enable row level security;
create policy "players watch only their own game notifications"
on public.game_updates for select to authenticated
using (user_id = (select auth.uid()));
revoke all on public.game_updates from anon, authenticated;
grant select on public.game_updates to authenticated;
grant all on public.game_updates to service_role;

create table public.game_actions (
  game_id uuid not null references public.games(id) on delete cascade,
  action_id uuid not null,
  primary key (game_id, action_id)
);
alter table public.game_actions enable row level security;
revoke all on public.game_actions from anon, authenticated;
grant all on public.game_actions to service_role;

-- One transaction commits the state, idempotency receipt and realtime notifications.
create function public.commit_game(
  p_game_id uuid, p_code text, p_state jsonb, p_expected integer,
  p_action_id uuid, p_actor uuid
) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare current_revision integer;
begin
  if p_expected = -1 then
    if (select count(*) from public.game_updates where user_id = p_actor) >= 30 then
      raise exception 'You have reached the limit of 30 games.';
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
revoke all on function public.commit_game(uuid, text, jsonb, integer, uuid, uuid) from public, anon, authenticated;
grant execute on function public.commit_game(uuid, text, jsonb, integer, uuid, uuid) to service_role;

alter publication supabase_realtime add table public.game_updates;
