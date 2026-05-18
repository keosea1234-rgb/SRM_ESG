CREATE TABLE IF NOT EXISTS public.spend_categories (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    level smallint NOT NULL CHECK (level BETWEEN 1 AND 4),
    parent_id uuid REFERENCES public.spend_categories(id) ON DELETE CASCADE,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE (parent_id, name)
);

CREATE TABLE IF NOT EXISTS public.spend_regions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    level smallint NOT NULL CHECK (level BETWEEN 1 AND 4),
    parent_id uuid REFERENCES public.spend_regions(id) ON DELETE CASCADE,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE (parent_id, name)
);

CREATE TABLE IF NOT EXISTS public.spend_business_groups (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL UNIQUE,
    code text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.spend_records (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    supplier_id uuid NOT NULL REFERENCES public.srm_suppliers(id) ON DELETE CASCADE,
    category_id uuid NOT NULL REFERENCES public.spend_categories(id) ON DELETE RESTRICT,
    region_id uuid NOT NULL REFERENCES public.spend_regions(id) ON DELETE RESTRICT,
    business_group_id uuid NOT NULL REFERENCES public.spend_business_groups(id) ON DELETE RESTRICT,
    amount numeric(14,2) NOT NULL CHECK (amount >= 0),
    currency text DEFAULT 'USD' NOT NULL,
    spend_date date NOT NULL,
    description text,
    source_reference text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_spend_categories_parent ON public.spend_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_spend_regions_parent ON public.spend_regions(parent_id);
CREATE INDEX IF NOT EXISTS idx_spend_records_supplier ON public.spend_records(supplier_id);
CREATE INDEX IF NOT EXISTS idx_spend_records_category ON public.spend_records(category_id);
CREATE INDEX IF NOT EXISTS idx_spend_records_region ON public.spend_records(region_id);
CREATE INDEX IF NOT EXISTS idx_spend_records_business_group ON public.spend_records(business_group_id);
CREATE INDEX IF NOT EXISTS idx_spend_records_spend_date ON public.spend_records(spend_date DESC);

CREATE OR REPLACE TRIGGER trg_spend_categories_updated_at
BEFORE UPDATE ON public.spend_categories
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_spend_regions_updated_at
BEFORE UPDATE ON public.spend_regions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_spend_business_groups_updated_at
BEFORE UPDATE ON public.spend_business_groups
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.spend_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spend_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spend_business_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spend_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read spend_categories"
ON public.spend_categories
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated read spend_regions"
ON public.spend_regions
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated read spend_business_groups"
ON public.spend_business_groups
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated read spend_records"
ON public.spend_records
FOR SELECT TO authenticated
USING (true);

GRANT ALL ON TABLE public.spend_categories TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.spend_regions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.spend_business_groups TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.spend_records TO anon, authenticated, service_role;
