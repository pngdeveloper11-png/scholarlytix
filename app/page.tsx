"use client";

import { useRef } from "react";
import Link from "next/link";
import { Sora, Fraunces } from "next/font/google";
import { motion, useScroll, useTransform, useSpring, MotionValue } from "framer-motion";
import {
  Building2, ShieldCheck, QrCode, Sparkles, GraduationCap, ClipboardCheck,
  CalendarDays, Users, BookOpen, ArrowRight,
} from "lucide-react";

const sora = Sora({ subsets: ["latin"], weight: ["400", "600", "800"] });
const serif = Fraunces({ subsets: ["latin"], weight: ["600"] });

// Change to your real college registration route
const REGISTER_HREF = "/register";

const FEATURES = [
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

const smooth = (v: MotionValue<number>) => useSpring(v, { stiffness: 140, damping: 28, mass: 0.4 });

/** Scroll-scrubbed 3D card: tilts in from depth, settles, tilts away. Runs in reverse when scrolling up. */
function Depth({ children, i = 0 }: { children: React.ReactNode; i?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const p = smooth(scrollYProgress);
  const side = i % 2 ? 1 : -1;
  const rotateX = useTransform(p, [0, 0.3, 0.7, 1], [38, 0, 0, -26]);
  const rotateY = useTransform(p, [0, 0.3, 0.7, 1], [18 * side, 0, 0, -14 * side]);
  const z = useTransform(p, [0, 0.3, 0.7, 1], [-320, 0, 0, -240]);
  const y = useTransform(p, [0, 0.3, 0.7, 1], [120, 0, 0, -80]);
  const opacity = useTransform(p, [0, 0.22, 0.78, 1], [0, 1, 1, 0]);
  return (
    <div ref={ref} style={{ perspective: 1200 }}>
      <motion.div style={{ rotateX, rotateY, z, y, opacity, willChange: "transform, opacity" }}>
        {children}
      </motion.div>
    </div>
  );
}

function Card({ f, className = "" }: { f: (typeof FEATURES)[number]; className?: string }) {
  const Icon = f.icon;
  return (
    <div className={`rounded-3xl border border-white/10 bg-[#110E1A] p-7 shadow-[0_30px_80px_-30px_rgba(79,55,139,.8)] ${className}`}>
      <div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#4F378B] to-[#D0BCFF] text-white">
        <Icon size={24} />
      </div>
      <h3 className="text-xl font-semibold text-[white]">{f.title}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-[white]/65">{f.text}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {f.tags.map((t) => (
          <span key={t} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[white]/75">{t}</span>
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
  const rotateX = useTransform(p, [0, 1], [24, 58]);
  const rotateZ = useTransform(p, [0, 1], [-4, 8]);
  const scale = useTransform(p, [0, 1], [1, 0.85]);
  const l1 = useTransform(p, [0, 1], [-30, -300]);
  const l2 = useTransform(p, [0, 1], [0, 110]);
  const l3 = useTransform(p, [0, 1], [30, 300]);
  const textY = useTransform(p, [0, 1], [0, -140]);
  const textO = useTransform(p, [0, 0.5], [1, 0]);
  const layers = [
    { y: l1, label: "Attendance", sub: "92% overall", c: "from-[#4F378B] to-[#9C84D6] text-white" },
    { y: l2, label: "Gate pass", sub: "Valid until 11:59 PM", c: "from-[#D0BCFF] to-[#9C84D6] text-[#1D1033]" },
    { y: l3, label: "AI timetable", sub: "12 slots mapped", c: "from-[#2A1F4D] to-[#4F378B] text-[#D0BCFF]" },
  ];
  return (
    <section ref={ref} className="relative h-[170vh]">
      <div className="sticky top-0 h-screen overflow-hidden">
        <motion.div style={{ y: textY, opacity: textO }} className="absolute inset-x-0 top-[15vh] z-10 mx-auto max-w-3xl px-6 text-center">
          <h1 className={`${serif.className} text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl md:text-6xl`}>
            One platform for your whole campus.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-white/70 md:text-lg">
            Attendance, gate security, tests, library, parents and AI tools. Built for colleges, on Android and the web.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={REGISTER_HREF} className="inline-flex items-center gap-2 rounded-full bg-[#D0BCFF] px-7 py-3.5 font-semibold text-[#1D1033] transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
              Register your college <ArrowRight size={18} />
            </Link>
            <a href="#features" className="rounded-full border border-white/20 px-7 py-3.5 font-semibold text-white transition hover:bg-white/10">
              See all features
            </a>
          </div>
        </motion.div>
        <div className="pointer-events-none absolute inset-x-0 top-[68vh] grid place-items-center" style={{ perspective: 1100 }}>
          <motion.div style={{ rotateX, rotateZ, scale, transformStyle: "preserve-3d" }} className="relative h-[240px] w-[min(86vw,540px)]">
            {layers.map((l, i) => (
              <motion.div key={l.label} style={{ y: l.y, z: i * 60 }}
                className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${l.c} p-7 shadow-2xl`}>
                <div className="text-2xl font-bold">{l.label}</div>
                <div className="mt-1 font-semibold opacity-70">{l.sub}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
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
    <motion.div style={{ x, rotateY, z, opacity }} className="absolute left-1/2 top-0 -ml-[170px] w-[340px]">
      <Card f={f} />
    </motion.div>
  );
}

/** Pinned carousel: scroll to move through every feature, scroll back to return. */
function Ring() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const p = smooth(scrollYProgress);
  return (
    <section ref={ref} className="relative h-[450vh]">
      <div className="sticky top-0 grid h-screen place-content-center overflow-hidden">
        <h2 className={`${serif.className} mb-14 px-6 text-center text-3xl font-semibold text-white md:text-5xl`}>
          Everything a campus runs on
        </h2>
        <div className="relative h-[400px] w-screen" style={{ perspective: 1400 }}>
          {FEATURES.map((f, i) => <RingCard key={f.title} f={f} i={i} p={p} />)}
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <main className={`${sora.className} relative min-h-screen overflow-x-clip bg-[#07050C] [text-rendering:geometricPrecision] antialiased text-white`}>
      {/* static backdrop: no animated blur, so scrolling stays at 60fps */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-0"
        style={{ background: "radial-gradient(70% 45% at 50% 0%, rgba(156,132,214,.28), transparent 70%), radial-gradient(60% 40% at 50% 100%, rgba(79,55,139,.30), transparent 70%)" }} />
      <nav className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 py-4 backdrop-blur-md md:px-12">
        <span className="text-xl font-extrabold tracking-tight">Scholarlytix</span>
        <Link href={REGISTER_HREF} className="rounded-full bg-white/10 px-5 py-2 text-sm font-semibold transition hover:bg-white/20">
          Register your college
        </Link>
      </nav>

      <div className="relative z-10">
        <Hero />
        <Ring />

        <section id="features" className="mx-auto max-w-6xl px-6 py-24">
          <h2 className={`${serif.className} mx-auto max-w-2xl text-center text-3xl font-semibold md:text-5xl`}>
            Built for the people who run a college
          </h2>
          <div className="mt-24 grid gap-x-10 gap-y-16 md:grid-cols-2">
            {FEATURES.map((f, i) => (
              <Depth key={f.title} i={i}><Card f={f} /></Depth>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-6 pb-40 pt-10">
          <Depth>
            <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#4F378B]/45 to-[#D0BCFF]/15 p-10 text-center md:p-16">
              <h2 className={`${serif.className} text-3xl font-semibold md:text-5xl`}>Bring your college onto Scholarlytix</h2>
              <p className="mx-auto mt-4 max-w-lg text-[white]/70">
                Register your college, get approved by the founder team, and start with your own isolated vault and brand colors.
              </p>
              <Link href={REGISTER_HREF} className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#D0BCFF] px-8 py-4 font-semibold text-[#1D1033] transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
                Register your college <ArrowRight size={18} />
              </Link>
            </div>
          </Depth>
        </section>
      </div>
    </main>
  );
}
