ALTER TABLE vulcan2x.transaction 
  ADD COLUMN nonce integer,
  ADD COLUMN value numeric(78, 0),
  ADD COLUMN gas_limit numeric(78,0),
  ADD COLUMN gas_price numeric(78,0),
  ADD COLUMN data TEXT;
  