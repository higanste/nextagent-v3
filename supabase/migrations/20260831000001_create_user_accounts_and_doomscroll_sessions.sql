-- Create user_accounts table to store connected OAuth provider tokens
-- This table tracks all third-party account connections for the personal agent

create table if not exists user_accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  provider text not null, -- "github" | "google" | "strava" | "instagram" | "iosScreenTime" | "androidWellbeing"
  access_token text not null,
  refresh_token text,
  expires_at timestamp with time zone,
  scope text,
  data jsonb, -- Additional provider-specific data
  connected_at timestamp with time default timezone('utc'::text, now()) not null,
  updated_at timestamp with time default timezone('utc'::text, now()) not null,

  -- Prevent duplicate connections
  unique(user_id, provider)
);

-- Enable row level security
alter table user_accounts enable row level security;

-- Create policy: users can read their own account connections
create policy "Users can read own account connections" on user_accounts
  for select using (auth.uid() = user_id);

create policy "Users can insert own account connections" on user_accounts
  for insert with check (auth.uid() = user_id);

create policy "Users can update own account connections" on user_accounts
  for update using (auth.uid() = user_id);

-- Create doomscroll_sessions table to track screen time sessions

create table if not exists doomscroll_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  duration_minutes integer not null,
  apps_used text[], -- Array of app names used during session
  timestamp timestamptz default timezone('utc'::text, now()) not null,
  created_at timestamp with time default timezone('utc'::text, now()) not null
);

-- Enable row level security
alter table doomscroll_sessions enable row level security;

-- Create policy: users can read their own doomscroll sessions
create policy "Users can read own doomscroll sessions" on doomscroll_sessions
  for select using (auth.uid() = user_id);

create policy "Users can insert own doomscroll sessions" on doomscroll_sessions
  for insert with check (auth.uid() = user_id);

-- Create index for faster queries by user
create index idx_user_accounts_user_id on user_accounts(user_id);
create index idx_user_accounts_provider on user_accounts(provider);
create index idx_doomscroll_sessions_user_id on doomscroll_sessions(user_id);
create index idx_doomscroll_sessions_timestamp on doomscroll_sessions(timestamp desc);