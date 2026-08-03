-- admin_level1/admin_level2 have no boundary polygons loaded yet (no
-- verified GADM/OSM dataset sourced — see the seed migration's note on
-- LGA data). Real reverse-geocoding (point-in-polygon against a loaded
-- boundary) is therefore not possible yet. Until that data exists,
-- level1_id (state) is client-selected from the seeded list and level2_id
-- (LGA) is left null rather than guessed or hand-seeded from memory.
alter table reports alter column level2_id drop not null;
