-- Fix: grant service_role privileges on all fin.* tables and sequences so
-- SECURITY INVOKER helpers/triggers called during payment fulfillment succeed.

grant usage on schema fin to service_role;
grant select, insert, update, delete on all tables in schema fin to service_role;
grant usage, select on all sequences in schema fin to service_role;
alter default privileges in schema fin grant select, insert, update, delete on tables to service_role;
alter default privileges in schema fin grant usage, select on sequences to service_role;
