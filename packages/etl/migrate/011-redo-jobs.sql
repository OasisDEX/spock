CREATE TABLE vulcan2x.job (
  id             serial primary key,
  -- name can be both extractor or transformer
  name character varying(100) not null,
  last_block_id   integer not null,

  unique (name)
);
CREATE INDEX vulcan2x_job_name ON vulcan2x.job(name);