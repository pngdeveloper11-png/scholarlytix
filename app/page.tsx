"use client";

import { useEffect, useId, useRef } from "react";
import Lenis from "lenis";
import { WM } from "./wordmark-data";
import Link from "next/link";
import { Sora, Fraunces } from "next/font/google";
import { motion, useScroll, useTransform, useSpring, useMotionValue, useReducedMotion, AnimatePresence, MotionValue } from "framer-motion";
import { useState } from "react";
import {
  Building2, ShieldCheck, QrCode, Sparkles, GraduationCap, ClipboardCheck,
  CalendarDays, Users, BookOpen, ArrowRight,
} from "lucide-react";

const sora = Sora({ subsets: ["latin"], weight: ["400", "600", "800"] });
const serif = Fraunces({ subsets: ["latin"], weight: ["600"] });

// Change to your real college registration route
const REGISTER_HREF = "/register";
// Where existing users sign in. "/" is your current login page.
const SIGN_IN_HREF = "/";

const RAW = [
  { icon: Building2, title: "Isolated college vaults", text: "Every college gets its own private database and its own brand colors. No data ever crosses campuses.", tags: ["Founder approval queue", "1-click legacy migration", "Android ↔ Web live sync"] },
  { icon: ShieldCheck, title: "Security & access", text: "Biometric lock, remote logout, and a role builder with 9 permission areas for Dean, Exam Cell, HOD and more.", tags: ["Custom designations", "Remote session kill", "Anonymous grievances"] },
  { icon: QrCode, title: "Gate & campus operations", text: "Hardware-locked digital ID, HOD-approved gate passes that burn on scan, and a PIN-protected guard kiosk.", tags: ["Rotating 10s QR", "Anti-screenshot ID", "Parent exit alerts"] },
  { icon: Sparkles, title: "Gemini AI automation", text: "Upload a timetable photo or a marks sheet. AI maps it to your real subjects and roll numbers.", tags: ["Timetable extraction", "Marks parsing", "Lecture summaries"] },
  { icon: ClipboardCheck, title: "Faculty & attendance", text: "Drag-to-select attendance that works offline, a leave chain from HOD to Principal, and a lecture proxy market.", tags: ["Offline sync", "CSV / PDF / WhatsApp export", "Defaulter engine"] },
  { icon: GraduationCap, title: "Tests with anti-cheat", text: "Timed quizzes with code snippets. Screens are blocked and answers stay locked until the deadline passes.", tags: ["Tab-switch blur", "Screenshot block", "Post-deadline reveal"] },
  { icon: BookOpen, title: "Library & study materials", text: "Students borrow with a single-use QR. Librarians scan, verify stock and issue the book. Notes and papers open in-app.", tags: ["Waitlists", "Overdue emails", "Lost & found"] },
  { icon: CalendarDays, title: "Events & calendar", text: "Seat-limited events with safe one-tap RSVP, plus one calendar for exams, holidays, deadlines and events.", tags: ["No overbooking", "Attendee CSV", "Unified calendar"] },
  { icon: Users, title: "Student & parent portals", text: "Students see attendance and IAT marks. Up to two parents get read-only access, and students can revoke it any time.", tags: ["OTP linking", "Instant revoke", "Push alerts"] },
];

// Tints stay inside the app palette: purples, plus the app's success green and danger red.
const HUES = [
  ["#4F378B", "#D0BCFF"], ["#2E7D32", "#81C784"], ["#D32F2F", "#FF8A80"],
  ["#7C4DFF", "#D0BCFF"], ["#5E35B1", "#B39DDB"], ["#512DA8", "#B39DDB"],
  ["#388E3C", "#A5D6A7"], ["#7B1FA2", "#E1BEE7"], ["#4F378B", "#D0BCFF"],
];
const FEATURES = RAW.map((f, i) => ({ ...f, hue: HUES[i] }));

const smooth = (v: MotionValue<number>) => useSpring(v, { stiffness: 260, damping: 38, mass: 0.35 });

/** Eases mouse-wheel scrolling so it feels smooth on desktop browsers. */
function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ lerp: 0.1 });
    let id = requestAnimationFrame(function raf(t) { lenis.raf(t); id = requestAnimationFrame(raf); });
    return () => { cancelAnimationFrame(id); lenis.destroy(); };
  }, []);
  return null;
}

