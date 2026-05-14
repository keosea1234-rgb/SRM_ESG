// Page component — rendered directly by the router.
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getAuthToken, supabase } from "../lib/supabase";
import { apiDelete, apiGet, apiPatch, apiPost } from "../lib/api";
import { COUNTRIES } from "../lib/countries";
import { Building2, CheckCircle2, Clock, LogOut, Trash2, UploadCloud } from "lucide-react";

type PortalTab = "profile" | "documents" | "submit";
type RevenueRange = "0-1M" | "1M-10M" | "10M-50M" | "50M+";

interface SupplierProfileForm {
  legal_name: string;
  registration_number: string;
  country: string;
  address: string;
  industry: string;
  employee_count: string;
  revenue_range: RevenueRange | "";
  website: string;
}

interface SupplierDocument {
  id: string;
  name?: string;
  title?: string;
  status: "pending" | "approved" | "rejected" | string;
  created_at?: string;
}

const EMPTY_PROFILE: SupplierProfileForm = {
  legal_name: "",
  registration_number: "",
  country: "",
  address: "",
  industry: "",
  employee_count: "",
  revenue_range: "",
  website: "",
};

export default function SupplierPortalPage() {
  const { user, signOut } = useAuth();
  const [supplierId, setSupplierId] = useState<string>("");

  const [activeTab, setActiveTab] = useState<PortalTab>("profile");
  const [profile, setProfile] = useState<SupplierProfileForm>(EMPTY_PROFILE);
  const [documents, setDocuments] = useState<SupplierDocument[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [submitMessage, setSubmitMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [onboardingStatus, setOnboardingStatus] = useState<string>("");

  const profileCompleted = useMemo(() => {
    return (
      profile.legal_name.trim() !== "" &&
      profile.registration_number.trim() !== "" &&
      profile.country.trim() !== "" &&
      profile.address.trim() !== "" &&
      profile.industry.trim() !== "" &&
      profile.employee_count.trim() !== "" &&
      profile.revenue_range !== "" &&
      profile.website.trim() !== ""
    );
  }, [profile]);

  const canSubmit = profileCompleted && documents.length > 0;

  useEffect(() => {
    if (!user) {
      setSupplierId("");
      setLoadingProfile(false);
      setLoadingDocuments(false);
      setError(null);
      return;
    }

    setLoadingProfile(true);
    setLoadingDocuments(true);
    setError(null);
    setSupplierId("");

    let cancelled = false;

    void (async () => {
      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("supplier_id")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (profileError) {
        setSupplierId("");
        setError(profileError.message);
        setLoadingProfile(false);
        setLoadingDocuments(false);
        return;
      }

      const sid = data?.supplier_id;
      if (sid == null || sid === "") {
        setSupplierId("");
        setError("Supplier account not linked to a profile.");
        setLoadingProfile(false);
        setLoadingDocuments(false);
        return;
      }

      setError(null);
      setSupplierId(String(sid));
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!supplierId) {
      setOnboardingStatus("");
      return;
    }

    void loadProfile(supplierId);
    void loadDocuments(supplierId);
    void (async () => {
      try {
        const data = await apiGet<{ onboarding_status?: string }>(
          `/api/suppliers/${supplierId}`
        );
        setOnboardingStatus(data?.onboarding_status ?? "");
      } catch {
        setOnboardingStatus("");
      }
    })();
  }, [supplierId]);

  const loadProfile = async (id: string) => {
    try {
      setLoadingProfile(true);
      const data = (await apiGet(`/api/suppliers/${id}/profile`).catch(() => null)) as Record<
        string,
        unknown
      > | null;
      if (!data) {
        setProfile(EMPTY_PROFILE);
        return;
      }
      setProfile({
        legal_name: String(data.legal_name ?? ""),
        registration_number: String(data.registration_number ?? ""),
        country: String(data.country ?? ""),
        address: String(data.address ?? ""),
        industry: String(data.industry ?? ""),
        employee_count:
          data.employee_count == null ? "" : String(data.employee_count),
        revenue_range:
          (data.revenue_range as RevenueRange | undefined) ?? "",
        website: String(data.website ?? ""),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load profile");
    } finally {
      setLoadingProfile(false);
    }
  };

  const loadDocuments = async (id: string) => {
    try {
      setLoadingDocuments(true);
      const data = await apiGet<SupplierDocument[]>(`/api/suppliers/${id}/documents`);
      setDocuments(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load documents");
    } finally {
      setLoadingDocuments(false);
    }
  };

  const saveProfile = async () => {
    if (!supplierId) return;
    try {
      setSavingProfile(true);
      const payload = {
        ...profile,
        employee_count:
          profile.employee_count.trim() === ""
            ? null
            : Number(profile.employee_count),
      };

      await apiPatch(`/api/suppliers/${supplierId}/profile`, payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const uploadDocument = async () => {
    if (!supplierId || !docTitle.trim() || !docFile) return;

    try {
      setUploadingDocument(true);
      const headers: HeadersInit = {};
      const token = await getAuthToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const formData = new FormData();
      formData.append("file", docFile);
      formData.append("title", docTitle.trim());

      const res = await fetch(`/api/suppliers/${supplierId}/documents`, {
        method: "POST",
        headers,
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to upload document");
      }

      const data = (await res.json()) as SupplierDocument;
      setDocuments((prev) => [data, ...prev]);
      setShowUploadModal(false);
      setDocTitle("");
      setDocFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to upload document");
    } finally {
      setUploadingDocument(false);
    }
  };

  // Deletes a pending document via API and removes it from local state.
  const deleteDocument = async (documentId: string) => {
    if (!supplierId) return;
    try {
      setDeletingDocumentId(documentId);
      await apiDelete(`/api/suppliers/${supplierId}/documents/${documentId}`);
      setDocuments((prev) => prev.filter((d) => d.id !== documentId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete document");
    } finally {
      setDeletingDocumentId(null);
    }
  };

  const submitApplication = async () => {
    if (!supplierId || !canSubmit) return;

    try {
      await apiPost(`/api/suppliers/${supplierId}/submit`, {});

      setOnboardingStatus("submitted");
      setSubmitMessage("Your application has been submitted.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to submit application"
      );
    }
  };

  const badgeClass = (status: SupplierDocument["status"]) => {
    if (status === "approved") return "bg-green-100 text-green-700";
    if (status === "rejected") return "bg-red-100 text-red-700";
    return "bg-surface-200 text-surface-700";
  };

  const visibleDocuments = documents.filter((doc) => doc.status === "pending");

  return (
    <div className="min-h-screen bg-surface-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl border border-surface-200 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-brand-50 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-brand-600" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-semibold text-surface-900">
                Supplier Portal
              </h1>
              <p className="text-sm text-surface-500">{user?.email}</p>
            </div>
          </div>

          <button
            onClick={signOut}
            className="text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-surface-200">
          <div className="border-b border-surface-200 px-3 py-2 flex gap-2">
            {(
              [
                ["profile", "Company Profile"],
                ["documents", "Documents"],
                ["submit", "Submit"],
              ] as [PortalTab, string][]
            ).map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  activeTab === tab
                    ? "bg-brand-600 text-white"
                    : "text-surface-600 hover:bg-surface-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            {activeTab === "profile" && (
              <div className="space-y-4">
                {loadingProfile ? (
                  <p className="text-sm text-surface-500">Loading profile...</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="space-y-1">
                      <span className="text-sm text-surface-600">Legal Name</span>
                      <input
                        className="input-field"
                        value={profile.legal_name}
                        onChange={(e) =>
                          setProfile((prev) => ({
                            ...prev,
                            legal_name: e.target.value,
                          }))
                        }
                        onBlur={saveProfile}
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-sm text-surface-600">
                        Registration Number
                      </span>
                      <input
                        className="input-field"
                        value={profile.registration_number}
                        onChange={(e) =>
                          setProfile((prev) => ({
                            ...prev,
                            registration_number: e.target.value,
                          }))
                        }
                        onBlur={saveProfile}
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-sm text-surface-600">Country</span>
                      <select
                        value={profile.country}
                        onChange={(e) =>
                          setProfile((prev) => ({ ...prev, country: e.target.value }))
                        }
                        onBlur={saveProfile}
                        className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm
                                   text-surface-900 focus:outline-none focus:ring-2 focus:ring-brand-400
                                   bg-white"
                      >
                        <option value="">Select country…</option>
                        {COUNTRIES.map((c) => (
                          <option key={c.code} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1 md:col-span-2">
                      <span className="text-sm text-surface-600">Address</span>
                      <textarea
                        className="input-field min-h-[90px]"
                        value={profile.address}
                        onChange={(e) =>
                          setProfile((prev) => ({ ...prev, address: e.target.value }))
                        }
                        onBlur={saveProfile}
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-sm text-surface-600">Industry</span>
                      <input
                        className="input-field"
                        value={profile.industry}
                        onChange={(e) =>
                          setProfile((prev) => ({ ...prev, industry: e.target.value }))
                        }
                        onBlur={saveProfile}
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-sm text-surface-600">Employee Count</span>
                      <input
                        type="number"
                        className="input-field"
                        value={profile.employee_count}
                        onChange={(e) =>
                          setProfile((prev) => ({
                            ...prev,
                            employee_count: e.target.value,
                          }))
                        }
                        onBlur={saveProfile}
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-sm text-surface-600">Revenue Range</span>
                      <select
                        className="input-field"
                        value={profile.revenue_range}
                        onChange={(e) =>
                          setProfile((prev) => ({
                            ...prev,
                            revenue_range: e.target.value as RevenueRange,
                          }))
                        }
                        onBlur={saveProfile}
                      >
                        <option value="">Select range</option>
                        <option value="0-1M">0-1M</option>
                        <option value="1M-10M">1M-10M</option>
                        <option value="10M-50M">10M-50M</option>
                        <option value="50M+">50M+</option>
                      </select>
                    </label>

                    <label className="space-y-1">
                      <span className="text-sm text-surface-600">Website</span>
                      <input
                        className="input-field"
                        value={profile.website}
                        onChange={(e) =>
                          setProfile((prev) => ({ ...prev, website: e.target.value }))
                        }
                        onBlur={saveProfile}
                      />
                    </label>
                  </div>
                )}
                {savingProfile && (
                  <p className="text-xs text-surface-500">Saving profile...</p>
                )}
              </div>
            )}

            {activeTab === "documents" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-surface-900">Documents</h2>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    disabled={uploadingDocument}
                    className="btn-primary flex items-center gap-2 disabled:opacity-60"
                  >
                    <UploadCloud className="w-4 h-4" />
                    Upload Document
                  </button>
                </div>

                {loadingDocuments ? (
                  <p className="text-sm text-surface-500">Loading documents...</p>
                ) : visibleDocuments.length === 0 ? (
                  <p className="text-sm text-surface-500">No pending documents.</p>
                ) : (
                  <div className="space-y-2">
                    {visibleDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="border border-surface-200 rounded-xl p-3 flex items-center justify-between"
                      >
                        <div>
                          <p className="text-sm font-medium text-surface-800">
                            {(doc as any).document_name ??
                              doc.title ??
                              doc.name ??
                              `Document ${doc.id}`}
                          </p>
                          {doc.created_at && (
                            <p className="text-xs text-surface-500">{doc.created_at}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {doc.status === "pending" && (
                            <button
                              type="button"
                              onClick={() => void deleteDocument(doc.id)}
                              disabled={deletingDocumentId === doc.id}
                              className="p-2 rounded-lg text-surface-500 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors disabled:opacity-50"
                              title="Delete document"
                              aria-label="Delete document"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          <span
                            className={`text-xs font-medium px-2 py-1 rounded-full ${badgeClass(
                              doc.status
                            )}`}
                          >
                            {doc.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "submit" && (
              <div className="space-y-4">
                {onboardingStatus === "approved" ? (
                  <div className="flex flex-col items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-5">
                    <CheckCircle2 className="w-10 h-10 text-green-600 shrink-0" aria-hidden />
                    <div>
                      <h2 className="text-lg font-semibold text-surface-900">
                        Application Approved
                      </h2>
                      <p className="text-sm text-surface-600 mt-1">
                        Your supplier profile has been approved. No further action is needed.
                      </p>
                    </div>
                  </div>
                ) : onboardingStatus === "submitted" ? (
                  <div className="flex flex-col items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-5">
                    <Clock className="w-10 h-10 text-blue-600 shrink-0" aria-hidden />
                    <div>
                      <h2 className="text-lg font-semibold text-surface-900">Under Review</h2>
                      <p className="text-sm text-surface-600 mt-1">
                        Your application has been submitted and is being reviewed.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <h2 className="text-lg font-semibold text-surface-900">
                      Submit Application
                    </h2>
                    <ul className="text-sm text-surface-600 space-y-1">
                      <li>
                        Profile completeness:{" "}
                        <span className={profileCompleted ? "text-green-700" : "text-red-600"}>
                          {profileCompleted ? "Complete" : "Incomplete"}
                        </span>
                      </li>
                      <li>
                        Uploaded documents:{" "}
                        <span className={documents.length > 0 ? "text-green-700" : "text-red-600"}>
                          {documents.length > 0
                            ? `${documents.length} document(s)`
                            : "No documents"}
                        </span>
                      </li>
                    </ul>

                    <button
                      className="btn-primary disabled:opacity-50"
                      onClick={submitApplication}
                      disabled={!canSubmit}
                    >
                      Submit for Review
                    </button>

                    {submitMessage && (
                      <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-green-700 text-sm flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        {submitMessage}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-surface-200 rounded-2xl shadow-xl">
            <div className="px-6 py-4 border-b border-surface-200">
              <h3 className="text-lg font-semibold text-surface-900">Upload Document</h3>
            </div>

            <div className="p-6 space-y-4">
              <label className="block space-y-1">
                <span className="text-sm text-surface-600">Title</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. ISO 9001 Certificate"
                  className="input-field"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                />
              </label>

              <div className="space-y-2">
                <span className="text-sm text-surface-600">File</span>
                <label
                  htmlFor="supplier-document-file"
                  className="block cursor-pointer border-2 border-dashed border-surface-300 rounded-xl p-6 text-center hover:border-brand-400 transition-colors"
                >
                  <UploadCloud className="w-5 h-5 mx-auto mb-2 text-surface-500" />
                  <p className="text-sm text-surface-700">
                    {docFile ? docFile.name : "Click to select a file"}
                  </p>
                  <p className="text-xs text-surface-500 mt-1">
                    Accepted: .pdf, .jpg, .png, .doc, .docx
                  </p>
                </label>
                <input
                  id="supplier-document-file"
                  type="file"
                  accept=".pdf,.jpg,.png,.doc,.docx"
                  className="hidden"
                  onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-surface-200 flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setShowUploadModal(false);
                  setDocTitle("");
                  setDocFile(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary disabled:opacity-50"
                onClick={uploadDocument}
                disabled={uploadingDocument || !docTitle.trim() || !docFile}
              >
                {uploadingDocument ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}