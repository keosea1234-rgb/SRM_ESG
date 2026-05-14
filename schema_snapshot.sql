


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."app_role" AS ENUM (
    'admin',
    'procurement_manager',
    'esg_analyst',
    'viewer',
    'supplier'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


COMMENT ON TYPE "public"."app_role" IS 'SRM user roles — admin: full access, procurement_manager: suppliers/contracts/risk,
   esg_analyst: ESG read+write, viewer: read-only, supplier: portal only';



CREATE TYPE "public"."onboarding_status" AS ENUM (
    'not_invited',
    'invited',
    'registered',
    'profile_filling',
    'submitted',
    'approved',
    'rejected'
);


ALTER TYPE "public"."onboarding_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_set_role"("target_email" "text", "new_role" "public"."app_role") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Admin-only guard
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Only admins can change roles';
  END IF;

  SELECT id INTO v_user_id
  FROM public.profiles
  WHERE email = target_email;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found: %', target_email;
  END IF;

  -- Update profiles table
  UPDATE public.profiles
  SET role = new_role
  WHERE id = v_user_id;

  -- Sync role into JWT app_metadata so requireRole can read it from token
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', new_role::text)
  WHERE id = v_user_id;
END;
$$;


ALTER FUNCTION "public"."admin_set_role"("target_email" "text", "new_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_set_role"("target_id" "uuid", "new_role" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Admin-only guard
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Only admins can change roles';
  END IF;

  -- Update profiles table
  UPDATE public.profiles
  SET role = new_role::public.app_role
  WHERE id = target_id;

  -- Sync role into JWT app_metadata so requireRole can read it from token
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', new_role)
  WHERE id = target_id;
END;
$$;


ALTER FUNCTION "public"."admin_set_role"("target_id" "uuid", "new_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_supplier_code"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.supplier_code IS NULL THEN
    NEW.supplier_code := 'SUP-' || nextval('supplier_code_seq');
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."assign_supplier_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_weighted_score"("p_evaluation_id" "uuid") RETURNS numeric
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    result NUMERIC;
BEGIN
    SELECT
        CASE 
            WHEN SUM(pc.weight * pc.max_score) = 0 THEN 0
            ELSE ROUND(
                (SUM(ps.score * pc.weight) / SUM(pc.weight * pc.max_score)) * 100,
                2
            )
        END INTO result
    FROM public.performance_scores ps
    JOIN public.performance_categories pc ON pc.id = ps.category_id
    WHERE ps.evaluation_id = p_evaluation_id
      AND pc.is_active = true;

    -- Update the evaluation record
    UPDATE public.performance_evaluations
    SET overall_score = result
    WHERE id = p_evaluation_id;

    RETURN COALESCE(result, 0);
END;
$$;


ALTER FUNCTION "public"."calculate_weighted_score"("p_evaluation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_role"() RETURNS "public"."app_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT role::public.app_role FROM public.profiles WHERE id = auth.uid();
$$;


ALTER FUNCTION "public"."current_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_esg_portfolio_summary"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT jsonb_build_object(
    'avg_esg',    ROUND(AVG(overall_esg_score)),
    'avg_env',    ROUND(AVG(env_score)),
    'avg_social', ROUND(AVG(social_score)),
    'avg_gov',    ROUND(AVG(gov_score)),
    'total',      COUNT(*),
    'avg_renewable_energy_pct',   ROUND(AVG(renewable_energy_pct)::numeric, 1),
    'avg_waste_recycling_pct',    ROUND(AVG(waste_recycling_pct)::numeric, 1),
    'avg_carbon_footprint_tons',  ROUND(AVG(carbon_footprint_tons)::numeric, 1),
    'avg_water_usage_m3',         ROUND(AVG(water_usage_m3)::numeric, 1),
    'avg_women_in_mgmt_pct',      ROUND(AVG(women_in_mgmt_pct)::numeric, 1),
    'avg_lost_time_injury_rate',  ROUND(AVG(lost_time_injury_rate)::numeric, 2),
    'living_wage_pct',
      ROUND(100.0 * COUNT(*) FILTER (WHERE living_wage_compliant = true)
            / NULLIF(COUNT(*) FILTER (WHERE living_wage_compliant IS NOT NULL), 0)),
    'child_labor_policy_pct',
      ROUND(100.0 * COUNT(*) FILTER (WHERE child_labor_policy = true)
            / NULLIF(COUNT(*) FILTER (WHERE child_labor_policy IS NOT NULL), 0)),
    'anti_corruption_pct',
      ROUND(100.0 * COUNT(*) FILTER (WHERE anti_corruption_policy = true)
            / NULLIF(COUNT(*) FILTER (WHERE anti_corruption_policy IS NOT NULL), 0)),
    'independent_audit_pct',
      ROUND(100.0 * COUNT(*) FILTER (WHERE independent_audit = true)
            / NULLIF(COUNT(*) FILTER (WHERE independent_audit IS NOT NULL), 0)),
    'gdpr_compliant_pct',
      ROUND(100.0 * COUNT(*) FILTER (WHERE gdpr_compliant = true)
            / NULLIF(COUNT(*) FILTER (WHERE gdpr_compliant IS NOT NULL), 0)),
    'avg_data_breach_incidents',  ROUND(AVG(data_breach_incidents)::numeric, 1)
  )
  FROM srm_esg_assessments
  WHERE status = 'approved';
$$;


ALTER FUNCTION "public"."get_esg_portfolio_summary"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  user_count INTEGER;
  assigned_role public.app_role;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.profiles;
  -- First user in the system becomes admin
  IF user_count = 0 THEN
    assigned_role := 'admin';
  ELSE
    assigned_role := 'viewer';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    assigned_role
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_dashboard_views"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_supplier_dashboard_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_supplier_score_trend;
END;
$$;


ALTER FUNCTION "public"."refresh_dashboard_views"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activity_logs" (
    "id" "text" NOT NULL,
    "user" "text",
    "action" "text",
    "contract" "text",
    "date" "date",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."activity_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contracts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "status" "text",
    "contract_type" "text",
    "category" "text",
    "owner" "text",
    "contract_size" numeric,
    "business_group" "text",
    "supplier_name" "text",
    "supplier_contact" "text",
    "start_date" "date",
    "expiration_date" "date" NOT NULL,
    "end_date" "date",
    "liability" "text",
    "insurance" "text",
    "payment_term" "text",
    "termination_for_convenience" boolean DEFAULT false,
    "renewal_reminder" integer DEFAULT 30,
    "version" integer DEFAULT 1,
    "last_modified" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "supplier_id" "uuid"
);


ALTER TABLE "public"."contracts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."srm_performance_evaluations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "evaluation_period" character varying(20) NOT NULL,
    "quality_score" numeric(3,1) NOT NULL,
    "delivery_score" numeric(3,1) NOT NULL,
    "price_score" numeric(3,1) NOT NULL,
    "communication_score" numeric(3,1) NOT NULL,
    "quality_weight" numeric(3,2) DEFAULT 0.30 NOT NULL,
    "delivery_weight" numeric(3,2) DEFAULT 0.25 NOT NULL,
    "price_weight" numeric(3,2) DEFAULT 0.25 NOT NULL,
    "communication_weight" numeric(3,2) DEFAULT 0.20 NOT NULL,
    "overall_score" numeric(4,2) GENERATED ALWAYS AS ((((("quality_score" * "quality_weight") + ("delivery_score" * "delivery_weight")) + ("price_score" * "price_weight")) + ("communication_score" * "communication_weight"))) STORED,
    "notes" "text",
    "evaluated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "srm_performance_evaluations_communication_score_check" CHECK ((("communication_score" >= (0)::numeric) AND ("communication_score" <= (10)::numeric))),
    CONSTRAINT "srm_performance_evaluations_delivery_score_check" CHECK ((("delivery_score" >= (0)::numeric) AND ("delivery_score" <= (10)::numeric))),
    CONSTRAINT "srm_performance_evaluations_price_score_check" CHECK ((("price_score" >= (0)::numeric) AND ("price_score" <= (10)::numeric))),
    CONSTRAINT "srm_performance_evaluations_quality_score_check" CHECK ((("quality_score" >= (0)::numeric) AND ("quality_score" <= (10)::numeric)))
);


ALTER TABLE "public"."srm_performance_evaluations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."srm_risk_assessments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "assessment_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "financial_risk" smallint NOT NULL,
    "operational_risk" smallint NOT NULL,
    "compliance_risk" smallint NOT NULL,
    "geopolitical_risk" smallint NOT NULL,
    "reputational_risk" smallint NOT NULL,
    "overall_risk_level" character varying(10) GENERATED ALWAYS AS (
CASE
    WHEN ((((((("financial_risk" + "operational_risk") + "compliance_risk") + "geopolitical_risk") + "reputational_risk"))::numeric / (5)::numeric) >= (4)::numeric) THEN 'critical'::"text"
    WHEN ((((((("financial_risk" + "operational_risk") + "compliance_risk") + "geopolitical_risk") + "reputational_risk"))::numeric / (5)::numeric) >= (3)::numeric) THEN 'high'::"text"
    WHEN ((((((("financial_risk" + "operational_risk") + "compliance_risk") + "geopolitical_risk") + "reputational_risk"))::numeric / (5)::numeric) >= (2)::numeric) THEN 'medium'::"text"
    ELSE 'low'::"text"
END) STORED,
    "mitigation_notes" "text",
    "assessed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "notes" "text",
    CONSTRAINT "srm_risk_assessments_compliance_risk_check" CHECK ((("compliance_risk" >= 1) AND ("compliance_risk" <= 5))),
    CONSTRAINT "srm_risk_assessments_financial_risk_check" CHECK ((("financial_risk" >= 1) AND ("financial_risk" <= 5))),
    CONSTRAINT "srm_risk_assessments_geopolitical_risk_check" CHECK ((("geopolitical_risk" >= 1) AND ("geopolitical_risk" <= 5))),
    CONSTRAINT "srm_risk_assessments_operational_risk_check" CHECK ((("operational_risk" >= 1) AND ("operational_risk" <= 5))),
    CONSTRAINT "srm_risk_assessments_reputational_risk_check" CHECK ((("reputational_risk" >= 1) AND ("reputational_risk" <= 5)))
);


ALTER TABLE "public"."srm_risk_assessments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."srm_suppliers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "tax_id" "text",
    "email" "text",
    "phone" "text",
    "website" "text",
    "address" "text",
    "city" "text",
    "country" "text" DEFAULT 'TR'::"text",
    "industry" "text",
    "company_size" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "logo_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "invited_email" "text",
    "invite_status" "text" DEFAULT 'not_invited'::"text",
    "supplier_code" "text",
    "onboarding_status" "public"."onboarding_status" DEFAULT 'not_invited'::"public"."onboarding_status" NOT NULL,
    "parent_id" "uuid",
    CONSTRAINT "suppliers_company_size_check" CHECK (("company_size" = ANY (ARRAY['micro'::"text", 'small'::"text", 'medium'::"text", 'large'::"text", 'enterprise'::"text"]))),
    CONSTRAINT "suppliers_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'blacklisted'::"text", 'pending'::"text"])))
);


ALTER TABLE "public"."srm_suppliers" OWNER TO "postgres";


COMMENT ON TABLE "public"."srm_suppliers" IS 'Shared supplier directory — used by both SRM and ContractGuard';



CREATE MATERIALIZED VIEW "public"."mv_supplier_dashboard_summary" AS
 SELECT "s"."id" AS "supplier_id",
    "s"."name" AS "supplier_name",
    "s"."onboarding_status",
    "pe"."overall_score" AS "latest_score",
    "pe"."evaluation_period" AS "latest_eval_period",
    "ra"."overall_risk_level" AS "current_risk_level",
    "ra"."assessment_date" AS "latest_risk_date",
    ("count"(DISTINCT "c"."id"))::integer AS "contract_count"
   FROM ((("public"."srm_suppliers" "s"
     LEFT JOIN LATERAL ( SELECT "srm_performance_evaluations"."overall_score",
            "srm_performance_evaluations"."evaluation_period"
           FROM "public"."srm_performance_evaluations"
          WHERE ("srm_performance_evaluations"."supplier_id" = "s"."id")
          ORDER BY "srm_performance_evaluations"."evaluation_period" DESC
         LIMIT 1) "pe" ON (true))
     LEFT JOIN LATERAL ( SELECT "srm_risk_assessments"."overall_risk_level",
            "srm_risk_assessments"."assessment_date"
           FROM "public"."srm_risk_assessments"
          WHERE ("srm_risk_assessments"."supplier_id" = "s"."id")
          ORDER BY "srm_risk_assessments"."assessment_date" DESC
         LIMIT 1) "ra" ON (true))
     LEFT JOIN "public"."contracts" "c" ON (("c"."supplier_id" = "s"."id")))
  GROUP BY "s"."id", "s"."name", "s"."onboarding_status", "pe"."overall_score", "pe"."evaluation_period", "ra"."overall_risk_level", "ra"."assessment_date"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."mv_supplier_dashboard_summary" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."mv_supplier_score_trend" AS
 SELECT "curr"."supplier_id",
    "s"."name" AS "supplier_name",
    "curr"."overall_score" AS "latest_score",
    "prev"."overall_score" AS "previous_score",
    ("curr"."overall_score" - "prev"."overall_score") AS "score_delta",
    "curr"."evaluation_period" AS "latest_period",
    "prev"."evaluation_period" AS "previous_period"
   FROM ((( SELECT DISTINCT ON ("srm_performance_evaluations"."supplier_id") "srm_performance_evaluations"."supplier_id",
            "srm_performance_evaluations"."overall_score",
            "srm_performance_evaluations"."evaluation_period"
           FROM "public"."srm_performance_evaluations"
          ORDER BY "srm_performance_evaluations"."supplier_id", "srm_performance_evaluations"."evaluation_period" DESC) "curr"
     JOIN ( SELECT DISTINCT ON ("srm_performance_evaluations"."supplier_id") "srm_performance_evaluations"."supplier_id",
            "srm_performance_evaluations"."overall_score",
            "srm_performance_evaluations"."evaluation_period"
           FROM "public"."srm_performance_evaluations"
          ORDER BY "srm_performance_evaluations"."supplier_id", "srm_performance_evaluations"."evaluation_period" DESC
         OFFSET 0) "prev" ON ((("prev"."supplier_id" = "curr"."supplier_id") AND (("prev"."evaluation_period")::"text" < ("curr"."evaluation_period")::"text"))))
     JOIN "public"."srm_suppliers" "s" ON (("s"."id" = "curr"."supplier_id")))
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."mv_supplier_score_trend" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "role" "text" DEFAULT 'viewer'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "supplier_id" "uuid",
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'editor'::"text", 'viewer'::"text", 'supplier'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."profiles" IS 'SRM user profiles — one row per auth.users entry, holds role and display info';



CREATE TABLE IF NOT EXISTS "public"."srm_activity_log" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "supplier_id" "uuid",
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid",
    "action" "text" NOT NULL,
    "description" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "performed_by" "uuid",
    "performed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "field_name" "text",
    "old_value" "text",
    "new_value" "text",
    CONSTRAINT "activity_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['supplier'::"text", 'contract'::"text", 'performance_evaluation'::"text", 'risk_assessment'::"text", 'document'::"text"]))),
    CONSTRAINT "srm_activity_log_action_check" CHECK (("action" = ANY (ARRAY['created'::"text", 'updated'::"text", 'deleted'::"text", 'status_changed'::"text", 'evaluated'::"text", 'risk_assessed'::"text"])))
);


