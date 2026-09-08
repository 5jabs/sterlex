-- Enterprise tenancy: optional organizations alongside the personal workspace.
-- Users may belong to many organizations. Project access stays explicit
-- (owner / shared_with); org membership does not open every matter.

-- ---------------------------------------------------------------------------
-- Organizations
-- ---------------------------------------------------------------------------

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  created_by uuid references auth.users(id) on delete set null,
  admins_can_access_all_projects boolean not null default false,
  monthly_budget_usd numeric(12, 2),
  budget_enforcement text not null default 'off'
    check (budget_enforcement in ('off', 'soft', 'hard')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists organizations_slug_key
  on public.organizations (slug);

create index if not exists idx_organizations_created_by
  on public.organizations (created_by);

alter table public.organizations enable row level security;

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create unique index if not exists organization_members_one_owner
  on public.organization_members (organization_id)
  where role = 'owner';

create index if not exists idx_organization_members_user
  on public.organization_members (user_id);

alter table public.organization_members enable row level security;

create table if not exists public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'member')),
  token_hash text not null unique,
  invited_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists organization_invites_pending_email
  on public.organization_invites (organization_id, email)
  where status = 'pending';

create index if not exists idx_organization_invites_email
  on public.organization_invites (email);

alter table public.organization_invites enable row level security;

create table if not exists public.organization_api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('claude', 'gemini', 'openai', 'openrouter', 'courtlistener')),
  encrypted_key text not null,
  iv text not null,
  auth_tag text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);

create index if not exists idx_organization_api_keys_org
  on public.organization_api_keys (organization_id);

alter table public.organization_api_keys enable row level security;

create table if not exists public.llm_usage_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  provider text not null,
  model text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost_usd numeric(12, 6) not null default 0,
  key_source text check (key_source in ('org', 'user', 'env')),
  created_at timestamptz not null default now()
);

create index if not exists idx_llm_usage_events_org_created
  on public.llm_usage_events (organization_id, created_at desc);

create index if not exists idx_llm_usage_events_user_created
  on public.llm_usage_events (user_id, created_at desc);

alter table public.llm_usage_events enable row level security;

-- ---------------------------------------------------------------------------
-- Profile + project tenancy columns
-- ---------------------------------------------------------------------------

alter table public.user_profiles
  add column if not exists active_organization_id uuid
    references public.organizations(id) on delete set null;

create index if not exists idx_user_profiles_active_organization
  on public.user_profiles (active_organization_id);

alter table public.projects
  add column if not exists organization_id uuid
    references public.organizations(id) on delete restrict;

create index if not exists idx_projects_organization
  on public.projects (organization_id);

-- ---------------------------------------------------------------------------
-- Projects overview: include organization_id
-- ---------------------------------------------------------------------------

drop function if exists public.get_projects_overview(text, text);

create or replace function public.get_projects_overview(
  p_user_id text,
  p_user_email text default null
)
returns table (
  id uuid,
  user_id text,
  organization_id uuid,
  name text,
  cm_number text,
  practice text,
  shared_with jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  is_owner boolean,
  owner_display_name text,
  owner_email text,
  document_count integer,
  chat_count integer,
  review_count integer
)
language sql
stable
as $$
  with visible_projects as (
    select p.*
    from public.projects p
    where p.user_id = p_user_id
       or (
        coalesce(p_user_email, '') <> ''
        and p.user_id <> p_user_id
        and p.shared_with @> jsonb_build_array(p_user_email)
      )
       or (
        p.organization_id is not null
        and exists (
          select 1
          from public.organization_members m
          join public.organizations o on o.id = m.organization_id
          where m.organization_id = p.organization_id
            and m.user_id::text = p_user_id
            and o.admins_can_access_all_projects = true
            and m.role in ('owner', 'admin')
        )
      )
  ),
  document_counts as (
    select d.project_id, count(*)::integer as document_count
    from public.documents d
    where d.project_id in (select vp.id from visible_projects vp)
    group by d.project_id
  ),
  chat_counts as (
    select c.project_id, count(*)::integer as chat_count
    from public.chats c
    where c.project_id in (select vp.id from visible_projects vp)
    group by c.project_id
  ),
  review_counts as (
    select tr.project_id, count(*)::integer as review_count
    from public.tabular_reviews tr
    where tr.project_id in (select vp.id from visible_projects vp)
    group by tr.project_id
  )
  select
    vp.id,
    vp.user_id,
    vp.organization_id,
    vp.name,
    vp.cm_number,
    vp.practice,
    vp.shared_with,
    vp.created_at,
    vp.updated_at,
    vp.user_id = p_user_id as is_owner,
    nullif(trim(up.display_name), '') as owner_display_name,
    null::text as owner_email,
    coalesce(dc.document_count, 0) as document_count,
    coalesce(cc.chat_count, 0) as chat_count,
    coalesce(rc.review_count, 0) as review_count
  from visible_projects vp
  left join public.user_profiles up
    on up.user_id::text = vp.user_id
  left join document_counts dc
    on dc.project_id = vp.id
  left join chat_counts cc
    on cc.project_id = vp.id
  left join review_counts rc
    on rc.project_id = vp.id
  order by vp.created_at desc;
