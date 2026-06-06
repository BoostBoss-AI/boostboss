-- ============================================================================
-- 23_publisher_payout_methods.sql — Bank-transfer payout details per publisher.
--
-- One row per publisher (keyed by auth.users.id), stores the international
-- bank-transfer fields Andy needs to feed into the Payoneer Mass Payouts API
-- on each biweekly batch. The publisher experiences this as "Boost Boss
-- payouts to my bank" — Payoneer is plumbing they don't see.
--
-- Writes are gated by password + TOTP 2FA at the API layer (see
-- /api/auth.js action=save_payout_method). RLS is enabled and there are no
-- grants — frontend never touches this table directly.
--
-- v1 supports bank transfer in USD only. Future rails (crypto / USDC on Base)
-- will get a separate table or a method_type column on this one.
-- ============================================================================

create table if not exists public.publisher_payout_methods (
  user_id                 uuid primary key references auth.users(id) on delete cascade,
  account_holder_name     text not null,
  account_holder_country  text not null,   -- ISO 3166-1 alpha-2
  account_holder_address  text not null,
  bank_name               text not null,
  bank_country            text not null,   -- ISO 3166-1 alpha-2
  swift_bic               text not null,
  iban_or_account         text not null,
  routing_or_branch       text,
  currency                text not null default 'USD',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

comment on table public.publisher_payout_methods is
  'Publisher international bank-transfer details. Writes require fresh TOTP + password verification.';
comment on column public.publisher_payout_methods.swift_bic is
  '8 or 11 character SWIFT/BIC code identifying the receiving bank globally.';
comment on column public.publisher_payout_methods.iban_or_account is
  'IBAN for IBAN-zone countries (EU, UK, MENA, etc.) or the domestic account number otherwise.';
comment on column public.publisher_payout_methods.routing_or_branch is
  'Optional: ABA routing (US), sort code (UK), BSB (AU), branch code (TW/JP), etc. Blank when using IBAN.';

alter table public.publisher_payout_methods enable row level security;
-- No grants — service role bypasses RLS by default.

-- Keeps updated_at fresh on UPDATE so admin tooling can show "last changed".
create or replace function public.touch_publisher_payout_methods()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_publisher_payout_methods_touch on public.publisher_payout_methods;
create trigger trg_publisher_payout_methods_touch
  before update on public.publisher_payout_methods
  for each row execute function public.touch_publisher_payout_methods();
