-- Idempotent seed for Spend module.
-- Run after 20240101000015_spend_module.sql.

-- ------------------------------------------------------------
-- Category hierarchy
-- ------------------------------------------------------------

INSERT INTO public.spend_categories (name, level, parent_id, sort_order)
SELECT seed.name, 1, NULL, seed.sort_order
FROM (
  VALUES
    ('Logistics', 10),
    ('Manufacturing', 20),
    ('Technology', 30),
    ('Energy', 40),
    ('Healthcare', 50)
) AS seed(name, sort_order)
LEFT JOIN public.spend_categories existing
  ON existing.level = 1
 AND existing.parent_id IS NULL
 AND existing.name = seed.name
WHERE existing.id IS NULL;

INSERT INTO public.spend_categories (name, level, parent_id, sort_order)
SELECT seed.child_name, 2, parent.id, seed.sort_order
FROM (
  VALUES
    ('Logistics', 'Freight', 10),
    ('Manufacturing', 'Components', 10),
    ('Technology', 'Software', 10),
    ('Energy', 'Utilities', 10),
    ('Healthcare', 'Medical Supplies', 10)
) AS seed(root_name, child_name, sort_order)
JOIN public.spend_categories parent
  ON parent.level = 1
 AND parent.name = seed.root_name
LEFT JOIN public.spend_categories existing
  ON existing.parent_id = parent.id
 AND existing.name = seed.child_name
WHERE existing.id IS NULL;

INSERT INTO public.spend_categories (name, level, parent_id, sort_order)
SELECT seed.child_name, 3, parent.id, seed.sort_order
FROM (
  VALUES
    ('Logistics', 'Freight', 'Air Freight', 10),
    ('Manufacturing', 'Components', 'Metals', 10),
    ('Technology', 'Software', 'Cloud Services', 10),
    ('Energy', 'Utilities', 'Power Supply', 10),
    ('Healthcare', 'Medical Supplies', 'Sterile Goods', 10)
) AS seed(root_name, level2_name, child_name, sort_order)
JOIN public.spend_categories root
  ON root.level = 1
 AND root.name = seed.root_name
JOIN public.spend_categories parent
  ON parent.level = 2
 AND parent.parent_id = root.id
 AND parent.name = seed.level2_name
LEFT JOIN public.spend_categories existing
  ON existing.parent_id = parent.id
 AND existing.name = seed.child_name
WHERE existing.id IS NULL;

INSERT INTO public.spend_categories (name, level, parent_id, sort_order)
SELECT seed.child_name, 4, parent.id, seed.sort_order
FROM (
  VALUES
    ('Logistics', 'Freight', 'Air Freight', 'Express Air', 10),
    ('Manufacturing', 'Components', 'Metals', 'Cast Parts', 10),
    ('Technology', 'Software', 'Cloud Services', 'SaaS Platforms', 10),
    ('Energy', 'Utilities', 'Power Supply', 'Renewable Power', 10),
    ('Healthcare', 'Medical Supplies', 'Sterile Goods', 'Disposables', 10)
) AS seed(root_name, level2_name, level3_name, child_name, sort_order)
JOIN public.spend_categories root
  ON root.level = 1
 AND root.name = seed.root_name
JOIN public.spend_categories level2
  ON level2.level = 2
 AND level2.parent_id = root.id
 AND level2.name = seed.level2_name
JOIN public.spend_categories parent
  ON parent.level = 3
 AND parent.parent_id = level2.id
 AND parent.name = seed.level3_name
LEFT JOIN public.spend_categories existing
  ON existing.parent_id = parent.id
 AND existing.name = seed.child_name
WHERE existing.id IS NULL;

-- ------------------------------------------------------------
-- Business groups
-- ------------------------------------------------------------

INSERT INTO public.spend_business_groups (name, code)
SELECT seed.name, seed.code
FROM (
  VALUES
    ('Value 1', 'VAL1'),
    ('Value 2', 'VAL2'),
    ('Value 3', 'VAL3')
) AS seed(name, code)
LEFT JOIN public.spend_business_groups existing
  ON existing.name = seed.name
WHERE existing.id IS NULL;

-- ------------------------------------------------------------
-- Supplier geo staging
-- ------------------------------------------------------------

