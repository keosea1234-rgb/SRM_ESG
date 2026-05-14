import { useState, useEffect } from "react";
import { X, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { apiGet, apiPost } from "../lib/api";

interface Supplier {
  id: string;
  name: string;
  status: string;
}

interface FormData {
  supplier_id: string;
  period: string;
  // Environmental
  carbon_footprint_tons: string;
  renewable_energy_pct: string;
  waste_recycling_pct: string;
  water_usage_m3: string;
  env_certifications: string[];
  // Social
  employee_count: string;
  women_in_mgmt_pct: string;
  lost_time_injury_rate: string;
  living_wage_compliant: boolean | null;
  child_labor_policy: boolean | null;
  social_certifications: string[];
  // Governance
  anti_corruption_policy: boolean | null;
  independent_audit: boolean | null;
  gdpr_compliant: boolean | null;
  data_breach_incidents: string;
  gov_certifications: string[];
  notes: string;
  status: "draft" | "submitted" | "approved";
}

const EMPTY_FORM: FormData = {
  supplier_id: "",
  period: "",
  carbon_footprint_tons: "",
  renewable_energy_pct: "",
  waste_recycling_pct: "",
  water_usage_m3: "",
  env_certifications: [],
  employee_count: "",
  women_in_mgmt_pct: "",
  lost_time_injury_rate: "",
  living_wage_compliant: null,
  child_labor_policy: null,
  social_certifications: [],
  anti_corruption_policy: null,
  independent_audit: null,
  gdpr_compliant: null,
  data_breach_incidents: "",
  gov_certifications: [],
  notes: "",
  status: "draft",
};

const ENV_CERTS = ["ISO14001", "CDP", "GRI"];
const SOCIAL_CERTS = ["ISO45001", "SA8000", "OHSAS18001"];
const GOV_CERTS = ["ISO27001", "ISO37001", "SOC2"];

const STEPS = [
  { id: 1, label: "Environmental", short: "E", color: "#0369a1", bg: "bg-blue-50", ring: "ring-blue-400" },
  { id: 2, label: "Social",        short: "S", color: "#7c3aed", bg: "bg-purple-50", ring: "ring-purple-400" },
  { id: 3, label: "Governance",   short: "G", color: "#b45309", bg: "bg-amber-50",  ring: "ring-amber-400" },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function NumberInput({
  label, value, onChange, unit, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; unit?: string; placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-surface-600">{label}</label>
      <div className="relative">
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "—"}
          className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm text-surface-900
                     placeholder:text-surface-300 focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-surface-400">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

function BooleanToggle({
  label, value, onChange,
}: {
  label: string; value: boolean | null; onChange: (v: boolean | null) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-surface-600">{label}</label>
      <div className="flex gap-2">
        {([{ val: true, label: "Yes" }, { val: false, label: "No" }, { val: null, label: "N/A" }] as const).map(
          (opt) => (
            <button
              key={String(opt.val)}
              type="button"
              onClick={() => onChange(opt.val)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                value === opt.val
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-surface-600 border-surface-200 hover:border-brand-300"
              }`}
            >
              {opt.label}
            </button>
          )
        )}
      </div>
    </div>
  );
}

function CertCheckboxes({
  options, selected, onChange, color,
}: {
  options: string[]; selected: string[]; onChange: (v: string[]) => void; color: string;
}) {
  const toggle = (cert: string) =>
    selected.includes(cert)
      ? onChange(selected.filter((c) => c !== cert))
      : onChange([...selected, cert]);

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-surface-600">Certifications</label>
      <div className="flex flex-wrap gap-2">
        {options.map((cert) => {
          const active = selected.includes(cert);
          return (
            <button
              key={cert}
              type="button"
              onClick={() => toggle(cert)}
              style={active ? { backgroundColor: color, borderColor: color, color: "#fff" } : {}}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                active ? "" : "border-surface-200 text-surface-600 hover:border-surface-400"
              }`}
            >
              {cert}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function ESGAssessmentModal({ onClose, onSuccess }: Props) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supplierQuery, setSupplierQuery] = useState("");
  const [showSupplierList, setShowSupplierList] = useState(false);

  const filteredSuppliers = suppliers.filter((s) =>
    s.name.toLowerCase().includes(supplierQuery.toLowerCase())
  );
  const selectedSupplier = suppliers.find((s) => s.id === form.supplier_id);

  useEffect(() => {
    const loadSuppliers = async () => {
      try {
        const data = await apiGet<Supplier[]>("/api/suppliers?status=approved");
        setSuppliers(data);
      } catch {
        setError("Failed to load suppliers. Please try again.");
      }
    };
    void loadSuppliers();
  }, []);

  useEffect(() => {
    setError(null);
  }, [step]);

  const set = (key: keyof FormData, value: unknown) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (status: "draft" | "approved") => {
    if (!form.supplier_id) return setError("Please select a supplier.");
    if (!form.period) return setError("Please enter a period (e.g. 2024-Q1).");
    setSaving(true);
    setError(null);
    try {
      await apiPost(`/api/esg/${form.supplier_id}`, {
        ...form,
        status,
        carbon_footprint_tons:  form.carbon_footprint_tons  ? Number(form.carbon_footprint_tons)  : null,
        renewable_energy_pct:   form.renewable_energy_pct   ? Number(form.renewable_energy_pct)   : null,
        waste_recycling_pct:    form.waste_recycling_pct    ? Number(form.waste_recycling_pct)    : null,
        water_usage_m3:         form.water_usage_m3         ? Number(form.water_usage_m3)         : null,
        employee_count:         form.employee_count         ? Number(form.employee_count)         : null,
        women_in_mgmt_pct:      form.women_in_mgmt_pct      ? Number(form.women_in_mgmt_pct)      : null,
        lost_time_injury_rate:  form.lost_time_injury_rate  ? Number(form.lost_time_injury_rate)  : null,
        data_breach_incidents:  form.data_breach_incidents  ? Number(form.data_breach_incidents)  : null,
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Submission failed";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const currentStep = STEPS[step - 1];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
          <div>
            <h2 className="text-base font-semibold text-surface-900">New ESG Assessment</h2>
            <p className="text-xs text-surface-400 mt-0.5">
              Step {step} of 3 — {currentStep.label}
            </p>
          </div>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex px-6 pt-4 gap-2">
          {STEPS.map((s) => (
            <div key={s.id} className="flex-1">
              <div className={`h-1.5 rounded-full transition-colors ${step >= s.id ? "bg-brand-600" : "bg-surface-100"}`} />
              <p className="text-[10px] text-surface-400 mt-1 text-center">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 space-y-4">

          {/* Supplier + Period (step 1 only) */}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-3 pb-2 border-b border-surface-100">
              <div className="space-y-1 relative">
                <label className="text-xs font-medium text-surface-600">Supplier</label>
                <input
                  type="text"
                  placeholder="Search supplier…"
                  value={selectedSupplier ? selectedSupplier.name : supplierQuery}
                  onFocus={() => { setShowSupplierList(true); if (selectedSupplier) setSupplierQuery(""); }}
                  onBlur={() => setTimeout(() => setShowSupplierList(false), 150)}
                  onChange={(e) => { setSupplierQuery(e.target.value); set("supplier_id", ""); }}
                  className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm text-surface-900
                             placeholder:text-surface-300 focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
                {showSupplierList && filteredSuppliers.length > 0 && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-surface-200
                                  rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredSuppliers.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onMouseDown={() => { set("supplier_id", s.id); setSupplierQuery(""); setShowSupplierList(false); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-surface-50 flex items-center justify-between"
                      >
                        <span className="font-medium text-surface-900">{s.name}</span>
                        <span className="text-xs text-surface-400">{s.status}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-surface-600">Period</label>
                <input
                  type="text"
                  placeholder="e.g. 2024-Q1"
                  value={form.period}
                  onChange={(e) => set("period", e.target.value)}
                  className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm text-surface-900
                             placeholder:text-surface-300 focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
            </div>
          )}

          {/* Step 1 — Environmental */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <NumberInput label="Carbon Footprint"  value={form.carbon_footprint_tons} onChange={(v) => set("carbon_footprint_tons", v)} unit="tons" />
                <NumberInput label="Renewable Energy"  value={form.renewable_energy_pct}  onChange={(v) => set("renewable_energy_pct", v)}  unit="%" />
                <NumberInput label="Waste Recycling"   value={form.waste_recycling_pct}   onChange={(v) => set("waste_recycling_pct", v)}   unit="%" />
                <NumberInput label="Water Usage"       value={form.water_usage_m3}         onChange={(v) => set("water_usage_m3", v)}         unit="m³" />
              </div>
              <CertCheckboxes options={ENV_CERTS} selected={form.env_certifications} onChange={(v) => set("env_certifications", v)} color={STEPS[0].color} />
            </div>
          )}

          {/* Step 2 — Social */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <NumberInput label="Employee Count"        value={form.employee_count}        onChange={(v) => set("employee_count", v)} />
                <NumberInput label="Women in Management"   value={form.women_in_mgmt_pct}     onChange={(v) => set("women_in_mgmt_pct", v)}     unit="%" />
                <NumberInput label="Injury Rate"           value={form.lost_time_injury_rate} onChange={(v) => set("lost_time_injury_rate", v)} unit="per 200k hrs" />
              </div>
              <BooleanToggle label="Living Wage Compliant" value={form.living_wage_compliant} onChange={(v) => set("living_wage_compliant", v)} />
              <BooleanToggle label="Child Labor Policy"    value={form.child_labor_policy}    onChange={(v) => set("child_labor_policy", v)} />
              <CertCheckboxes options={SOCIAL_CERTS} selected={form.social_certifications} onChange={(v) => set("social_certifications", v)} color={STEPS[1].color} />
            </div>
          )}

          {/* Step 3 — Governance */}
          {step === 3 && (
            <div className="space-y-3">
              <BooleanToggle label="Anti-Corruption Policy" value={form.anti_corruption_policy} onChange={(v) => set("anti_corruption_policy", v)} />
              <BooleanToggle label="Independent Audit"      value={form.independent_audit}      onChange={(v) => set("independent_audit", v)} />
              <BooleanToggle label="GDPR Compliant"         value={form.gdpr_compliant}         onChange={(v) => set("gdpr_compliant", v)} />
              <NumberInput label="Data Breach Incidents"    value={form.data_breach_incidents}  onChange={(v) => set("data_breach_incidents", v)} placeholder="0" />
              <CertCheckboxes options={GOV_CERTS} selected={form.gov_certifications} onChange={(v) => set("gov_certifications", v)} color={STEPS[2].color} />
              <div className="space-y-1">
                <label className="text-xs font-medium text-surface-600">Notes</label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="Optional notes…"
                  className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm text-surface-900
                             placeholder:text-surface-300 focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                />
              </div>
            </div>
          )}

        </div>

        {error && (
          <div
            className="mx-6 mb-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3
                     text-sm text-red-700 flex items-center justify-between"
          >
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-3 text-red-500 hover:text-red-700 font-medium"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-surface-100">
          <button
            type="button"
            onClick={() => (step > 1 ? setStep(step - 1) : onClose())}
            className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-800"
          >
            <ChevronLeft className="w-4 h-4" />
            {step > 1 ? "Back" : "Cancel"}
          </button>

          <div className="flex gap-2">
            {step === 3 && (
              <button
                type="button"
                onClick={() => handleSubmit("draft")}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-surface-200
                           text-surface-600 hover:bg-surface-50 disabled:opacity-50"
              >
                Save Draft
              </button>
            )}
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg
                           bg-brand-600 text-white hover:bg-brand-700"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSubmit("approved")}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg
                           bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {saving ? "Saving…" : "Submit & Approve"}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
