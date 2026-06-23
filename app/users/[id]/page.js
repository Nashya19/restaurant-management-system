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
import { getUserById } from '@/lib/api/users';
import { createUser, updateUser, resetUserPassword } from '@/lib/actions/users';
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
      phone: '',
    },
    validate: (data) => {
      return validateUserForm({
        email: data.email,
        password: data.password,
        fullName: data.fullName,
        role: data.role,
        phone: data.phone,
        isNewUser,
      });
    },
    onSubmit: async (data) => {
      if (isNewUser) {
        await createUser({
          email: data.email,
          password: data.password,
          fullName: data.fullName,
          role: data.role,
          phone: data.phone,
        });
      } else {
        await updateUser(userId, {
          fullName: data.fullName,
          role: data.role,
          phone: data.phone,
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
        setFieldValue('phone', user.phone || '');
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
      alert('Password reset successfully.');
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
    <div className="w-full max-w-2xl mx-auto space-y-8 animate-fade-in">
      {/* Back Button */}
      <div>
        <Link
          href="/users"
          className="btn btn-ghost bg-[#09090b] border-[#27272a] hover:bg-[#18181b] hover:text-[var(--accent)] inline-flex items-center gap-2 font-bold px-4 py-2 rounded-xl cursor-pointer text-xs"
        >
          <ArrowLeft size={14} />
          <span>Back to Staff</span>
        </Link>
      </div>

      {/* Page Header */}
      <div className="pb-4 border-b border-[#27272a]">
        <h1 className="text-display text-2xl font-bold tracking-tight text-[var(--text-primary)]">
          {isNewUser ? 'Create Staff Member' : 'Edit Staff Member'}
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {isNewUser
            ? 'Add a new staff member. They can log in immediately with the password you set.'
            : 'Update staff member details.'}
        </p>
      </div>

      {/* Main Form */}
      <form onSubmit={handleFormSubmit} className="card bg-[#18181b] border border-[#27272a] p-8 rounded-2xl shadow-lg space-y-6">
        {/* Submit Error */}
        {errors.submit && (
          <div className="flex items-start gap-2 bg-[#2a1010] border border-[#5a2020] text-[#c45a5a] text-sm p-4 rounded-xl">
            <span className="shrink-0 mt-0.5">⚠️</span>
            <span>{errors.submit}</span>
          </div>
        )}

        {/* Email Field (Create only) */}
        {isNewUser && (
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider cursor-pointer">
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="staff@restaurant.com"
              className="w-full bg-[#09090b] border-[#27272a] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none rounded-lg text-sm transition-all"
              required
            />
            {errors.email && <p className="text-xs text-[var(--destructive)] mt-1 font-semibold">{errors.email}</p>}
          </div>
        )}

        {/* Full Name Field */}
        <div className="space-y-1.5">
          <label htmlFor="fullName" className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider cursor-pointer">
            Full Name
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            value={formData.fullName}
            onChange={handleChange}
            placeholder="John Doe"
            className="w-full bg-[#09090b] border-[#27272a] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none rounded-lg text-sm transition-all"
            required
          />
          {errors.fullName && <p className="text-xs text-[var(--destructive)] mt-1 font-semibold">{errors.fullName}</p>}
        </div>

        {/* Password Field (Create only) */}
        {isNewUser && (
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider cursor-pointer">
              Initial Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Min 8 chars, upper, lower, number"
              className="w-full bg-[#09090b] border-[#27272a] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none rounded-lg text-sm transition-all"
              required
            />
            {errors.password && <p className="text-xs text-[var(--destructive)] mt-1 font-semibold">{errors.password}</p>}
            <p className="text-xs text-[var(--text-muted)] mt-1.5 font-medium">
              Set the initial password for this staff member.
            </p>
          </div>
        )}

        {/* Role Field */}
        <div className="space-y-1.5">
          <label htmlFor="role" className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider cursor-pointer">
            Role
          </label>
          <div className="relative">
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full bg-[#09090b] border-[#27272a] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none rounded-lg text-sm h-10 px-3 outline-none transition-all"
              required
            >
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {errors.role && <p className="text-xs text-[var(--destructive)] mt-1 font-semibold">{errors.role}</p>}
          <p className="text-xs text-[var(--text-muted)] mt-1.5 font-medium">
            Admins can manage staff, inventory, and view dashboard metrics.
          </p>
        </div>

        {/* Phone Field */}
        <div className="space-y-1.5">
          <label htmlFor="phone" className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider cursor-pointer">
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            value={formData.phone}
            onChange={handleChange}
            placeholder="e.g. +15551234567"
            className="w-full bg-[#09090b] border-[#27272a] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none rounded-lg text-sm transition-all"
          />
          {errors.phone && <p className="text-xs text-[var(--destructive)] mt-1 font-semibold">{errors.phone}</p>}
        </div>

        {/* Buttons */}
        <div className="flex gap-4 pt-4 border-t border-[#27272a]">
          <button
            type="submit"
            disabled={formLoading}
            className="btn btn-primary btn-premium flex-1 flex items-center justify-center gap-2 rounded-xl font-bold cursor-pointer"
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
          <Link href="/users" className="btn btn-ghost bg-[#09090b] border-[#27272a] hover:bg-[#18181b] flex-1 rounded-xl font-bold text-center">
            Cancel
          </Link>
        </div>
      </form>

      {/* Password Reset Section (Edit only) */}
      {!isNewUser && (
        <div className="card bg-[#18181b] border border-[#27272a] p-8 rounded-2xl shadow-lg">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-md font-bold text-[var(--text-primary)] mb-1 uppercase tracking-wider">Reset Password</h3>
              <p className="text-xs text-[var(--text-secondary)] font-medium">
                Set a new password for this staff member.
              </p>
            </div>
            <button
              onClick={() => setShowResetForm(!showResetForm)}
              className="btn btn-ghost bg-[#09090b] border-[#27272a] hover:bg-[#18181b] text-[var(--accent)] hover:text-[var(--accent)] p-2 rounded-xl cursor-pointer"
            >
              <Key size={18} />
            </button>
          </div>

          {showResetForm && (
            <form onSubmit={handlePasswordReset} className="space-y-4 pt-6 mt-6 border-t border-[#27272a] animate-fade-in">
              {resetError && (
                <div className="flex items-start gap-2 bg-[#2a1010] border border-[#5a2020] text-[#c45a5a] text-sm p-4 rounded-xl">
                  <span className="shrink-0 mt-0.5">⚠️</span>
                  <span>{resetError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="resetPassword" className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider cursor-pointer">
                  New Password
                </label>
                <input
                  id="resetPassword"
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Min 8 chars, upper, lower, number"
                  className="w-full bg-[#09090b] border-[#27272a] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none rounded-lg text-sm transition-all"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="resetConfirm" className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider cursor-pointer">
                  Confirm Password
                </label>
                <input
                  id="resetConfirm"
                  type="password"
                  value={resetConfirm}
                  onChange={(e) => setResetConfirm(e.target.value)}
                  placeholder="Repeat password"
                  className="w-full bg-[#09090b] border-[#27272a] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none rounded-lg text-sm transition-all"
                  required
                />
              </div>

              <div className="flex gap-4 pt-4 border-t border-[#27272a]">
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="btn btn-primary btn-premium flex-1 flex items-center justify-center gap-2 rounded-xl font-bold cursor-pointer"
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
                  className="btn btn-ghost bg-[#09090b] border-[#27272a] hover:bg-[#18181b] flex-1 rounded-xl font-bold cursor-pointer"
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
