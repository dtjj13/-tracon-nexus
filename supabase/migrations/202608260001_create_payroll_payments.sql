create table if not exists public.payroll_payments (
  load_id text primary key,
  status text not null default 'unpaid' check (status in ('unpaid', 'paid')),
  paid_at timestamptz,
  period_start date,
  period_end date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payroll_payments enable row level security;

drop policy if exists "Authenticated users can manage payroll payments"
on public.payroll_payments;

create policy "Authenticated users can manage payroll payments"
on public.payroll_payments
for all
to authenticated
using (true)
with check (true);

grant select, insert, update on public.payroll_payments to authenticated;
