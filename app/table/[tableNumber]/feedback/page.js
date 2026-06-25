'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  clearTableSessionAction,
  submitRatingAction,
} from '@/lib/actions/orders';

export default function FeedbackPage() {
  const params = useParams();
  const router = useRouter();
  const tableNumber = params.tableNumber;

  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const handleDone = async (gaveFeedback = false) => {
    try {
      const sessionId = localStorage.getItem('sessionId');

      if (sessionId) {
        await clearTableSessionAction(sessionId);
      }
    } catch (err) {
      console.error('[FEEDBACK] Failed to clear session:', err);
    } finally {
      localStorage.removeItem('sessionId');
      localStorage.removeItem('tableNumber');
      localStorage.removeItem('dev-role');

      router.push(
        `/table/${tableNumber}/thank-you?feedback=${gaveFeedback}`
      );
    }
  };

  const handleSubmit = async () => {
    if (!rating) return;

    setSubmitting(true);

    try {
      const sessionId = localStorage.getItem('sessionId');

      if (sessionId) {
        await submitRatingAction(sessionId, rating);
      }

      await handleDone(true);
    } catch (err) {
      console.error('[FEEDBACK] Failed to submit rating:', err);
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    setSubmitting(true);
    await handleDone(false);
  };

  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-8 shadow-xl text-center space-y-6">

        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          How was your experience?
        </h1>

        <p className="text-sm text-[var(--text-secondary)]">
          Your feedback helps us improve.
        </p>

        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className="text-4xl transition-transform hover:scale-110"
            >
              {star <= rating ? '⭐' : '☆'}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleSubmit}
            disabled={!rating || submitting}
            className="btn btn-primary btn-premium px-4 py-3 rounded-xl font-bold disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Rating'}
          </button>

          <button
            onClick={handleSkip}
            disabled={submitting}
            className="btn btn-ghost border border-border px-4 py-3 rounded-xl font-bold"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}