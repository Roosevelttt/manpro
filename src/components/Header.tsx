'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useState } from 'react';

export default function Header() {
  const { data: session, status } = useSession();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/' });
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black border-b" style={{ borderColor: '#4A52EB' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <span className="text-2xl font-bold" style={{ color: '#D1F577' }}>
              Sonar
            </span>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-4">
            {status === 'loading' ? (
              <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#4A52EB' }}></div>
            ) : session ? (
              <>
                <Link
                  href="/history"
                  className="px-4 py-2 rounded font-medium transition-all hover:opacity-80"
                  style={{ color: '#EEECFF' }}
                >
                  History
                </Link>

                {/* User dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center gap-2 px-4 py-2 rounded transition-all hover:opacity-80"
                    style={{ backgroundColor: '#1F1F1F', color: '#EEECFF' }}
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center font-semibold" style={{ backgroundColor: '#4A52EB', color: 'white' }}>
                      {session.user?.name?.charAt(0).toUpperCase() || session.user?.email?.charAt(0).toUpperCase()}
                    </div>
                    <span className="hidden sm:inline">{session.user?.name || 'Account'}</span>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>

                  {isDropdownOpen && (
                    <div
                      className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg overflow-hidden"
                      style={{ backgroundColor: '#1F1F1F' }}
                    >
                      <div className="px-4 py-3 border-b" style={{ borderColor: '#4A52EB' }}>
                        <p className="text-sm font-medium" style={{ color: '#EEECFF' }}>
                          {session.user?.name}
                        </p>
                        <p className="text-xs truncate" style={{ color: '#EEECFF', opacity: 0.7 }}>
                          {session.user?.email}
                        </p>
                      </div>
                      <button
                        onClick={handleSignOut}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-black transition-colors"
                        style={{ color: '#EF4444' }}
                      >
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-4 py-2 rounded font-medium transition-all hover:opacity-80"
                  style={{ color: '#EEECFF' }}
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 rounded font-semibold text-white transition-all hover:opacity-90"
                  style={{ backgroundColor: '#4A52EB' }}
                >
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}