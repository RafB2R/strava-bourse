-- $valeurs et @membres identifiés dans les commentaires du fil et dans les clubs
-- (posts et réponses). Les tags choisis sont rangés à côté du texte :
-- { "tickers": [{ symbol, name, type }], "mentions": [{ id, username, full_name }] }.

alter table public.activity_comments add column if not exists tags jsonb;
alter table public.club_posts add column if not exists tags jsonb;
alter table public.club_replies add column if not exists tags jsonb;

notify pgrst, 'reload schema';
