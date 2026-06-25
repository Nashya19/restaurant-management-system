'use client';

import { useParams, useSearchParams } from 'next/navigation';

export default function ThankYouPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const feedbackGiven = searchParams.get('feedback') === 'true';

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-6">
      <div className="bg-white rounded-3xl shadow-xl p-10 text-center max-w-md w-full">

        <div className="text-6xl mb-4">
          {feedbackGiven ? '🎉' : '🙏'}
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

        <div className="mt-6 text-sm text-gray-400">
          Table {params.tableNumber}
        </div>
      </div>
    </div>
  );
}