ALTER TABLE "public"."srm_activity_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."srm_activity_log" IS 'Audit trail for all SRM actions';



CREATE TABLE IF NOT EXISTS "public"."srm_contract_links" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "contract_id" "uuid" NOT NULL,
    "contract_title" "text",
    "contract_status" "text",
    "link_type" "text" DEFAULT 'primary'::"text",
    "linked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "linked_by" "uuid",
    CONSTRAINT "srm_contract_links_link_type_check" CHECK (("link_type" = ANY (ARRAY['primary'::"text", 'amendment'::"text", 'renewal'::"text", 'related'::"text"])))
);


ALTER TABLE "public"."srm_contract_links" OWNER TO "postgres";


COMMENT ON TABLE "public"."srm_contract_links" IS 'Bridge table linking SRM suppliers to ContractGuard contracts';



CREATE TABLE IF NOT EXISTS "public"."srm_daily_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "snapshot_date" "date" NOT NULL,
    "total_suppliers" integer DEFAULT 0 NOT NULL,
    "active_suppliers" integer DEFAULT 0 NOT NULL,
    "avg_performance_score" numeric(5,2),
    "high_risk_count" integer DEFAULT 0 NOT NULL,
    "expiring_docs_count" integer DEFAULT 0 NOT NULL,
    "active_contracts" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."srm_daily_snapshots" OWNER TO "postgres";


