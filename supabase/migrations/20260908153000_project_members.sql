-- Explicit project membership. Org membership still does not open every
-- matter; access is owner, project_members, or org-admin-all-projects.
-- shared_with remains a denormalized email list for compatibility.

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member'
    check (role in ('member')),
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create index if not exists idx_project_members_user
  on public.project_members (user_id);

create index if not exists idx_project_members_project
  on public.project_members (project_id);

alter table public.project_members enable row level security;

create table if not exists public.project_access_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('member_added', 'member_removed')),
  target_user_id uuid references auth.users(id) on delete set null,
  target_email text,
  created_at timestamptz not null default now()
);

create index if not exists idx_project_access_events_project_created
  on public.project_access_events (project_id, created_at desc);

alter table public.project_access_events enable row level security;

insert into public.project_members (project_id, user_id, role)
select distinct p.id, up.user_id, 'member'
from public.projects p
cross join lateral jsonb_array_elements_text(coalesce(p.shared_with, '[]'::jsonb)) as email(value)
join public.user_profiles up
  on lower(btrim(up.email)) = lower(btrim(email.value))
where up.user_id is not null
  and up.user_id::text is distinct from p.user_id
on conflict (project_id, user_id) do nothing;

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
  member_count integer,
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
       or exists (
        select 1
        from public.project_members pm
        where pm.project_id = p.id
          and pm.user_id::text = p_user_id
      )
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
  ),
  member_counts as (
    select pm.project_id, count(*)::integer as member_count
    from public.project_members pm
    where pm.project_id in (select vp.id from visible_projects vp)
    group by pm.project_id
  )
  select
    vp.id,
    vp.user_id,
    vp.organization_id,
    vp.name,
    vp.cm_number,
    vp.practice,
    vp.shared_with,
    coalesce(mc.member_count, 0) as member_count,
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
  left join member_counts mc
    on mc.project_id = vp.id
  order by vp.created_at desc;
$$;

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
       or exists (
        select 1
        from public.project_members pm
        where pm.project_id = p.id
          and pm.user_id::text = p_user_id
      )
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

revoke all on public.project_members from anon, authenticated;
revoke all on public.project_access_events from anon, authenticated;
