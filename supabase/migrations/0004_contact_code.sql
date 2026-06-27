-- =============================================================
-- حساب‌یار - آپدیت ۴: کد یکتا برای اشخاص (مشتری/تامین‌کننده)
-- مثل کد کالا. این فایل را در Supabase > SQL Editor اجرا کنید.
-- =============================================================

-- 1) ستون کد
alter table public.contacts add column if not exists code text;

-- 2) ایندکس یکتا در هر سازمان (وقتی پر است)
create unique index if not exists uq_contacts_org_code
  on public.contacts(org_id, code) where code is not null;

create index if not exists idx_contacts_code on public.contacts(code);

-- 3) تابع تولید کد بعدی مشتری (پیشوند C + شماره ۵ رقمی، با پیشوند سازمان)
create or replace function public.next_contact_code(p_org uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_count  bigint;
  v_code   text;
begin
  select coalesce((value->>'contact_code_prefix'), 'MJ-C')
    into v_prefix
    from public.settings
    where org_id = p_org and key = 'general'
    limit 1;
  if v_prefix is null then v_prefix := 'MJ-C'; end if;

  select count(*) into v_count from public.contacts where org_id = p_org;

  loop
    v_count := v_count + 1;
    v_code := v_prefix || '-' || lpad(v_count::text, 5, '0');
    exit when not exists (
      select 1 from public.contacts where org_id = p_org and code = v_code
    );
  end loop;

  return v_code;
end;
$$;

-- 4) تریگر: تولید خودکار کد هنگام درج اگر خالی بود
create or replace function public.set_contact_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.code is null or btrim(new.code) = '' then
    new.code := public.next_contact_code(new.org_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_contact_code on public.contacts;
create trigger trg_set_contact_code
  before insert on public.contacts
  for each row execute function public.set_contact_code();

-- =============================================================
-- پایان آپدیت ۴
-- =============================================================
