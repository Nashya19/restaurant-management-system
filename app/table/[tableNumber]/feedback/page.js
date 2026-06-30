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
  const [comments, setComments] = useState('');
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
        await submitRatingAction(sessionId, rating, comments);
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

  const getPlaceholder = () => {
    switch (rating) {
      case 1:
        return "We are so sorry. What went wrong and how can we make it up to you?";
      case 2:
        return "We're sorry your experience wasn't great. Please tell us how we can improve.";
      case 3:
        return "Thanks! What could we have done to make your experience better?";
      case 4:
        return "Glad you enjoyed it! Anything we can do to make it a 5-star experience?";
      case 5:
        return "Wow, thank you! What did you love most about your visit today?";
      default:
        return "Select a star rating and tell us about your experience...";
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-8 shadow-xl text-center space-y-6">
        <div className="flex flex-col items-center justify-center space-y-1.5 mb-2">
          <img 
            src="/images/logo.png" 
            alt="Sauté Logo" 
            className="w-14 h-14 object-contain filter drop-shadow-[0_0_8px_rgba(245,158,11,0.25)]" 
          />
          <span className="text-xs font-black tracking-[0.25em] uppercase text-[var(--accent)] font-sans">Sauté</span>
        </div>

        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          How was your experience?
        </h1>

        <p className="text-sm text-[var(--text-secondary)]">
          Your feedback helps us improve.
        </p>

        <div className="flex justify-center gap-3 my-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className="transition-transform hover:scale-125 active:scale-95 focus:outline-none cursor-pointer"
              aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
            >
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill={star <= rating ? '#F59E0B' : 'none'}
                stroke={star <= rating ? '#F59E0B' : '#6B7280'}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-all duration-150"
                style={{ filter: star <= rating ? 'drop-shadow(0 0 6px rgba(245,158,11,0.5))' : 'none' }}
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </button>
          ))}
        </div>

        {/* Custom Comments Field */}
        <div className="space-y-1.5 text-left">
          <label htmlFor="comments" className="text-xs uppercase text-[var(--text-secondary)] font-bold tracking-wider cursor-pointer">
            Additional Comments (Optional)
          </label>
          <textarea
            id="comments"
            rows={8}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder={getPlaceholder()}
            className="w-full min-h-[160px] border border-border bg-background focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] focus:outline-none rounded-xl p-3 text-sm text-[var(--text-primary)] resize-y py-2.5 leading-relaxed"
          />
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