'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { HeartHandshake, LogIn, ChevronRight, Shield } from 'lucide-react';

export default function LandingPage() {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const activeTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    setTheme(activeTheme);

    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains('dark');
      setTheme(isDark ? 'dark' : 'light');
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  const logoSrc = theme === 'dark' ? '/images/logo-text-tagline-darkmode.png' : '/images/logo-text-tagline-lightmode.png';

  return (
    <div className="flex-1 relative flex flex-col items-center justify-center min-h-screen bg-background text-[var(--text-primary)] overflow-hidden font-sans">
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
          background: 'radial-gradient(circle at center, rgba(var(--accent-rgb), 0.02) 0%, var(--background) 85%)'
        }}
      />

      {/* Main Content Wrapper */}
      <div className="relative z-10 w-full max-w-4xl px-6 py-16 flex flex-col items-center text-center animate-fade-in">
        {/* Brand Logo & Tagline Image */}
        <div className="max-w-lg w-full px-4 mb-10 animate-fade-in flex justify-center">
          <img 
            src={logoSrc} 
            alt="Sauté" 
            className="w-full h-auto max-h-72 object-contain" 
          />
        </div>

        {/* Headings */}
        <div className="space-y-4 max-w-2xl">
          <p className="text-body text-[var(--text-secondary)] text-base md:text-lg mb-12 max-w-lg mx-auto text-pretty leading-relaxed">
            Cohesive operations suite for table logistics, staff schedules, and surplus food distribution.
          </p>
        </div>

        {/* Navigation Cards (Solid, Conforming to system styling but with premium glow) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl mx-auto mt-10">
          
          {/* Public Surplus */}
          <Link 
            href="/surplus" 
            className="glow-card card flex flex-col items-center justify-center p-8 bg-surface border border-border text-center group cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
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
            className="glow-card card flex flex-col items-center justify-center p-8 bg-surface border border-border text-center group cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
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
