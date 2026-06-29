'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function CustomerSessionPage() {
  const params = useParams();
  const router = useRouter();
  const tableNumber = params.tableNumber;

  useEffect(() => {
    router.replace(`/table/${tableNumber}`);
  }, [router, tableNumber]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--background)]">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
        <p className="mt-4 text-[var(--text-secondary)]">Redirecting to table page…</p>
      </div>
    </div>
  );
}