COMMENT ON TABLE "public"."srm_daily_snapshots" IS 'Daily snapshot of key SRM metrics for trend analysis and sparklines';



CREATE TABLE IF NOT EXISTS "public"."srm_esg_assessments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "assessed_by" "uuid",
    "assessment_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "period" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "carbon_footprint_tons" numeric(10,2),
    "renewable_energy_pct" numeric(5,2),
    "waste_recycling_pct" numeric(5,2),
    "water_usage_m3" numeric(10,2),
    "env_certifications" "text"[] DEFAULT '{}'::"text"[],
    "env_score" numeric(5,2),
    "employee_count" integer,
    "women_in_mgmt_pct" numeric(5,2),
    "lost_time_injury_rate" numeric(6,3),
    "living_wage_compliant" boolean DEFAULT false,
    "child_labor_policy" boolean DEFAULT false,
    "social_certifications" "text"[] DEFAULT '{}'::"text"[],
    "social_score" numeric(5,2),
    "anti_corruption_policy" boolean DEFAULT false,
    "independent_audit" boolean DEFAULT false,
    "gdpr_compliant" boolean DEFAULT false,
    "data_breach_incidents" integer DEFAULT 0,
    "gov_certifications" "text"[] DEFAULT '{}'::"text"[],
    "gov_score" numeric(5,2),
    "overall_esg_score" numeric(5,2),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "srm_esg_assessments_env_score_check" CHECK ((("env_score" >= (0)::numeric) AND ("env_score" <= (100)::numeric))),
    CONSTRAINT "srm_esg_assessments_gov_score_check" CHECK ((("gov_score" >= (0)::numeric) AND ("gov_score" <= (100)::numeric))),
    CONSTRAINT "srm_esg_assessments_overall_esg_score_check" CHECK ((("overall_esg_score" >= (0)::numeric) AND ("overall_esg_score" <= (100)::numeric))),
    CONSTRAINT "srm_esg_assessments_renewable_energy_pct_check" CHECK ((("renewable_energy_pct" >= (0)::numeric) AND ("renewable_energy_pct" <= (100)::numeric))),
    CONSTRAINT "srm_esg_assessments_social_score_check" CHECK ((("social_score" >= (0)::numeric) AND ("social_score" <= (100)::numeric))),
    CONSTRAINT "srm_esg_assessments_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'approved'::"text"]))),
    CONSTRAINT "srm_esg_assessments_waste_recycling_pct_check" CHECK ((("waste_recycling_pct" >= (0)::numeric) AND ("waste_recycling_pct" <= (100)::numeric))),
    CONSTRAINT "srm_esg_assessments_women_in_mgmt_pct_check" CHECK ((("women_in_mgmt_pct" >= (0)::numeric) AND ("women_in_mgmt_pct" <= (100)::numeric)))
);


