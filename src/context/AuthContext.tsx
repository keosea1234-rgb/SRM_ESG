import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

// ── Role types ────────────────────────────────────────────────────────────────

export type AppRole =
  | "admin"
  | "procurement_manager"
  | "esg_analyst"
  | "viewer"
  | "supplier";

// Permission matrix — what each role can do
export interface Permissions {
  // Supplier management
  canManageSuppliers: boolean;   // create, edit, invite
  canViewSuppliers: boolean;

  // ESG
  canWriteESG: boolean;          // create / approve assessments
  canViewESG: boolean;

  // Risk & Performance
  canManageRisk: boolean;
  canManagePerformance: boolean;

  // Contracts
  canManageContracts: boolean;
  canViewContracts: boolean;

  // Admin
  canManageUsers: boolean;       // change roles, invite users
  canViewActivityLog: boolean;

  // Supplier comparison
  canViewComparison: boolean;

  // Supplier portal
  isSupplierPortal: boolean;     // redirects to supplier-only view
}

const PERMISSION_MAP: Record<AppRole, Permissions> = {
  admin: {
    canManageSuppliers: true,
    canViewSuppliers: true,
    canWriteESG: true,
    canViewESG: true,
    canManageRisk: true,
    canManagePerformance: true,
    canManageContracts: true,
    canViewContracts: true, // they review supplier contracts for ESG clauses
    canManageUsers: true,
    canViewActivityLog: true, // ESG analysts need audit trail
    canViewComparison: true,
    isSupplierPortal: false,
  },
  procurement_manager: {
    canManageSuppliers: true,
    canViewSuppliers: true,
    canWriteESG: false,
    canViewESG: true,
    canManageRisk: true,
    canManagePerformance: true,
    canManageContracts: true,
    canViewContracts: true,
    canManageUsers: false,
    canViewActivityLog: true,
    canViewComparison: true,
    isSupplierPortal: false,
  },
  esg_analyst: {
    canManageSuppliers: false,
    canViewSuppliers: true,
    canWriteESG: true,
    canViewESG: true,
    canManageRisk: false,
    canManagePerformance: false,
    canManageContracts: false,
    canViewContracts: true, // they review supplier contracts for ESG clauses
    canManageUsers: false,
    canViewActivityLog: true, // ESG analysts need audit trail
    canViewComparison: false,
    isSupplierPortal: false,
  },
  viewer: {
    canManageSuppliers: false,
    canViewSuppliers: true,
    canWriteESG: false,
    canViewESG: true,
    canManageRisk: false,
    canManagePerformance: false,
    canManageContracts: false,
    canViewContracts: true, // they review supplier contracts for ESG clauses
    canManageUsers: false,
    canViewActivityLog: false,
    canViewComparison: false,
    isSupplierPortal: false,
  },
  supplier: {
    canManageSuppliers: false,
    canViewSuppliers: false,
    canWriteESG: false,
    canViewESG: false,
    canManageRisk: false,
    canManagePerformance: false,
    canManageContracts: false,
    canViewContracts: false,
    canManageUsers: false,
    canViewActivityLog: false,
    canViewComparison: false,
    isSupplierPortal: true,
  },
};

// ── Profile ───────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  email: string;
  fullName: string | null;
  role: AppRole;
  supplierId: string | null;
}

// ── Context ───────────────────────────────────────────────────────────────────

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  profileLoading: boolean;
  loading: boolean;
  permissions: Permissions;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const VIEWER_PERMISSIONS = PERMISSION_MAP["viewer"];

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, supplier_id")
        .eq("id", userId)
        .single();

      if (error || !data) {
        // Profile row missing — default to viewer (safe fallback)
        setProfile({
          id: userId,
          email: "",
          fullName: null,
          role: "viewer",
          supplierId: null,
        });
        return;
      }

      const row = data as {
        id: string;
        email: string;
        full_name: string | null;
        role: AppRole | null;
        supplier_id: string | null;
      };

      setProfile({
        id: row.id,
        email: row.email,
        fullName: row.full_name ?? null,
        role: row.role ?? "viewer",
        supplierId: row.supplier_id ?? null,
      });
    } catch {
      setProfile({
        id: userId,
        email: "",
        fullName: null,
        role: "viewer",
        supplierId: null,
      });
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        const { data: { session: initial } } = await supabase.auth.getSession();
        if (!isMounted) return;
        setSession(initial ?? null);
        setLoading(false);
        if (initial?.user) {
          void fetchProfile(initial.user.id);
        } else {
          setProfile(null);
          setProfileLoading(false);
        }
      } catch {
        if (!isMounted) return;
        setSession(null);
        setProfile(null);
        setProfileLoading(false);
        setLoading(false);
      }
    };

    void initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        setSession(nextSession);
        if (!nextSession) {
          setProfile(null);
          setProfileLoading(false);
          return;
        }
        if (
          event === "SIGNED_IN" ||
          event === "INITIAL_SESSION" ||
          event === "TOKEN_REFRESHED"
        ) {
          void fetchProfile(nextSession.user.id);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, fullName: string) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      return { error: error?.message ?? null };
    },
    []
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setProfileLoading(false);
  }, []);

  const permissions = useMemo<Permissions>(
    () => (profile ? PERMISSION_MAP[profile.role] : VIEWER_PERMISSIONS),
    [profile]
  );

  const value = useMemo(
    (): AuthContextType => ({
      session,
      user: session?.user ?? null,
      profile,
      profileLoading,
      loading,
      permissions,
      signIn,
      signUp,
      signOut,
    }),
    [session, profile, profileLoading, loading, permissions, signIn, signUp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Convenience hook — returns permissions directly */
export function usePermissions(): Permissions {
  return useAuth().permissions;
}

/** Returns true if the current user has one of the given roles */
export function useHasRole(...roles: AppRole[]): boolean {
  const { profile } = useAuth();
  return profile ? roles.includes(profile.role) : false;
}
