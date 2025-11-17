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

const WaveIcon = ({ color }: { color: string }) => (
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

export default function LoginPage() {
  const router = useRouter();

  return (
    <main
      className="min-h-screen flex items-center justify-center p-6 relative"
      style={{ backgroundColor: HERO_BG }}
    >
      {/* 🔵 BACK BUTTON — SAME STYLE AS REGISTER */}
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
            Welcome
            <br /> Back
          </h1>

          <div
            className="h-1 w-20 rounded-full mt-4 mb-6"
            style={{ backgroundColor: TEXT_BLUE }}
          ></div>

          <p
            className="text-base max-w-md leading-relaxed"
            style={{ color: TEXT_MUTED }}
          >
            Login to your account to access smart voice tools, personalized
            features, and your dashboard.
          </p>

          <WaveIcon color={TEXT_BLUE} />
        </section>

        {/* RIGHT SECTION — LOGIN FORM */}
        <section className="flex flex-col justify-center px-10 md:px-14 py-10 bg-white">
          <h2
            className="text-3xl font-bold mb-6 text-center md:text-left"
            style={{ color: TEXT_BLUE }}
          >
            Sign In
          </h2>

          <form className="space-y-4">
            <div>
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
              />
            </div>

            <div>
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
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-lg font-semibold text-lg shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ backgroundColor: TEXT_BLUE, color: "white" }}
            >
              Login
            </button>

            <div
              className="text-center mt-2 text-sm"
              style={{ color: TEXT_MUTED }}
            >
              Don’t have an account?{" "}
              <Link
                href="/register"
                className="font-semibold hover:underline"
                style={{ color: TEXT_BLUE }}
              >
                Register
              </Link>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