ALTER TABLE "public"."srm_esg_assessments" OWNER TO "postgres";


COMMENT ON TABLE "public"."srm_esg_assessments" IS 'ESG assessments per supplier per period — scores computed by backend scoring engine';



CREATE TABLE IF NOT EXISTS "public"."srm_esg_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "assessment_id" "uuid",
    "document_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "file_url" "text",
    "valid_until" "date",
    "verified" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."srm_esg_documents" OWNER TO "postgres";


COMMENT ON TABLE "public"."srm_esg_documents" IS 'Supporting documents for ESG assessments (certs, reports, policies).';



CREATE TABLE IF NOT EXISTS "public"."srm_supplier_contacts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "title" "text",
    "email" "text",
    "phone" "text",
    "is_primary" boolean DEFAULT false,
    "department" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."srm_supplier_contacts" OWNER TO "postgres";


COMMENT ON TABLE "public"."srm_supplier_contacts" IS 'Contact persons for each supplier';



CREATE TABLE IF NOT EXISTS "public"."srm_supplier_documents" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "document_name" "text" NOT NULL,
    "document_type" "text",
    "file_url" "text",
    "file_size" integer,
    "expiry_date" "date",
    "is_verified" boolean DEFAULT false,
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "file_path" "text",
    CONSTRAINT "srm_supplier_documents_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "supplier_documents_document_type_check" CHECK (("document_type" = ANY (ARRAY['certificate'::"text", 'license'::"text", 'insurance'::"text", 'financial'::"text", 'audit'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."srm_supplier_documents" OWNER TO "postgres";


COMMENT ON TABLE "public"."srm_supplier_documents" IS 'Compliance documents, certificates, and attachments';



