-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- 1. Profiles Table
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  height_cm numeric,
  gender text,
  current_weight_kg numeric,
  target_weight_kg numeric,
  primary_goal text,
  target_date date,
  daily_target_calories integer default 2500,
  daily_target_protein_g integer default 150,
  daily_target_carbs_g integer,
  daily_target_fat_g integer,
  daily_target_burn_calories integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Weight Logs Table
create table public.weight_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  weight_kg numeric not null,
  logged_date date default current_date not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Nutrition Logs Table
create table public.nutrition_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  raw_input text not null,
  total_calories integer not null,
  total_protein_g integer not null,
  total_carbs_g integer not null,
  total_fat_g integer not null,
  items_breakdown jsonb not null,
  logged_date date default current_date not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Workout Logs Table
create table public.workout_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  target_muscle_group text not null,
  readiness_score text,
  plan_json jsonb not null,
  is_completed boolean default false not null,
  logged_date date default current_date not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Activity Logs Table
create table public.activity_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  raw_input text not null,
  total_calories_burned integer not null,
  activities_breakdown jsonb not null,
  logged_date date default current_date not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.weight_logs enable row level security;
alter table public.nutrition_logs enable row level security;
alter table public.workout_logs enable row level security;
alter table public.activity_logs enable row level security;

-- Create RLS Policies (Users can only see/edit their own data)
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can CRUD own weight logs" on public.weight_logs for all using (auth.uid() = user_id);
create policy "Users can CRUD own nutrition logs" on public.nutrition_logs for all using (auth.uid() = user_id);
create policy "Users can CRUD own workout logs" on public.workout_logs for all using (auth.uid() = user_id);
create policy "Users can CRUD own activity logs" on public.activity_logs for all using (auth.uid() = user_id);

-- Trigger to create profile on sign up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();