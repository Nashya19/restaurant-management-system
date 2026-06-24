"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Utensils, Lock, Mail } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();
  const supabase = createClient();

  // The theme is loaded dynamically in RootLayout, so we do not force dark theme here.

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      if (profileError) throw profileError;

      if (profile.role === "admin") {
        router.push("/dashboard");
      } else if (profile.role === "staff") {
        router.push("/orders");
      } else {
        throw new Error("Invalid user role detected.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (authError) throw authError;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 relative flex flex-col items-center justify-center min-h-screen bg-background text-[var(--text-primary)] overflow-hidden font-sans p-4">
      {/* Background glow effects */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(212, 134, 42, 0.05) 0%, transparent 60%)'
        }}
      />
      
      <div className="relative z-10 w-full max-w-[420px] animate-fade-in">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-surface border border-border text-[var(--accent)] mb-4 shadow-xl">
            <Utensils size={26} strokeWidth={2} aria-hidden="true" />
          </div>
          <h1 className="text-display text-2xl font-bold tracking-tight text-[var(--text-primary)] mb-1">
            Zenith RMS
          </h1>
          <p className="text-body text-sm text-[var(--text-secondary)]">Staff & Admin Operations Portal</p>
        </div>

        {/* Login Form Card */}
        <div className="card bg-surface border border-border p-8 shadow-2xl rounded-2xl">
          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="flex items-start gap-2 bg-destructive-bg border border-destructive-border text-destructive text-sm p-3 rounded-lg animate-fade-in">
                <span className="shrink-0 mt-0.5">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-small text-[var(--text-secondary)] uppercase tracking-wider font-semibold cursor-pointer">
                Email Address
              </label>
              <div className="relative flex items-center">
                <Mail size={16} className="absolute left-3 text-[var(--text-secondary)]" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-3 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none bg-background border-border rounded-lg transition-all"
                  placeholder="name@example.com"
                  spellCheck={false}
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-small text-[var(--text-secondary)] uppercase tracking-wider font-semibold cursor-pointer">
                Password
              </label>
              <div className="relative flex items-center">
                <Lock size={16} className="absolute left-3 text-[var(--text-secondary)]" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-3 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none bg-background border-border rounded-lg transition-all"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-premium w-full mt-2 rounded-lg font-bold shadow-lg focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
            >
              {loading ? (
                <div className="flex items-center gap-2 justify-center">
                  <Loader2 className="animate-spin" size={16} aria-hidden="true" />
                  <span>Authenticating…</span>
                </div>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Social Divider */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-small">
                <span className="bg-surface px-3 text-[var(--text-secondary)] font-semibold">Or continue with</span>
              </div>
            </div>

            {/* Google Sign In */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="btn btn-ghost w-full mt-4 flex items-center justify-center gap-2 bg-background border-border hover:bg-surface rounded-lg focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none transition-colors"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span className="font-bold text-sm">Google</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