DROP TABLE IF EXISTS tmp_spend_supplier_geo;
CREATE TEMP TABLE tmp_spend_supplier_geo AS
SELECT
  s.id AS supplier_id,
  s.name AS supplier_name,
  COALESCE(NULLIF(TRIM(s.industry), ''), 'Manufacturing') AS industry_name,
  COALESCE(NULLIF(TRIM(s.country), ''), 'Unknown Country') AS country_name,
  COALESCE(NULLIF(TRIM(s.city), ''), 'Unknown City') AS city_name,
  COALESCE(NULLIF(TRIM(s.supplier_code), ''), SUBSTRING(REPLACE(s.id::text, '-', '') FROM 1 FOR 8)) || ' Plant' AS plant_name
FROM public.srm_suppliers s;

ALTER TABLE tmp_spend_supplier_geo ADD COLUMN continent_name text;
ALTER TABLE tmp_spend_supplier_geo ADD COLUMN root_category_name text;

UPDATE tmp_spend_supplier_geo
SET continent_name = 'Global'
WHERE continent_name IS NULL;

UPDATE tmp_spend_supplier_geo
SET continent_name = 'Europe'
WHERE country_name IN (
  'Turkey', 'Turkiye', 'Germany', 'France', 'Italy', 'Spain', 'United Kingdom', 'UK',
  'Netherlands', 'Belgium', 'Sweden', 'Poland', 'Romania', 'Czech Republic', 'Austria',
  'Switzerland', 'Portugal', 'Greece', 'Hungary', 'Slovakia', 'Ireland', 'Denmark',
  'Finland', 'Norway', 'Ukraine'
);

UPDATE tmp_spend_supplier_geo
SET continent_name = 'North America'
WHERE country_name IN ('United States', 'USA', 'Canada', 'Mexico');

UPDATE tmp_spend_supplier_geo
SET continent_name = 'Asia Pacific'
WHERE country_name IN (
  'China', 'Japan', 'India', 'South Korea', 'Singapore', 'Malaysia',
  'Thailand', 'Vietnam', 'Indonesia', 'Taiwan', 'Philippines'
);

UPDATE tmp_spend_supplier_geo
SET continent_name = 'South America'
WHERE country_name IN ('Brazil', 'Argentina', 'Chile', 'Colombia', 'Peru');

UPDATE tmp_spend_supplier_geo
SET continent_name = 'Africa'
WHERE country_name IN ('South Africa', 'Egypt', 'Morocco', 'Kenya', 'Nigeria');

UPDATE tmp_spend_supplier_geo
SET continent_name = 'Middle East'
WHERE country_name IN ('United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Israel');

UPDATE tmp_spend_supplier_geo
SET root_category_name = 'Manufacturing'
WHERE root_category_name IS NULL;

UPDATE tmp_spend_supplier_geo
SET root_category_name = 'Logistics'
WHERE LOWER(industry_name) LIKE '%logistic%'
   OR LOWER(supplier_name) LIKE '%logistic%';

UPDATE tmp_spend_supplier_geo
SET root_category_name = 'Technology'
WHERE LOWER(industry_name) LIKE '%tech%'
   OR LOWER(industry_name) LIKE '%software%';

UPDATE tmp_spend_supplier_geo
SET root_category_name = 'Energy'
WHERE LOWER(industry_name) LIKE '%energy%'
   OR LOWER(supplier_name) LIKE '%energy%';

UPDATE tmp_spend_supplier_geo
SET root_category_name = 'Healthcare'
WHERE LOWER(industry_name) LIKE '%health%'
   OR LOWER(supplier_name) LIKE '%med%';

-- ------------------------------------------------------------
-- Region hierarchy
-- ------------------------------------------------------------

INSERT INTO public.spend_regions (name, level, parent_id, sort_order)
SELECT DISTINCT geo.continent_name, 1, NULL, 10
FROM tmp_spend_supplier_geo geo
LEFT JOIN public.spend_regions existing
  ON existing.level = 1
 AND existing.parent_id IS NULL
 AND existing.name = geo.continent_name
WHERE existing.id IS NULL;

INSERT INTO public.spend_regions (name, level, parent_id, sort_order)
SELECT DISTINCT geo.country_name, 2, continent.id, 10
FROM tmp_spend_supplier_geo geo
JOIN public.spend_regions continent
  ON continent.level = 1
 AND continent.name = geo.continent_name
LEFT JOIN public.spend_regions existing
  ON existing.level = 2
 AND existing.parent_id = continent.id
 AND existing.name = geo.country_name
