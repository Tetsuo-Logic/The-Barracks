-- Editable games list: the CO can add or remove games at will. Stored as JSON on
-- the single app_settings row (CO-only write already enforced). Only the seed
-- 'threeball' keeps golf scoring; everything added is a plain game. Run after 0020.

alter table app_settings add column if not exists games jsonb;

insert into app_settings (id) values (1) on conflict (id) do nothing;

update app_settings
set games = '[
  {"id":"threeball","name":"The Threeball Cup","emoji":"⛳","hasScorecard":true},
  {"id":"cod","name":"COD","emoji":"🎮","hasScorecard":false},
  {"id":"showdown","name":"Showdown","emoji":"🕹️","hasScorecard":false},
  {"id":"fifa","name":"FIFA","emoji":"⚽","hasScorecard":false},
  {"id":"gta","name":"GTA","emoji":"🚗","hasScorecard":false}
]'::jsonb
where id = 1 and games is null;
