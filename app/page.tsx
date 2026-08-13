import { GraduationCap, User, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import DownloadAppButton from '@/components/DownloadAppButton';

export default function Home() {
  return (
    <main className="relative min-h-screen w-full flex flex-col items-center justify-between p-6 md:p-12 text-white">

      {/* Top Branding */}
      <div className="flex flex-col items-center text-center mt-12">
        <div className="p-4 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl mb-6">
          <GraduationCap className="w-16 h-16 text-purple-300" />
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight">
          Academi<span className="text-purple-300">Q.</span>
        </h1>
        <p className="text-lg md:text-xl text-neutral-400 mt-3 max-w-md">
          The Intelligent EdTech Ecosystem &amp; Autonomous Assistant
        </p>
      </div>

      {/* Role Selection Cards */}
      <div className="w-full max-w-md space-y-4 my-8">
        {/* Faculty Card */}
        <Link href="/faculty/login" className="block group">
          <div className="p-6 rounded-2xl bg-white/5 backdrop-blur-md border border-white/15 hover:border-purple-400/50 hover:bg-white/10 transition-all duration-300 shadow-xl flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 rounded-xl bg-purple-500/20 text-purple-300">
                <GraduationCap className="w-8 h-8" />
              </div>
              <div className="text-left">
                <h3 className="text-xl font-bold text-white group-hover:text-purple-300 transition-colors">Faculty Portal</h3>
                <p className="text-sm text-neutral-400">Mark attendance, upload notes &amp; view analytics</p>
              </div>
            </div>
            <ArrowRight className="w-6 h-6 text-neutral-400 group-hover:text-purple-300 group-hover:translate-x-1 transition-all" />
          </div>
        </Link>

        {/* Student Card */}
        <Link href="/student/login" className="block group">
          <div className="p-6 rounded-2xl bg-white/5 backdrop-blur-md border border-white/15 hover:border-purple-400/50 hover:bg-white/10 transition-all duration-300 shadow-xl flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 rounded-xl bg-purple-500/20 text-purple-300">
                <User className="w-8 h-8" />
              </div>
              <div className="text-left">
                <h3 className="text-xl font-bold text-white group-hover:text-purple-300 transition-colors">Student Portal</h3>
                <p className="text-sm text-neutral-400">Track attendance, download materials &amp; view scores</p>
              </div>
            </div>
            <ArrowRight className="w-6 h-6 text-neutral-400 group-hover:text-purple-300 group-hover:translate-x-1 transition-all" />
          </div>
        </Link>
      </div>

      {/* Android App Download Button */}
      <div className="w-full max-w-md mb-12">
        <DownloadAppButton />
      </div>

      {/* Footer Branding */}
      <div className="flex flex-col items-center text-center space-y-2 mb-4">
        <p className="text-xs font-medium text-white/70">Developed by - Pratosh Gharat</p>
        <div className="relative h-14 w-44 flex items-center justify-center">
          <Image 
            src="/signature.png" 
            alt="Pratosh Gharat Signature" 
            fill
            sizes="(max-width: 768px) 100vw, 176px"
            className="object-contain brightness-0 invert" 
          />
        </div>
      </div>
    </main>
  );
}