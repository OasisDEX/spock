CREATE SCHEMA extracted;

CREATE TABLE extracted.logs (
  id           serial primary key,
  block_id     integer not null REFERENCES vulcan2x.block(id) ON DELETE CASCADE,
  log_index    integer not null,
  address      character varying(66) not null,
  data         text not null,
  topics       character varying(400) not null,
  tx_id        integer not null REFERENCES vulcan2x.transaction(id) ON DELETE CASCADE,

  unique (log_index, tx_id)
)