CREATE TABLE vulcan2x.done_extracted_block (
  id             serial primary key,
  -- ranges are inclusive
  start_block_id integer not null,
  end_block_id   integer not null,
  extractor_name character varying(100) not null,
  unique (start_block_id, end_block_id, extractor_name)
);
CREATE INDEX vulcan2x_done_extracted_block_extractor_name ON vulcan2x.done_extracted_block(extractor_name);