CREATE TABLE IF NOT EXISTS "public"."srm_supplier_financial_data" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "credit_score" integer,
    "risk_rating" "text",
    "annual_revenue" numeric,
    "data_source" "text",
    "fetched_at" timestamp with time zone,
    "raw_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."srm_supplier_financial_data" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."srm_supplier_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "legal_name" "text",
    "registration_number" "text",
    "country" "text",
    "address" "text",
    "industry" "text",
    "employee_count" integer,
    "revenue_range" "text",
    "website" "text",
    "submitted_at" timestamp with time zone,
    "approved_at" timestamp with time zone,
    "approved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."srm_supplier_profiles" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."supplier_code_seq"
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."supplier_code_seq" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_supplier_summary" AS
 SELECT "s"."id",
    "s"."name",
    "s"."country",
    "s"."industry",
    "s"."status",
    "s"."supplier_code",
    "s"."onboarding_status",
    "s"."invite_status",
    "s"."invited_email",
    "s"."created_at",
    COALESCE("c"."contract_count", (0)::bigint) AS "contract_count",
    COALESCE("c"."total_value", (0)::numeric) AS "total_value",
    "s"."city",
    "pe"."latest_performance_score",
    "pe"."last_evaluated_at",
    "ra"."current_risk_level",
    "ra"."last_risk_assessed_at",
    "s"."parent_id",
    "p"."name" AS "parent_name"
   FROM (((("public"."srm_suppliers" "s"
     LEFT JOIN "public"."srm_suppliers" "p" ON (("p"."id" = "s"."parent_id")))
     LEFT JOIN ( SELECT "contracts"."supplier_id",
            "count"(*) AS "contract_count",
            "sum"("contracts"."contract_size") AS "total_value"
           FROM "public"."contracts"
          GROUP BY "contracts"."supplier_id") "c" ON (("c"."supplier_id" = "s"."id")))
     LEFT JOIN ( SELECT DISTINCT ON ("srm_performance_evaluations"."supplier_id") "srm_performance_evaluations"."supplier_id",
            "srm_performance_evaluations"."overall_score" AS "latest_performance_score",
            "srm_performance_evaluations"."created_at" AS "last_evaluated_at"
           FROM "public"."srm_performance_evaluations"
          ORDER BY "srm_performance_evaluations"."supplier_id", "srm_performance_evaluations"."evaluation_period" DESC) "pe" ON (("pe"."supplier_id" = "s"."id")))
     LEFT JOIN ( SELECT DISTINCT ON ("srm_risk_assessments"."supplier_id") "srm_risk_assessments"."supplier_id",
            "srm_risk_assessments"."overall_risk_level" AS "current_risk_level",
            "srm_risk_assessments"."assessment_date" AS "last_risk_assessed_at"
           FROM "public"."srm_risk_assessments"
          ORDER BY "srm_risk_assessments"."supplier_id", "srm_risk_assessments"."assessment_date" DESC) "ra" ON (("ra"."supplier_id" = "s"."id")));


ALTER VIEW "public"."v_supplier_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."versions" (
    "id" "text" NOT NULL,
    "contract_id" "uuid",
    "version" integer,
    "author" "text",
    "date" "date",
    "changes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."versions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contracts"
    ADD CONSTRAINT "contracts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."srm_activity_log"
    ADD CONSTRAINT "srm_activity_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."srm_contract_links"
    ADD CONSTRAINT "srm_contract_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."srm_contract_links"
    ADD CONSTRAINT "srm_contract_links_supplier_id_contract_id_key" UNIQUE ("supplier_id", "contract_id");



ALTER TABLE ONLY "public"."srm_daily_snapshots"
    ADD CONSTRAINT "srm_daily_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."srm_daily_snapshots"
    ADD CONSTRAINT "srm_daily_snapshots_snapshot_date_key" UNIQUE ("snapshot_date");



ALTER TABLE ONLY "public"."srm_esg_assessments"
    ADD CONSTRAINT "srm_esg_assessments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."srm_esg_assessments"
    ADD CONSTRAINT "srm_esg_assessments_supplier_id_period_key" UNIQUE ("supplier_id", "period");



ALTER TABLE ONLY "public"."srm_esg_documents"
    ADD CONSTRAINT "srm_esg_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."srm_performance_evaluations"
    ADD CONSTRAINT "srm_performance_evaluations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."srm_risk_assessments"
    ADD CONSTRAINT "srm_risk_assessments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."srm_supplier_financial_data"
    ADD CONSTRAINT "srm_supplier_financial_data_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."srm_supplier_profiles"
    ADD CONSTRAINT "srm_supplier_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."srm_supplier_contacts"
    ADD CONSTRAINT "supplier_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."srm_supplier_documents"
    ADD CONSTRAINT "supplier_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."srm_suppliers"
    ADD CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."srm_suppliers"
    ADD CONSTRAINT "suppliers_supplier_code_key" UNIQUE ("supplier_code");



ALTER TABLE ONLY "public"."srm_suppliers"
    ADD CONSTRAINT "suppliers_tax_id_key" UNIQUE ("tax_id");



ALTER TABLE ONLY "public"."srm_performance_evaluations"
    ADD CONSTRAINT "uq_supplier_period" UNIQUE ("supplier_id", "evaluation_period");



ALTER TABLE ONLY "public"."versions"
    ADD CONSTRAINT "versions_pkey" PRIMARY KEY ("id");



