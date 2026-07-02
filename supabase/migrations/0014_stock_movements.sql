-- =============================================================
-- Hesabyar Migration 0014 - تثبیت Stock Movements و Read Model موجودی
-- نوع: UP migration
-- ایمنی: idempotent، بدون حذف داده، بدون trigger جدید روی جداول عملیاتی
-- نکته مهم: در schema فعلی stock_movements.type جهت حرکت است، نه نوع تجاری.
--           بنابراین type فعلی حفظ می‌شود و reason به عنوان نوع تجاری استفاده می‌شود.
-- =============================================================

-- -------------------------------------------------------------
-- بخش ۱) تکمیل ستون‌های آینده‌پذیر
-- warehouse_id فعلاً FK ندارد چون جدول warehouse هنوز در schema فعلی وجود ندارد.
-- balance_after برای snapshot موجودی بعد از هر حرکت جدید استفاده می‌شود.
-- ستون‌های موجود زیر تکرار نمی‌شوند:
--   type      = جهت حرکت فعلی: in/out/adjust/transfer_in/transfer_out
--   reason    = نوع/علت تجاری حرکت: purchase/sale/opening/...
--   ref_table = معادل ref_type
--   ref_id    = شناسه uuid سند مرجع
--   created_by از قبل وجود دارد
-- -------------------------------------------------------------
alter table if exists public.stock_movements
  add column if not exists warehouse_id uuid null,
  add column if not exists balance_after numeric null;

-- -------------------------------------------------------------
-- استانداردسازی constraint ستون reason بدون حذف داده
-- reason نقش movement_type تجاری را دارد.
-- مقادیر legacy مثل manual/count حفظ می‌شوند تا داده/کد فعلی نشکند.
-- -------------------------------------------------------------
do $$
declare
  v_attnum int;
  r record;
begin
  select attnum into v_attnum
  from pg_attribute
  where attrelid = 'public.stock_movements'::regclass
    and attname = 'reason'
    and not attisdropped;

  if v_attnum is not null then
    for r in
      select conname
      from pg_constraint
      where conrelid = 'public.stock_movements'::regclass
        and contype = 'c'
        and v_attnum = any(conkey)
        and conname <> 'stock_movements_reason_semantic_check'
    loop
      execute format('alter table public.stock_movements drop constraint if exists %I', r.conname);
    end loop;

    if not exists (
      select 1 from pg_constraint
      where conname = 'stock_movements_reason_semantic_check'
        and conrelid = 'public.stock_movements'::regclass
    ) then
      alter table public.stock_movements
        add constraint stock_movements_reason_semantic_check
        check (reason in ('purchase','sale','adjust','waste','return','opening','transfer','manual','count'));
    end if;
  end if;
end $$;

-- -------------------------------------------------------------
-- ایندکس‌های کمکی غیرمخرب برای گزارش‌گیری و اتصال سندی
-- -------------------------------------------------------------
create index if not exists idx_stock_movements_ref
  on public.stock_movements (ref_table, ref_id);

create index if not exists idx_stock_movements_created_at
  on public.stock_movements (created_at desc);

create index if not exists idx_stock_movements_warehouse
  on public.stock_movements (warehouse_id);

-- -------------------------------------------------------------
-- بخش ۲) View موجودی محصول/واریانت
-- موجودی مستقیم از SUM(qty) محاسبه می‌شود.
-- دلیل: qty در دیتابیس فعلی خودش علامت اثر موجودی را دارد و trigger فعلی نیز مستقیم stock_qty + qty می‌کند.
-- برای variantهای بدون حرکت هم current_stock = 0 نمایش داده می‌شود.
-- -------------------------------------------------------------
drop view if exists public.v_product_stock;

create or replace view public.v_product_stock
with (security_invoker = true)
as
select
  p.id::uuid as product_id,
  pv.id::uuid as product_variant_id,
  coalesce(sum(sm.qty), 0)::numeric as current_stock,
  max(sm.created_at)::timestamptz as last_movement_at
from public.product_variants pv
join public.products p on p.id = pv.product_id
left join public.stock_movements sm on sm.variant_id = pv.id
group by p.id, pv.id;

comment on view public.v_product_stock is
'Read-model موجودی محصول/واریانت بر اساس SUM(stock_movements.qty)؛ بدون تغییر داده فیزیکی.';

