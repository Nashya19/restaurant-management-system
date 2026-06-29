'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

export default function ThankYouPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const [closeStatus, setCloseStatus] = useState("Closing tab in 3 seconds...");

  const feedbackGiven = searchParams.get('feedback') === 'true';

  useEffect(() => {
    const timer = setTimeout(() => {
      window.close();
      // If window.close() fails (e.g. browser security blocks it), update status
      setCloseStatus("You can now safely close this browser tab.");
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-6">
      <div className="bg-white rounded-3xl shadow-xl p-10 text-center max-w-md w-full">

        <div className="text-6xl mb-4">
          {feedbackGiven ? '' : ''}
        </div>

        <h1 className="text-3xl font-bold mb-3">
          Thank You!
        </h1>

        {feedbackGiven ? (
          <>
            <p className="text-gray-600">
              Your feedback has been submitted successfully.
            </p>

            <p className="text-gray-600 mt-2">
              We appreciate your time and hope to serve you again soon.
            </p>
          </>
        ) : (
          <>
            <p className="text-gray-600">
              Thank you for dining with us.
            </p>

            <p className="text-gray-600 mt-2">
              We hope you enjoyed your experience and look forward to serving you again.
            </p>
          </>
        )}

        <div className="mt-6 text-sm text-[var(--accent)] font-bold animate-pulse">
          {closeStatus}
        </div>

        <div className="mt-4 text-xs text-gray-400 font-medium">
          Table {params.tableNumber}
        </div>
      </div>
    </div>
  );
}