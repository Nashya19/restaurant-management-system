import Link from 'next/link';
import { Utensils, HeartHandshake, LogIn } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="dark flex-1 relative flex flex-col items-center justify-center min-h-screen bg-[#0F0F0F] text-[var(--text-primary)] overflow-hidden font-sans">
      {/* Background Image with Cozy Warm Opacity */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-[0.2]"
        style={{ 
          backgroundImage: 'url("https://images.unsplash.com/photo-1514933651103-005eec06c04b?q=80&w=2000&auto=format&fit=crop")',
          filter: 'grayscale(20%) contrast(110%) sepia(15%)'
        }}
      />

      {/* Ambient Warm Radial Overlay */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at center, rgba(15, 15, 15, 0.4) 0%, rgba(15, 15, 15, 0.95) 80%, #0F0F0F 100%)'
        }}
      />

      {/* Main Content Card Wrapper */}
      <div className="relative z-10 w-full max-w-4xl px-6 py-12 flex flex-col items-center text-center">
        {/* Classy Logo / Brand Badge */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded bg-[var(--surface)] border border-[var(--border)] text-[var(--accent)] mb-8 shadow-sm">
          <Utensils size={30} strokeWidth={2} aria-hidden="true" />
        </div>

        {/* Headings */}
        <h1 className="text-display text-4xl md:text-5xl lg:text-6xl text-[var(--text-primary)] font-semibold tracking-tight mb-4 text-balance">
          Zenith RMS
        </h1>
        <p className="text-body text-[var(--text-secondary)] text-base md:text-lg mb-12 max-w-lg mx-auto text-pretty leading-relaxed">
          Internal operations portal for table logistics, staff schedules, and surplus food distribution.
        </p>

        {/* Navigation Cards (Solid, NO Glassmorphism, conforming to globals.md) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl mx-auto">
          
          {/* Public Surplus */}
          <Link 
            href="/surplus" 
            className="card flex flex-col items-center justify-center p-8 bg-[var(--surface)] hover:bg-[var(--surface-raised)] transition-all duration-150 group hover:border-[var(--accent)] cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
          >
            <div className="mb-4 text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-colors duration-150">
              <HeartHandshake size={32} aria-hidden="true" />
            </div>
            <h2 className="text-heading text-lg font-semibold text-[var(--text-primary)] mb-2 text-balance">Surplus Food</h2>
            <p className="text-body text-sm text-[var(--text-secondary)] text-center max-w-xs leading-normal">
              Redistribute surplus ingredients and meals to community partners.
            </p>
            <span className="text-small text-[var(--accent)] uppercase tracking-wider font-semibold mt-4 block">
              Public Surplus Portal
            </span>
          </Link>

          {/* Secure Staff Portal */}
          <Link 
            href="/login" 
            className="card flex flex-col items-center justify-center p-8 bg-[var(--surface)] hover:bg-[var(--surface-raised)] transition-all duration-150 group hover:border-[var(--accent)] cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
          >
            <div className="mb-4 text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-colors duration-150">
              <LogIn size={32} aria-hidden="true" />
            </div>
            <h2 className="text-heading text-lg font-semibold text-[var(--text-primary)] mb-2 text-balance">Staff Portal</h2>
            <p className="text-body text-sm text-[var(--text-secondary)] text-center max-w-xs leading-normal">
              Access order management, rosters, tables, and settings.
            </p>
            <span className="text-small text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] uppercase tracking-wider font-semibold mt-4 block transition-colors duration-150">
              Authorized Entrance
            </span>
          </Link>

        </div>

        {/* Footer */}
        <footer className="w-full mt-16 pb-4">
          <p className="text-small text-[var(--text-muted)] tracking-widest uppercase font-medium">
            Authorized Personnel Only
          </p>
        </footer>
      </div>
    </div>
  );
}
