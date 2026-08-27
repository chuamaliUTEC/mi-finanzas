-- next_due_date can also be unknown ("por confirmar") for a recurring
-- expense whose exact billing day isn't known yet — NULL, never invented.
alter table public.recurring_expenses
  alter column next_due_date drop not null;

comment on column public.recurring_expenses.next_due_date is
  'NULL means the exact billing date is unknown/unconfirmed — never invent one.';
