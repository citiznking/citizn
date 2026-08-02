-- Countries in scope for v1 (spec Scope section). Nigeria gets the full
-- feature set; Kenya/South Africa/Senegal/The Gambia launch reporting-only;
-- Ghana is seeded inactive for a future activation.
insert into countries (iso3, name, url_slug, active, features) values
  ('NGA', 'Nigeria',      'Nig', true,  '{"reporting": true, "money": true, "elections": true}'),
  ('KEN', 'Kenya',        'Ken', true,  '{"reporting": true, "money": false, "elections": false}'),
  ('ZAF', 'South Africa', 'Saf', true,  '{"reporting": true, "money": false, "elections": false}'),
  ('SEN', 'Senegal',      'Sen', true,  '{"reporting": true, "money": false, "elections": false}'),
  ('GMB', 'The Gambia',   'Gam', true,  '{"reporting": true, "money": false, "elections": false}'),
  ('GHA', 'Ghana',        'Gha', false, '{"reporting": false, "money": false, "elections": false}');

-- Nigeria's 36 states + FCT. Stable since 1996 (no new states created
-- since Bayelsa/Ekiti/Gombe/Nasarawa/Zamfara), so safe to hand-seed.
-- LGA-level (774), ward-level, and the Nigeria PU dataset (176,846 units)
-- are deliberately NOT seeded here — that volume of precise official
-- names/codes needs to come from a verified source (NBS/INEC), not typed
-- from memory. See the spec's open question on the PU coordinates dataset;
-- the same sourcing question applies to authoritative LGA/ward names. That
-- belongs in a workers/ ingestion script reading a licensed dataset, once
-- one is chosen.
insert into admin_level1 (country_id, name, code, label)
select c.id, s.name, s.code, 'State'
from countries c, (values
  ('Abia', 'abia'), ('Adamawa', 'adamawa'), ('Akwa Ibom', 'akwa-ibom'), ('Anambra', 'anambra'),
  ('Bauchi', 'bauchi'), ('Bayelsa', 'bayelsa'), ('Benue', 'benue'), ('Borno', 'borno'),
  ('Cross River', 'cross-river'), ('Delta', 'delta'), ('Ebonyi', 'ebonyi'), ('Edo', 'edo'),
  ('Ekiti', 'ekiti'), ('Enugu', 'enugu'), ('Gombe', 'gombe'), ('Imo', 'imo'),
  ('Jigawa', 'jigawa'), ('Kaduna', 'kaduna'), ('Kano', 'kano'), ('Katsina', 'katsina'),
  ('Kebbi', 'kebbi'), ('Kogi', 'kogi'), ('Kwara', 'kwara'), ('Lagos', 'lagos'),
  ('Nasarawa', 'nasarawa'), ('Niger', 'niger'), ('Ogun', 'ogun'), ('Ondo', 'ondo'),
  ('Osun', 'osun'), ('Oyo', 'oyo'), ('Plateau', 'plateau'), ('Rivers', 'rivers'),
  ('Sokoto', 'sokoto'), ('Taraba', 'taraba'), ('Yobe', 'yobe'), ('Zamfara', 'zamfara'),
  ('Federal Capital Territory', 'fct')
) as s(name, code)
where c.iso3 = 'NGA';

-- The 2027 election shell (dates from the spec's Problem section — INEC's
-- revised timetable under the Electoral Act 2026). Party list and precise
-- polling_units rows are still open questions (spec Open questions).
insert into elections (country_id, slug, name, dates, active)
select c.id, '2027election', 'Nigeria 2027 General Election',
  '{"presidential_nass": "2027-01-16", "governorship_state_assembly": "2027-02-06", "campaigns_begin": "2026-08-19"}'::jsonb,
  true
from countries c where c.iso3 = 'NGA';
