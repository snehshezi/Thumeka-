-- Migration 021: add Pre-loved as a marketplace category
--
-- Pre-loved (second-hand clothing, gear, anything pre-owned) slots in
-- right after Clothing — buyers browsing fashion are the most likely to
-- check it out. Inserts at sort_order=4 and bumps every category from
-- Beauty onward by one. Same idempotent pattern as migration 015
-- (Medication).
--
-- After this migration:
--   1 Food, 2 Groceries, 3 Clothing, 4 Pre-loved, 5 Beauty,
--   6 Medication, 7 Home services, 8 Cleaning, 9 Repairs, 10 Errands,
--   11 Transport, 12 Digital services, 13 Other

insert into public.categories (name, slug, sort_order)
values ('Pre-loved', 'pre-loved', 4)
on conflict (slug) do update
set
  name = excluded.name,
  sort_order = excluded.sort_order,
  is_active = true;

-- Re-assert canonical sort_order for every other category. Idempotent —
-- repeated runs land at the same final order.
update public.categories set sort_order = 1  where slug = 'food';
update public.categories set sort_order = 2  where slug = 'groceries';
update public.categories set sort_order = 3  where slug = 'clothing';
-- 4 is Pre-loved (set above)
update public.categories set sort_order = 5  where slug = 'beauty';
update public.categories set sort_order = 6  where slug = 'medication';
update public.categories set sort_order = 7  where slug = 'home-services';
update public.categories set sort_order = 8  where slug = 'cleaning';
update public.categories set sort_order = 9  where slug = 'repairs';
update public.categories set sort_order = 10 where slug = 'errands';
update public.categories set sort_order = 11 where slug = 'transport';
update public.categories set sort_order = 12 where slug = 'digital-services';
update public.categories set sort_order = 13 where slug = 'other';
