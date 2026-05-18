import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  FileText,
  Users,
  DollarSign,
  Plus,
  X,
  Loader2,
  User,
  Send,
  CheckCircle2,
  LineChart,
  ShieldAlert,
  Leaf,
  AlertTriangle,
  Activity,
  ClipboardCheck,
  Clock3,
  Gauge,
  TimerReset,
} from "lucide-react";
import { apiGet, apiPatch, apiPost } from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import { drillDownVariants } from "../lib/animation";
import { fetchHealthNarrative, fetchSupplierESG } from "../services/suppliers";
import { fetchActivityLog, type ActivityLogRow } from "../services/activityLog";
import { calcHealthScore } from "../lib/healthScore";
import { COUNTRIES } from "../lib/countries";
import PerformanceTab from "../components/PerformanceTab";
import RiskTab from "../components/RiskTab";
import SupplierESGTab from "../components/SupplierESGTab";
import type { Supplier, SupplierContact, SupplierSummary } from "../types";
import { usePageTitle } from "../hooks/usePageTitle";

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatCurrency(val: number | null) {
  if (val === null || val === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
}

function daysUntil(date: string | null) {
  if (!date) return null;
  const target = new Date(date).getTime();
  if (Number.isNaN(target)) return null;
  return Math.ceil((target - Date.now()) / (24 * 60 * 60 * 1000));
}

function isOlderThan(date: string | null | undefined, days: number) {
  if (!date) return true;
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return true;
  return Date.now() - t > days * 24 * 60 * 60 * 1000;
}

function formatActivityAction(action: string | null) {
  if (!action) return "Activity";
  return action
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function metricTone(value: "good" | "watch" | "risk" | "neutral") {
  if (value === "good") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (value === "watch") return "bg-amber-50 text-amber-700 border-amber-200";
  if (value === "risk") return "bg-red-50 text-red-700 border-red-200";
  return "bg-surface-50 text-surface-700 border-surface-200";
}

function severityDot(severity: "high" | "medium" | "low") {
  if (severity === "high") return "mt-1 h-2 w-2 rounded-full bg-red-500";
  if (severity === "medium") return "mt-1 h-2 w-2 rounded-full bg-amber-500";
  return "mt-1 h-2 w-2 rounded-full bg-blue-400";
}

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "badge-active" },
  inactive: { label: "Inactive", className: "badge-inactive" },
  blacklisted: { label: "Blacklisted", className: "badge-blacklisted" },
  pending: { label: "Pending", className: "badge-pending" },
};

const contractStatusConfig: Record<string, string> = {
  Draft: "bg-surface-100 text-surface-600 border border-surface-200",
  Review: "bg-amber-50 text-amber-700 border border-amber-200",
  Active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Expired: "bg-red-50 text-red-700 border border-red-200",
  Archived: "bg-surface-100 text-surface-500 border border-surface-200",
};

interface LinkedContract {
  id: string;
  title: string;
  status: string;
  contract_type: string | null;
  category: string | null;
  contract_size: number | null;
  start_date: string | null;
  expiration_date: string | null;
}

interface SubmissionProfile {
  legal_name: string | null;
  registration_number: string | null;
  country: string | null;
  address: string | null;
  industry: string | null;
  employee_count: number | null;
  revenue_range: string | null;
  website: string | null;
}

interface SubmissionDocument {
  id: string;
  title?: string | null;
  name?: string | null;
  status: "pending" | "approved" | "rejected" | string;
  created_at?: string | null;
}

type EditableSupplierField =
  | "name"
  | "email"
  | "phone"
  | "website"
  | "address"
  | "industry"
  | "company_size"
  | "tax_id"
  | "country";

const emptyContact = {
  full_name: "",
  title: "",
  email: "",
  phone: "",
  department: "",
  is_primary: false,
};

// Onboarding statuses for which the Submission review tab stays visible after decision.
const SUBMISSION_TAB_ONBOARDING_STATUSES = new Set(["submitted", "approved", "rejected"]);

const COMPANY_SIZE_VALUES = ["micro", "small", "medium", "large", "enterprise"] as const;

const COMPANY_SIZE_LABELS: Record<(typeof COMPANY_SIZE_VALUES)[number], string> = {
  micro: "Micro",
  small: "Small",
  medium: "Medium",
  large: "Large",
  enterprise: "Enterprise",
};

type SupplierDetailTab =
  | "overview"
  | "contacts"
  | "contracts"
  | "submission"
  | "timeline"
  | "Performance"
  | "Risk"
  | "esg";

