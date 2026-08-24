-- credit_limit can also be unknown ("por confirmar") for a card you haven't
-- fully detailed yet — NULL, never a silent 0.
alter table public.credit_cards
  alter column credit_limit drop not null;

comment on column public.credit_cards.credit_limit is
  'NULL means unknown/unconfirmed ("por confirmar") — never default this to 0.';
