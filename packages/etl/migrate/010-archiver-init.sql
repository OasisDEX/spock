CREATE TABLE vulcan2x.done_job (
  id             serial primary key,
  -- ranges are inclusive
  start_block_id integer not null,
  end_block_id   integer not null,

  -- name can be both extractor or transformer
  name character varying(100) not null,
  unique (start_block_id, end_block_id, name)
);
CREATE INDEX vulcan2x_done_job_extractor_name ON vulcan2x.done_job(name);


-- missing index for block hash
CREATE INDEX vulcan2x_block_hash_index ON vulcan2x.block(hash);