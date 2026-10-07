"use client";

import { createContext, useContext, useEffect, useId, useRef } from "react";
import Lenis from "lenis";
import { WM } from "./wordmark-data";
import Link from "next/link";
import { Sora, Fraunces } from "next/font/google";
import { motion, useScroll, useTransform, useSpring, useMotionValue, useMotionValueEvent, useVelocity, useReducedMotion, AnimatePresence, MotionValue } from "framer-motion";
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
      <Float speed={0.5}><h2 id="roles-h" className={`${serif.className} text-center text-3xl font-semibold md:text-5xl`}>See it from every seat</h2></Float>
      <div role="tablist" aria-label="Choose a role" onKeyDown={onKey} className="mt-10 flex flex-wrap justify-center gap-2">
        {keys.map((r, i) => (
          <button key={r} id={`tab-${i}`} role="tab" aria-selected={role === r} aria-controls="role-panel" tabIndex={role === r ? 0 : -1}
            onClick={() => setRole(r)} className="relative min-h-[44px] rounded-full px-5 text-sm font-semibold text-white/85 transition hover:text-white">
            {role === r && <motion.span layoutId="role-pill" transition={{ type: "spring", stiffness: 380, damping: 32 }} className="absolute inset-0 rounded-full bg-[#4F378B]" />}
            <span className="relative">{r}</span>
          </button>
        ))}
      </div>
      <div id="role-panel" role="tabpanel" aria-labelledby={`tab-${keys.indexOf(role)}`} className="glass mt-8 min-h-[300px] rounded-3xl p-8 md:p-10">
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
.glass{position:relative;background:linear-gradient(145deg,rgba(255,255,255,.14),rgba(255,255,255,.04) 45%,rgba(255,255,255,.08));-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.17);box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 34px 60px -30px rgba(0,0,0,.75)}
.glass::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;transition:opacity .3s;background:radial-gradient(300px circle at var(--mx,50%) var(--my,50%),rgba(208,188,255,.22),transparent 62%)}
*:hover>.glass::before,.glass:hover::before{opacity:1}
@media(max-width:767px){.glass{-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}}
@media(prefers-reduced-transparency:reduce){.glass{-webkit-backdrop-filter:none;backdrop-filter:none;background:#1B1527}}
@supports not (backdrop-filter:blur(1px)){.glass{background:rgba(27,21,39,.92)}}
@media(prefers-reduced-motion:reduce){@media (prefers-reduced-motion:reduce){`;

const FadeCtx = createContext<MotionValue<number> | null>(null);
const FxCtx = createContext<MotionValue<number> | null>(null);

/** Scroll-scrubbed 3D entrance: tilts in from depth, settles, tilts away, and reverses on the way up.
 *  Scroll speed adds a small extra tilt (the "4th dimension"). With `glass`, the fade is handed to the
 *  glass layers instead of an ancestor, because an ancestor with opacity would stop the blur from seeing the background. */
function Depth({ children, i = 0, glass = false }: { children: React.ReactNode; i?: number; glass?: boolean }) {
  const rm = useReducedMotion();
  const vel = useContext(FxCtx);
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const p = smooth(scrollYProgress);
  const side = i % 2 ? 1 : -1;
  const baseX = useTransform(p, [0, 0.3, 0.7, 1], [38, 0, 0, -26]);
  const rotateX = useTransform(vel ? [baseX, vel] : [baseX], (v: number[]) => v[0] + (v[1] === undefined ? 0 : Math.max(-9, Math.min(9, -v[1] / 260))));
  const rotateY = useTransform(p, [0, 0.3, 0.7, 1], [18 * side, 0, 0, -14 * side]);
  const z = useTransform(p, [0, 0.3, 0.7, 1], [-320, 0, 0, -240]);
  const y = useTransform(p, [0, 0.3, 0.7, 1], [120, 0, 0, -80]);
  const fade = useTransform(p, [0, 0.22, 0.78, 1], [0, 1, 1, 0]);
  if (rm) return <div ref={ref} className="h-full">{children}</div>;
  return (
    <div ref={ref} style={{ perspective: 1200 }} className="h-full">
      <motion.div className="h-full" style={{ rotateX, rotateY, z, y, transformStyle: "preserve-3d", willChange: "transform", ...(glass ? {} : { opacity: fade }) }}>
        {glass ? <FadeCtx.Provider value={fade}>{children}</FadeCtx.Provider> : children}
      </motion.div>
    </div>
  );
}

/** Pointer tilt: the element leans toward the cursor and its layers sit at different depths. */
function Tilt({ children, className = "", max = 11 }: { children: React.ReactNode; className?: string; max?: number }) {
  const rm = useReducedMotion();
  const rx = useMotionValue(0), ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 220, damping: 22 }), sry = useSpring(ry, { stiffness: 220, damping: 22 });
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
    if (!rm) { ry.set(px * max); rx.set(-py * max); }
  };
  return (
    <motion.div onPointerMove={move} onPointerLeave={() => { rx.set(0); ry.set(0); }}
      style={{ rotateX: srx, rotateY: sry, transformPerspective: 1000, transformStyle: "preserve-3d" }} className={`relative ${className}`}>
      {children}
    </motion.div>
  );
}

/** Frosted glass panel: the blur plate sits behind, the content floats above it. */
function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const fade = useContext(FadeCtx);
  return (
    <Tilt className={className}>
      <motion.div aria-hidden style={{ opacity: fade ?? 1 }} className="glass absolute inset-0 rounded-3xl" />
      <motion.div style={{ opacity: fade ?? 1 }} className="relative flex h-full flex-col p-7 [transform:translateZ(22px)] [transform-style:preserve-3d]">
        {children}
      </motion.div>
    </Tilt>
  );
}

function Card({ f, className = "" }: { f: (typeof FEATURES)[number]; className?: string }) {
  const Icon = f.icon;
  return (
    <GlassCard className={className}>
      <div style={{ background: `linear-gradient(135deg, rgba(255,255,255,.45), rgba(255,255,255,0)), ${f.hue[1]}` }} className="mb-5 grid h-12 w-12 place-items-center rounded-2xl text-[#1D1033] shadow-[0_12px_24px_-8px_rgba(0,0,0,.6)] [transform:translateZ(34px)]">
        <Icon size={24} aria-hidden="true" />
      </div>
      <h3 className="text-xl font-semibold text-white [transform:translateZ(22px)]">{f.title}</h3>
      <p className="mt-2 text-base leading-relaxed text-white/80 [transform:translateZ(10px)]">{f.text}</p>
      <div className="mt-auto flex flex-wrap gap-2 pt-5 [transform:translateZ(26px)]">
        {f.tags.map((t) => (
          <span key={t} className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[13px] text-white/90">{t}</span>
        ))}
      </div>
    </GlassCard>
  );
}

/** Slow vertical drift so headings sit on a different depth layer from the cards. */
function Float({ children, speed = 1, className = "" }: { children: React.ReactNode; speed?: number; className?: string }) {
  const rm = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [70 * speed, -70 * speed]);
  if (rm) return <div className={className}>{children}</div>;
  return <motion.div ref={ref} style={{ y }} className={className}>{children}</motion.div>;
}

/** Background that reacts to scroll (colour mood crossfades by section) and to the pointer (parallax). Transforms and opacity only. */
function ReactiveBackdrop() {
  const { scrollYProgress } = useScroll();
  const px = useMotionValue(0), py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 50, damping: 20 }), sy = useSpring(py, { stiffness: 50, damping: 20 });
  useEffect(() => {
    const m = (e: PointerEvent) => { px.set(e.clientX / window.innerWidth - 0.5); py.set(e.clientY / window.innerHeight - 0.5); };
    window.addEventListener("pointermove", m, { passive: true });
    return () => window.removeEventListener("pointermove", m);
  }, [px, py]);
  const aO = useTransform(scrollYProgress, [0, 0.3, 0.55], [1, 1, 0.25]);
  const bO = useTransform(scrollYProgress, [0.15, 0.45, 0.8], [0, 1, 0.25]);
  const cO = useTransform(scrollYProgress, [0.5, 0.8, 1], [0, 1, 1]);
  const y1 = useTransform(scrollYProgress, [0, 1], [0, -260]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const x1 = useTransform(sx, [-0.5, 0.5], [-70, 70]);
  const x2 = useTransform(sx, [-0.5, 0.5], [60, -60]);
  const yp = useTransform(sy, [-0.5, 0.5], [-50, 50]);
  const Blob = ({ c, className, style }: { c: string; className: string; style: React.ComponentProps<typeof motion.div>["style"] }) => (
    <motion.div style={style} className={`absolute rounded-full ${className}`}>
      <div className="h-full w-full rounded-full" style={{ background: `radial-gradient(circle, ${c}, transparent 62%)` }} />
    </motion.div>
  );
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <motion.div style={{ opacity: aO }} className="absolute inset-0">
        <Blob c="rgba(156,132,214,.5)" className="-right-[18vmax] -top-[22vmax] h-[62vmax] w-[62vmax]" style={{ x: x1, y: y1 }} />
        <Blob c="rgba(79,55,139,.55)" className="-bottom-[26vmax] -left-[20vmax] h-[66vmax] w-[66vmax]" style={{ x: x2, y: yp }} />
      </motion.div>
      <motion.div style={{ opacity: bO }} className="absolute inset-0">
        <Blob c="rgba(91,124,255,.40)" className="-left-[16vmax] top-[10vh] h-[58vmax] w-[58vmax]" style={{ x: x2, y: y2 }} />
      </motion.div>
      <motion.div style={{ opacity: cO }} className="absolute inset-0">
        <Blob c="rgba(255,158,199,.30)" className="-right-[14vmax] bottom-[-10vmax] h-[56vmax] w-[56vmax]" style={{ x: x1, y: y1 }} />
      </motion.div>
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
    { y: l1, label: "Attendance", sub: "92% overall", c: "from-[#4F378B]/85 to-[#6B4FBB]/85 text-white" },
    { y: l2, label: "Gate pass", sub: "Valid until 11:59 PM", c: "from-[#D0BCFF]/92 to-[#9C84D6]/92 text-[#1D1033]" },
    { y: l3, label: "AI timetable", sub: "12 slots mapped", c: "from-[#2A1F4D]/85 to-[#4F378B]/85 text-[#D0BCFF]" },
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
                className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${l.c} p-7 shadow-2xl border border-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,.35)]`}>
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

/** One card in the pinned carousel. `pos` is a spring-smoothed card index, so the motion stays fluid however you scroll. */
function RingCard({ f, i, pos }: { f: (typeof FEATURES)[number]; i: number; pos: MotionValue<number> }) {
  const d = useTransform(pos, (v) => i - v);
  const x = useTransform(d, (v) => v * 400);
  const rotateY = useTransform(d, (v) => Math.max(-1, Math.min(1, v)) * 34);
  const z = useTransform(d, (v) => -Math.min(Math.abs(v), 2) * 200);
  const fade = useTransform(d, (v) => Math.max(0, 1 - Math.abs(v) * 0.5));
  // Cards two or more places away are not drawn at all, which saves the blur work on the GPU.
  const visibility = useTransform(d, (v) => (Math.abs(v) >= 2 ? "hidden" : "visible"));
  return (
    <motion.div style={{ x, rotateY, z, visibility, transformStyle: "preserve-3d", willChange: "transform", marginLeft: "calc(min(340px, 86vw) / -2)" }} className="absolute left-1/2 top-0 w-[min(340px,86vw)]">
      <FadeCtx.Provider value={fade}><Card f={f} className="h-[440px]" /></FadeCtx.Provider>
    </motion.div>
  );
}

function Dot({ i, pos }: { i: number; pos: MotionValue<number> }) {
  const opacity = useTransform(pos, (v) => 0.3 + 0.7 * Math.max(0, 1 - Math.abs(v - i)));
  const width = useTransform(pos, (v) => 8 + 16 * Math.max(0, 1 - Math.abs(v - i)));
  return <motion.span style={{ opacity, width }} className="h-2 rounded-full bg-[#D0BCFF]" />;
}

/** Pinned carousel: scroll to move through every feature, scroll back to return.
 *  Scroll picks the target card, and a critically damped spring glides to it. The card in focus ends up perfectly flat and sharp. */
function Ring() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const rm = useReducedMotion();
  const n = FEATURES.length;
  const target = useMotionValue(0);
  const pos = useSpring(target, { stiffness: 130, damping: 24, mass: 1 });
  useMotionValueEvent(scrollYProgress, "change", (v) => target.set(Math.min(n - 1, Math.max(0, Math.round(v * (n - 1))))));
  if (rm) return (
    <section ref={ref} aria-labelledby="ring-h" className="mx-auto max-w-6xl px-6 py-24">
      <h2 id="ring-h" className={`${serif.className} mb-12 text-center text-3xl font-semibold md:text-5xl`}>Everything a campus runs on</h2>
      <div className="grid gap-6 md:grid-cols-3">{FEATURES.map((f) => <Card key={f.title} f={f} />)}</div>
    </section>
  );
  return (
    <section ref={ref} aria-labelledby="ring-h" className="relative h-[700vh]">
      <div className="sticky top-0 grid h-screen place-content-center overflow-hidden">
        <h2 id="ring-h" className={`${serif.className} mb-12 px-6 text-center text-3xl font-semibold text-white md:text-5xl`}>
          Everything a campus runs on
        </h2>
        <div className="relative h-[440px] w-screen" style={{ perspective: 1400 }}>
          {FEATURES.map((f, i) => <RingCard key={f.title} f={f} i={i} pos={pos} />)}
        </div>
        <div aria-hidden="true" className="mt-8 flex items-center justify-center gap-2">
          {FEATURES.map((f, i) => <Dot key={f.title} i={i} pos={pos} />)}
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
  const vel = useSpring(useVelocity(scrollY), { stiffness: 100, damping: 30, mass: 0.5 });
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
    <FxCtx.Provider value={vel}>
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
      <ReactiveBackdrop />
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
          <Float speed={0.5}>
            <h2 className={`${serif.className} mx-auto max-w-2xl text-center text-3xl font-semibold md:text-5xl`}>
              Built for the people who run a college
            </h2>
          </Float>
          <div className="mt-24 grid gap-x-10 gap-y-16 md:grid-cols-2">
            {FEATURES.map((f, i) => (
              <Depth key={f.title} i={i} glass><Card f={f} className="h-full" /></Depth>
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
                <Tilt className="h-full">
                  <div className="h-full rounded-3xl border border-[#4F378B]/10 bg-white p-7 shadow-[0_30px_60px_-24px_rgba(79,55,139,.5)] [transform-style:preserve-3d]">
                    <div className="mb-4 grid h-9 w-9 place-items-center rounded-full bg-[#4F378B] font-bold text-white shadow-[0_10px_20px_-6px_rgba(79,55,139,.7)] [transform:translateZ(32px)]">{n}</div>
                    <h3 className="text-lg font-semibold [transform:translateZ(20px)]">{t}</h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-[#4A4458] [transform:translateZ(8px)]">{d}</p>
                  </div>
                </Tilt>
              </Depth>
            ))}
          </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-6 pb-24 pt-28">
          <Depth glass>
            <div className="glass rounded-[2rem] p-10 text-center md:p-16">
              <h2 className={`${serif.className} text-3xl font-semibold md:text-5xl`}>Bring your college onto Scholarlytix</h2>
              <p className="mx-auto mt-4 max-w-lg text-white/70">
                Register your college, get approved by the founder team, and start with your own isolated vault and brand colors.
              </p>
              <div className="mt-8"><Magnetic><Link href={REGISTER_HREF} className="inline-flex items-center gap-2 rounded-full bg-[#FFB020] px-8 py-4 font-semibold text-[#2B1A00] shadow-[0_10px_24px_-10px_rgba(0,0,0,.7)] transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
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
    </FxCtx.Provider>
  );
}