/** The glass-script wordmark, built from the traced pen strokes. With `write`, each stroke is drawn left to right. */
function Wordmark({ write = false }: { write?: boolean }) {
  const u = useId().replace(/:/g, "");
  const { w, h, sw, paths } = WM;
  const stroke = (width: number, paint: string, extra: React.SVGProps<SVGPathElement> = {}) =>
    paths.map((p, i) => (
      <path key={i} d={p.d} pathLength={1} fill="none" stroke={paint} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round"
        className={write ? "wp" : undefined}
        style={write ? ({ "--d": `${(0.2 + (p.x / w) * 2.5).toFixed(2)}s`, "--t": `${Math.max(0.22, p.len / 820).toFixed(2)}s` } as React.CSSProperties) : undefined}
        {...extra} />
    ));
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Scholarlytix" className="block w-full overflow-visible">
      <defs>
        <linearGradient id={`g${u}`} gradientUnits="userSpaceOnUse" x1="0" x2={w} y1="0" y2="0">
          <stop offset="0" stopColor="#6C8BFF" /><stop offset=".3" stopColor="#A895FF" /><stop offset=".5" stopColor="#FF9ECF" />
          <stop offset=".62" stopColor="#FFB38A" /><stop offset=".78" stopColor="#C48BFF" /><stop offset="1" stopColor="#8F7BFF" />
        </linearGradient>
        <linearGradient id={`t${u}`} gradientUnits="userSpaceOnUse" x1="0" x2={w} y1="0" y2="0">
          <stop offset="0" stopColor="#7FA0FF" stopOpacity=".65" /><stop offset=".5" stopColor="#FFB3DA" stopOpacity=".6" /><stop offset="1" stopColor="#9C8BFF" stopOpacity=".65" />
        </linearGradient>
        <filter id={`b${u}`} x="-5%" y="-20%" width="110%" height="140%"><feGaussianBlur stdDeviation="16" /></filter>
      </defs>
      <g opacity=".5" filter={`url(#b${u})`}>{stroke(sw * 2.4, `url(#g${u})`)}</g>
      <g>{stroke(sw + 2, `url(#g${u})`)}</g>
      <g>{stroke(sw - 6, "rgba(18,10,44,.45)")}</g>
      <g>{stroke(sw - 8, `url(#t${u})`)}</g>
      <g transform="translate(-2.5 -3.5)" opacity=".6">{stroke(1.6, "#fff")}</g>
    </svg>
  );
}

/** Soft light that follows the mouse on desktop. */
function CursorGlow() {
  const x = useMotionValue(-600), y = useMotionValue(-600);
  const sx = useSpring(x, { stiffness: 120, damping: 20, mass: 0.5 });
  const sy = useSpring(y, { stiffness: 120, damping: 20, mass: 0.5 });
  const rm = useReducedMotion();
  useEffect(() => {
    if (rm) return;
    const m = (e: PointerEvent) => { x.set(e.clientX - 300); y.set(e.clientY - 300); };
    window.addEventListener("pointermove", m, { passive: true });
    return () => window.removeEventListener("pointermove", m);
  }, [x, y, rm]);
  if (rm) return null;
  return <motion.div aria-hidden style={{ x: sx, y: sy, background: "radial-gradient(circle, rgba(156,132,214,.18), transparent 65%)" }}
    className="pointer-events-none fixed left-0 top-0 z-[5] hidden h-[600px] w-[600px] rounded-full md:block" />;
}

/** Buttons lean toward the cursor. */
function Magnetic({ children }: { children: React.ReactNode }) {
  const rm = useReducedMotion();
  const x = useMotionValue(0), y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 16 }), sy = useSpring(y, { stiffness: 220, damping: 16 });
  return (
    <motion.div style={{ x: sx, y: sy }} className="inline-block"
      onPointerMove={(e) => { if (rm) return; const r = e.currentTarget.getBoundingClientRect(); x.set((e.clientX - r.left - r.width / 2) * 0.25); y.set((e.clientY - r.top - r.height / 2) * 0.35); }}
      onPointerLeave={() => { x.set(0); y.set(0); }}>
      {children}
    </motion.div>
  );
}

