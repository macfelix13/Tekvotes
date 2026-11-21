-- TekVotes Phase 20: Event Media Gallery
-- Allows Organisers and Super Admin to upload & manage multiple event gallery photos
-- displayed alongside contestant photos in the Event Gallery tab on /competitions/[slug].

create table if not exists public.event_gallery_media (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null,
  organization_id  uuid not null,
  image_url        text not null,
  caption          text not null default '',
  sort_order       integer not null default 0,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint event_gallery_media_event_fk foreign key (event_id, organization_id)
    references public.events (id, organization_id) on delete cascade
);

create index if not exists event_gallery_media_event_idx
  on public.event_gallery_media (event_id, sort_order, created_at desc);

alter table public.event_gallery_media enable row level security;

grant select on public.event_gallery_media to anon, authenticated;
grant all on public.event_gallery_media to service_role;

create policy event_gallery_media_public_read on public.event_gallery_media
  for select to anon, authenticated using (true);
