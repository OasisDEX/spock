-- processing - everything is fine
-- stopped - error occured, job stopped
-- not-ready - not part of the current config
CREATE TYPE job_status AS ENUM ('processing', 'stopped', 'not-ready');

ALTER TABLE vulcan2x.job 
  ADD status job_status not null default 'not-ready',
  ADD extra_info text;