const ROLES: Record<string, string[]> = {
  Students: ["Live attendance with subject-wise percentages", "Rotating-QR digital ID that blocks screenshots", "Gate pass, library borrow pass and event RSVP in one app", "Tests scored instantly, answers revealed after the deadline"],
  Faculty: ["Drag-to-select attendance that works offline", "One-tap leave requests and the lecture proxy market", "AI reads timetables and marks sheets for you", "Export to CSV, Excel, PDF or a WhatsApp summary"],
  "HOD & admin": ["Approve gate passes and multi-level leave requests", "Build custom roles with 9 permission areas", "Promote whole divisions to the next semester", "Defaulters flagged automatically every 12 hours"],
  Parents: ["Read-only view of attendance and marks", "Instant alert when your child leaves campus", "Linked by OTP, and the student can revoke access", "Works on your own phone"],
  "Guards & librarians": ["PIN-protected guard kiosk scans QR passes", "Verified student photo shown on every scan", "Librarians scan, check stock and issue books", "Waitlists and overdue emails run themselves"],
};

function Explorer() {
  const [role, setRole] = useState("Students");
  const keys = Object.keys(ROLES);
  const onKey = (e: React.KeyboardEvent) => {
    const i = keys.indexOf(role);
    const n = e.key === "ArrowRight" ? (i + 1) % keys.length : e.key === "ArrowLeft" ? (i + keys.length - 1) % keys.length : -1;
    if (n < 0) return;
    e.preventDefault();
    setRole(keys[n]);
    document.getElementById(`tab-${n}`)?.focus();
  };
  return (
    <section aria-labelledby="roles-h" className="mx-auto max-w-4xl px-6 pb-32">
      <h2 id="roles-h" className={`${serif.className} text-center text-3xl font-semibold md:text-5xl`}>See it from every seat</h2>
      <div role="tablist" aria-label="Choose a role" onKeyDown={onKey} className="mt-10 flex flex-wrap justify-center gap-2">
        {keys.map((r, i) => (
          <button key={r} id={`tab-${i}`} role="tab" aria-selected={role === r} aria-controls="role-panel" tabIndex={role === r ? 0 : -1}
            onClick={() => setRole(r)} className="relative min-h-[44px] rounded-full px-5 text-sm font-semibold text-white/85 transition hover:text-white">
            {role === r && <motion.span layoutId="role-pill" transition={{ type: "spring", stiffness: 380, damping: 32 }} className="absolute inset-0 rounded-full bg-[#4F378B]" />}
            <span className="relative">{r}</span>
          </button>
        ))}
      </div>
      <div id="role-panel" role="tabpanel" aria-labelledby={`tab-${keys.indexOf(role)}`} className="glow-card relative mt-8 min-h-[300px] rounded-3xl p-8 md:p-10">
        <AnimatePresence mode="wait">
          <motion.ul key={role} initial="h" animate="s" exit="x" variants={{ s: { transition: { staggerChildren: 0.07 } } }} className="grid gap-4 md:grid-cols-2">
            {ROLES[role].map((t) => (
              <motion.li key={t} variants={{ h: { opacity: 0, y: 16 }, s: { opacity: 1, y: 0 }, x: { opacity: 0, transition: { duration: 0.12 } } }}
                className="rounded-2xl border border-white/10 bg-white/5 p-5 text-base leading-relaxed text-white/90">{t}</motion.li>
            ))}
          </motion.ul>
        </AnimatePresence>
      </div>
    </section>
  );
}

