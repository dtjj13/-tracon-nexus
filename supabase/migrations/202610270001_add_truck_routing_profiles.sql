alter table public.trucks
  add column if not exists routing_height_ft numeric(5, 2),
  add column if not exists routing_width_ft numeric(5, 2),
  add column if not exists routing_length_ft numeric(6, 2),
  add column if not exists routing_gross_weight_lbs integer,
  add column if not exists routing_axle_load_lbs integer,
  add column if not exists routing_hazmat boolean not null default false,
  add column if not exists routing_avoid_tolls boolean not null default false;

alter table public.trucks
  drop constraint if exists trucks_routing_height_ft_check,
  add constraint trucks_routing_height_ft_check
    check (routing_height_ft is null or routing_height_ft > 0 and routing_height_ft <= 20),
  drop constraint if exists trucks_routing_width_ft_check,
  add constraint trucks_routing_width_ft_check
    check (routing_width_ft is null or routing_width_ft > 0 and routing_width_ft <= 15),
  drop constraint if exists trucks_routing_length_ft_check,
  add constraint trucks_routing_length_ft_check
    check (routing_length_ft is null or routing_length_ft > 0 and routing_length_ft <= 150),
  drop constraint if exists trucks_routing_gross_weight_lbs_check,
  add constraint trucks_routing_gross_weight_lbs_check
    check (
      routing_gross_weight_lbs is null
      or routing_gross_weight_lbs > 0 and routing_gross_weight_lbs <= 200000
    ),
  drop constraint if exists trucks_routing_axle_load_lbs_check,
  add constraint trucks_routing_axle_load_lbs_check
    check (
      routing_axle_load_lbs is null
      or routing_axle_load_lbs > 0 and routing_axle_load_lbs <= 80000
    );

comment on column public.trucks.routing_height_ft is
  'Overall truck height in feet used for commercial route restrictions.';
comment on column public.trucks.routing_width_ft is
  'Overall truck width in feet used for commercial route restrictions.';
comment on column public.trucks.routing_length_ft is
  'Overall truck and trailer length in feet used for commercial route restrictions.';
comment on column public.trucks.routing_gross_weight_lbs is
  'Routing gross vehicle weight in pounds.';
comment on column public.trucks.routing_axle_load_lbs is
  'Maximum axle load in pounds used for route restrictions.';
comment on column public.trucks.routing_hazmat is
  'Whether hazmat routing restrictions should be applied.';
comment on column public.trucks.routing_avoid_tolls is
  'Whether toll roads should be strongly deprioritized.';
