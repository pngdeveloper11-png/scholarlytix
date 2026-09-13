'use client';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export default function DynamicHueBackground({ theme }: { theme: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const palettes: any = {
    indigo: { bg: '#1A237E', blobs: [{ c: '#A200FF', a: 0.6 }, { c: '#FF007F', a: 0.5 }, { c: '#FF6A00', a: 0.4 }, { c: '#2962FF', a: 0.6 }, { c: '#D0BCFF', a: 0.35 }] },
    obsidian: { bg: '#050505', blobs: [{ c: '#4A0000', a: 0.5 }, { c: '#1A0033', a: 0.5 }, { c: '#2E0000', a: 0.4 }, { c: '#4A0000', a: 0.4 }] },
    aurora: { bg: '#0A0F1D', blobs: [{ c: '#80D8FF', a: 0.5 }, { c: '#A7FFEB', a: 0.4 }, { c: '#B388FF', a: 0.5 }, { c: '#80D8FF', a: 0.4 }] },
    ocean: { bg: '#001F3F', blobs: [{ c: '#0074D9', a: 0.6 }, { c: '#39CCCC', a: 0.4 }, { c: '#001F3F', a: 0.5 }, { c: '#0074D9', a: 0.5 }] },
    eclipse: { bg: '#0D0D0D', blobs: [{ c: '#FFD700', a: 0.4 }, { c: '#E65100', a: 0.5 }, { c: '#FF8A80', a: 0.4 }, { c: '#FFD700', a: 0.3 }] },
    sunset: { bg: '#4A0E4E', blobs: [{ c: '#FF5722', a: 0.5 }, { c: '#FFC107', a: 0.4 }, { c: '#E91E63', a: 0.4 }, { c: '#FF5722', a: 0.5 }] },
    emerald: { bg: '#0B0F19', blobs: [{ c: '#00695C', a: 0.6 }, { c: '#00B0FF', a: 0.4 }, { c: '#69F0AE', a: 0.35 }, { c: '#00695C', a: 0.5 }] },
    neon: { bg: '#090A0F', blobs: [{ c: '#FF00FF', a: 0.5 }, { c: '#00FFFF', a: 0.4 }, { c: '#3D00E0', a: 0.5 }, { c: '#FF00FF', a: 0.4 }] },
    lavender: { bg: '#E6E6FA', blobs: [{ c: '#D0BCFF', a: 0.6 }, { c: '#F8BBD0', a: 0.5 }, { c: '#E1BEE7', a: 0.5 }, { c: '#D0BCFF', a: 0.5 }] },
    vibrant: { bg: '#1A0000', blobs: [{ c: '#D50000', a: 0.5 }, { c: '#E91E63', a: 0.5 }, { c: '#2962FF', a: 0.6 }, { c: '#00C853', a: 0.4 }, { c: '#FF6D00', a: 0.5 }] }
  };

  const current = palettes[theme] || palettes.indigo;

  if (!mounted) return <div className="fixed inset-0 z-[-1]" style={{ backgroundColor: current.bg }} />;

  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden transition-colors duration-1000" style={{ backgroundColor: current.bg }}>
      {current.blobs.map((blob: any, i: number) => (
        <motion.div
          key={`${theme}-${i}`}
          animate={{
            x: [0, (i % 2 === 0 ? 100 : -100), (i % 3 === 0 ? -50 : 50), 0],
            y: [0, (i % 2 === 0 ? -100 : 100), (i % 3 === 0 ? 50 : -50), 0],
            scale: [1, 1.2, 0.9, 1],
          }}
          transition={{ duration: 15 + i * 2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute w-[60vw] h-[60vw] rounded-full blur-[140px]"
          style={{
            backgroundColor: blob.c,
            opacity: blob.a,
            top: `${10 + i * 15}%`,
            left: `${10 + i * 15}%`,
            transform: `translate(-50%, -50%)`
          }}
        />
      ))}
      <div className="absolute inset-0 bg-black/45 pointer-events-none" />
    </div>
  );
}