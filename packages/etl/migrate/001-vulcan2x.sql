CREATE SCHEMA vulcan2x;

CREATE TABLE vulcan2x.block (
  id           serial primary key,
  number       integer not null,
  hash         character varying(66) not null,
  timestamp    timestamptz not null,

  CONSTRAINT   unique_hash UNIQUE(hash)
);

CREATE INDEX vulcan2x_block_number_index ON vulcan2x.block(number);

CREATE TABLE vulcan2x.extracted_block (
  id             serial primary key,
  block_id       integer not null REFERENCES vulcan2x.block(id) ON DELETE CASCADE,
  extractor_name character varying(100) not null,
  status         character varying(100) not null,
  unique (block_id, extractor_name)
);
CREATE INDEX vulcan2x_extracted_block_extractor_name ON vulcan2x.extracted_block(extractor_name);

CREATE TABLE vulcan2x.transformed_block (
  id               serial primary key,
  block_id         integer not null REFERENCES vulcan2x.block(id) ON DELETE CASCADE,
  transformer_name character varying(100) not null,
  status           character varying(100) not null,
  unique (block_id, transformer_name)
);
CREATE INDEX vulcan2x_transformed_block_transformer_name ON vulcan2x.transformed_block(transformer_name);

CREATE TABLE vulcan2x.transaction (
  id           serial primary key,
  hash         character varying(66) not null,
  to_address   character varying(66) not null,
  from_address character varying(66) not null,
  block_id     integer not null REFERENCES vulcan2x.block(id) ON DELETE CASCADE,

  CONSTRAINT   transaction_unique_hash UNIQUE(hash)
);