WHERE existing.id IS NULL;

INSERT INTO public.spend_regions (name, level, parent_id, sort_order)
SELECT DISTINCT geo.city_name, 3, country_region.id, 10
FROM tmp_spend_supplier_geo geo
JOIN public.spend_regions country_region
  ON country_region.level = 2
 AND country_region.name = geo.country_name
LEFT JOIN public.spend_regions existing
  ON existing.level = 3
 AND existing.parent_id = country_region.id
 AND existing.name = geo.city_name
WHERE existing.id IS NULL;

INSERT INTO public.spend_regions (name, level, parent_id, sort_order)
SELECT DISTINCT geo.plant_name, 4, city_region.id, 10
FROM tmp_spend_supplier_geo geo
JOIN public.spend_regions country_region
  ON country_region.level = 2
 AND country_region.name = geo.country_name
JOIN public.spend_regions city_region
  ON city_region.level = 3
 AND city_region.parent_id = country_region.id
 AND city_region.name = geo.city_name
LEFT JOIN public.spend_regions existing
  ON existing.level = 4
 AND existing.parent_id = city_region.id
 AND existing.name = geo.plant_name
WHERE existing.id IS NULL;

-- ------------------------------------------------------------
-- Spend records
-- ------------------------------------------------------------

DROP TABLE IF EXISTS tmp_spend_seed_rows;
CREATE TEMP TABLE tmp_spend_seed_rows AS
SELECT
  geo.supplier_id,
  leaf.id AS category_id,
  plant.id AS region_id,
  months.month_index,
  months.spend_date,
  ((get_byte(decode(md5(geo.supplier_id::text || ':' || months.month_index::text), 'hex'), 0) * 420)
    + (get_byte(decode(md5(geo.supplier_id::text || ':' || months.month_index::text), 'hex'), 1) * 17)
    + 15000
    + (months.month_index * 1250))::numeric(14,2) AS amount,
  ((get_byte(decode(md5(geo.supplier_id::text || ':bg:' || months.month_index::text), 'hex'), 2) % 3) + 1) AS bg_rank,
  'seed:spend:' || geo.supplier_id::text || ':' || months.month_index::text AS source_reference
FROM tmp_spend_supplier_geo geo
JOIN public.spend_categories root
  ON root.level = 1
 AND root.name = geo.root_category_name
JOIN public.spend_categories level2
  ON level2.level = 2
 AND level2.parent_id = root.id
JOIN public.spend_categories level3
  ON level3.level = 3
 AND level3.parent_id = level2.id
JOIN public.spend_categories leaf
  ON leaf.level = 4
 AND leaf.parent_id = level3.id
JOIN public.spend_regions country_region
  ON country_region.level = 2
 AND country_region.name = geo.country_name
JOIN public.spend_regions city_region
  ON city_region.level = 3
 AND city_region.parent_id = country_region.id
 AND city_region.name = geo.city_name
JOIN public.spend_regions plant
  ON plant.level = 4
 AND plant.parent_id = city_region.id
 AND plant.name = geo.plant_name
JOIN (
  SELECT 0 AS month_index, date_trunc('month', CURRENT_DATE)::date AS spend_date
  UNION ALL
  SELECT 1 AS month_index, (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date AS spend_date
  UNION ALL
  SELECT 2 AS month_index, (date_trunc('month', CURRENT_DATE) - INTERVAL '2 month')::date AS spend_date
) AS months
  ON TRUE;

INSERT INTO public.spend_records (
  supplier_id,
  category_id,
  region_id,
  business_group_id,
  amount,
  currency,
  spend_date,
  description,
  source_reference
)
SELECT
  seed.supplier_id,
  seed.category_id,
  seed.region_id,
  bg.id,
  seed.amount,
  'USD',
  seed.spend_date,
  'Seeded spend generated from supplier master data',
  seed.source_reference
FROM tmp_spend_seed_rows seed
JOIN (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name) AS rn
  FROM public.spend_business_groups
  WHERE name IN ('Value 1', 'Value 2', 'Value 3')
) bg
  ON bg.rn = seed.bg_rank
LEFT JOIN public.spend_records existing
  ON existing.source_reference = seed.source_reference
WHERE existing.id IS NULL;

DROP TABLE IF EXISTS tmp_spend_seed_rows;
DROP TABLE IF EXISTS tmp_spend_supplier_geo;
