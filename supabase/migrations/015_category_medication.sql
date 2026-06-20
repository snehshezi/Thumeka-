-- Migration 015: add Medication as a marketplace category
--
-- Inserts Medication at sort_order=5 (between Beauty and Home services) and
-- shifts the subsequent categories down by one so the dropdown stays in a
-- sensible order. All updates are idempotent — re-running the migration is
-- safe because each category is keyed by its slug and we set its
-- sort_order to a fixed canonical value rather than incrementing.

insert into public.categories (name, slug, sort_order)
values ('Medication', 'medication', 5)
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
update public.categories set sort_order = 4  where slug = 'beauty';
-- 5 is Medication (set above)
update public.categories set sort_order = 6  where slug = 'home-services';
update public.categories set sort_order = 7  where slug = 'cleaning';
update public.categories set sort_order = 8  where slug = 'repairs';
update public.categories set sort_order = 9  where slug = 'errands';
update public.categories set sort_order = 10 where slug = 'transport';
update public.categories set sort_order = 11 where slug = 'digital-services';
update public.categories set sort_order = 12 where slug = 'other';
