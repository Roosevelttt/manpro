'use client';

import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid email or password');
        setIsLoading(false);
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError('An error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    await signIn('google', { callbackUrl });
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0B1A63] p-4">
      {/* CARD WRAPPER */}
      <div className="w-full max-w-[1024px] h-[600px] bg-[#FFF7EF] rounded-2xl shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-2">
        
        {/* LEFT SECTION */}
        <section className="flex flex-col justify-center px-10 md:px-12 border-b md:border-b-0 md:border-r border-[#0B1A63]/10">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-[#0B1A63] mb-4">
              Welcome Back!!
            </h1>
            <div className="h-1 w-16 bg-[#0B1A63] rounded-full mb-6"></div>
            <p className="text-[#2B2F57]/80 text-sm md:text-base max-w-sm">
              Please log in to your account to continue to access the service.
            </p>
          </div>
        </section>

        {/* RIGHT SECTION */}
        <section className="flex flex-col justify-center px-10 md:px-14">
          <h2 className="text-3xl font-bold text-[#0B1A63] mb-8 text-center md:text-left">
            Login
          </h2>

          {error && (
            <div className="mb-4 bg-red-500 text-white px-4 py-2 rounded-md text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* USERNAME */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-[#0B1A63] mb-1"
              >
                Username<span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Username"
                className="w-full border border-gray-300 rounded-md px-4 py-2 shadow-sm focus:ring-2 focus:ring-[#0B1A63]/30 focus:outline-none text-black placeholder:text-gray-400"
              />
            </div>

            {/* PASSWORD */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-[#0B1A63] mb-1"
              >
                Password<span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Password"
                  className="w-full border border-gray-300 rounded-md px-4 py-2 shadow-sm focus:ring-2 focus:ring-[#0B1A63]/30 focus:outline-none text-black placeholder:text-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute inset-y-0 right-0 px-3 text-[#0B1A63]/70 hover:text-[#0B1A63]"
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-5 h-5"
                  >
                    {showPwd ? (
                      <path d="M3.53 2.47 2.47 3.53 5.3 6.36A11.88 11.88 0 0 0 1.2 12c2.15 4.32 6.54 7.25 10.8 7.25 2.08 0 4.2-.6 6.06-1.75l2.41 2.41 1.06-1.06-18-18ZM12 17.25A5.25 5.25 0 0 1 6.75 12c0-.87.21-1.7.58-2.42l1.6 1.6A3.252 3.252 0 0 0 12 15.25c.73 0 1.4-.24 1.94-.65l1.6 1.6c-.72.37-1.55.58-2.54.58Zm0-10.5c4.26 0 8.65 2.93 10.8 7.25-.66 1.33-1.6 2.5-2.67 3.49l-2.38-2.38c.28-.64.45-1.35.45-2.11A5.25 5.25 0 0 0 12 6.75c-.76 0-1.47.16-2.11.45L7.5 4.81c1.13-.38 2.35-.56 3.5-.56Z" />
                    ) : (
                      <path d="M12 5.25c-4.26 0-8.65 2.93-10.8 7.25 2.15 4.32 6.54 7.25 10.8 7.25s8.65-2.93 10.8-7.25C20.65 8.18 16.26 5.25 12 5.25Zm0 12A4.75 4.75 0 1 1 12 7.75a4.75 4.75 0 0 1 0 9.5Zm0-2a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5Z" />
                    )}
                  </svg>
                </button>
              </div>
            </div>

            {/* BUTTON */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#0B1A63] text-white font-semibold py-2.5 rounded-md hover:opacity-90 disabled:opacity-60 shadow-md transition"
            >
              {isLoading ? 'Logging in…' : 'Log In'}
            </button>
          </form>

          {/* GOOGLE BUTTON */}
          <div className="mt-4 text-center">
            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="text-sm text-[#0B1A63] underline hover:opacity-80 disabled:opacity-60"
            >
              Continue with Google
            </button>
          </div>

          {/* REGISTER LINK */}
          <p className="mt-6 text-center text-sm text-[#5D5D5D]">
            Don&apos;t have an account?{' '}
            <Link
              href="/register"
              className="text-[#F2A33C] font-semibold hover:underline"
            >
              Register
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