const CSS = `
a:focus-visible,button:focus-visible{outline:3px solid #FFB020;outline-offset:3px;border-radius:9999px}
.intro{position:fixed;inset:0;z-index:80;animation:introHide 0s linear 5s forwards}
.intro-bg{position:absolute;inset:0;background:radial-gradient(70% 45% at 50% 0%,rgba(156,132,214,.28),transparent 70%),radial-gradient(60% 40% at 50% 100%,rgba(79,55,139,.3),transparent 70%),#07050C;animation:introBg 1.4s ease 3.6s forwards}
.intro-word,.hero-mark{position:absolute;left:50%;top:9vh;width:min(78vw,420px);margin-left:calc(min(78vw,420px) / -2);filter:drop-shadow(0 0 22px rgba(208,188,255,.45))}
.intro-word{transform-origin:50% 0;--s:1.13;--dy:calc(41vh - 64px);animation:introMove 1.8s cubic-bezier(.65,0,.35,1) 3.2s both}
@media(min-width:768px){.intro-word{--s:2.6;--dy:calc(41vh - 205px)}}
.wp{stroke-dasharray:1 1;stroke-dashoffset:1;animation:draw var(--t) cubic-bezier(.4,.1,.3,1) var(--d) forwards}
.intro-skip{position:absolute;bottom:32px;left:50%;transform:translateX(-50%);animation:introBg .4s ease 3s forwards}
.hero-mark{animation:markIn 0s linear 5s both}
.intro-off .intro{display:none}.intro-off .hero-mark{animation:none}
@keyframes draw{to{stroke-dashoffset:0}}
@keyframes introMove{from{transform:translateY(var(--dy)) scale(var(--s))}to{transform:none}}
@keyframes introBg{to{opacity:0}}
@keyframes introHide{to{visibility:hidden}}
@keyframes markIn{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion:reduce){.intro{display:none}.hero-mark{animation:none}}
html.lenis{height:auto}.lenis.lenis-smooth{scroll-behavior:auto!important}
.glow-card{border:1px solid transparent;background:linear-gradient(#110E1A,#110E1A) padding-box,linear-gradient(135deg,rgba(208,188,255,.5),rgba(79,55,139,.12) 45%,rgba(255,255,255,.06)) border-box}
.glow-card::before,.glow-card::after{content:"";position:absolute;inset:-1px;border-radius:inherit;pointer-events:none;opacity:0;transition:opacity .3s}
.glow-card::before{padding:1px;background:radial-gradient(260px circle at var(--mx,50%) var(--my,50%),#D0BCFF,transparent 62%);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}
.glow-card::after{inset:0;background:radial-gradient(320px circle at var(--mx,50%) var(--my,50%),rgba(208,188,255,.09),transparent 60%)}
.glow-card:hover::before,.glow-card:hover::after{opacity:1}
@property --a{syntax:"<angle>";initial-value:0deg;inherits:false}
.beam{border:1px solid transparent;background:linear-gradient(135deg,#241747,#120D1F) padding-box,conic-gradient(from var(--a),rgba(208,188,255,.1) 0 60%,#FFB020 85%,rgba(208,188,255,.1)) border-box;animation:beam 7s linear infinite}
@keyframes beam{to{--a:360deg}}
@media (prefers-reduced-motion:reduce){.beam{animation:none}}
`;

/** Scroll-scrubbed 3D card: tilts in from depth, settles, tilts away. Runs in reverse when scrolling up. */
function Depth({ children, i = 0 }: { children: React.ReactNode; i?: number }) {
  const rm = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const p = smooth(scrollYProgress);
  const side = i % 2 ? 1 : -1;
  const rotateX = useTransform(p, [0, 0.3, 0.7, 1], [38, 0, 0, -26]);
  const rotateY = useTransform(p, [0, 0.3, 0.7, 1], [18 * side, 0, 0, -14 * side]);
  const z = useTransform(p, [0, 0.3, 0.7, 1], [-320, 0, 0, -240]);
  const y = useTransform(p, [0, 0.3, 0.7, 1], [120, 0, 0, -80]);
  const opacity = useTransform(p, [0, 0.22, 0.78, 1], [0, 1, 1, 0]);
  if (rm) return <div ref={ref} className="h-full">{children}</div>;
  return (
    <div ref={ref} style={{ perspective: 1200 }} className="h-full">
      <motion.div className="h-full" style={{ rotateX, rotateY, z, y, opacity, willChange: "transform, opacity" }}>
        {children}
      </motion.div>
    </div>
  );
}

