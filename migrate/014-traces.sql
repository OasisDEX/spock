CREATE TABLE vulcan2x.traces (
  id             serial primary key,
  tx_id          integer not null REFERENCES vulcan2x.transaction(id) ON DELETE CASCADE,

  trace_blob     text not null,

  unique (tx_id)
);