export default function SupplierDetail() {
  const { id } = useParams<{ id: string }>();

  usePageTitle("Supplier Detail");

  const { data: esgData } = useQuery({
    queryKey: queryKeys.supplierESG(id ?? ""),
    queryFn: () => fetchSupplierESG(id!),
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 5,
  });
  const { data: narrative } = useQuery({
    queryKey: queryKeys.supplierNarrative(id ?? ""),
    queryFn: () => fetchHealthNarrative(id!),
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 5,
  });
  const { data: activityLog } = useQuery({
    queryKey: ["supplier-activity-log", id],
    queryFn: () => fetchActivityLog({ supplierId: id!, page: 1, limit: 8 }),
    enabled: Boolean(id),
    staleTime: 1000 * 60,
  });

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [contacts, setContacts] = useState<SupplierContact[]>([]);
  const [contracts, setContracts] = useState<LinkedContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SupplierDetailTab>("overview");

  // Contact modal
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactForm, setContactForm] = useState(emptyContact);
  const [savingContact, setSavingContact] = useState(false);

  const [editingField, setEditingField] = useState<EditableSupplierField | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [savingInlineField, setSavingInlineField] = useState<EditableSupplierField | null>(null);
  const [savedInlineField, setSavedInlineField] = useState<EditableSupplierField | null>(null);

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [submissionProfile, setSubmissionProfile] = useState<SubmissionProfile | null>(null);
  const [submissionDocuments, setSubmissionDocuments] = useState<SubmissionDocument[]>([]);
  const [supplierDocuments, setSupplierDocuments] = useState<SubmissionDocument[]>([]);
  const [submissionLoading, setSubmissionLoading] = useState(false);
  const [submissionActionLoading, setSubmissionActionLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchAll();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const ob = supplier?.onboarding_status ?? undefined;
    if (!ob || !SUBMISSION_TAB_ONBOARDING_STATUSES.has(ob)) return;
    void fetchSubmissionData();
  }, [id, supplier?.id, supplier?.onboarding_status]);

  async function fetchAll() {
    try {
      setLoading(true);
      const [supData, conData, result, docs] = await Promise.all([
        apiGet<Supplier>(`/api/suppliers/${id}`),
        apiGet<SupplierContact[]>(`/api/suppliers/${id}/contacts`),
        apiGet<any>(`/api/suppliers/${id}/contracts`),
        apiGet<SubmissionDocument[]>(`/api/suppliers/${id}/documents`).catch(() => []),
      ]);
      setSupplier(supData);
      setContacts(conData);
      const payload = Array.isArray(result) ? result : (result?.data ?? result);
      setContracts(Array.isArray(payload) ? payload : (payload?.data ?? []));
      setSupplierDocuments(docs);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Loads supplier profile and documents for the submission review tab.
  async function fetchSubmissionData() {
    if (!id) return;
    try {
      setSubmissionLoading(true);
      const [profile, docs] = await Promise.all([
        apiGet<SubmissionProfile>(`/api/suppliers/${id}/profile`).catch(() => null),
        apiGet<SubmissionDocument[]>(`/api/suppliers/${id}/documents`),
      ]);
      setSubmissionProfile(profile);
      setSubmissionDocuments(docs);
      setSupplierDocuments(docs);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmissionLoading(false);
    }
  }

  // Updates one supplier document status from the submission review tab.
  async function handleSubmissionDocumentStatus(
    documentId: string,
    action: "approve" | "reject"
  ) {
    if (!id) return;
    setSubmissionActionLoading(true);
    try {
      await apiPatch(
        `/api/suppliers/${id}/documents/${documentId}/${action}`,
        {}
      );
      // Refresh profile + documents list so status badges stay in sync.
      await fetchSubmissionData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmissionActionLoading(false);
    }
  }

  // Approves or rejects supplier onboarding from the submission review tab.
  async function handleSupplierDecision(action: "approve" | "reject") {
    if (!id) return;
    setSubmissionActionLoading(true);
    try {
      await apiPost(`/api/suppliers/${id}/${action}`, {});
      await fetchAll();
      await fetchSubmissionData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmissionActionLoading(false);
    }
  }

  // Starts inline editing for a single supplier field.
  function startInlineEdit(field: EditableSupplierField) {
    if (!supplier) return;
    const currentValue = supplier[field];
    setEditingField(field);
    setEditingValue(currentValue == null ? "" : String(currentValue));
  }

  // Saves one supplier field on blur and sends field change metadata for activity logging.
  async function saveInlineField(field: EditableSupplierField) {
    if (!id || !supplier) return;

    const oldValueRaw = supplier[field];
    const oldValue = oldValueRaw == null ? "" : String(oldValueRaw);
    const newValue = editingValue.trim();

    if (newValue === oldValue) {
      setEditingField(null);
      return;
    }

    setSavingInlineField(field);
    try {
      const updated = await apiPatch<Supplier>(`/api/suppliers/${id}`, {
        [field]: newValue,
        field_name: field,
        old_value: oldValue,
        new_value: newValue,
      });
      setSupplier(updated);
      setEditingField(null);
      setSavedInlineField(field);
      window.setTimeout(() => setSavedInlineField((curr) => (curr === field ? null : curr)), 2000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingInlineField(null);
    }
  }

  // Renders one inline-editable supplier field for the overview section.
  function renderInlineField(field: EditableSupplierField, label: string) {
    if (!supplier) return null;
    const isEditing = editingField === field;
    const isSaving = savingInlineField === field;
    const raw = supplier[field];
    const rawStr = raw == null ? "" : String(raw);
    const value =
      raw == null || rawStr === ""
        ? "—"
        : field === "company_size" && rawStr in COMPANY_SIZE_LABELS
          ? COMPANY_SIZE_LABELS[rawStr as keyof typeof COMPANY_SIZE_LABELS]
          : rawStr;

    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-xs text-surface-500">{label}</p>
          {savedInlineField === field && (
            <span className="text-[11px] text-emerald-600">Saved</span>
          )}
        </div>
        {isEditing ? (
          field === "industry" ? (
            <select
              autoFocus
              className="input-field h-9"
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              onBlur={() => void saveInlineField(field)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void saveInlineField(field);
                }
                if (e.key === "Escape") {
                  setEditingField(null);
                }
              }}
            >
              <option value="">Select industry</option>
              <option value="IT & Software">IT &amp; Software</option>
              <option value="IT HW & Infra">IT HW &amp; Infra</option>
              <option value="Marketing">Marketing</option>
              <option value="Consultancy">Consultancy</option>
              <option value="Facilities">Facilities</option>
              <option value="HR & Benefits">HR &amp; Benefits</option>
              <option value="Travel">Travel</option>
              <option value="Logistics">Logistics</option>
              <option value="Legal">Legal</option>
              <option value="Other">Other</option>
            </select>
          ) : field === "company_size" ? (
            <select
              autoFocus
              className="input-field h-9"
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              onBlur={() => void saveInlineField(field)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void saveInlineField(field);
                }
                if (e.key === "Escape") {
                  setEditingField(null);
                }
              }}
            >
              <option value="">Select size</option>
              <option value="micro">Micro</option>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
              <option value="enterprise">Enterprise</option>
              {editingValue !== "" &&
                !COMPANY_SIZE_VALUES.includes(
                  editingValue as (typeof COMPANY_SIZE_VALUES)[number]
                ) && <option value={editingValue}>{editingValue}</option>}
            </select>
          ) : field === "country" ? (
            <select
              autoFocus
              className="input-field h-9"
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              onBlur={() => void saveInlineField(field)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void saveInlineField(field);
                }
                if (e.key === "Escape") {
                  setEditingField(null);
                }
              }}
            >
              <option value="">Select country…</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.name}>{c.name}</option>
              ))}
            </select>
          ) : (
            <input
              autoFocus
              className="input-field h-9"
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              onBlur={() => void saveInlineField(field)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void saveInlineField(field);
                }
                if (e.key === "Escape") {
                  setEditingField(null);
                }
              }}
            />
          )
        ) : (
          <button
            type="button"
            onClick={() => startInlineEdit(field)}
            className="text-left text-sm text-surface-900 hover:text-brand-700 transition-colors"
          >
            {isSaving ? "Saving..." : value}
          </button>
        )}
      </div>
    );
  }

  async function handleAddContact(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSavingContact(true);
    try {
      await apiPost(`/api/suppliers/${id}/contacts`, contactForm);
      setShowContactModal(false);
      setContactForm(emptyContact);
      setContacts(await apiGet<SupplierContact[]>(`/api/suppliers/${id}/contacts`));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingContact(false);
    }
  }

  // ── Davet gönder ──
  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setInviting(true);
    setInviteError(null);
    try {
      await apiPost(`/api/suppliers/${id}/invite`, { email: inviteEmail });
      setInviteSuccess(true);
      // Supplier'ı yenile (invite_status güncellensin)
      setSupplier(await apiGet<Supplier>(`/api/suppliers/${id}`));
    } catch (err: any) {
      setInviteError(err.message);
    } finally {
      setInviting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-brand-600 animate-spin" />
      </div>
    );
  }

  if (error || !supplier) {
    return (
      <div className="text-center py-24">
        <p className="text-red-600 text-sm">{error || "Supplier not found"}</p>
        <Link to="/suppliers" className="btn-secondary mt-4 inline-block">Back to Suppliers</Link>
      </div>
    );
  }

  const onboardingStatus = supplier.onboarding_status ?? undefined;
  const showSubmissionTab =
    onboardingStatus !== undefined && SUBMISSION_TAB_ONBOARDING_STATUSES.has(onboardingStatus);
  const supplierDecisionLocked = onboardingStatus === "approved" || onboardingStatus === "rejected";
  const pendingDocuments = supplierDocuments.filter((doc) => doc.status === "pending");
  const approvedDocuments = supplierDocuments.filter((doc) => doc.status === "approved");

  type SupplierWithSignals = Supplier & Partial<Pick<SupplierSummary, "latest_performance_score" | "last_evaluated_at" | "current_risk_level" | "last_risk_assessed_at">>;
  const signalSupplier = supplier as SupplierWithSignals;
  const performanceScore = signalSupplier.latest_performance_score ?? null;
  const riskLevel = signalSupplier.current_risk_level ?? null;
  const health = calcHealthScore(performanceScore, riskLevel, esgData?.overall_esg_score ?? null);
  const totalContractValue = contracts.reduce((sum, c) => sum + (c.contract_size || 0), 0);
  const activeContracts = contracts.filter((c) => c.status === "Active");
  const expiringContracts = contracts
    .map((contract) => ({ contract, days: daysUntil(contract.expiration_date) }))
    .filter((item): item is { contract: LinkedContract; days: number } => item.days != null && item.days >= 0 && item.days <= 90);
  const contractStatusCounts = contracts.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});
  const categoryCount = new Set(contracts.map((c) => c.category).filter(Boolean)).size;
  const hasPrimaryContact = contacts.some((c) => c.is_primary);
  const timelineRows = activityLog?.data ?? [];
  const readinessChecks = [
    { label: "Primary contact", complete: hasPrimaryContact },
    { label: "Tax ID", complete: Boolean(supplier.tax_id) },
    { label: "Country", complete: Boolean(supplier.country) },
    { label: "Industry", complete: Boolean(supplier.industry) },
    { label: "Company size", complete: Boolean(supplier.company_size) },
    { label: "Approved document", complete: approvedDocuments.length > 0 },
    { label: "ESG assessment", complete: esgData?.overall_esg_score != null },
    { label: "Performance review", complete: performanceScore != null && !isOlderThan(signalSupplier.last_evaluated_at, 180) },
    { label: "Risk review", complete: riskLevel != null && !isOlderThan(signalSupplier.last_risk_assessed_at, 180) },
  ];
  const readinessScore = Math.round((readinessChecks.filter((c) => c.complete).length / readinessChecks.length) * 100);
  const requiredActions = [
    ...(pendingDocuments.length > 0
      ? [{ title: `${pendingDocuments.length} document${pendingDocuments.length > 1 ? "s" : ""} pending review`, detail: "Approve or reject supplier-submitted files.", tone: "risk" as const }]
      : []),
    ...(onboardingStatus === "submitted"
      ? [{ title: "Supplier submission waiting for decision", detail: "Review profile and documents in the Submission tab.", tone: "risk" as const }]
      : []),
    ...(!hasPrimaryContact
      ? [{ title: "Primary contact missing", detail: "Assign one owner for operational escalations.", tone: "watch" as const }]
      : []),
    ...(riskLevel === "high" || riskLevel === "critical"
      ? [{ title: `${riskLevel === "critical" ? "Critical" : "High"} risk supplier`, detail: "Review mitigation plan and next risk assessment.", tone: "risk" as const }]
      : []),
    ...(expiringContracts.length > 0
      ? [{ title: `${expiringContracts.length} contract${expiringContracts.length > 1 ? "s" : ""} expiring in 90 days`, detail: "Start renewal or exit planning.", tone: "watch" as const }]
      : []),
    ...(esgData?.overall_esg_score == null
      ? [{ title: "ESG assessment missing", detail: "Collect ESG data to complete the health view.", tone: "watch" as const }]
      : []),
    ...(isOlderThan(signalSupplier.last_evaluated_at, 180)
      ? [{ title: "Performance review is stale", detail: "Schedule a fresh supplier evaluation.", tone: "watch" as const }]
      : []),
  ].slice(0, 5);

  const tabs: {
    key: SupplierDetailTab;
    label: string;
    icon: typeof Building2;
  }[] = [
    { key: "overview", label: "Overview", icon: Building2 },
    { key: "contacts", label: `Contacts (${contacts.length})`, icon: Users },
    { key: "contracts", label: `Contracts (${contracts.length})`, icon: FileText },
    { key: "esg" as const, label: "ESG", icon: Leaf },
    { key: "timeline" as const, label: "Timeline", icon: Activity },
    ...(showSubmissionTab ? [{ key: "submission" as const, label: "Submission", icon: CheckCircle2 }] : []),
    { key: "Performance", label: "Performance", icon: LineChart },
    { key: "Risk", label: "Risk", icon: ShieldAlert },
  ];

  // Portal status badge reflects supplier onboarding progression.
  const portalStatusMap: Record<string, { label: string; className: string }> = {
    invited: { label: "Invited", className: "bg-amber-50 text-amber-700 border border-amber-200" },
    submitted: { label: "Submitted", className: "bg-blue-50 text-blue-700 border border-blue-200" },
    approved: { label: "Approved", className: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
    rejected: { label: "Rejected", className: "bg-red-50 text-red-700 border border-red-200" },
  };
  const portalStatus = onboardingStatus ? portalStatusMap[onboardingStatus] : undefined;

  return (
    <motion.div
      className="space-y-6"
      variants={drillDownVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <div>
        <Link to="/suppliers" className="inline-flex items-center gap-1 text-sm text-surface-500 hover:text-surface-700 mb-3">
          <ArrowLeft className="w-4 h-4" /> Back to Suppliers
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-brand-50 rounded-xl flex items-center justify-center">
              <Building2 className="w-7 h-7 text-brand-600" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-display text-2xl font-semibold text-surface-900">{supplier.name}</h1>
                <span className={`badge ${statusConfig[supplier.status]?.className}`}>
                  {statusConfig[supplier.status]?.label}
                </span>
                {(() => {
                  type WithHealth = Pick<SupplierSummary, "latest_performance_score" | "current_risk_level">;
                  const sh = supplier as Supplier & WithHealth;
                  const perf = sh.latest_performance_score ?? null;
                  const risk = sh.current_risk_level ?? null;
                  const h = calcHealthScore(perf, risk, esgData?.overall_esg_score ?? null);
                  if (!h) return null;
                  const perfLabel =
                    perf != null && !Number.isNaN(Number(perf)) ? Number(perf).toFixed(1) : "—";
                  const badgeTitle =
                    h.breakdown.hasEsg && h.breakdown.esgNorm != null
                      ? `Perf ${perfLabel} · ESG ${Math.round(h.breakdown.esgNorm * 10)}/100 · Risk ${h.breakdown.riskScore}/10`
                      : `Perf ${perfLabel} · Risk ${h.breakdown.riskScore}/10 · No ESG data`;
                  return (
                    <span
                      title={badgeTitle}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${h.bgColor} ${h.color}`}
                    >
                      Health: {h.score} · {h.band}
                    </span>
                  );
                })()}
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm text-surface-500">
                {supplier.industry && <span>{supplier.industry}</span>}
                {supplier.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />{supplier.city}, {supplier.country}
                  </span>
                )}
              </div>
              {narrative?.overallSummary && (
                <p className="mt-2 max-w-2xl text-sm text-surface-600">{narrative.overallSummary}</p>
              )}
            </div>
          </div>

          {/* Invite Button */}
          <div className="flex items-center gap-3 flex-wrap">
            {portalStatus && (
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${portalStatus.className}`}>
                Portal: {portalStatus.label}
              </span>
            )}
            {supplier.invite_status !== "registered" && (
              <button
                onClick={() => {
                  setInviteEmail(supplier.invited_email ?? supplier.email ?? "");
                  setInviteSuccess(false);
                  setInviteError(null);
                  setShowInviteModal(true);
                }}
                className="btn-primary flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                {supplier.invite_status === "invited" ? "Resend Invite" : "Send Invite"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Executive supplier cockpit */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3">
        <MetricTile
          icon={Gauge}
          label="Health"
          value={health ? `${health.score} / 10` : "No data"}
          detail={health ? health.band : "Needs performance data"}
          tone={health == null ? "neutral" : health.score >= 6 ? "good" : health.score >= 4 ? "watch" : "risk"}
        />
        <MetricTile
          icon={ShieldAlert}
          label="Risk"
          value={riskLevel ? riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1) : "No data"}
          detail={signalSupplier.last_risk_assessed_at ? `Updated ${formatDate(signalSupplier.last_risk_assessed_at)}` : "Review missing"}
          tone={riskLevel === "critical" || riskLevel === "high" ? "risk" : riskLevel === "medium" ? "watch" : riskLevel === "low" ? "good" : "neutral"}
        />
        <MetricTile
          icon={LineChart}
          label="Performance"
          value={performanceScore != null ? performanceScore.toFixed(1) : "No data"}
          detail={signalSupplier.last_evaluated_at ? `Updated ${formatDate(signalSupplier.last_evaluated_at)}` : "Evaluation missing"}
          tone={performanceScore == null ? "neutral" : performanceScore >= 7 ? "good" : performanceScore >= 4 ? "watch" : "risk"}
        />
        <MetricTile
          icon={Leaf}
          label="ESG"
          value={esgData?.overall_esg_score != null ? `${Number(esgData.overall_esg_score).toFixed(0)} / 100` : "No data"}
          detail={esgData?.assessed_at ? `Assessed ${formatDate(esgData.assessed_at)}` : "Assessment missing"}
          tone={esgData?.overall_esg_score == null ? "neutral" : esgData.overall_esg_score >= 70 ? "good" : esgData.overall_esg_score >= 50 ? "watch" : "risk"}
        />
        <MetricTile
          icon={DollarSign}
          label="Exposure"
          value={formatCurrency(totalContractValue)}
          detail={`${activeContracts.length} active contract${activeContracts.length === 1 ? "" : "s"}`}
          tone={riskLevel === "high" || riskLevel === "critical" ? "risk" : totalContractValue > 0 ? "good" : "neutral"}
        />
        <MetricTile
          icon={ClipboardCheck}
          label="Readiness"
          value={`${readinessScore}%`}
          detail={`${readinessChecks.filter((c) => !c.complete).length} gaps open`}
          tone={readinessScore >= 80 ? "good" : readinessScore >= 55 ? "watch" : "risk"}
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-surface-200">
        <div className="flex gap-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-brand-600 text-brand-600"
                  : "border-transparent text-surface-500 hover:text-surface-700"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100">
              <h2 className="font-display text-base font-semibold text-surface-900">Company Information</h2>
              <p className="text-xs text-surface-500">Click any field to edit</p>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderInlineField("name", "Company Name")}
                {renderInlineField("email", "Email")}
                {renderInlineField("phone", "Phone")}
                {renderInlineField("website", "Website")}
                {renderInlineField("address", "Address")}
                {renderInlineField("industry", "Industry")}
                {renderInlineField("company_size", "Company Size")}
                {renderInlineField("tax_id", "Tax ID")}
                {renderInlineField("country", "Country")}
                <div className="space-y-1">
                  <p className="text-xs text-surface-500">Added</p>
                  <p className="text-sm text-surface-900">{formatDate(supplier.created_at)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {narrative && (
              <div className="card p-5 space-y-3">
                <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide">
                  Health Summary
                </p>
                <p className="text-sm text-surface-700">{narrative.overallSummary}</p>
                <div className="space-y-1">
                  {narrative.signals.slice(0, 3).map((signal, index) => (
                    <div key={`${signal.type}-${index}`} className="flex items-start gap-2 text-xs">
                      <span className={severityDot(signal.severity)} />
                      <span className="text-surface-600">{signal.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-surface-500 uppercase tracking-wider">Required Actions</p>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${requiredActions.length ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
                  {requiredActions.length ? `${requiredActions.length} open` : "Clear"}
                </span>
              </div>
              {requiredActions.length === 0 ? (
                <p className="text-sm text-surface-500">No immediate supplier actions.</p>
              ) : (
                <div className="space-y-2">
                  {requiredActions.map((item) => (
                    <div key={item.title} className={`rounded-lg border px-3 py-2 ${metricTone(item.tone)}`}>
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{item.title}</p>
                          <p className="text-xs opacity-80 mt-0.5">{item.detail}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-surface-500 uppercase tracking-wider">Compliance Readiness</p>
                <span className="text-sm font-bold text-surface-900">{readinessScore}%</span>
              </div>
              <div className="h-2 rounded-full bg-surface-100 overflow-hidden mb-3">
                <div
                  className={`h-full ${readinessScore >= 80 ? "bg-emerald-500" : readinessScore >= 55 ? "bg-amber-500" : "bg-red-500"}`}
                  style={{ width: `${readinessScore}%` }}
                />
              </div>
              <div className="grid grid-cols-1 gap-2">
                {readinessChecks.map((check) => (
                  <div key={check.label} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-surface-600">{check.label}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${check.complete ? "bg-emerald-50 text-emerald-700" : "bg-surface-100 text-surface-500"}`}>
                      {check.complete ? "Ready" : "Missing"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTACTS TAB */}
      {activeTab === "contacts" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-surface-500">{contacts.length} contacts</p>
            <button onClick={() => setShowContactModal(true)} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Contact
            </button>
          </div>
          {contacts.length === 0 ? (
            <div className="card p-12 text-center">
              <Users className="w-10 h-10 text-surface-300 mx-auto mb-3" />
              <p className="text-sm text-surface-500">No contacts yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contacts.map((c) => (
                <div key={c.id} className="card p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-surface-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-surface-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-surface-900">{c.full_name}</p>
                        {c.is_primary && <span className="badge badge-active">Primary</span>}
                      </div>
                      {c.title && <p className="text-xs text-surface-500 mt-0.5">{c.title}</p>}
                      {c.department && <p className="text-xs text-surface-400">{c.department}</p>}
                      <div className="flex flex-col gap-1 mt-2">
                        {c.email && <span className="text-xs text-surface-500 flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>}
                        {c.phone && <span className="text-xs text-surface-500 flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CONTRACTS TAB */}
      {activeTab === "contracts" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            <MetricTile
              icon={DollarSign}
              label="Total Value"
              value={formatCurrency(totalContractValue)}
              detail="Commercial exposure"
              tone={totalContractValue > 0 ? "good" : "neutral"}
            />
            <MetricTile
              icon={FileText}
              label="Active"
              value={String(activeContracts.length)}
              detail={`${contracts.length} linked total`}
              tone={activeContracts.length > 0 ? "good" : "neutral"}
            />
            <MetricTile
              icon={TimerReset}
              label="Expiring"
              value={String(expiringContracts.length)}
              detail="Next 90 days"
              tone={expiringContracts.length > 0 ? "watch" : "good"}
            />
            <MetricTile
              icon={ClipboardCheck}
              label="Categories"
              value={String(categoryCount)}
              detail={categoryCount <= 1 && contracts.length > 0 ? "Concentrated exposure" : "Distributed exposure"}
              tone={categoryCount <= 1 && contracts.length > 0 ? "watch" : "good"}
            />
            <MetricTile
              icon={ShieldAlert}
              label="Risk x Value"
              value={riskLevel === "high" || riskLevel === "critical" ? "Elevated" : "Normal"}
              detail={riskLevel ? `${riskLevel} supplier risk` : "Risk data missing"}
              tone={riskLevel === "high" || riskLevel === "critical" ? "risk" : riskLevel ? "good" : "neutral"}
            />
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <p className="text-sm text-surface-500">{contracts.length} linked contracts from ContractGuard</p>
              <div className="flex items-center gap-2 flex-wrap">
                {Object.entries(contractStatusCounts).map(([status, count]) => (
                  <span key={status} className={`badge ${contractStatusConfig[status] || "bg-surface-100 text-surface-600 border border-surface-200"}`}>
                    {status}: {count}
                  </span>
                ))}
              </div>
            </div>
          </div>
          {contracts.length === 0 ? (
            <div className="card p-12 text-center">
              <FileText className="w-10 h-10 text-surface-300 mx-auto mb-3" />
              <p className="text-sm text-surface-500">No contracts linked to this supplier.</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-200 bg-surface-50/50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Contract</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Type</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Status</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Value</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Period</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {contracts.map((c) => (
                    <tr key={c.id} className="hover:bg-surface-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-medium text-surface-900">{c.title}</p>
                        {c.category && <p className="text-xs text-surface-400">{c.category}</p>}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-surface-600">{c.contract_type || "—"}</td>
                      <td className="px-5 py-3.5">
                        <span className={`badge ${contractStatusConfig[c.status] || "bg-surface-100 text-surface-600"}`}>{c.status}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-sm font-medium text-surface-900">{formatCurrency(c.contract_size)}</td>
                      <td className="px-5 py-3.5 text-sm text-surface-500">{formatDate(c.start_date)} — {formatDate(c.expiration_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TIMELINE TAB */}
      {activeTab === "timeline" && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-surface-900">Supplier Relationship Timeline</h2>
              <p className="text-sm text-surface-500 mt-0.5">Latest lifecycle, approval, profile, and evaluation activity.</p>
            </div>
            <Activity className="w-5 h-5 text-surface-400 shrink-0" />
          </div>
          {timelineRows.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Clock3 className="w-9 h-9 text-surface-300 mx-auto mb-3" />
              <p className="text-sm text-surface-500">No activity has been recorded for this supplier yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-surface-100">
              {timelineRows.map((row: ActivityLogRow) => (
                <div key={row.id} className="px-5 py-4 flex gap-3">
                  <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-surface-900">{formatActivityAction(row.action)}</p>
                      <span className="text-xs text-surface-400 shrink-0">{formatDate(row.performed_at)}</span>
                    </div>
                    <p className="text-sm text-surface-600 mt-0.5">{row.description || "Supplier record updated."}</p>
                    {row.field_name && (
                      <p className="text-xs text-surface-400 mt-1">
                        {row.field_name}: {row.old_value || "empty"} {"->"} {row.new_value || "empty"}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUBMISSION TAB */}
      {activeTab === "submission" && (
        <div className="space-y-6">
          {submissionLoading ? (
            <div className="flex items-center gap-2 text-surface-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading submission data...
            </div>
          ) : (
            <>
              {onboardingStatus === "approved" && (
                <div
                  role="status"
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
                >
                  This supplier has been approved.
                </div>
              )}
              {onboardingStatus === "rejected" && (
                <div
                  role="status"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900"
                >
                  This supplier has been rejected.
                </div>
              )}
              <div className="card p-5">
                <h3 className="font-display text-base font-semibold text-surface-900 mb-4">
                  Supplier Profile
                </h3>
                {!submissionProfile ? (
                  <p className="text-sm text-surface-500">No profile data submitted.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoRow icon={Building2} label="Legal Name" value={submissionProfile.legal_name} />
                    <InfoRow icon={FileText} label="Registration Number" value={submissionProfile.registration_number} />
                    <InfoRow icon={MapPin} label="Country" value={submissionProfile.country} />
                    <InfoRow icon={Building2} label="Industry" value={submissionProfile.industry} />
                    <InfoRow icon={Users} label="Employee Count" value={submissionProfile.employee_count?.toString() ?? null} />
                    <InfoRow icon={DollarSign} label="Revenue Range" value={submissionProfile.revenue_range} />
                    <InfoRow icon={Globe} label="Website" value={submissionProfile.website} />
                    <div className="md:col-span-2">
                      <InfoRow icon={MapPin} label="Address" value={submissionProfile.address} />
                    </div>
                  </div>
                )}
              </div>

              <div className="card p-5">
                <h3 className="font-display text-base font-semibold text-surface-900 mb-4">
                  Documents
                </h3>
                {pendingDocuments.length === 0 ? (
                  <p className="text-sm text-surface-500">No pending documents.</p>
                ) : (
                  <div className="space-y-3">
                    {pendingDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="border border-surface-200 rounded-lg p-3 flex items-center justify-between"
                      >
                        <div>
                          <p className="text-sm font-medium text-surface-900">
                            {doc.title || doc.name || `Document ${doc.id}`}
                          </p>
                          {doc.created_at && (
                            <p className="text-xs text-surface-500">{formatDate(doc.created_at)}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                              doc.status === "approved"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : doc.status === "rejected"
                                ? "bg-red-50 text-red-700 border border-red-200"
                                : "bg-surface-100 text-surface-600 border border-surface-200"
                            }`}
                          >
                            {doc.status}
                          </span>
                          {onboardingStatus === "submitted" && (
                            <>
                              <button
                                onClick={() => handleSubmissionDocumentStatus(doc.id, "approve")}
                                disabled={submissionActionLoading}
                                className="btn-secondary text-emerald-700 border-emerald-200 hover:bg-emerald-50 disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleSubmissionDocumentStatus(doc.id, "reject")}
                                disabled={submissionActionLoading}
                                className="btn-secondary text-red-700 border-red-200 hover:bg-red-50 disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {!supplierDecisionLocked && (
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => handleSupplierDecision("reject")}
                    disabled={submissionActionLoading}
                    className="btn-secondary text-red-700 border-red-200 hover:bg-red-50 disabled:opacity-50"
                  >
                    Reject Supplier
                  </button>
                  <button
                    onClick={() => handleSupplierDecision("approve")}
                    disabled={submissionActionLoading}
                    className="btn-primary disabled:opacity-50"
                  >
                    Approve Supplier
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === "Performance" && supplier?.id && (
        <PerformanceTab supplierId={supplier.id} />
      )}
      {activeTab === "Risk" && supplier?.id && (
        <RiskTab supplierId={supplier.id} />
      )}
      {activeTab === "esg" && supplier && (
        <div className="px-6 py-4">
          <SupplierESGTab supplierId={supplier.id} />
        </div>
      )}

      {/* INVITE MODAL */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowInviteModal(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
              <h2 className="font-display text-lg font-semibold text-surface-900">Invite Supplier to Portal</h2>
              <button onClick={() => setShowInviteModal(false)} className="p-1 text-surface-400 hover:text-surface-600 rounded-lg hover:bg-surface-50">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {inviteSuccess ? (
                <div className="text-center space-y-3 py-4">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                  <p className="font-semibold text-surface-900">Invite Sent!</p>
                  <p className="text-sm text-surface-500">{inviteEmail} will receive an email with a link to set up their account.</p>
                  <button onClick={() => setShowInviteModal(false)} className="btn-primary mt-2">Done</button>
                </div>
              ) : (
                <form onSubmit={handleSendInvite} className="space-y-4">
                  <p className="text-sm text-surface-600">
                    Send a portal invitation to <strong>{supplier.name}</strong>. They will receive an email to set up their account and access their supplier portal.
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-surface-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="input-field"
                      placeholder="contact@supplier.com"
                      required
                    />
                  </div>
                  {inviteError && (
                    <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{inviteError}</p>
                  )}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button type="button" onClick={() => setShowInviteModal(false)} className="btn-secondary">Cancel</button>
                    <button type="submit" disabled={inviting} className="btn-primary flex items-center gap-2 disabled:opacity-50">
                      <Send className="w-4 h-4" />
                      {inviting ? "Sending..." : "Send Invite"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ADD CONTACT MODAL */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowContactModal(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
              <h2 className="font-display text-lg font-semibold text-surface-900">Add Contact</h2>
              <button onClick={() => setShowContactModal(false)} className="p-1 text-surface-400 hover:text-surface-600 rounded-lg hover:bg-surface-50">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddContact} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">Full Name *</label>
                <input type="text" value={contactForm.full_name} onChange={(e) => setContactForm({ ...contactForm, full_name: e.target.value })} className="input-field" placeholder="John Doe" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">Job Title</label>
                  <input type="text" value={contactForm.title} onChange={(e) => setContactForm({ ...contactForm, title: e.target.value })} className="input-field" placeholder="Procurement Manager" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">Department</label>
                  <input type="text" value={contactForm.department} onChange={(e) => setContactForm({ ...contactForm, department: e.target.value })} className="input-field" placeholder="Sales" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">Email</label>
                  <input type="email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} className="input-field" placeholder="john@company.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">Phone</label>
                  <input type="text" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} className="input-field" placeholder="+90 555 000 0000" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={contactForm.is_primary} onChange={(e) => setContactForm({ ...contactForm, is_primary: e.target.checked })} className="w-4 h-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
                <span className="text-sm text-surface-700">Primary contact</span>
              </label>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowContactModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={savingContact || !contactForm.full_name.trim()} className="btn-primary disabled:opacity-50">
                  {savingContact ? "Adding..." : "Add Contact"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: any;
  label: string;
  value: string;
  detail: string;
  tone: "good" | "watch" | "risk" | "neutral";
}) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${metricTone(tone)}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-75">{label}</p>
          <p className="text-lg font-bold mt-1 truncate">{value}</p>
          <p className="text-xs mt-0.5 opacity-80 truncate">{detail}</p>
        </div>
        <Icon className="w-5 h-5 shrink-0 opacity-80" />
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string | null }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-surface-400 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-xs text-surface-500">{label}</p>
        <p className="text-sm text-surface-900">{value || "—"}</p>
      </div>
    </div>
  );
}