$$;

-- Tabular reviews inherit the same org-admin visibility as projects.
create or replace function public.get_tabular_reviews_overview(
  p_user_id text,
  p_user_email text default null,
  p_project_id text default null
)
returns table (
  id uuid,
  project_id uuid,
  user_id text,
  title text,
  columns_config jsonb,
  document_ids jsonb,
  workflow_id uuid,
  shared_with jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  is_owner boolean,
  document_count integer
)
language sql
stable
as $$
  with accessible_projects as (
    select p.id
    from public.projects p
    where p.user_id = p_user_id
       or (
        coalesce(p_user_email, '') <> ''
        and p.user_id <> p_user_id
        and p.shared_with @> jsonb_build_array(p_user_email)
      )
       or (
        p.organization_id is not null
        and exists (
          select 1
          from public.organization_members m
          join public.organizations o on o.id = m.organization_id
          where m.organization_id = p.organization_id
            and m.user_id::text = p_user_id
            and o.admins_can_access_all_projects = true
            and m.role in ('owner', 'admin')
        )
      )
  ),
  visible_reviews as (
    select tr.*
    from public.tabular_reviews tr
    where (p_project_id is null or tr.project_id::text = p_project_id)
      and (
        p_project_id is null
        or exists (
          select 1
          from accessible_projects ap
          where ap.id::text = p_project_id
        )
      )
      and (
        tr.user_id = p_user_id
        or (
          tr.project_id in (select ap.id from accessible_projects ap)
          and tr.user_id <> p_user_id
        )
        or (
          p_project_id is null
          and coalesce(p_user_email, '') <> ''
          and tr.user_id <> p_user_id
          and tr.shared_with @> jsonb_build_array(p_user_email)
        )
      )
  ),
  cell_document_counts as (
    select
      tc.review_id,
      count(distinct tc.document_id)::integer as document_count
    from public.tabular_cells tc
    where tc.review_id in (select vr.id from visible_reviews vr)
    group by tc.review_id
  )
  select
    vr.id,
    vr.project_id,
    vr.user_id,
    vr.title,
    vr.columns_config,
    vr.document_ids,
    vr.workflow_id,
    vr.shared_with,
    vr.created_at,
    vr.updated_at,
    vr.user_id = p_user_id as is_owner,
    case
      when jsonb_typeof(vr.document_ids) = 'array'
        then (
          select count(distinct doc_id.value)::integer
          from jsonb_array_elements_text(vr.document_ids) as doc_id(value)
        )
      else coalesce(cdc.document_count, 0)
    end as document_count
  from visible_reviews vr
  left join cell_document_counts cdc
    on cdc.review_id = vr.id
  order by vr.created_at desc;
$$;

-- ---------------------------------------------------------------------------
-- Direct client grant hardening
-- ---------------------------------------------------------------------------

revoke all on public.organizations from anon, authenticated;
revoke all on public.organization_members from anon, authenticated;
revoke all on public.organization_invites from anon, authenticated;
revoke all on public.organization_api_keys from anon, authenticated;
revoke all on public.llm_usage_events from anon, authenticated;
