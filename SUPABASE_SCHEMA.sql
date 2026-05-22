-- Optional production schema for OCR Labeling Console.
-- Run in Supabase only after confirming privacy/security policy.

create table if not exists public.ocr_items (
  id text primary key,
  exam_id text not null,
  student_name text,
  grade text,
  page_num integer,
  line_num integer,
  task_type text,
  image_url text,
  page_image_url text,
  apple_ocr text,
  qwen_ocr text,
  qwen_lora_ocr text,
  chosen_text text,
  confidence numeric,
  review_required boolean default false,
  reasons jsonb default '[]'::jsonb,
  status text default 'open',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.ocr_labels (
  id uuid primary key default gen_random_uuid(),
  item_id text references public.ocr_items(id) on delete cascade,
  reviewer_id uuid references auth.users(id),
  corrected_text text not null,
  status text not null default 'verified',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.scoring_labels (
  id uuid primary key default gen_random_uuid(),
  item_id text references public.ocr_items(id) on delete cascade,
  reviewer_id uuid references auth.users(id),
  structure numeric,
  content numeric,
  mechanics numeric,
  total numeric generated always as (coalesce(structure,0) + coalesce(content,0) + coalesce(mechanics,0)) stored,
  rubric_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.ocr_items enable row level security;
alter table public.ocr_labels enable row level security;
alter table public.scoring_labels enable row level security;

-- Minimal authenticated reviewer policies. Tighten before production if student PII is present.
create policy "authenticated can read items" on public.ocr_items for select to authenticated using (true);
create policy "authenticated can update items" on public.ocr_items for update to authenticated using (true);
create policy "authenticated can insert labels" on public.ocr_labels for insert to authenticated with check (auth.uid() = reviewer_id);
create policy "authenticated can read labels" on public.ocr_labels for select to authenticated using (true);
create policy "authenticated can update own labels" on public.ocr_labels for update to authenticated using (auth.uid() = reviewer_id);
create policy "authenticated can insert scoring labels" on public.scoring_labels for insert to authenticated with check (auth.uid() = reviewer_id);
create policy "authenticated can read scoring labels" on public.scoring_labels for select to authenticated using (true);
create policy "authenticated can update own scoring labels" on public.scoring_labels for update to authenticated using (auth.uid() = reviewer_id);
