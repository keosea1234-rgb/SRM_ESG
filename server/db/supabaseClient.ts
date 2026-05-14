import dotenv from "dotenv";
dotenv.config();
// Initializes the Supabase client for server-side data access.
import { createClient } from "@supabase/supabase-js";
export type { SupplierRow, PerformanceEvaluationRow, RiskAssessmentRow, ActivityLogRow, SupplierContactRow, SupplierDocumentRow, SupplierProfileRow, ContractRow, ProfileRow, SupplierSummaryRow, OnboardingStatus } from "./database.types";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);