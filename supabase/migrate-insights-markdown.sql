-- Insights persistem no lead com markdown completo + título (timeline)
alter table public.lead_insights
  add column if not exists titulo text;
alter table public.lead_insights
  add column if not exists markdown text;

create index if not exists idx_lead_insights_lead_created
  on public.lead_insights(id_lead, created_at desc);