function Card({ f, className = "" }: { f: (typeof FEATURES)[number]; className?: string }) {
  const Icon = f.icon;
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  return (
    <div onPointerMove={onMove} className={`glow-card relative flex flex-col rounded-3xl p-7 shadow-[0_30px_80px_-30px_rgba(79,55,139,.8)] ${className}`}>
      <div style={{ background: `linear-gradient(135deg, rgba(255,255,255,.45), rgba(255,255,255,0)), ${f.hue[1]}` }} className="mb-5 grid h-12 w-12 place-items-center rounded-2xl text-[#1D1033]">
        <Icon size={24} aria-hidden="true" />
      </div>
      <h3 className="text-xl font-semibold text-white">{f.title}</h3>
      <p className="mt-2 text-base leading-relaxed text-white/70">{f.text}</p>
      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        {f.tags.map((t) => (
          <span key={t} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[13px] text-white/80">{t}</span>
        ))}
      </div>
    </div>
  );
}

/** Hero: copy on top, a stack of product cards below that fans out in 3D as you scroll. */
function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const p = smooth(scrollYProgress);
  const rm = useReducedMotion();
  const mx = useMotionValue(0), my = useMotionValue(0);
  const mry = useSpring(useTransform(mx, [-0.5, 0.5], [-9, 9]), { stiffness: 90, damping: 18 });
  const mrx = useSpring(useTransform(my, [-0.5, 0.5], [5, -5]), { stiffness: 90, damping: 18 });
  const rx0 = useTransform(p, [0, 1], [24, 58]);
  const rotateX = useTransform([rx0, mrx], ([a, b]: number[]) => a + b);
  const rotateZ = useTransform(p, [0, 1], [-4, 8]);
  const scale = useTransform(p, [0, 1], [1, 0.85]);
  const l1 = useTransform(p, [0, 1], [-30, -300]);
  const l2 = useTransform(p, [0, 1], [0, 110]);
  const l3 = useTransform(p, [0, 1], [30, 300]);
  const textY = useTransform(p, [0, 1], [0, -140]);
  const textO = useTransform(p, [0, 0.5], [1, 0]);
  const layers = [
    { y: l1, label: "Attendance", sub: "92% overall", c: "from-[#4F378B] to-[#6B4FBB] text-white" },
    { y: l2, label: "Gate pass", sub: "Valid until 11:59 PM", c: "from-[#D0BCFF] to-[#9C84D6] text-[#1D1033]" },
    { y: l3, label: "AI timetable", sub: "12 slots mapped", c: "from-[#2A1F4D] to-[#4F378B] text-[#D0BCFF]" },
  ];
  return (
    <section ref={ref} className={`relative ${rm ? "min-h-screen" : "h-[170vh]"}`}>
      <div className={rm ? "relative min-h-screen" : "sticky top-0 h-screen overflow-hidden"} onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); mx.set((e.clientX - r.left) / r.width - 0.5); my.set((e.clientY - r.top) / r.height - 0.5); }}>
        <div className="hero-mark z-10"><motion.div style={rm ? undefined : { y: textY, opacity: textO }}><Wordmark /></motion.div></div>
        <motion.div style={rm ? undefined : { y: textY, opacity: textO }} className="absolute inset-x-0 top-[28vh] z-10 mx-auto max-w-3xl px-6 text-center">
          <h1 className={`${serif.className} text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl md:text-6xl`}>
            One platform for your whole campus.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-white/70 md:text-lg">
            Attendance, gate security, tests, library, parents and AI tools. Built for colleges, on Android and the web.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Magnetic><Link href={REGISTER_HREF} className="inline-flex items-center gap-2 rounded-full bg-[#FFB020] px-7 py-3.5 font-semibold text-[#2B1A00] shadow-[0_0_44px_-6px_rgba(255,176,32,.55)] transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
              Register your college <ArrowRight size={18} />
            </Link></Magnetic>
            <a href="#features" className="rounded-full border border-white/30 px-7 py-3.5 font-semibold text-white transition hover:bg-white/10">
              See all features
            </a>
          </div>
        </motion.div>
        {!rm && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[74vh] grid md:top-[68vh] place-items-center" style={{ perspective: 1100 }}>
          <motion.div style={{ rotateX, rotateY: mry, rotateZ, scale, transformStyle: "preserve-3d" }} className="relative h-[240px] w-[min(86vw,540px)]">
            {layers.map((l, i) => (
              <motion.div key={l.label} style={{ y: l.y, z: i * 60 }}
                className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${l.c} p-7 shadow-2xl`}>
                <div className="text-2xl font-bold">{l.label}</div>
                <div className="mt-1 font-semibold opacity-90">{l.sub}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>}
      </div>
    </section>
  );
}

/** One card in the pinned carousel. The focused card sits flat so its text stays sharp. */
function RingCard({ f, i, p }: { f: (typeof FEATURES)[number]; i: number; p: MotionValue<number> }) {
  const n = FEATURES.length;
  // Dwell on each card, then glide to the next: keeps the focused card flat for most of the scroll.
  const d = useTransform(p, (v) => {
    const a = v * (n - 1), k = Math.floor(a);
    const t = Math.min(1, Math.max(0, (a - k - 0.3) / 0.4));
    return i - (k + t * t * (3 - 2 * t));
  });
  const x = useTransform(d, (v) => v * 400);
  const rotateY = useTransform(d, (v) => Math.max(-1, Math.min(1, v)) * 38);
  const z = useTransform(d, (v) => -Math.min(Math.abs(v), 2) * 220);
  const opacity = useTransform(d, (v) => Math.max(0, 1 - Math.abs(v) * 0.45));
  return (
    <motion.div style={{ x, rotateY, z, opacity, marginLeft: "calc(min(340px, 86vw) / -2)" }} className="absolute left-1/2 top-0 w-[min(340px,86vw)]">
      <Card f={f} className="h-[440px]" />
    </motion.div>
  );
}

/** Pinned carousel: scroll to move through every feature, scroll back to return. */
function Ring() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const p = smooth(scrollYProgress);
  const rm = useReducedMotion();
  if (rm) return (
    <section ref={ref} aria-labelledby="ring-h" className="mx-auto max-w-6xl px-6 py-24">
      <h2 id="ring-h" className={`${serif.className} mb-12 text-center text-3xl font-semibold md:text-5xl`}>Everything a campus runs on</h2>
      <div className="grid gap-6 md:grid-cols-3">{FEATURES.map((f) => <Card key={f.title} f={f} />)}</div>
    </section>
  );
  return (
    <section ref={ref} aria-labelledby="ring-h" className="relative h-[450vh]">
      <div className="sticky top-0 grid h-screen place-content-center overflow-hidden">
        <h2 id="ring-h" className={`${serif.className} mb-14 px-6 text-center text-3xl font-semibold text-white md:text-5xl`}>
          Everything a campus runs on
        </h2>
        <div className="relative h-[440px] w-screen" style={{ perspective: 1400 }}>
          {FEATURES.map((f, i) => <RingCard key={f.title} f={f} i={i} p={p} />)}
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const { scrollYProgress } = useScroll();
  const bar = useSpring(scrollYProgress, { stiffness: 200, damping: 30 });
  const { scrollY } = useScroll();
  const logoO = useTransform(scrollY, [140, 280], [0, 1]);
  const [introOff, setIntroOff] = useState(false);
  const endIntro = () => {
    try { sessionStorage.setItem("sx-intro", "1"); } catch {}
    document.documentElement.style.overflow = "";
    setIntroOff(true);
  };
  useEffect(() => {
    let seen = false;
    try { seen = !!sessionStorage.getItem("sx-intro"); } catch {}
    if (seen || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setIntroOff(true); return; }
    const html = document.documentElement;
    html.style.overflow = "hidden";
    const t = setTimeout(() => { try { sessionStorage.setItem("sx-intro", "1"); } catch {} html.style.overflow = ""; }, 5000);
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") endIntro(); };
    window.addEventListener("keydown", esc);
    return () => { clearTimeout(t); html.style.overflow = ""; window.removeEventListener("keydown", esc); };
  }, []);
  return (
    <div className={`${sora.className} relative min-h-screen overflow-x-clip bg-[#07050C] [text-rendering:geometricPrecision] antialiased text-white ${introOff ? "intro-off" : ""}`}>
      <style>{CSS}</style>
      <div className="intro">
        <div className="intro-bg" />
        <div className="intro-word" aria-hidden="true"><Wordmark write /></div>
        <button onClick={endIntro} className="intro-skip min-h-[44px] rounded-full border border-white/30 px-5 text-sm font-semibold text-white/90 hover:bg-white/10">Skip intro</button>
      </div>
      <SmoothScroll />
      <CursorGlow />
      <motion.div aria-hidden style={{ scaleX: bar }} className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-[#FFB020]" />
      {/* static backdrop: no animated blur, so scrolling stays at 60fps */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-0"
        style={{ background: "radial-gradient(70% 45% at 50% 0%, rgba(156,132,214,.28), transparent 70%), radial-gradient(60% 40% at 50% 100%, rgba(79,55,139,.30), transparent 70%)" }} />
      <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-full focus:bg-[#FFB020] focus:px-5 focus:py-3 focus:font-semibold focus:text-[#2B1A00]">Skip to main content</a>
      <header className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 py-4 backdrop-blur-md border-b border-white/5 bg-[#07050C]/90 md:px-12">
        <motion.span style={{ opacity: logoO }} className="text-xl font-extrabold tracking-tight">Scholarlytix</motion.span>
        <div className="flex items-center gap-2">
          <Link href={SIGN_IN_HREF} className="inline-flex min-h-[44px] items-center rounded-full px-4 text-sm font-semibold text-white/90 hover:bg-white/10">Sign in</Link>
        <Link href={REGISTER_HREF} className="inline-flex min-h-[44px] items-center rounded-full bg-[#FFB020] px-5 text-sm font-semibold text-[#2B1A00] transition hover:bg-[#FFC24D]">
          Register your college
        </Link>
        </div>
      </header>

      <main id="content" className="relative z-10">
        <Hero />
        <Ring />

        <section id="features" className="mx-auto max-w-6xl px-6 py-24">
          <h2 className={`${serif.className} mx-auto max-w-2xl text-center text-3xl font-semibold md:text-5xl`}>
            Built for the people who run a college
          </h2>
          <div className="mt-24 grid gap-x-10 gap-y-16 md:grid-cols-2">
            {FEATURES.map((f, i) => (
              <Depth key={f.title} i={i}><Card f={f} className="h-full" /></Depth>
            ))}
          </div>
        </section>

        <Explorer />

        <section className="rounded-[2.5rem] bg-[#F8F9FA] px-6 py-28 text-[#1D1033] md:rounded-[3.5rem]">
          <div className="mx-auto max-w-5xl">
          <h2 className={`${serif.className} text-center text-3xl font-semibold md:text-5xl`}>Live on your campus in three steps</h2>
          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {[
              ["1", "Register your college", "Send your college name and admin email through the registration form."],
              ["2", "Get approved", "The Scholarlytix founder team reviews and approves your college."],
              ["3", "Go live", "You get a private vault with your brand colors, on Android and the web."],
            ].map(([n, t, d], i) => (
              <Depth key={n} i={i}>
                <div className="h-full rounded-3xl border border-[#4F378B]/10 bg-white p-7 shadow-[0_24px_50px_-24px_rgba(79,55,139,.4)]">
                  <div className="mb-4 grid h-9 w-9 place-items-center rounded-full bg-[#4F378B] font-bold text-white">{n}</div>
                  <h3 className="text-lg font-semibold">{t}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-[#4A4458]">{d}</p>
                </div>
              </Depth>
            ))}
          </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-6 pb-24 pt-28">
          <Depth>
            <div className="beam rounded-[2rem] p-10 text-center md:p-16">
              <h2 className={`${serif.className} text-3xl font-semibold md:text-5xl`}>Bring your college onto Scholarlytix</h2>
              <p className="mx-auto mt-4 max-w-lg text-white/70">
                Register your college, get approved by the founder team, and start with your own isolated vault and brand colors.
              </p>
              <div className="mt-8"><Magnetic><Link href={REGISTER_HREF} className="inline-flex items-center gap-2 rounded-full bg-[#FFB020] px-8 py-4 font-semibold text-[#2B1A00] shadow-[0_0_44px_-6px_rgba(255,176,32,.5)] transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
                Register your college <ArrowRight size={18} />
              </Link></Magnetic></div>
            </div>
          </Depth>
        </section>
      </main>
      <footer className="relative z-10 border-t border-white/10 px-6 py-8 text-center text-sm text-white/65">
        © {new Date().getFullYear()} Scholarlytix. Campus management for colleges.
      </footer>
    </div>
  );
}
