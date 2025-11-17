// Improved UI version of your RegisterPage component
// (Functional logic untouched — only UI/UX/styling updated)

"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const HERO_BG = "#070F2B";
const ACCENT_BLUE = "#00FFFF";
const CARD_BG = "#FFFFFF";
const TEXT_DARK = "#08122B";
const TEXT_MUTED = "#5D5D5D";
const TEXT_BLUE = "#122f78";

const WaveIcon = ({ color }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 40"
    fill="none"
    stroke={color}
    strokeWidth="5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-28 h-auto mt-6 opacity-80"
  >
    <path d="M5 20 L15 10 L25 30 L35 20 L45 10 L55 30 L65 20 L75 10 L85 30 L95 20" />
    <circle cx="5" cy="20" r="2" fill={color} />
    <circle cx="95" cy="20" r="2" fill={color} />
  </svg>
);

export default function RegisterPage() {
  const router = useRouter();
<<<<<<< HEAD

  return (
    <main
      className="min-h-screen flex items-center justify-center p-6 relative"
      style={{ backgroundColor: HERO_BG }}
    >
      {/* 🔵 NEW BACK BUTTON — ROUND ICON, OUTSIDE CARD */}
      <button
        type="button"
        onClick={() => router.push("/")}
        className="absolute top-6 left-6 w-12 h-12 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-all"
        style={{
          backgroundColor: TEXT_BLUE,
          color: "white",
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
          className="w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </button>

      <div
        className="w-full max-w-[1100px] min-h-[620px] rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-2 relative backdrop-blur-xl"
        style={{
          backgroundColor: CARD_BG,
          boxShadow: `0 0 55px ${ACCENT_BLUE}50`,
          border: `1.5px solid ${ACCENT_BLUE}60`,
        }}
      >
        {/* LEFT SECTION */}
        <section
          className="flex flex-col justify-center items-center text-center px-12 py-10 relative bg-gradient-to-br from-[#F7FBFF] to-[#E8F3FF]"
          style={{ borderRight: `1px solid ${ACCENT_BLUE}30` }}
        >
          <h1
            className="text-4xl md:text-5xl font-extrabold drop-shadow-sm"
            style={{ color: TEXT_BLUE }}
          >
            Create Your
            <br /> Account
          </h1>

          <div
            className="h-1 w-20 rounded-full mt-4 mb-6"
            style={{ backgroundColor: TEXT_BLUE }}
          ></div>

          <p
            className="text-base max-w-md leading-relaxed"
            style={{ color: TEXT_MUTED }}
          >
            Join our platform and unlock seamless access to voice-powered
            features, smart tools, and personalized experiences.
          </p>

          <WaveIcon color={TEXT_BLUE} />
        </section>

        {/* RIGHT SECTION — FORM */}
        <section className="flex flex-col justify-center px-10 md:px-14 py-10 bg-white">
          <h2
            className="text-3xl font-bold mb-6 text-center md:text-left"
            style={{ color: TEXT_BLUE }}
          >
            Sign Up
          </h2>

          <form className="space-y-4">
            <div>
              <label
                className="block text-sm font-semibold mb-1"
                style={{ color: TEXT_DARK }}
              >
=======
  const [formData, setFormData] = useState({
    name: '',
    email: '',            
    password: '',
    confirmPassword: '',
  });
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Something went wrong');
        setIsLoading(false);
        return;
      }

      setSuccess(true);

      setTimeout(async () => {
        await signIn('credentials', {
          email: formData.email,
          password: formData.password,
          redirect: false,
        });
        router.push('/');
        router.refresh();
      }, 1500);
    } catch {
      setError('An error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    await signIn('google', { callbackUrl: '/' });
  };

  if (success) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#0B1A63] p-4">
        <div className="w-full max-w-[1024px] h-[600px] bg-[#FFF7EF] rounded-2xl shadow-xl grid place-items-center">
          <div className="text-center px-8">
            <svg className="w-16 h-16 mx-auto text-[#0B1A63]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <h2 className="text-3xl font-extrabold text-[#0B1A63] mt-4">Account Created!</h2>
            <p className="text-[#2B2F57]/80 mt-2">Welcome! Redirecting you to the app…</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0B1A63] p-4">
      {/* Card */}
      <div className="w-full max-w-[1024px] h-[600px] bg-[#FFF7EF] rounded-2xl shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-2">
        {/* Left: copy */}
        <section className="flex flex-col justify-center px-10 md:px-12 border-b md:border-b-0 md:border-r border-[#0B1A63]/10">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-[#0B1A63]">Create Your<br/>Account</h1>
            <div className="h-1 w-16 bg-[#0B1A63] rounded-full mt-3 mb-6"></div>
            <p className="text-[#2B2F57]/80 text-sm md:text-base max-w-sm">
              Please sign up to your account to continue to access the service.
            </p>
          </div>
        </section>

        {/* Right: form */}
        <section className="flex flex-col justify-center px-10 md:px-14">
          <h2 className="text-3xl font-bold text-[#0B1A63] mb-8 text-center md:text-left">Sign Up</h2>

          {error && (
            <div className="mb-4 bg-red-500 text-white px-4 py-2 rounded-md text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-[#0B1A63] mb-1">
>>>>>>> 519872a94f21585a12580fd5841b613a64b846ca
                Full Name<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
<<<<<<< HEAD
                placeholder="Your full name"
                className="w-full border rounded-lg px-4 py-2 shadow focus:ring-2 focus:outline-none text-black placeholder:text-gray-400 transition-all"
                style={{
                  borderColor: TEXT_MUTED + "40",
                  backgroundColor: "#F9FAFB",
                }}
=======
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="Full Name"
                className="w-full border border-gray-300 rounded-md px-4 py-2 shadow-sm focus:ring-2 focus:ring-[#0B1A63]/30 focus:outline-none text-black placeholder:text-gray-400"
>>>>>>> 519872a94f21585a12580fd5841b613a64b846ca
              />
            </div>

            {/* Username (bound to email for backend compatibility) */}
            <div>
<<<<<<< HEAD
              <label
                className="block text-sm font-semibold mb-1"
                style={{ color: TEXT_DARK }}
              >
                Email<span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                placeholder="example@mail.com"
                className="w-full border rounded-lg px-4 py-2 shadow focus:ring-2 focus:outline-none text-black placeholder:text-gray-400 transition-all"
                style={{
                  borderColor: TEXT_MUTED + "40",
                  backgroundColor: "#F9FAFB",
                }}
=======
              <label htmlFor="email" className="block text-sm font-semibold text-[#0B1A63] mb-1">
                Email<span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="text"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="your@gmail.com"
                className="w-full border border-gray-300 rounded-md px-4 py-2 shadow-sm focus:ring-2 focus:ring-[#0B1A63]/30 focus:outline-none text-black placeholder:text-gray-400"
>>>>>>> 519872a94f21585a12580fd5841b613a64b846ca
              />
            </div>

            {/* Password */}
            <div>
<<<<<<< HEAD
              <label
                className="block text-sm font-semibold mb-1"
                style={{ color: TEXT_DARK }}
              >
                Password<span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                placeholder="•••••••"
                className="w-full border rounded-lg px-4 py-2 shadow focus:ring-2 focus:outline-none text-black placeholder:text-gray-400 transition-all"
                style={{
                  borderColor: TEXT_MUTED + "40",
                  backgroundColor: "#F9FAFB",
                }}
              />
=======
              <label htmlFor="password" className="block text-sm font-semibold text-[#0B1A63] mb-1">
                Password<span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPwd ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange}
                  required
                  placeholder="Password"
                  className="w-full border border-gray-300 rounded-md px-4 py-2 shadow-sm focus:ring-2 focus:ring-[#0B1A63]/30 focus:outline-none text-black placeholder:text-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute inset-y-0 right-0 px-3 text-[#0B1A63]/70 hover:text-[#0B1A63]"
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    {showPwd ? (
                      <path d="M3.53 2.47 2.47 3.53 5.3 6.36A11.88 11.88 0 0 0 1.2 12c2.15 4.32 6.54 7.25 10.8 7.25 2.08 0 4.2-.6 6.06-1.75l2.41 2.41 1.06-1.06-18-18ZM12 17.25A5.25 5.25 0 0 1 6.75 12c0-.87.21-1.7.58-2.42l1.6 1.6A3.252 3.252 0 0 0 12 15.25c.73 0 1.4-.24 1.94-.65l1.6 1.6c-.72.37-1.55.58-2.54.58Zm0-10.5c4.26 0 8.65 2.93 10.8 7.25-.66 1.33-1.6 2.5-2.67 3.49l-2.38-2.38c.28-.64.45-1.35.45-2.11A5.25 5.25 0 0 0 12 6.75c-.76 0-1.47.16-2.11.45L7.5 4.81c1.13-.38 2.35-.56 3.5-.56Z" />
                    ) : (
                      <path d="M12 5.25c-4.26 0-8.65 2.93-10.8 7.25 2.15 4.32 6.54 7.25 10.8 7.25s8.65-2.93 10.8-7.25C20.65 8.18 16.26 5.25 12 5.25Zm0 12A4.75 4.75 0 1 1 12 7.75a4.75 4.75 0 0 1 0 9.5Zm0-2a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5Z" />
                    )}
                  </svg>
                </button>
              </div>
>>>>>>> 519872a94f21585a12580fd5841b613a64b846ca
            </div>

            {/* Confirm Password */}
            <div>
<<<<<<< HEAD
              <label
                className="block text-sm font-semibold mb-1"
                style={{ color: TEXT_DARK }}
              >
                Confirm Password<span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                placeholder="Re-enter password"
                className="w-full border rounded-lg px-4 py-2 shadow focus:ring-2 focus:outline-none text-black placeholder:text-gray-400 transition-all"
                style={{
                  borderColor: TEXT_MUTED + "40",
                  backgroundColor: "#F9FAFB",
                }}
              />
=======
              <label htmlFor="confirmPassword" className="block text-sm font-semibold text-[#0B1A63] mb-1">
                Confirm Password<span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPwd2 ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  placeholder="Confirm Password"
                  className="w-full border border-gray-300 rounded-md px-4 py-2 shadow-sm focus:ring-2 focus:ring-[#0B1A63]/30 focus:outline-none text-black placeholder:text-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd2(v => !v)}
                  className="absolute inset-y-0 right-0 px-3 text-[#0B1A63]/70 hover:text-[#0B1A63]"
                  aria-label={showPwd2 ? 'Hide password' : 'Show password'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    {showPwd2 ? (
                      <path d="M3.53 2.47 2.47 3.53 5.3 6.36A11.88 11.88 0 0 0 1.2 12c2.15 4.32 6.54 7.25 10.8 7.25 2.08 0 4.2-.6 6.06-1.75l2.41 2.41 1.06-1.06-18-18ZM12 17.25A5.25 5.25 0 0 1 6.75 12c0-.87.21-1.7.58-2.42l1.6 1.6A3.252 3.252 0 0 0 12 15.25c.73 0 1.4-.24 1.94-.65l1.6 1.6c-.72.37-1.55.58-2.54.58Zm0-10.5c4.26 0 8.65 2.93 10.8 7.25-.66 1.33-1.6 2.5-2.67 3.49l-2.38-2.38c.28-.64.45-1.35.45-2.11A5.25 5.25 0 0 0 12 6.75c-.76 0-1.47.16-2.11.45L7.5 4.81c1.13-.38 2.35-.56 3.5-.56Z" />
                    ) : (
                      <path d="M12 5.25c-4.26 0-8.65 2.93-10.8 7.25 2.15 4.32 6.54 7.25 10.8 7.25s8.65-2.93 10.8-7.25C20.65 8.18 16.26 5.25 12 5.25Zm0 12A4.75 4.75 0 1 1 12 7.75a4.75 4.75 0 0 1 0 9.5Zm0-2a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5Z" />
                    )}
                  </svg>
                </button>
              </div>
>>>>>>> 519872a94f21585a12580fd5841b613a64b846ca
            </div>

            {/* Submit */}
            <button
              type="submit"
<<<<<<< HEAD
              className="w-full py-3 rounded-lg font-semibold text-lg shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ backgroundColor: TEXT_BLUE, color: "white" }}
            >
              Create Account
=======
              disabled={isLoading}
              className="w-full bg-[#0B1A63] text-white font-semibold py-2.5 rounded-md hover:opacity-90 disabled:opacity-60 shadow-md transition"
            >
              {isLoading ? 'Creating account…' : 'Sign Up'}
>>>>>>> 519872a94f21585a12580fd5841b613a64b846ca
            </button>

            <div
              className="text-center mt-2 text-sm"
              style={{ color: TEXT_MUTED }}
            >
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold hover:underline"
                style={{ color: TEXT_BLUE }}
              >
                Login
              </Link>
            </div>
          </form>
<<<<<<< HEAD
=======

          {/* Google */}
          <div className="mt-4 text-center">
            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="text-sm text-[#0B1A63] underline hover:opacity-80 disabled:opacity-60"
            >
              Continue with Google
            </button>
          </div>

          {/* Login link */}
          <p className="mt-6 text-center text-sm text-[#5D5D5D]">
            Already have an account?{' '}
            <Link href="/login" className="text-[#F2A33C] font-semibold hover:underline">
              Login
            </Link>
          </p>
>>>>>>> 519872a94f21585a12580fd5841b613a64b846ca
        </section>
      </div>
    </main>
  );
}
