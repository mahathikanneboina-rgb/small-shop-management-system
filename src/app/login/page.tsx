// src/app/login/page.tsx
"use client";
import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";

import Link from "next/link";

export default function LoginPage() {
  const { login, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      router.push('/');
    }
  }, [authLoading, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Email and password are required");
      return;
    }
    try {
      setLoading(true);
      await login(email.trim(), password);
      router.push("/");
    } catch (err: any) {
      const code = err?.code || "";
      let msg = "Login failed";
      if (code === "auth/invalid-credential" || code === "auth/user-not-found" || code === "auth/wrong-password") {
        msg = "Invalid email or password. Please check your credentials.";
      } else if (code === "auth/too-many-requests") {
        msg = "Too many failed attempts. Please try again in a few minutes.";
      } else if (code === "auth/invalid-email") {
        msg = "Please enter a valid email address.";
      } else if (code === "auth/network-request-failed") {
        msg = "Network error. Please check your internet connection.";
      } else if (code === "auth/invalid-api-key" || code === "auth/api-key-not-valid" || err?.message?.includes("invalid")) {
        msg = "Firebase API key is not configured or invalid in .env.local.";
      } else {
        msg = `Login failed (${code || err?.message || "unknown error"})`;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <div className="auth-header">
        <div className="auth-logo-badge">🏪</div>
        <h1 className="auth-title">Welcome Back</h1>
        <p className="auth-subtitle">Sign in to manage your store, sales, and inventory</p>
      </div>

      {error && (
        <div className="auth-alert auth-alert-error" role="alert">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="email">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            placeholder="admin@shop.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="form-control"
            required
            autoComplete="email"
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="form-control"
            required
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary btn-block btn-lg"
          style={{ marginTop: '10px' }}
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>

      <div className="auth-footer">
        Don&apos;t have an account yet?{" "}
        <Link href="/register" className="auth-link">
          Create staff account
        </Link>
      </div>
    </div>
  );
}
