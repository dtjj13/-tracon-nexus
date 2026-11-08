create extension if not exists pgcrypto;

create table if not exists public.community_stop_reports (
  id uuid primary key default gen_random_uuid(),
  stop_id text not null check (char_length(stop_id) between 1 and 200),
  stop_name text not null check (char_length(stop_name) between 1 and 200),
  category text not null check (category in ('fuel', 'weigh_station')),
  longitude double precision not null check (longitude between -180 and 180),
  latitude double precision not null check (latitude between -90 and 90),
  availability text check (availability in ('open', 'closed')),
  diesel_price_per_gallon numeric(5, 3) check (
    diesel_price_per_gallon between 0.01 and 20
  ),
  observed_at timestamptz not null,
  received_at timestamptz not null default now(),
  installation_hash text not null check (char_length(installation_hash) = 64),
  client_id text not null default 'tracon-maps-mobile',
  moderation_status text not null default 'pending' check (
    moderation_status in ('pending', 'accepted', 'rejected')
  ),
  check (
    (category = 'weigh_station' and availability is not null and diesel_price_per_gallon is null)
    or
    (category = 'fuel' and availability is null and diesel_price_per_gallon is not null)
  )
);

create index if not exists community_stop_reports_stop_received_idx
on public.community_stop_reports (stop_id, received_at desc);

create index if not exists community_stop_reports_installation_received_idx
on public.community_stop_reports (installation_hash, received_at desc);

alter table public.community_stop_reports enable row level security;

revoke all on public.community_stop_reports from anon, authenticated;
