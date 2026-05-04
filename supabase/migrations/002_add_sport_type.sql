alter table tournaments
  add column if not exists sport_type text not null default 'ping-pong';
