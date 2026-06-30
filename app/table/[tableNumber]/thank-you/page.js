'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { CheckCircle2, Heart } from 'lucide-react';

export default function ThankYouPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const [closeStatus, setCloseStatus] = useState('Closing tab in 3 seconds…');

  const feedbackGiven = searchParams.get('feedback') === 'true';

  useEffect(() => {
    const timer = setTimeout(() => {
      window.close();
      setCloseStatus('You can now safely close this tab.');
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-6">
      <div className="bg-[var(--surface)] border border-border rounded-3xl shadow-2xl p-10 text-center max-w-md w-full space-y-4">

        {/* Icon */}
        <div className="flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-success/10 border border-success/20 flex items-center justify-center">
            {feedbackGiven
              ? <Heart size={28} className="text-success fill-success" />
              : <CheckCircle2 size={28} className="text-success" />
            }
          </div>
        </div>

        <h1 className="text-3xl font-bold text-[var(--text-primary)]">
          Thank You!
        </h1>

        {feedbackGiven ? (
          <>
            <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
              Your feedback has been submitted successfully.
            </p>
            <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
              We appreciate your time and hope to serve you again soon.
            </p>
          </>
        ) : (
          <>
            <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
              Thank you for dining with us.
            </p>
            <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
              We hope you enjoyed your experience and look forward to serving you again.
            </p>
          </>
        )}

        <div className="mt-2 text-sm text-[var(--accent)] font-bold animate-pulse">
          {closeStatus}
        </div>

        <div className="text-xs text-[var(--text-secondary)] opacity-50 font-medium">
          Table {params.tableNumber}
        </div>
      </div>
    </div>
  );
}