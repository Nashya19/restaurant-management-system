'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { validateSessionPin } from '@/lib/api/table-sessions';
import { createClient } from '@/lib/supabase/client';
import { Shield, Sparkles, Loader2, ArrowRight } from 'lucide-react';

export default function CustomerTablePage() {
  const params = useParams();
  const tableNumber = params.tableNumber;
  const router = useRouter();
  const supabase = createClient();

  const [pinDigits, setPinDigits] = useState(['', '', '', '']);
  const [message, setMessage] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [tableExists, setTableExists] = useState(true);
  const [checkingActive, setCheckingActive] = useState(true);
  const [isValidating, setIsValidating] = useState(false);

  // References for digit inputs
  const inputRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  useEffect(() => {
    async function checkTable() {
      try {
        const { data, error } = await supabase
          .from('tables')
          .select('is_active')
          .eq('table_number', Number(tableNumber))
          .maybeSingle();

        if (error || !data) {
          setTableExists(false);
          setIsActive(false);
        } else if (data.is_active === false) {
          setIsActive(false);
        }
      } catch (err) {
        console.error('Error checking table status:', err);
      } finally {
        setCheckingActive(false);
      }
    }
    checkTable();
  }, [tableNumber, supabase]);

  // Focus first input on mount
  useEffect(() => {
    if (!checkingActive && isActive && inputRefs[0].current) {
      inputRefs[0].current.focus();
    }
  }, [checkingActive, isActive]);

  const handleDigitChange = (index, value) => {
    // Only allow single digit numbers
    if (value && !/^\d$/.test(value)) return;

    const newDigits = [...pinDigits];
    newDigits[index] = value;
    setPinDigits(newDigits);
    setMessage('');

    // Auto-focus next input
    if (value && index < 3) {
      inputRefs[index + 1].current.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!pinDigits[index] && index > 0) {
        // Focus previous input and clear it
        const newDigits = [...pinDigits];
        newDigits[index - 1] = '';
        setPinDigits(newDigits);
        inputRefs[index - 1].current.focus();
      } else {
        const newDigits = [...pinDigits];
        newDigits[index] = '';
        setPinDigits(newDigits);
      }
      setMessage('');
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').slice(0, 4);
    if (!/^\d+$/.test(pasteData)) return;

    const newDigits = [...pinDigits];
    for (let i = 0; i < Math.min(pasteData.length, 4); i++) {
      newDigits[i] = pasteData[i];
    }
    setPinDigits(newDigits);
    setMessage('');

    // Focus last focused box or submit
    const targetIdx = Math.min(pasteData.length - 1, 3);
    inputRefs[targetIdx].current.focus();
  };

  const handleContinue = async () => {
    const fullPin = pinDigits.join('');
    if (fullPin.length < 4) {
      setMessage('⚠️ Please enter the complete 4-digit PIN.');
      return;
    }

    setIsValidating(true);
    setMessage('');

    try {
      const session = await validateSessionPin(tableNumber, fullPin);

      if (!session) {
        setMessage('❌ Invalid PIN');
        setPinDigits(['', '', '', '']);
        inputRefs[0].current.focus();
        setIsValidating(false);
        return;
      }

      const deviceFingerprint =
        localStorage.getItem('deviceFingerprint') || crypto.randomUUID();
      localStorage.setItem('deviceFingerprint', deviceFingerprint);

      // Check if this device was already connected to the session
      const { data: existingDevice } = await supabase
        .from('session_devices')
        .select('id')
        .eq('session_id', session.id)
        .eq('device_fingerprint', deviceFingerprint)
        .maybeSingle();

      const isUnlocked = session.unlock_until && new Date(session.unlock_until) > new Date();

      if (session.status === 'locked' && !existingDevice && !isUnlocked) {
        setMessage('🔒 This session is locked. New devices cannot join.');
        setIsValidating(false);
        return;
      }

      if (session.status === 'completed') {
        setMessage('✅ This session has already been completed.');
        setIsValidating(false);
        return;
      }

      if (session.status === 'cleared') {
        setMessage('🧹 This session has already been cleared.');
        setIsValidating(false);
        return;
      }

      if (!existingDevice) {
        await supabase
          .from('session_devices')
          .insert({
            session_id: session.id,
            device_fingerprint: deviceFingerprint,
          });
      }

      localStorage.setItem('sessionId', session.id);
      localStorage.setItem('tableNumber', tableNumber);
      localStorage.setItem('dev-role', 'customer');

      router.push('/menu');
    } catch (err) {
      console.error(err);
      setMessage('⚠️ An error occurred. Please try again.');
      setIsValidating(false);
    }
  };

  // Submit automatically when all 4 digits are entered
  useEffect(() => {
    if (pinDigits.every(d => d !== '') && pinDigits.join('').length === 4) {
      handleContinue();
    }
  }, [pinDigits]);

  if (checkingActive) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#09090b]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
          <p className="mt-4 text-zinc-400 font-medium">Checking table status…</p>
        </div>
      </div>
    );
  }

  if (!tableExists) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#09090b]">
        <div className="card max-w-md w-full bg-[#18181b] border border-red-950 bg-[#2a1010]/30 p-8 rounded-2xl shadow-xl text-center space-y-4">
          <span className="text-4xl">⚠️</span>
          <h1 className="text-2xl font-bold text-[#c45a5a] mt-4 mb-2">Table Not Found</h1>
          <p className="text-zinc-400 text-sm font-semibold">
            Table {tableNumber} does not exist in the system. Please verify the URL or contact staff.
          </p>
        </div>
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#09090b]">
        <div className="card max-w-md w-full bg-[#18181b] border border-red-950 bg-[#2a1010]/30 p-8 rounded-2xl shadow-xl text-center space-y-4">
          <span className="text-4xl">⚠️</span>
          <h1 className="text-2xl font-bold text-[#c45a5a] mt-4 mb-2">Table {tableNumber} Inactive</h1>
          <p className="text-zinc-400 text-sm font-semibold">
            This table is currently out of service. Please contact a staff member for assistance.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#09090b] relative overflow-hidden">
      {/* Decorative ambient background glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[var(--accent)] opacity-5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[var(--accent)] opacity-5 rounded-full blur-3xl pointer-events-none" />

      <div className="card max-w-md w-full bg-[#18181b]/80 border border-[#27272a] p-8 rounded-3xl shadow-2xl backdrop-blur-md space-y-8 animate-fade-in relative z-10">
        {/* Brand/Table Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#27272a]/60 border border-[#27272a] text-[var(--accent)] mb-2 shadow-inner">
            <Shield size={28} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
            Table {tableNumber} <Sparkles size={18} className="text-[var(--accent)]" />
          </h1>
          <p className="text-sm text-zinc-400 font-medium">
            Enter the 4-digit PIN provided by your waiter to join this table session.
          </p>
        </div>

        {/* 4 PIN Digit Inputs */}
        <div className="space-y-6">
          <div className="flex justify-between gap-3 max-w-[280px] mx-auto">
            {pinDigits.map((digit, idx) => (
              <input
                key={idx}
                ref={inputRefs[idx]}
                type="text"
                maxLength={1}
                inputMode="numeric"
                pattern="[0-9]*"
                value={digit}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                onPaste={handlePaste}
                disabled={isValidating}
                className="w-14 h-16 bg-[#09090b] border border-[#27272a] rounded-2xl text-center text-2xl font-bold font-mono text-white focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition-all shadow-inner disabled:opacity-50"
              />
            ))}
          </div>

          {/* Submit action */}
          <button
            type="button"
            onClick={handleContinue}
            disabled={isValidating || pinDigits.some(d => d === '')}
            className="w-full btn btn-primary btn-premium flex items-center justify-center gap-2 rounded-2xl h-12 font-bold shadow-lg shadow-[var(--accent)]/15 disabled:opacity-50"
          >
            {isValidating ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Validating Session PIN…</span>
              </>
            ) : (
              <>
                <span>Continue</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>

        {/* Message alerts */}
        {message && (
          <p className="text-sm text-center font-semibold text-[#c45a5a] bg-[#2a1010]/30 border border-[#5a2020] p-3.5 rounded-xl animate-fade-in">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}