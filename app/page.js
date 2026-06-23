import Link from 'next/link';
import { Utensils, HeartHandshake, LogIn, ChevronRight, Shield } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="dark flex-1 relative flex flex-col items-center justify-center min-h-screen bg-[#09090b] text-[var(--text-primary)] overflow-hidden font-sans">
      {/* Background Image with Cozy Warm Opacity and Sepia Overlay */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-[0.15] scale-105 transition-transform duration-1000"
        style={{ 
          backgroundImage: 'url("https://images.unsplash.com/photo-1514933651103-005eec06c04b?q=80&w=2000&auto=format&fit=crop")',
          filter: 'grayscale(30%) contrast(115%) sepia(20%) blur(1px)'
        }}
      />

      {/* Ambient Warm Radial Overlays (creates the deep glowing atmosphere) */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 30%, rgba(212, 134, 42, 0.08) 0%, transparent 60%)'
        }}
      />
      <div 
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at center, rgba(9, 9, 11, 0.2) 0%, rgba(9, 9, 11, 0.98) 85%, #09090b 100%)'
        }}
      />

      {/* Main Content Wrapper */}
      <div className="relative z-10 w-full max-w-4xl px-6 py-16 flex flex-col items-center text-center animate-fade-in">
        {/* Brand Badge */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#18181b] border border-[#27272a] text-[var(--accent)] mb-8 shadow-2xl transition-all duration-300 hover:border-[var(--accent)] hover:rotate-6">
          <Utensils size={30} strokeWidth={1.8} aria-hidden="true" />
        </div>

        {/* Headings */}
        <div className="space-y-4 max-w-2xl">
          <h1 className="text-display text-4xl md:text-5xl lg:text-6xl text-[var(--text-primary)] font-bold tracking-tight text-balance">
            Zenith <span className="text-[var(--accent)]">RMS</span>
          </h1>
          <p className="text-body text-[var(--text-secondary)] text-base md:text-lg mb-12 max-w-lg mx-auto text-pretty leading-relaxed">
            Cohesive operations suite for table logistics, staff schedules, and surplus food distribution.
          </p>
        </div>

        {/* Navigation Cards (Solid, Conforming to system styling but with premium glow) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl mx-auto mt-10">
          
          {/* Public Surplus */}
          <Link 
            href="/surplus" 
            className="glow-card card flex flex-col items-center justify-center p-8 bg-[#18181b] border border-[#27272a] text-center group cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
          >
            <div className="mb-4 text-[var(--text-secondary)] group-hover:text-[var(--accent)] group-hover:scale-110 transition-all duration-300">
              <HeartHandshake size={36} aria-hidden="true" />
            </div>
            <h2 className="text-heading text-lg font-semibold text-[var(--text-primary)] mb-2">Surplus Food</h2>
            <p className="text-body text-sm text-[var(--text-secondary)] leading-normal max-w-[240px]">
              Redistribute surplus ingredients and meals to community partners.
            </p>
            <span className="text-small text-[var(--accent)] uppercase tracking-wider font-bold mt-6 inline-flex items-center gap-1">
              Public Portal <ChevronRight size={12} className="group-hover:translate-x-1 transition-transform" />
            </span>
          </Link>

          {/* Secure Staff Portal */}
          <Link 
            href="/login" 
            className="glow-card card flex flex-col items-center justify-center p-8 bg-[#18181b] border border-[#27272a] text-center group cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
          >
            <div className="mb-4 text-[var(--text-secondary)] group-hover:text-[var(--accent)] group-hover:scale-110 transition-all duration-300">
              <LogIn size={36} aria-hidden="true" />
            </div>
            <h2 className="text-heading text-lg font-semibold text-[var(--text-primary)] mb-2">Staff Portal</h2>
            <p className="text-body text-sm text-[var(--text-secondary)] leading-normal max-w-[240px]">
              Access order management, rosters, tables, and settings.
            </p>
            <span className="text-small text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] uppercase tracking-wider font-bold mt-6 inline-flex items-center gap-1">
              Sign In <ChevronRight size={12} className="group-hover:translate-x-1 transition-transform" />
            </span>
          </Link>

        </div>

        {/* Footer */}
        <footer className="w-full mt-20 flex items-center justify-center gap-2 text-small text-[var(--text-muted)] tracking-wider uppercase font-semibold">
          <Shield size={12} className="text-[var(--accent)]" />
          <span>Authorized Personnel Only</span>
        </footer>
      </div>
    </div>
  );
}
