-- Self-service billing: token wallets, ledger, Stripe subscription state.
-- Plans are free | personal | enterprise. Included quota resets each period;
-- prepaid packs persist. Existing org/project tenancy is unchanged.

-- ---------------------------------------------------------------------------
-- Wallets
-- ---------------------------------------------------------------------------

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('user', 'organization')),
  user_id uuid references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  plan text not null default 'free'
    check (plan in ('free', 'personal', 'enterprise')),
  seats integer not null default 1,
  included_tokens_grant bigint not null default 50000,
  included_tokens_remaining bigint not null default 50000,
  included_reset_at timestamptz not null default (now() + interval '30 days'),
  prepaid_tokens bigint not null default 0,
  auto_recharge_enabled boolean not null default false,
  auto_recharge_packs integer not null default 1,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  default_payment_method_id text,
  subscription_status text,
  past_due boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wallets_owner_xor check (
    (owner_type = 'user' and user_id is not null and organization_id is null)
    or
    (owner_type = 'organization' and organization_id is not null and user_id is null)
  ),
  constraint wallets_tokens_nonnegative check (
    included_tokens_remaining >= 0
    and prepaid_tokens >= 0
    and included_tokens_grant >= 0
    and seats >= 0
    and auto_recharge_packs >= 1
  )
);

create unique index if not exists wallets_user_unique
  on public.wallets (user_id)
  where owner_type = 'user';

create unique index if not exists wallets_organization_unique
  on public.wallets (organization_id)
  where owner_type = 'organization';

create index if not exists idx_wallets_stripe_customer
  on public.wallets (stripe_customer_id)
  where stripe_customer_id is not null;

create index if not exists idx_wallets_stripe_subscription
  on public.wallets (stripe_subscription_id)
  where stripe_subscription_id is not null;

alter table public.wallets enable row level security;

-- ---------------------------------------------------------------------------
-- Ledger + processed Stripe events
-- ---------------------------------------------------------------------------

create table if not exists public.token_ledger (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  reason text not null check (reason in (
    'period_grant',
    'pack_purchase',
    'auto_recharge',
    'llm_usage',
    'seat_grant',
    'plan_change',
    'adjustment'
  )),
  billed_tokens bigint not null,
  included_delta bigint not null default 0,
  prepaid_delta bigint not null default 0,
  llm_input_tokens integer not null default 0,
  llm_output_tokens integer not null default 0,
  model text,
  stripe_event_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_token_ledger_wallet_created
  on public.token_ledger (wallet_id, created_at desc);

create index if not exists idx_token_ledger_stripe_event
  on public.token_ledger (stripe_event_id)
  where stripe_event_id is not null;

alter table public.token_ledger enable row level security;

create table if not exists public.billing_stripe_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);

alter table public.billing_stripe_events enable row level security;

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  stripe_price_id text,
  plan text not null check (plan in ('personal', 'enterprise')),
  status text not null,
  seats integer not null default 1,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_billing_subscriptions_wallet
  on public.billing_subscriptions (wallet_id);

alter table public.billing_subscriptions enable row level security;

-- ---------------------------------------------------------------------------
-- Profile onboarding + usage event billed tokens
-- ---------------------------------------------------------------------------

alter table public.user_profiles
  add column if not exists onboarding_completed_at timestamptz;

alter table public.user_profiles
  add column if not exists welcome_email_sent_at timestamptz;

alter table public.llm_usage_events
  add column if not exists billed_tokens integer not null default 0;

-- ---------------------------------------------------------------------------
-- Project member roles: admin | editor | viewer (keep legacy 'member')
-- ---------------------------------------------------------------------------

alter table public.project_members
  drop constraint if exists project_members_role_check;

alter table public.project_members
  add constraint project_members_role_check
  check (role in ('admin', 'editor', 'viewer', 'member'));

-- ---------------------------------------------------------------------------
-- Atomic debit
-- ---------------------------------------------------------------------------

create or replace function public.debit_wallet(p_wallet_id uuid, p_tokens bigint)
returns jsonb
language plpgsql
as $$
declare
  w public.wallets%rowtype;
  take_included bigint;
  take_prepaid bigint;
begin
  if p_tokens is null or p_tokens <= 0 then
    return jsonb_build_object('ok', true, 'noop', true, 'included', 0, 'prepaid', 0);
  end if;

  select * into w from public.wallets where id = p_wallet_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'wallet_not_found');
  end if;

  if w.past_due then
    return jsonb_build_object('ok', false, 'code', 'past_due');
  end if;

  if (w.included_tokens_remaining + w.prepaid_tokens) < p_tokens then
    return jsonb_build_object(
      'ok', false,
      'code', 'insufficient_tokens',
      'available', w.included_tokens_remaining + w.prepaid_tokens,
      'plan', w.plan
    );
  end if;

  take_included := least(w.included_tokens_remaining, p_tokens);
  take_prepaid := p_tokens - take_included;

  update public.wallets
    set included_tokens_remaining = included_tokens_remaining - take_included,
        prepaid_tokens = prepaid_tokens - take_prepaid,
        updated_at = now()
    where id = p_wallet_id;

  return jsonb_build_object(
    'ok', true,
    'included', take_included,
    'prepaid', take_prepaid
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Signup: profile + free wallet
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (user_id, email, tier)
  values (new.id, lower(new.email), 'free')
  on conflict (user_id) do update
    set email = excluded.email,
        updated_at = now();

  insert into public.wallets (
    owner_type,
    user_id,
    plan,
    seats,
    included_tokens_grant,
    included_tokens_remaining,
    included_reset_at
  )
  values (
    'user',
    new.id,
    'free',
    1,
    50000,
    50000,
    now() + interval '30 days'
  )
  on conflict (user_id) where owner_type = 'user' do nothing;

  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill wallets for existing users and organizations
insert into public.wallets (
  owner_type,
  user_id,
  plan,
  seats,
  included_tokens_grant,
  included_tokens_remaining,
  included_reset_at
)
select
  'user',
  p.user_id,
  'free',
  1,
  50000,
  50000,
  coalesce(p.credits_reset_date, now() + interval '30 days')
from public.user_profiles p
where p.user_id is not null
on conflict (user_id) where owner_type = 'user' do nothing;

insert into public.wallets (
  owner_type,
  organization_id,
  plan,
  seats,
  included_tokens_grant,
  included_tokens_remaining,
  included_reset_at
)
select
  'organization',
  o.id,
  'enterprise',
  greatest(
    1,
    (select count(*)::integer from public.organization_members m where m.organization_id = o.id)
  ),
  0,
  0,
  now() + interval '30 days'
from public.organizations o
on conflict (organization_id) where owner_type = 'organization' do nothing;

revoke all on public.wallets from anon, authenticated;
revoke all on public.token_ledger from anon, authenticated;
revoke all on public.billing_stripe_events from anon, authenticated;
revoke all on public.billing_subscriptions from anon, authenticated;
