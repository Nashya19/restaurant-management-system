'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { clearTableSessionAction } from '@/lib/actions/orders';
import { Loader2 } from 'lucide-react';

/**
 * /table/[tableNumber]/feedback
 *
 * Blank placeholder — another team member is building the feedback form.
 * For now, this page auto-clears the table after 3 seconds and redirects
 * back to the table entry page.
 *
 * When the feedback form is integrated:
 *  - Remove the auto-clear & auto-redirect
 *  - Call clearTableSessionAction(sessionId) after the form is submitted
 *  - Then redirect to /table/[tableNumber]
 */
export default function FeedbackPage() {
  const params = useParams();
  const router = useRouter();
  const tableNumber = params.tableNumber;

  const [clearing, setClearing] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // TODO: Remove this auto-clear when the real feedback form is integrated.
    // The feedback form should call handleDone() on form submit.
    const timer = setTimeout(() => {
      handleDone();
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleDone = async () => {
    if (clearing) return;
    setClearing(true);
    try {
      const sessionId = localStorage.getItem('sessionId');
      if (sessionId) {
        await clearTableSessionAction(sessionId);
      }
    } catch (err) {
      console.error('[FEEDBACK] Failed to clear session:', err);
    } finally {
      // Clean up local storage
      localStorage.removeItem('sessionId');
      localStorage.removeItem('tableNumber');
      localStorage.removeItem('dev-role');
      setDone(true);
      router.push(`/table/${tableNumber}`);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-6">
      <div className="text-center space-y-4 animate-fade-in">
        <Loader2 size={32} className="animate-spin text-[var(--accent)] mx-auto" />
        <p className="text-sm font-semibold text-[var(--text-secondary)]">
          Feedback page coming soon…
        </p>
        <p className="text-xs text-[var(--text-muted)]">Closing your session automatically.</p>
      </div>
    </div>
  );
}
