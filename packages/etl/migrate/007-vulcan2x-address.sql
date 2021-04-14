CREATE TABLE vulcan2x.address (
  address       character varying(66) not null unique,
  bytecode_hash character varying(66),
  is_contract   boolean not null default FALSE
);