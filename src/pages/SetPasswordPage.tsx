import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Building2, Eye, EyeOff, CheckCircle2 } from "lucide-react";

// SetPasswordPage is shown when a supplier clicks the invite link in their email.
// Supabase invite links contain an access_token in the URL hash (#access_token=...).
// We manually extract and set the session from that token, then allow the user
// to set a new password to activate their account.
export default function SetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Step 1: Manually extract the access_token from the URL hash.
    // Supabase invite links look like:
    //   /set-password#access_token=xxx&refresh_token=yyy&type=invite
    const hash = window.location.hash;
    if (hash && hash.includes("access_token")) {
      const params = new URLSearchParams(hash.substring(1)); // remove leading #
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token") ?? "";

      if (accessToken) {
        // Step 2: Tell Supabase to use this token as the current session.
        // This is needed because the user hasn't logged in yet — they arrived
        // via an invite link, not a normal login flow.
        supabase.auth
          .setSession({ access_token: accessToken, refresh_token: refreshToken })
          .then(({ data, error }) => {
            if (data.session) setSessionReady(true);
            if (error) setError("Invalid or expired invite link.");
          });
      }
    }

    // Step 3: Also listen for auth state changes as a fallback.
    // This fires if Supabase processes the token automatically.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
        setSessionReady(true);
      }
    });

    // Step 4: Check if a session already exists (e.g. user refreshed the page).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Guard: make sure we have a valid session before trying to update password
    if (!sessionReady) {
      setError(
        "Auth session missing! Please use the invite link from your email."
      );
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      // Update the user's password using the temporary session from the invite link.
      // After this call succeeds, the user is fully registered.
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);

      // Redirect to the portal after a short delay so the user sees the success message
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto">
            <Building2 className="w-7 h-7 text-brand-600" />
          </div>
          <h1 className="font-display text-2xl font-semibold text-surface-900">
            Set Your Password
          </h1>
          <p className="text-sm text-surface-500">
            Welcome to the Supplier Portal. Create a password to activate your
            account.
          </p>
          {/* Warn the user if we haven't found a valid session yet */}
          {!sessionReady && (
            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
              Waiting for auth session... Please make sure you opened this page
              from your invite email.
            </p>
          )}
        </div>

        {success ? (
          // Success state — shown after password is set, before redirect
          <div className="text-center space-y-3 py-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <p className="font-semibold text-surface-900">
              Password set successfully!
            </p>
            <p className="text-sm text-surface-500">
              Redirecting you to the portal...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New password field with show/hide toggle */}
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pr-10"
                  placeholder="Minimum 8 characters"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Confirm password field */}
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">
                Confirm Password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="input-field"
                placeholder="Repeat your password"
                required
              />
            </div>

            {/* Error message display */}
            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            {/* Submit button — disabled until session is ready */}
            <button
              type="submit"
              disabled={loading || !sessionReady}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loading ? "Setting password..." : "Activate Account"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}