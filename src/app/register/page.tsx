// src/app/register/page.tsx
"use client";
import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";

import Link from "next/link";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!fullName.trim()) {
      setError("Full name is required");
      return;
    }
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    if (!password) {
      setError("Password is required");
      return;
    }
    if (password.length < 6) {
      setError("Password should be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    try {
      setLoading(true);
      await register(fullName.trim(), email.trim(), password);
      setSuccess("Registration successful! Redirecting to dashboard…");
      router.push("/");
    } catch (err: any) {
      const code = err?.code || "";
      let msg = "Registration failed";
      if (code === "auth/email-already-in-use") {
        msg = "An account with this email already exists.";
      } else if (code === "auth/invalid-email") {
        msg = "Please enter a valid email address.";
      } else if (code === "auth/weak-password") {
        msg = "Password should be at least 6 characters.";
      } else if (code === "auth/invalid-api-key" || code === "auth/api-key-not-valid") {
        msg = "Firebase API key is not configured or invalid in .env.local.";
      } else {
        msg = `Registration failed (${code || err?.message || "unknown error"})`;
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
        <h1 className="auth-title">Create Account</h1>
        <p className="auth-subtitle">Register a new staff member for shop access</p>
      </div>

      {error && (
        <div className="auth-alert auth-alert-error" role="alert">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="auth-alert auth-alert-success" role="alert">
          <span>✓</span>
          <span>{success}</span>
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="fullName">
            Full Name
          </label>
          <input
            id="fullName"
            type="text"
            placeholder="John Doe"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="form-control"
            required
            autoComplete="name"
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="email">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            placeholder="staff@shop.com"
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
            placeholder="Minimum 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="form-control"
            required
            autoComplete="new-password"
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="confirmPassword">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            placeholder="Repeat password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="form-control"
            required
            autoComplete="new-password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary btn-block btn-lg"
          style={{ marginTop: '10px' }}
        >
          {loading ? "Creating Account…" : "Register Account"}
        </button>
      </form>

      <div className="auth-footer">
        Already have an account?{" "}
        <Link href="/login" className="auth-link">
          Sign in here
        </Link>
      </div>
    </div>
  );
}