CREATE INDEX "activity_logs_date_idx" ON "public"."activity_logs" USING "btree" ("date" DESC);



CREATE INDEX "contracts_expiration_date_idx" ON "public"."contracts" USING "btree" ("expiration_date");



CREATE INDEX "contracts_status_idx" ON "public"."contracts" USING "btree" ("status");



CREATE INDEX "idx_activity_log_performed" ON "public"."srm_activity_log" USING "btree" ("performed_at" DESC);



CREATE INDEX "idx_activity_log_supplier" ON "public"."srm_activity_log" USING "btree" ("supplier_id");



CREATE INDEX "idx_contract_links_contract" ON "public"."srm_contract_links" USING "btree" ("contract_id");



CREATE INDEX "idx_contract_links_supplier" ON "public"."srm_contract_links" USING "btree" ("supplier_id");



CREATE INDEX "idx_contracts_created_at" ON "public"."contracts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_contracts_title" ON "public"."contracts" USING "gin" ("title" "public"."gin_trgm_ops");



CREATE INDEX "idx_daily_snapshots_date" ON "public"."srm_daily_snapshots" USING "btree" ("snapshot_date" DESC);



CREATE INDEX "idx_esg_assessments_period" ON "public"."srm_esg_assessments" USING "btree" ("period");



CREATE INDEX "idx_esg_assessments_supplier" ON "public"."srm_esg_assessments" USING "btree" ("supplier_id", "assessment_date" DESC);



CREATE INDEX "idx_esg_date" ON "public"."srm_esg_assessments" USING "btree" ("assessment_date" DESC);



CREATE INDEX "idx_esg_documents_expiry" ON "public"."srm_esg_documents" USING "btree" ("valid_until") WHERE ("valid_until" IS NOT NULL);



CREATE INDEX "idx_esg_documents_supplier" ON "public"."srm_esg_documents" USING "btree" ("supplier_id");



CREATE INDEX "idx_esg_overall_score" ON "public"."srm_esg_assessments" USING "btree" ("overall_esg_score" DESC);



CREATE INDEX "idx_esg_status" ON "public"."srm_esg_assessments" USING "btree" ("status");



CREATE INDEX "idx_esg_supplier" ON "public"."srm_esg_assessments" USING "btree" ("supplier_id");



CREATE UNIQUE INDEX "idx_mv_supplier_dashboard_summary_id" ON "public"."mv_supplier_dashboard_summary" USING "btree" ("supplier_id");



CREATE INDEX "idx_mv_supplier_dashboard_summary_risk" ON "public"."mv_supplier_dashboard_summary" USING "btree" ("current_risk_level");



CREATE INDEX "idx_mv_supplier_dashboard_summary_score" ON "public"."mv_supplier_dashboard_summary" USING "btree" ("latest_score" DESC NULLS LAST);



CREATE INDEX "idx_mv_supplier_score_trend_delta" ON "public"."mv_supplier_score_trend" USING "btree" ("score_delta");



CREATE UNIQUE INDEX "idx_mv_supplier_score_trend_id" ON "public"."mv_supplier_score_trend" USING "btree" ("supplier_id");



CREATE INDEX "idx_perf_eval_period" ON "public"."srm_performance_evaluations" USING "btree" ("evaluation_period");



CREATE INDEX "idx_perf_eval_supplier" ON "public"."srm_performance_evaluations" USING "btree" ("supplier_id");



CREATE INDEX "idx_risk_assess_date" ON "public"."srm_risk_assessments" USING "btree" ("assessment_date");



CREATE INDEX "idx_risk_assess_supplier" ON "public"."srm_risk_assessments" USING "btree" ("supplier_id");



CREATE INDEX "idx_risk_supplier" ON "public"."srm_risk_assessments" USING "btree" ("supplier_id");



CREATE INDEX "idx_srm_supplier_financial_data_supplier_id" ON "public"."srm_supplier_financial_data" USING "btree" ("supplier_id");



CREATE INDEX "idx_srm_supplier_profiles_supplier_id" ON "public"."srm_supplier_profiles" USING "btree" ("supplier_id");



CREATE INDEX "idx_supplier_contacts_supplier" ON "public"."srm_supplier_contacts" USING "btree" ("supplier_id");



CREATE INDEX "idx_supplier_docs_expiry" ON "public"."srm_supplier_documents" USING "btree" ("expiry_date");



CREATE INDEX "idx_supplier_docs_supplier" ON "public"."srm_supplier_documents" USING "btree" ("supplier_id");



CREATE INDEX "idx_suppliers_country" ON "public"."srm_suppliers" USING "btree" ("country");



CREATE INDEX "idx_suppliers_name" ON "public"."srm_suppliers" USING "gin" ("name" "public"."gin_trgm_ops");



CREATE INDEX "idx_suppliers_status" ON "public"."srm_suppliers" USING "btree" ("status");



CREATE INDEX "versions_contract_id_idx" ON "public"."versions" USING "btree" ("contract_id");



CREATE OR REPLACE TRIGGER "trg_esg_updated_at" BEFORE UPDATE ON "public"."srm_esg_assessments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_perf_eval_updated_at" BEFORE UPDATE ON "public"."srm_performance_evaluations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_risk_assess_updated_at" BEFORE UPDATE ON "public"."srm_risk_assessments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_risk_updated_at" BEFORE UPDATE ON "public"."srm_risk_assessments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_supplier_contacts_updated_at" BEFORE UPDATE ON "public"."srm_supplier_contacts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_supplier_documents_updated_at" BEFORE UPDATE ON "public"."srm_supplier_documents" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_suppliers_updated_at" BEFORE UPDATE ON "public"."srm_suppliers" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_assign_supplier_code" BEFORE INSERT ON "public"."srm_suppliers" FOR EACH ROW EXECUTE FUNCTION "public"."assign_supplier_code"();



