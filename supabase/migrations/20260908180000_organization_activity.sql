-- Organization activity log for member, invite, access, and settings events.
-- Used by the organization directory and activity screens. No email or billing.

create table if not exists public.organization_activity_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in (
    'organization_created',
    'settings_updated',
    'member_joined',
    'member_removed',
    'member_role_changed',
    'ownership_transferred',
    'invite_created',
    'invite_accepted',
    'invite_revoked',
    'invite_link_regenerated',
    'project_member_added',
    'project_member_removed',
    'api_key_saved',
    'api_key_removed'
  )),
  target_user_id uuid references auth.users(id) on delete set null,
  target_email text,
  project_id uuid references public.projects(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_organization_activity_org_created
  on public.organization_activity_events (organization_id, created_at desc);

alter table public.organization_activity_events enable row level security;

revoke all on public.organization_activity_events from anon, authenticated;
