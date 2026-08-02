-- Public-safe projections of reporter-adjacent tables. Views are owned by
-- the migration role and therefore bypass the base tables' RLS, so the
-- WHERE/SELECT list here — not RLS — is what keeps session_hash and
-- precise election-report coordinates out of anonymous reach. Never add
-- session_hash, geom, or accuracy_m to the election-report views: that is
-- exactly the coarsening the threat model requires (round to pu_id/lga
-- level only, never expose the precise capture-time fix).

create view public.v_reports as
select
  id, country_id, category, severity, description,
  geom, accuracy_m, level1_id, level2_id, ward_id,
  status, lifecycle, created_at
from reports
where status = 'published';

create view public.v_report_media as
select m.id, m.report_id, m.storage_path, m.sha256, m.phash, m.exif_clean, m.watermarked, m.safety_score, m.created_at
from report_media m
join reports r on r.id = m.report_id
where r.status = 'published';

create view public.v_lifecycle_events as
select e.id, e.report_id, e.from_status, e.to_status, e.actor, e.created_at
from lifecycle_events e
join reports r on r.id = e.report_id
where r.status = 'published';

create view public.v_election_reports as
select
  er.id, er.election_id, er.type, er.pu_id,
  er.captured_at, er.submitted_at, er.status, er.corroboration_count
from election_reports er
where er.status = 'published';

create view public.v_result_entries as
select re.id, re.election_report_id, re.race_type, re.party_code, re.votes, re.registered_voters, re.accredited
from result_entries re
join election_reports er on er.id = re.election_report_id
where er.status = 'published';

create view public.v_incident_details as
select d.election_report_id, d.category, d.note
from incident_details d
join election_reports er on er.id = d.election_report_id
where er.status = 'published';

grant select on
  public.v_reports, public.v_report_media, public.v_lifecycle_events,
  public.v_election_reports, public.v_result_entries, public.v_incident_details
to anon, authenticated;
