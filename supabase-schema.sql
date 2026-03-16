-- Run this in Supabase SQL Editor (supabase.com > your project > SQL Editor)

-- Profiles table (extends Supabase Auth users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  display_name text,
  bio text default '',
  created_at timestamptz default now()
);

-- Items (books, films, TV shows)
create table public.items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  category text not null check (category in ('book', 'film', 'tv')),
  title text not null,
  creator text default '',
  year text default '',
  cover_url text default '',
  rank integer not null,
  external_id text default '',
  created_at timestamptz default now(),
  unique(user_id, category, title)
);

-- Friendships
create table public.friendships (
  id uuid default gen_random_uuid() primary key,
  requester_id uuid references public.profiles(id) on delete cascade not null,
  addressee_id uuid references public.profiles(id) on delete cascade not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz default now(),
  unique(requester_id, addressee_id)
);

-- Messages (private, item-anchored conversations)
create table public.messages (
  id uuid default gen_random_uuid() primary key,
  item_id uuid references public.items(id) on delete cascade not null,
  author_id uuid references public.profiles(id) on delete cascade not null,
  body text not null,
  created_at timestamptz default now()
);

-- Message recipients (who can see each message)
create table public.message_recipients (
  id uuid default gen_random_uuid() primary key,
  message_id uuid references public.messages(id) on delete cascade not null,
  recipient_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(message_id, recipient_id)
);

-- Recommended items (saved from AI recommendations)
create table public.recommended (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  category text not null check (category in ('book', 'film', 'tv')),
  title text not null,
  creator text default '',
  source text default '',
  notes text default '',
  created_at timestamptz default now(),
  unique(user_id, category, title)
);

-- Friend recommendations (sent between users)
create table public.friend_recommendations (
  id uuid default gen_random_uuid() primary key,
  from_user_id uuid references public.profiles(id) on delete cascade not null,
  to_user_id uuid references public.profiles(id) on delete cascade not null,
  category text not null check (category in ('book', 'film', 'tv')),
  title text not null,
  creator text default '',
  cover_url text default '',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz default now(),
  unique(from_user_id, to_user_id, category, title)
);

-- Saved AI recommendations per friend pair
create table public.match_recommendations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  friend_id uuid references public.profiles(id) on delete cascade not null,
  recommendation jsonb not null,
  created_at timestamptz default now(),
  unique(user_id, friend_id)
);

-- Personal AI recommendations (cached per user)
create table public.personal_recommendations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null unique,
  recommendation jsonb not null,
  created_at timestamptz default now()
);

-- Indexes
create index idx_recommended_user on public.recommended(user_id);
create index idx_match_recs_user on public.match_recommendations(user_id, friend_id);
create index idx_items_user on public.items(user_id);
create index idx_items_category on public.items(user_id, category);
create index idx_items_external_id on public.items(external_id);
create index idx_friendships_addressee on public.friendships(addressee_id);
create index idx_messages_item on public.messages(item_id);
create index idx_messages_author on public.messages(author_id);
create index idx_message_recipients_recipient on public.message_recipients(recipient_id);
create index idx_message_recipients_message on public.message_recipients(message_id);
create index idx_friend_recs_to on public.friend_recommendations(to_user_id);
create index idx_friend_recs_from on public.friend_recommendations(from_user_id);

create index idx_personal_recs_user on public.personal_recommendations(user_id);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.items enable row level security;
alter table public.friendships enable row level security;
alter table public.recommended enable row level security;
alter table public.match_recommendations enable row level security;
alter table public.friend_recommendations enable row level security;
alter table public.personal_recommendations enable row level security;
alter table public.messages enable row level security;
alter table public.message_recipients enable row level security;

-- Profiles: anyone can read, only own profile can update
create policy "Profiles are viewable by everyone" on public.profiles
  for select using (true);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- Items: anyone can read (needed for friend matching), only owner can modify
create policy "Items are viewable by everyone" on public.items
  for select using (true);
create policy "Users can insert own items" on public.items
  for insert with check (auth.uid() = user_id);
create policy "Users can update own items" on public.items
  for update using (auth.uid() = user_id);
create policy "Users can delete own items" on public.items
  for delete using (auth.uid() = user_id);

-- Friendships: involved users can read, requester can insert
create policy "Users can view own friendships" on public.friendships
  for select using (auth.uid() = requester_id or auth.uid() = addressee_id);
create policy "Users can send friend requests" on public.friendships
  for insert with check (auth.uid() = requester_id);
create policy "Addressee can update friendship status" on public.friendships
  for update using (auth.uid() = addressee_id);

-- Recommended: only owner can read, insert, delete
create policy "Recommended viewable by owner" on public.recommended
  for select using (auth.uid() = user_id);
create policy "Users can insert own recommended" on public.recommended
  for insert with check (auth.uid() = user_id);
create policy "Users can delete own recommended" on public.recommended
  for delete using (auth.uid() = user_id);

-- Match recommendations: only owner can read, insert, update
create policy "Match recs viewable by owner" on public.match_recommendations
  for select using (auth.uid() = user_id);
create policy "Users can insert own match recs" on public.match_recommendations
  for insert with check (auth.uid() = user_id);
create policy "Users can update own match recs" on public.match_recommendations
  for update using (auth.uid() = user_id);

-- Friend recommendations: sender can insert/view, recipient can view/update/delete
create policy "Users can send recommendations" on public.friend_recommendations
  for insert with check (auth.uid() = from_user_id);
create policy "Sender can view sent recs" on public.friend_recommendations
  for select using (auth.uid() = from_user_id);
create policy "Recipient can view received recs" on public.friend_recommendations
  for select using (auth.uid() = to_user_id);
create policy "Recipient can update rec status" on public.friend_recommendations
  for update using (auth.uid() = to_user_id);
create policy "Recipient can delete recs" on public.friend_recommendations
  for delete using (auth.uid() = to_user_id);

-- Personal recommendations: only owner can manage
create policy "Users can manage own personal recs" on public.personal_recommendations
  for all using (auth.uid() = user_id);

-- Messages: visible to author or any recipient
create policy "Authors can see own messages" on public.messages
  for select using (auth.uid() = author_id);
create policy "Recipients can see messages" on public.messages
  for select using (
    exists (select 1 from public.message_recipients where message_id = id and recipient_id = auth.uid())
  );
create policy "Users can send messages" on public.messages
  for insert with check (auth.uid() = author_id);

-- Message recipients: visible to the recipient or the message author
create policy "Recipients can see own entries" on public.message_recipients
  for select using (auth.uid() = recipient_id);
create policy "Authors can see recipient entries" on public.message_recipients
  for select using (
    exists (select 1 from public.messages where id = message_id and author_id = auth.uid())
  );
create policy "Authors can add recipients" on public.message_recipients
  for insert with check (
    exists (select 1 from public.messages where id = message_id and author_id = auth.uid())
  );

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
