import type { SupabaseClient } from "@supabase/supabase-js";
import { matchKey, type RowError } from "./schema";
import type { ParsedContact, ParsedProduct } from "./parse";

/**
 * درج واقعی رکوردها.
 *
 * جدا از parse نگه داشته شده چون این لایه به دیتابیس نیاز دارد و
 * parse نه. اینطور اعتبارسنجی بدون شبکه تست می‌شود.
 */

export type DuplicateMode = "skip" | "update";

export interface ExecuteSummary {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: RowError[];
}

/** درج دسته‌ای با اندازه‌ی امن. */
const CHUNK = 200;

/* ───────────────────────── مخاطبین ───────────────────────── */

export async function importContacts(
  svc: SupabaseClient,
  params: {
    orgId: string;
    branchId: string | null;
    userId: string;
    jobId: string;
    rows: ParsedContact[];
    mode: DuplicateMode;
  }
): Promise<ExecuteSummary> {
  const { orgId, branchId, userId, jobId, rows, mode } = params;
  const summary: ExecuteSummary = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };
  if (rows.length === 0) return summary;

  /*
    مخاطبین موجود یک بار خوانده می‌شوند، نه یکی به ازای هر سطر.
    با ۵۰۰ سطر، حالت N+1 یعنی ۵۰۰ رفت‌وبرگشت و قطعاً timeout.
  */
  const { data: existing, error } = await svc
    .from("contacts")
    .select("id, name, phone, code")
    .eq("org_id", orgId);
  if (error) throw error;

  const byPhone = new Map<string, string>();
  const byCode = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const c of existing ?? []) {
    if (c.phone) byPhone.set(matchKey(c.phone as string), c.id as string);
    if (c.code) byCode.set(matchKey(c.code as string), c.id as string);
    if (c.name) byName.set(matchKey(c.name as string), c.id as string);
  }

  const toInsert: Record<string, unknown>[] = [];
  const toUpdate: { id: string; patch: Record<string, unknown>; row: number }[] = [];

  for (const r of rows) {
    const existingId =
      (r.phone ? byPhone.get(matchKey(r.phone)) : undefined) ??
      (r.code ? byCode.get(matchKey(r.code)) : undefined) ??
      (!r.phone && !r.code ? byName.get(matchKey(r.name)) : undefined);

    if (existingId) {
      if (mode === "skip") {
        summary.skipped++;
        continue;
      }
      /*
        فقط ستون‌هایی که در فایل مقدار دارند به‌روز می‌شوند.
        🔴 اگر همه‌ی ستون‌ها را می‌فرستادیم، ستون خالی در فایل،
        آدرس و توضیح موجود مشتری را پاک می‌کرد — «به‌روزرسانی» به
        «حذف اطلاعات» تبدیل می‌شد.
      */
      const patch: Record<string, unknown> = { name: r.name, type: r.type };
      if (r.phone !== null) patch.phone = r.phone;
      if (r.address !== null) patch.address = r.address;
      if (r.description !== null) patch.description = r.description;
      if (r.creditLimit !== null) patch.credit_limit = r.creditLimit;
      if (r.openingBalance !== null) patch.opening_balance = r.openingBalance;
      toUpdate.push({ id: existingId, patch, row: r.rowNumber });
      continue;
    }

    toInsert.push({
      org_id: orgId,
      branch_id: branchId,
      name: r.name,
      type: r.type,
      phone: r.phone,
      // code خالی → تریگر set_contact_code خودش می‌سازد
      code: r.code,
      address: r.address,
      description: r.description,
      credit_limit: r.creditLimit ?? 0,
      opening_balance: r.openingBalance ?? 0,
      created_by: userId,
      import_job_id: jobId,
    });

    // درون همین فایل هم باید تکراری تشخیص داده شود
    if (r.phone) byPhone.set(matchKey(r.phone), "pending");
    if (r.code) byCode.set(matchKey(r.code), "pending");
    byName.set(matchKey(r.name), "pending");
  }

  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK);
    const { error: insErr } = await svc.from("contacts").insert(chunk);
    if (insErr) {
      summary.failed += chunk.length;
      summary.errors.push({
        row: rows[i]?.rowNumber ?? 0,
        message: `ثبت ${chunk.length} سطر ناموفق بود: ${insErr.message}`,
      });
    } else {
      summary.created += chunk.length;
    }
  }

  for (const u of toUpdate) {
    const { error: updErr } = await svc
      .from("contacts")
      .update(u.patch)
      .eq("id", u.id)
      .eq("org_id", orgId);   // گارد سازمان داخل کوئری
    if (updErr) {
      summary.failed++;
      summary.errors.push({ row: u.row, message: `به‌روزرسانی ناموفق: ${updErr.message}` });
    } else {
      summary.updated++;
    }
  }

  return summary;
}

