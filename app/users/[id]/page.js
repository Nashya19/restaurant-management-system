/**
 * /app/users/[id]/page.js
 * 
 * User create/edit page (admin only)
 * 
 * When [id] = "new":
 * - Show create form with empty fields
 * - Create password field (required)
 * - Form validates and creates auth user + profile
 * 
 * When [id] = existing UUID:
 * - Fetch user profile
 * - Show edit form pre-filled
 * - NO password field (show "Reset password" link instead)
 * - Form validates and updates profile
 * 
 * DESIGN COMPLIANCE:
 * - Dark theme throughout
 * - Form uses globals.md styling: `.form-group` wrapper, label uppercase, input with focus ring
 * - Error messages display inline (below field) in destructive color
 * - Submit button: `.btn-primary` (amber accent)
 * - Cancel button: `.btn-ghost` (neutral)
 * - Loading state shows spinner + disabled button
 * 
 * WHY separate password reset?
 * - Creating user: admin sets initial password (sent in invite email)
 * - Editing user: admin can reset via separate API call (resetUserPassword)
 * - Cleaner UX: two different flows, two different forms
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createUser, getUserById, updateUser, resetUserPassword } from '@/lib/api/users';
import { useFormState } from '@/lib/hooks/useFormState';
import { validateUserForm, validateEmail, validatePassword, validateFullName, validateRole } from '@/lib/utils/validation';
import { ArrowLeft, Loader2, Key } from 'lucide-react';

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id;
  const isNewUser = userId === 'new';

  const [isLoading, setIsLoading] = useState(!isNewUser); // Load existing user data
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetError, setResetError] = useState(null);
  const [resetLoading, setResetLoading] = useState(false);

  // Main form state
  const {
    formData,
    setFieldValue,
    errors,
    setFieldError,
    isLoading: formLoading,
    handleChange,
    handleSubmit: handleFormSubmit,
  } = useFormState({
    initialData: {
      email: '',
      password: '',
      fullName: '',
      role: 'staff',
    },
    validate: (data) => {
      return validateUserForm({
        email: data.email,
        password: data.password,
        fullName: data.fullName,
        role: data.role,
        isNewUser,
      });
    },
    onSubmit: async (data) => {
      if (isNewUser) {
        await createUser({
          email: data.email,
          fullName: data.fullName,
          role: data.role,
        });
      } else {
        await updateUser(userId, {
          fullName: data.fullName,
          role: data.role,
        });
      }
    },
    onSuccess: () => {
      router.push('/users');
    },
    onError: (err) => {
      console.error('Form submission error:', err);
    },
  });

  // Fetch existing user data
  useEffect(() => {
    if (isNewUser) {
      setIsLoading(false);
      return;
    }

    const fetchUser = async () => {
      try {
        const user = await getUserById(userId);
        setFieldValue('fullName', user.full_name);
        setFieldValue('role', user.role);
      } catch (err) {
        setFieldError('submit', err.message);
        console.error('Failed to fetch user:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [userId, isNewUser, setFieldValue, setFieldError]);

  // Handle password reset
  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setResetError(null);
    setResetLoading(true);

    try {
      if (resetPassword !== resetConfirm) {
        throw new Error('Passwords do not match');
      }

      const passwordError = validatePassword(resetPassword);
      if (passwordError) {
        throw new Error(passwordError);
      }

      await resetUserPassword(userId, resetPassword);
      setResetPassword('');
      setResetConfirm('');
      setShowResetForm(false);
      alert('Password reset successfully. Staff member will receive a confirmation email.');
    } catch (err) {
      setResetError(err.message);
      console.error('Password reset error:', err);
    } finally {
      setResetLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
          <p className="mt-4 text-[var(--text-secondary)]">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Back Button */}
      <Link
        href="/users"
        className="inline-flex items-center gap-2 text-[var(--accent)] hover:text-[var(--accent)] mb-6 font-semibold"
      >
        <ArrowLeft size={18} />
        Back to Staff
      </Link>

      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-display text-[var(--text-primary)] mb-2">
          {isNewUser ? 'Create Staff Member' : 'Edit Staff Member'}
        </h1>
        <p className="text-body text-[var(--text-secondary)]">
          {isNewUser
            ? 'Add a new staff member. They will receive an invite email to set their password.'
            : 'Update staff member details.'}
        </p>
      </div>

      {/* Main Form */}
      <form onSubmit={handleFormSubmit} className="card space-y-6 mb-8">
        {/* Submit Error */}
        {errors.submit && (
          <div className="bg-[var(--destructive-bg)] border border-[var(--destructive-border)] rounded p-4">
            <p className="text-body text-[var(--destructive)]">⚠️ {errors.submit}</p>
          </div>
        )}

        {/* Email Field (Create only) */}
        {isNewUser && (
          <div className="form-group">
            <label htmlFor="email" className="text-small uppercase text-[var(--text-secondary)] font-semibold block mb-2">
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="staff@restaurant.com"
              className="w-full"
              required
            />
            {errors.email && <p className="text-small text-[var(--destructive)] mt-1">{errors.email}</p>}
          </div>
        )}

        {/* Full Name Field */}
        <div className="form-group">
          <label htmlFor="fullName" className="text-small uppercase text-[var(--text-secondary)] font-semibold block mb-2">
            Full Name
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            value={formData.fullName}
            onChange={handleChange}
            placeholder="John Doe"
            className="w-full"
            required
          />
          {errors.fullName && <p className="text-small text-[var(--destructive)] mt-1">{errors.fullName}</p>}
        </div>

        {/* Password Field (Create only) */}
        {isNewUser && (
          <div className="form-group">
            <label htmlFor="password" className="text-small uppercase text-[var(--text-secondary)] font-semibold block mb-2">
              Initial Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Min 8 chars, upper, lower, number"
              className="w-full"
              required
            />
            {errors.password && <p className="text-small text-[var(--destructive)] mt-1">{errors.password}</p>}
            <p className="text-small text-[var(--text-muted)] mt-1">
              This password will be sent to the staff member's email.
            </p>
          </div>
        )}

        {/* Role Field */}
        <div className="form-group">
          <label htmlFor="role" className="text-small uppercase text-[var(--text-secondary)] font-semibold block mb-2">
            Role
          </label>
          <select
            id="role"
            name="role"
            value={formData.role}
            onChange={handleChange}
            className="w-full"
            required
          >
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
          {errors.role && <p className="text-small text-[var(--destructive)] mt-1">{errors.role}</p>}
          <p className="text-small text-[var(--text-muted)] mt-1">
            Admins can manage staff, inventory, and view dashboard metrics.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={formLoading}
            className="btn btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {formLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving…
              </>
            ) : (
              'Save Changes'
            )}
          </button>
          <Link href="/users" className="btn btn-ghost flex-1">
            Cancel
          </Link>
        </div>
      </form>

      {/* Password Reset Section (Edit only) */}
      {!isNewUser && (
        <div className="card border-[var(--border)]">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-heading text-[var(--text-primary)] mb-1">Reset Password</h3>
              <p className="text-body text-[var(--text-secondary)]">
                Set a new password for this staff member. They will receive a confirmation email.
              </p>
            </div>
            <button
              onClick={() => setShowResetForm(!showResetForm)}
              className="btn btn-ghost text-[var(--accent)] hover:text-[var(--accent)]"
            >
              <Key size={18} />
            </button>
          </div>

          {showResetForm && (
            <form onSubmit={handlePasswordReset} className="space-y-4 pt-4 border-t border-[var(--border)]">
              {resetError && (
                <div className="bg-[var(--destructive-bg)] border border-[var(--destructive-border)] rounded p-3">
                  <p className="text-small text-[var(--destructive)]">⚠️ {resetError}</p>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="resetPassword" className="text-small uppercase text-[var(--text-secondary)] font-semibold block mb-2">
                  New Password
                </label>
                <input
                  id="resetPassword"
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Min 8 chars, upper, lower, number"
                  className="w-full"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="resetConfirm" className="text-small uppercase text-[var(--text-secondary)] font-semibold block mb-2">
                  Confirm Password
                </label>
                <input
                  id="resetConfirm"
                  type="password"
                  value={resetConfirm}
                  onChange={(e) => setResetConfirm(e.target.value)}
                  placeholder="Repeat password"
                  className="w-full"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="btn btn-primary flex items-center justify-center gap-2"
                >
                  {resetLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Resetting…
                    </>
                  ) : (
                    'Reset Password'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowResetForm(false)}
                  className="btn btn-ghost"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
