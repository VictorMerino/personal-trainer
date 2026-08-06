-- docs/adr/0015-health-data-compliance.md: training/injury data is
-- special-category under GDPR Art. 9 — explicit consent is the legal
-- basis, and this column is that consent's record. Nullable: existing
-- rows predate this column and haven't (re-)consented yet.
alter table user_profiles add column data_consent_at timestamptz;