/* ───────────────────────── کالاها ───────────────────────── */

export async function importProducts(
  svc: SupabaseClient,
  params: {
    orgId: string;
    branchId: string | null;
    userId: string;
    jobId: string;
    rows: ParsedProduct[];
    mode: DuplicateMode;
  }
): Promise<ExecuteSummary> {
  const { orgId, branchId, userId, jobId, rows, mode } = params;
  const summary: ExecuteSummary = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };
  if (rows.length === 0) return summary;

  /* ── فهرست‌های مرجع، یک بار ── */
  const [{ data: cats }, { data: brands }, { data: existingProducts }, { data: existingVariants }] =
    await Promise.all([
      svc.from("categories").select("id, name"),
      svc.from("brands").select("id, name").eq("org_id", orgId),
      svc.from("products").select("id, name, code").eq("org_id", orgId),
      svc
        .from("product_variants")
        .select("id, product_id, barcode, sku, color, size")
        .eq("org_id", orgId),
    ]);

  const catByName = new Map((cats ?? []).map((c) => [matchKey(c.name as string), c.id as string]));
  const brandByName = new Map((brands ?? []).map((b) => [matchKey(b.name as string), b.id as string]));
  const productByCode = new Map<string, string>();
  const productByName = new Map<string, string>();
  for (const p of existingProducts ?? []) {
    if (p.code) productByCode.set(matchKey(p.code as string), p.id as string);
    if (p.name) productByName.set(matchKey(p.name as string), p.id as string);
  }
  const variantByBarcode = new Map<string, { id: string; productId: string }>();
  for (const v of existingVariants ?? []) {
    if (v.barcode)
      variantByBarcode.set(matchKey(v.barcode as string), {
        id: v.id as string,
        productId: v.product_id as string,
      });
  }

  /* ── برندهای تازه ساخته می‌شوند؛ دسته‌ها نه ──
     دلیل در مهاجرت ۰۰۳۷ آمده: جدول categories ستون org_id ندارد و
     بین همه‌ی کسب‌وکارها مشترک است. ساختن دسته از اینجا یعنی دسته‌ی
     یک مشتری در حساب بقیه ظاهر شود. */
  const newBrandNames = Array.from(
    new Set(
      rows
        .map((r) => r.brand)
        .filter((b): b is string => Boolean(b) && !brandByName.has(matchKey(b!)))
        .map((b) => b.trim())
    )
  );
  if (newBrandNames.length > 0) {
    const { data: created } = await svc
      .from("brands")
      .insert(newBrandNames.map((name) => ({ org_id: orgId, branch_id: branchId, name, created_by: userId })))
      .select("id, name");
    for (const b of created ?? []) brandByName.set(matchKey(b.name as string), b.id as string);
  }

  /* ── هر سطر ── */
  type PendingMovement = { variantId: string; qty: number };
  const movements: PendingMovement[] = [];

  for (const r of rows) {
    try {
      // دسته‌ای که وجود ندارد: هشدار، ولی کالا ثبت می‌شود.
      // رد کردن کل سطر به‌خاطر یک غلط املایی در دسته، بیش از حد سخت‌گیرانه است.
      let categoryId: string | null = null;
      if (r.category) {
        categoryId = catByName.get(matchKey(r.category)) ?? null;
        if (!categoryId) {
          summary.errors.push({
            row: r.rowNumber,
            column: "دسته‌بندی",
            message: `دسته‌ی «${r.category}» وجود ندارد — کالا بدون دسته ثبت شد`,
          });
        }
      }
      const brandId = r.brand ? brandByName.get(matchKey(r.brand)) ?? null : null;

      /* ── واریانت تکراری؟ ── */
      const existingVariant = r.barcode ? variantByBarcode.get(matchKey(r.barcode)) : undefined;
      if (existingVariant) {
        if (mode === "skip") {
          summary.skipped++;
          continue;
        }
        const patch: Record<string, unknown> = {};
        if (r.purchasePrice !== null) patch.purchase_price = r.purchasePrice;
        if (r.salePrice !== null) patch.sale_price = r.salePrice;
        if (r.color !== null) patch.color = r.color;
        if (r.size !== null) patch.size = r.size;
        /*
          ⚠️ stock_qty عمداً اینجا نیست.
          تریگر guard_stock_qty_update تغییر مستقیم موجودی را رد
          می‌کند: «stock_qty فقط از طریق stock_movements قابل تغییر
          است». موجودی با سند انبار تنظیم می‌شود، پایین‌تر.
        */
        if (Object.keys(patch).length > 0) {
          const { error } = await svc
            .from("product_variants")
            .update(patch)
            .eq("id", existingVariant.id)
            .eq("org_id", orgId);
          if (error) throw error;
        }
        summary.updated++;
        continue;
      }

      /* ── کالای پایه: موجود یا تازه ── */
      let productId =
        (r.code ? productByCode.get(matchKey(r.code)) : undefined) ??
        productByName.get(matchKey(r.name));

      if (!productId) {
        const { data: created, error } = await svc
          .from("products")
          .insert({
            org_id: orgId,
            branch_id: branchId,
            name: r.name,
            code: r.code,           // خالی → تریگر set_product_code
            category_id: categoryId,
            brand_id: brandId,
            description: r.description,
            base_purchase_price: r.purchasePrice ?? 0,
            base_sale_price: r.salePrice ?? 0,
            low_stock_threshold: r.lowStock ?? 3,
            created_by: userId,
            import_job_id: jobId,
          })
          .select("id, code, name")
          .single();
        if (error) throw error;
        productId = created.id as string;
        if (created.code) productByCode.set(matchKey(created.code as string), productId);
        productByName.set(matchKey(created.name as string), productId);
      }

      /* ── واریانت ── */
      const { data: variant, error: vErr } = await svc
        .from("product_variants")
        .insert({
          org_id: orgId,
          branch_id: branchId,
          product_id: productId,
          color: r.color,
          size: r.size,
          barcode: r.barcode,
          purchase_price: r.purchasePrice,
          sale_price: r.salePrice,
          created_by: userId,
          import_job_id: jobId,
        })
        .select("id")
        .single();
      if (vErr) throw vErr;

      if (r.barcode) {
        variantByBarcode.set(matchKey(r.barcode), {
          id: variant.id as string,
          productId,
        });
      }
      if (r.stock && r.stock > 0) {
        movements.push({ variantId: variant.id as string, qty: r.stock });
      }
      summary.created++;
    } catch (e) {
      summary.failed++;
      summary.errors.push({
        row: r.rowNumber,
        message: (e as Error).message?.slice(0, 200) ?? "خطای نامشخص",
      });
    }
  }

  /* ── موجودی اولیه ──
     موجودی هرگز مستقیم نوشته نمی‌شود؛ سند انبار می‌خورد و تریگر
     apply_stock_movement خودش stock_qty را بالا می‌برد. این یعنی
     کاردکس کالا از روز اول درست است و برگرداندن ورود هم ممکن می‌ماند.

     reason='opening' و ref_table='import_jobs' تا در گردش انبار
     مشخص باشد این موجودی از کجا آمده. */
  if (movements.length > 0) {
    for (let i = 0; i < movements.length; i += CHUNK) {
      const chunk = movements.slice(i, i + CHUNK);
      const { error } = await svc.from("stock_movements").insert(
        chunk.map((m) => ({
          org_id: orgId,
          branch_id: branchId,
          variant_id: m.variantId,
          type: "in",
          reason: "opening",
          qty: m.qty,
          ref_table: "import_jobs",
          ref_id: jobId,
          note: "موجودی اولیه از فایل اکسل",
          created_by: userId,
        }))
      );
      if (error) {
        summary.errors.push({
          row: 0,
          message: `ثبت موجودی اولیه برای ${chunk.length} کالا ناموفق بود: ${error.message}`,
        });
      }
    }
  }

  return summary;
}
