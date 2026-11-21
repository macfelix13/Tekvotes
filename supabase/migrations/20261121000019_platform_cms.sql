-- TekVotes Phase 19: Super Admin Platform CMS & Marquee Items
-- Allows Super Admin to control hero copy, imagery, marquee logos/sponsors/partners,
-- announcement banner, pricing display, about section, contact details, and footer without touching backend code.

create table if not exists public.platform_cms_settings (
  id                     integer primary key default 1 check (id = 1),
  announcement_enabled   boolean not null default false,
  announcement_text      text not null default '',
  announcement_link      text not null default '',
  hero_title             text not null default 'Cast Your Vote for Ghana''s Next',
  hero_highlight         text not null default 'Champions',
  hero_subtitle          text not null default 'Instant, transparent and fraud-free digital voting for awards, pageants, and talent competitions. Pay securely with MTN MoMo, Telecel Cash, and AT Money.',
  hero_image_url         text not null default '/images/hero-voter.jpg',
  hero_primary_cta       text not null default 'Browse Active Competitions',
  hero_secondary_cta     text not null default 'Host an Event',
  marquee_enabled        boolean not null default true,
  marquee_heading        text not null default 'Trusted Events, Official Sponsors & Payment Partners',
  marquee_subheading     text not null default 'Powering verified digital competitions & instant MoMo voting across Ghana',
  organiser_heading      text not null default 'Join our platform as an organiser and create your events for voting and ticketing',
  organiser_description  text not null default 'All you need to do is to create an account and verify your email. That''s it. Your account is ready to be used with comprehensive category setups, custom vote pricing, and real-time bank settlements.',
  about_heading          text not null default 'It''s an e-voting platform where Organisers create and run their award & pageant events with ease',
  about_description      text not null default 'All they have to do is create an account and verify their email address, and they are ready to start using our platform.',
  pricing_commission_label text not null default '10-35% on Base Votes',
  support_email          text not null default 'frametek93@gmail.com',
  support_address        text not null default 'Accra Digital Centre, Ring Road West, Accra, Ghana.',
  footer_tagline         text not null default 'Ghana''s premier multi-tenant digital competition management and voting infrastructure.',
  footer_copyright       text not null default '© 2026 TekVotes Ghana Ltd. All rights reserved.',
  updated_by             uuid references public.profiles (id) on delete set null,
  updated_at             timestamptz not null default now()
);

create trigger platform_cms_settings_updated_at before update on public.platform_cms_settings
  for each row execute function private.set_updated_at();

insert into public.platform_cms_settings (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.platform_marquee_items (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(btrim(name)) between 1 and 120),
  subtitle      text not null default '',
  badge         text not null default 'Partner' check (badge in ('Event', 'Sponsor', 'Partner')),
  logo_url      text,
  website_url   text,
  sort_order    integer not null default 0,
  active        boolean not null default true,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists platform_marquee_items_active_idx
  on public.platform_marquee_items (active, sort_order, created_at);

create trigger platform_marquee_items_updated_at before update on public.platform_marquee_items
  for each row execute function private.set_updated_at();

-- Seed default payment & technology partners if table is empty
insert into public.platform_marquee_items (name, subtitle, badge, logo_url, website_url, sort_order, active)
select * from (values
  ('Paystack', 'Payment Infrastructure', 'Partner', null, null, 10, true),
  ('MTN MoMo', 'Mobile Money Partner', 'Partner', null, null, 20, true),
  ('Telecel Cash', 'Mobile Money Partner', 'Partner', null, null, 30, true),
  ('AT Money', 'Mobile Money Partner', 'Partner', null, null, 40, true),
  ('Visa & Mastercard', 'Global Card Checkout', 'Partner', null, null, 50, true),
  ('FrameTek Ghana', 'Technology Partner', 'Partner', null, 'https://frametekgh.com', 60, true)
) as v(name, subtitle, badge, logo_url, website_url, sort_order, active)
where not exists (select 1 from public.platform_marquee_items);

alter table public.platform_cms_settings enable row level security;
alter table public.platform_marquee_items enable row level security;

grant select on public.platform_cms_settings to anon, authenticated;
grant select on public.platform_marquee_items to anon, authenticated;
grant all on public.platform_cms_settings to service_role;
grant all on public.platform_marquee_items to service_role;

create policy platform_cms_settings_public_read on public.platform_cms_settings
  for select to anon, authenticated using (true);

create policy platform_marquee_items_public_read on public.platform_marquee_items
  for select to anon, authenticated using (active = true or private.is_platform());
