CREATE TABLE vulcan2x.enhanced_transaction (
  hash         character varying(66) not null,
  method_name  character varying(255),
  arg0         text,
  arg1         text,
  arg2         text,
  args         json,
  primary key (hash)
);
