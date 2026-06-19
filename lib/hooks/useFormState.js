/**
 * useFormState Hook
 * 
 * DESIGN DECISION: Modules 2 (User Management) and 4 (Menu Management) both have forms
 * with similar patterns: state, validation, loading, error handling, submission.
 * This hook centralizes that logic to avoid duplication.
 * 
 * BENEFITS:
 * - Single source of truth for form state
 * - Validation runs before submission
 * - Loading state prevents double-submit
 * - Error handling shows user-friendly messages
 * - Easy to test: hook logic separated from component logic
 * 
 * WHY NOT formik/react-hook-form?
 * - Intern project: keep dependencies minimal and code transparent
 * - This hook is <100 lines; external libs add complexity
 * - We can explain every line to interviewers
 * 
 * USAGE:
 *   const { formData, errors, isLoading, handleChange, handleSubmit } = useFormState({
 *     initialData: { name: '', email: '' },
 *     validate: validateUserForm,  // from lib/utils/validation.js
 *     onSubmit: async (data) => {
 *       await supabase.from('profiles').insert(data);
 *     },
 *     onSuccess: () => router.push('/users'),
 *     onError: (err) => setToastError(err.message),
 *   });
 */

'use client';

import { useState } from 'react';

export function useFormState({
  initialData,
  validate, // Function that returns { fieldName: errorMessage, ... }
  onSubmit, // Async function to handle form submission
  onSuccess, // Callback on successful submission
  onError, // Callback on submission error
}) {
  const [formData, setFormData] = useState(initialData);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Handle input change
   * Clear error for this field on change (better UX)
   */
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;

    setFormData((prev) => ({
      ...prev,
      [name]: newValue,
    }));

    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  /**
   * Handle form submission
   * 1. Validate all fields
   * 2. If errors, display and return early
   * 3. If valid, call onSubmit
   * 4. On success, call onSuccess callback
   * 5. On error, call onError callback
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    try {
      // Validate form
      if (validate) {
        const validationErrors = validate(formData);
        if (Object.keys(validationErrors).length > 0) {
          setErrors(validationErrors);
          setIsLoading(false);
          return;
        }
      }

      // Submit form
      await onSubmit(formData);

      // Success callback
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      // Error callback
      const errorMessage = err.message || 'An error occurred. Please try again.';
      setErrors({ submit: errorMessage });
      if (onError) {
        onError(err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Reset form to initial state
   * Useful after successful submission or when user clicks "Clear"
   */
  const resetForm = () => {
    setFormData(initialData);
    setErrors({});
  };

  /**
   * Manually set field value
   * Useful for populating form from server data
   */
  const setFieldValue = (name, value) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  /**
   * Manually set field error
   * Useful for server-side validation errors
   */
  const setFieldError = (name, error) => {
    setErrors((prev) => ({
      ...prev,
      [name]: error,
    }));
  };

  return {
    formData,
    setFieldValue,
    errors,
    setFieldError,
    isLoading,
    handleChange,
    handleSubmit,
    resetForm,
  };
}
