-- TekVotes Phase 23: Separate Ticket Event Flyers from Voting Event Flyers
-- Adds ticket_flyer_public_id to branding_settings so ticketed shows/premieres/finales
-- have their own dedicated flyer separate from the voting competition cover banner.

alter table public.branding_settings
  add column if not exists ticket_flyer_public_id text;
