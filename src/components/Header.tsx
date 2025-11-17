"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";

export default function Header() {
  const { data: session, status } = useSession();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" });
  };

  return (
    <header
  className="fixed top-0 left-0 right-0 z-50 border-b"
  style={{ backgroundColor: '#08122B', borderColor: '#00FFFF' }}
>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 sm:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <span className="text-xl sm:text-2xl md:text-3xl font-bold tracking-wide text-white">
              Find a Song!
            </span>
          </Link>

          {/* Navigation */}
          <nav
            className="flex items-center gap-2 sm:gap-4 md:gap-6 text-xs sm:text-sm md:text-base font-medium"
            style={{ color: "#EEECFF" }}
          >
            {status === "loading" ? (
              <div
                className="w-6 h-6 sm:w-8 sm:h-8 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: "#4A52EB" }}
              ></div>
            ) : session ? (
              <>
                <Link
                  href="/history"
                  className="px-2 sm:px-3 md:px-4 py-1 sm:py-2 rounded transition-all hover:opacity-80"
                >
                  History
                </Link>

                {/* User dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 md:px-4 py-1 sm:py-2 rounded transition-all hover:opacity-80"
                    style={{ backgroundColor: "#1F1F1F", color: "#EEECFF" }}
                  >
                    <div
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-semibold text-sm sm:text-base"
                      style={{ backgroundColor: "#4A52EB", color: "white" }}
                    >
                      {session.user?.name?.charAt(0).toUpperCase() ||
                        session.user?.email?.charAt(0).toUpperCase()}
                    </div>
                    <span className="hidden sm:inline">
                      {session.user?.name || "Account"}
                    </span>
                    <svg
                      className="w-3 h-3 sm:w-4 sm:h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>

                  {isDropdownOpen && (
                    <div
                      className="absolute right-0 mt-2 w-40 sm:w-48 rounded-lg shadow-lg overflow-hidden"
                      style={{ backgroundColor: "#1F1F1F" }}
                    >
                      <div
                        className="px-3 sm:px-4 py-2 sm:py-3 border-b"
                        style={{ borderColor: "#4A52EB" }}
                      >
                        <p
                          className="text-xs sm:text-sm font-medium"
                          style={{ color: "#EEECFF" }}
                        >
                          {session.user?.name}
                        </p>
                        <p
                          className="text-[10px] sm:text-xs truncate"
                          style={{ color: "#EEECFF", opacity: 0.7 }}
                        >
                          {session.user?.email}
                        </p>
                      </div>
                      <button
                        onClick={handleSignOut}
                        className="w-full text-left px-3 sm:px-4 py-2 text-xs sm:text-sm hover:bg-black transition-colors"
                        style={{ color: "#EF4444" }}
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
                  className="text-white/70 hover:text-white transition-opacity font-medium"
                >
                  Sign in
                </Link>

                <Link
                  href="/register"
                  className="text-white font-semibold hover:opacity-90"
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