ALTER TABLE ONLY "public"."contracts"
    ADD CONSTRAINT "contracts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."srm_suppliers"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."srm_suppliers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."srm_activity_log"
    ADD CONSTRAINT "srm_activity_log_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."srm_activity_log"
    ADD CONSTRAINT "srm_activity_log_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."srm_suppliers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."srm_contract_links"
    ADD CONSTRAINT "srm_contract_links_linked_by_fkey" FOREIGN KEY ("linked_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."srm_contract_links"
    ADD CONSTRAINT "srm_contract_links_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."srm_suppliers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."srm_esg_assessments"
    ADD CONSTRAINT "srm_esg_assessments_assessed_by_fkey" FOREIGN KEY ("assessed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."srm_esg_assessments"
    ADD CONSTRAINT "srm_esg_assessments_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."srm_suppliers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."srm_esg_documents"
    ADD CONSTRAINT "srm_esg_documents_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "public"."srm_esg_assessments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."srm_esg_documents"
    ADD CONSTRAINT "srm_esg_documents_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."srm_suppliers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."srm_performance_evaluations"
    ADD CONSTRAINT "srm_performance_evaluations_evaluated_by_fkey" FOREIGN KEY ("evaluated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."srm_performance_evaluations"
    ADD CONSTRAINT "srm_performance_evaluations_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."srm_suppliers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."srm_risk_assessments"
    ADD CONSTRAINT "srm_risk_assessments_assessed_by_fkey" FOREIGN KEY ("assessed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."srm_risk_assessments"
    ADD CONSTRAINT "srm_risk_assessments_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."srm_suppliers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."srm_supplier_documents"
    ADD CONSTRAINT "srm_supplier_documents_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."srm_supplier_financial_data"
    ADD CONSTRAINT "srm_supplier_financial_data_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."srm_suppliers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."srm_supplier_profiles"
    ADD CONSTRAINT "srm_supplier_profiles_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."srm_supplier_profiles"
    ADD CONSTRAINT "srm_supplier_profiles_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."srm_suppliers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."srm_suppliers"
    ADD CONSTRAINT "srm_suppliers_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."srm_suppliers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."srm_supplier_contacts"
    ADD CONSTRAINT "supplier_contacts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."srm_suppliers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."srm_supplier_documents"
    ADD CONSTRAINT "supplier_documents_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."srm_suppliers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."srm_supplier_documents"
    ADD CONSTRAINT "supplier_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."srm_suppliers"
    ADD CONSTRAINT "suppliers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."versions"
    ADD CONSTRAINT "versions_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE CASCADE;



CREATE POLICY "Authenticated insert srm_activity_log" ON "public"."srm_activity_log" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated insert srm_contract_links" ON "public"."srm_contract_links" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated insert srm_esg_assessments" ON "public"."srm_esg_assessments" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated insert srm_esg_documents" ON "public"."srm_esg_documents" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated insert supplier_contacts" ON "public"."srm_supplier_contacts" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated insert supplier_documents" ON "public"."srm_supplier_documents" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated insert suppliers" ON "public"."srm_suppliers" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated read srm_activity_log" ON "public"."srm_activity_log" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated read srm_contract_links" ON "public"."srm_contract_links" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated read supplier_contacts" ON "public"."srm_supplier_contacts" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated read supplier_documents" ON "public"."srm_supplier_documents" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated read suppliers" ON "public"."srm_suppliers" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated select srm_daily_snapshots" ON "public"."srm_daily_snapshots" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated select srm_esg_assessments" ON "public"."srm_esg_assessments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated select srm_esg_documents" ON "public"."srm_esg_documents" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated update srm_activity_log" ON "public"."srm_activity_log" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated update srm_contract_links" ON "public"."srm_contract_links" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated update srm_esg_assessments" ON "public"."srm_esg_assessments" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated update srm_esg_documents" ON "public"."srm_esg_documents" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated update supplier_contacts" ON "public"."srm_supplier_contacts" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated update supplier_documents" ON "public"."srm_supplier_documents" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated update suppliers" ON "public"."srm_suppliers" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access on performance_evaluations" ON "public"."srm_performance_evaluations" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role full access on risk_assessments" ON "public"."srm_risk_assessments" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."activity_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "allow all" ON "public"."activity_logs" USING (true) WITH CHECK (true);



CREATE POLICY "allow all" ON "public"."contracts" USING (true) WITH CHECK (true);



CREATE POLICY "allow all" ON "public"."versions" USING (true) WITH CHECK (true);



ALTER TABLE "public"."contracts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "esg: read approved" ON "public"."srm_esg_assessments" FOR SELECT TO "authenticated" USING ((("status" = 'approved'::"text") OR ("public"."current_user_role"() = ANY (ARRAY['admin'::"public"."app_role", 'procurement_manager'::"public"."app_role", 'esg_analyst'::"public"."app_role"]))));



CREATE POLICY "esg: update" ON "public"."srm_esg_assessments" FOR UPDATE TO "authenticated" USING (("public"."current_user_role"() = ANY (ARRAY['admin'::"public"."app_role", 'esg_analyst'::"public"."app_role"])));



CREATE POLICY "esg: write" ON "public"."srm_esg_assessments" FOR INSERT TO "authenticated" WITH CHECK (("public"."current_user_role"() = ANY (ARRAY['admin'::"public"."app_role", 'esg_analyst'::"public"."app_role"])));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles: admin select all" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("public"."current_user_role"() = 'admin'::"public"."app_role"));



CREATE POLICY "profiles: admin update all" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("public"."current_user_role"() = 'admin'::"public"."app_role"));



CREATE POLICY "profiles: own row select" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "profiles: own row update" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "profiles_insert" ON "public"."profiles" FOR INSERT WITH CHECK (true);



CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "service role full access" ON "public"."srm_supplier_financial_data" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service role full access" ON "public"."srm_supplier_profiles" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."srm_activity_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."srm_contract_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."srm_daily_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."srm_esg_assessments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."srm_esg_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."srm_performance_evaluations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."srm_risk_assessments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."srm_supplier_contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."srm_supplier_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."srm_supplier_financial_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."srm_supplier_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."srm_suppliers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."versions" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_set_role"("target_email" "text", "new_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_set_role"("target_id" "uuid", "new_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_supplier_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."assign_supplier_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_supplier_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_weighted_score"("p_evaluation_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_weighted_score"("p_evaluation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_weighted_score"("p_evaluation_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."current_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_esg_portfolio_summary"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_esg_portfolio_summary"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_esg_portfolio_summary"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_dashboard_views"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_dashboard_views"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_dashboard_views"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON TABLE "public"."activity_logs" TO "anon";
GRANT ALL ON TABLE "public"."activity_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_logs" TO "service_role";



GRANT ALL ON TABLE "public"."contracts" TO "anon";
GRANT ALL ON TABLE "public"."contracts" TO "authenticated";
GRANT ALL ON TABLE "public"."contracts" TO "service_role";



GRANT ALL ON TABLE "public"."srm_performance_evaluations" TO "anon";
GRANT ALL ON TABLE "public"."srm_performance_evaluations" TO "authenticated";
GRANT ALL ON TABLE "public"."srm_performance_evaluations" TO "service_role";



GRANT ALL ON TABLE "public"."srm_risk_assessments" TO "anon";
GRANT ALL ON TABLE "public"."srm_risk_assessments" TO "authenticated";
GRANT ALL ON TABLE "public"."srm_risk_assessments" TO "service_role";



GRANT ALL ON TABLE "public"."srm_suppliers" TO "anon";
GRANT ALL ON TABLE "public"."srm_suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."srm_suppliers" TO "service_role";



GRANT ALL ON TABLE "public"."mv_supplier_dashboard_summary" TO "anon";
GRANT ALL ON TABLE "public"."mv_supplier_dashboard_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."mv_supplier_dashboard_summary" TO "service_role";



GRANT ALL ON TABLE "public"."mv_supplier_score_trend" TO "anon";
GRANT ALL ON TABLE "public"."mv_supplier_score_trend" TO "authenticated";
GRANT ALL ON TABLE "public"."mv_supplier_score_trend" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."srm_activity_log" TO "anon";
GRANT ALL ON TABLE "public"."srm_activity_log" TO "authenticated";
GRANT ALL ON TABLE "public"."srm_activity_log" TO "service_role";



GRANT ALL ON TABLE "public"."srm_contract_links" TO "anon";
GRANT ALL ON TABLE "public"."srm_contract_links" TO "authenticated";
GRANT ALL ON TABLE "public"."srm_contract_links" TO "service_role";



GRANT ALL ON TABLE "public"."srm_daily_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."srm_daily_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."srm_daily_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."srm_esg_assessments" TO "anon";
GRANT ALL ON TABLE "public"."srm_esg_assessments" TO "authenticated";
GRANT ALL ON TABLE "public"."srm_esg_assessments" TO "service_role";



GRANT ALL ON TABLE "public"."srm_esg_documents" TO "anon";
GRANT ALL ON TABLE "public"."srm_esg_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."srm_esg_documents" TO "service_role";



GRANT ALL ON TABLE "public"."srm_supplier_contacts" TO "anon";
GRANT ALL ON TABLE "public"."srm_supplier_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."srm_supplier_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."srm_supplier_documents" TO "anon";
GRANT ALL ON TABLE "public"."srm_supplier_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."srm_supplier_documents" TO "service_role";



GRANT ALL ON TABLE "public"."srm_supplier_financial_data" TO "anon";
GRANT ALL ON TABLE "public"."srm_supplier_financial_data" TO "authenticated";
GRANT ALL ON TABLE "public"."srm_supplier_financial_data" TO "service_role";



GRANT ALL ON TABLE "public"."srm_supplier_profiles" TO "anon";
GRANT ALL ON TABLE "public"."srm_supplier_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."srm_supplier_profiles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."supplier_code_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."supplier_code_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."supplier_code_seq" TO "service_role";



GRANT ALL ON TABLE "public"."v_supplier_summary" TO "anon";
GRANT ALL ON TABLE "public"."v_supplier_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."v_supplier_summary" TO "service_role";



GRANT ALL ON TABLE "public"."versions" TO "anon";
GRANT ALL ON TABLE "public"."versions" TO "authenticated";
GRANT ALL ON TABLE "public"."versions" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