-- -------------------------------------------------------------
-- بخش ۴) RPC ثبت حرکت انبار
-- امضای عمومی مطابق معماری:
-- fn_add_stock_movement(p_product_id, p_variant_id, p_type, p_qty, p_ref_type, p_ref_id, p_note)
--
-- Mapping امن:
--   p_type semantic  → stock_movements.reason
--   direction/effect → stock_movements.type
--   p_ref_type       → stock_movements.ref_table
--   p_ref_id         → stock_movements.ref_id اگر uuid معتبر باشد
--
-- توجه: stock_movements.qty در schema فعلی integer است؛ مقدار اعشاری رد می‌شود.
-- -------------------------------------------------------------
create or replace function public.fn_add_stock_movement(
  p_product_id uuid,
  p_variant_id uuid,
  p_type text,
  p_qty numeric,
  p_ref_type text default null,
  p_ref_id text default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid;
  v_org_id uuid;
  v_branch_id uuid;
  v_product_id uuid;
  v_reason text;
  v_direction text;
  v_qty numeric;
  v_qty_int int;
  v_current_stock numeric;
  v_balance_after numeric;
  v_ref_table text;
  v_ref_id uuid;
  v_movement_id uuid;
  v_after jsonb;
begin
  -- اعتبارسنجی پایه
  if p_variant_id is null then
    raise exception 'p_variant_id الزامی است';
  end if;

  if p_qty is null or p_qty = 0 then
    raise exception 'p_qty باید غیرصفر باشد';
  end if;

  if p_qty <> trunc(p_qty) then
    raise exception 'در schema فعلی stock_movements.qty از نوع integer است؛ مقدار اعشاری مجاز نیست: %', p_qty;
  end if;

  v_reason := lower(trim(coalesce(p_type, '')));

  if v_reason not in ('purchase','sale','adjust','waste','return','opening','transfer') then
    raise exception 'نوع حرکت انبار نامعتبر است: %', p_type;
  end if;

  -- دریافت اطلاعات variant و کنترل product_id
  select pv.org_id, pv.branch_id, pv.product_id
    into v_org_id, v_branch_id, v_product_id
  from public.product_variants pv
  where pv.id = p_variant_id;

  if v_org_id is null then
    raise exception 'product_variant یافت نشد: %', p_variant_id;
  end if;

  if p_product_id is not null and p_product_id <> v_product_id then
    raise exception 'p_product_id با product_id تنوع کالا سازگار نیست';
  end if;

  -- گرفتن user_id از Supabase Auth، در contextهای backend ممکن است null باشد.
  begin
    v_uid := auth.uid();
  exception when others then
    v_uid := null;
  end;

  -- نرمال‌سازی ref_type به نام جدول‌های فعلی
  v_ref_table := nullif(trim(coalesce(p_ref_type, '')), '');
  if v_ref_table = 'sale' then
    v_ref_table := 'sales';
  elsif v_ref_table = 'purchase' then
    v_ref_table := 'purchases';
  end if;

  -- ref_id فعلی uuid است؛ اگر متن uuid معتبر نباشد، null ثبت می‌شود.
  if p_ref_id is not null and p_ref_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_ref_id := p_ref_id::uuid;
  else
    v_ref_id := null;
  end if;

  -- تبدیل نوع تجاری به جهت و qty علامت‌دار
  if v_reason in ('purchase', 'opening') then
    v_direction := 'in';
    v_qty := abs(p_qty);

  elsif v_reason in ('sale', 'waste') then
    v_direction := 'out';
    v_qty := -1 * abs(p_qty);

  elsif v_reason = 'return' then
    -- پیش‌فرض return در POS یعنی برگشت از مشتری و ورود موجودی.
    -- اگر در آینده purchase_return باشد، می‌توان بر اساس ref_type خروجی کرد.
    if v_ref_table in ('purchase_returns', 'purchase_return') then
      v_direction := 'out';
      v_qty := -1 * abs(p_qty);
    else
      v_direction := 'in';
      v_qty := abs(p_qty);
    end if;

  elsif v_reason = 'adjust' then
    v_direction := 'adjust';
    v_qty := p_qty;

  elsif v_reason = 'transfer' then
    if p_qty >= 0 then
      v_direction := 'transfer_in';
      v_qty := abs(p_qty);
    else
      v_direction := 'transfer_out';
      v_qty := -1 * abs(p_qty);
    end if;
  end if;

  v_qty_int := v_qty::int;

  -- محاسبه موجودی جاری قبل از insert، بر اساس دفتر حرکات
  select coalesce(sum(qty), 0)::numeric
    into v_current_stock
  from public.stock_movements
  where variant_id = p_variant_id;

  v_balance_after := coalesce(v_current_stock, 0) + v_qty;

  insert into public.stock_movements (
    org_id,
    branch_id,
    variant_id,
    type,
    reason,
    qty,
    ref_table,
    ref_id,
    note,
    warehouse_id,
    balance_after,
    created_by
  ) values (
    v_org_id,
    v_branch_id,
    p_variant_id,
    v_direction,
    v_reason,
    v_qty_int,
    v_ref_table,
    v_ref_id,
    p_note,
    null,
    v_balance_after,
    v_uid
  )
  returning id into v_movement_id;

  select to_jsonb(sm) into v_after
  from public.stock_movements sm
  where sm.id = v_movement_id;

  -- ثبت audit با source='rpc'
  insert into public.audit_logs (
    user_id,
    entity_type,
    entity_id,
    action,
    before_json,
    after_json,
    source,
    created_at
  ) values (
    v_uid,
    'stock_movement',
    v_movement_id::text,
    'create',
    null,
    v_after,
    'rpc',
    now()
  );

  return v_movement_id;
end;
$$;

comment on function public.fn_add_stock_movement(uuid, uuid, text, numeric, text, text, text) is
'ثبت امن حرکت انبار با mapping نوع تجاری به reason و جهت موجودی به type؛ همراه با balance_after و audit_logs.';

grant execute on function public.fn_add_stock_movement(uuid, uuid, text, numeric, text, text, text)
  to authenticated, service_role;

-- =============================================================
-- پایان UP migration 0014
-- =============================================================
