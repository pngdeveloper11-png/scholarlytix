'use client';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export default function DynamicHueBackground({ theme }: { theme: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const palettes: any = {
    indigo: { bg: '#1A237E', blobs: [{ c: '#A200FF', a: 0.6 }, { c: '#FF007F', a: 0.5 }, { c: '#FF6A00', a: 0.4 }, { c: '#2962FF', a: 0.6 }, { c: '#D0BCFF', a: 0.35 }] },
    aurora: { bg: '#0A0F1D', blobs: [{ c: '#80D8FF', a: 0.5 }, { c: '#A7FFEB', a: 0.4 }, { c: '#B388FF', a: 0.5 }, { c: '#80D8FF', a: 0.4 }] },
    eclipse: { bg: '#0D0D0D', blobs: [{ c: '#FFD700', a: 0.4 }, { c: '#E65100', a: 0.5 }, { c: '#FF8A80', a: 0.4 }, { c: '#FFD700', a: 0.3 }] },
    emerald: { bg: '#0B0F19', blobs: [{ c: '#00695C', a: 0.6 }, { c: '#00B0FF', a: 0.4 }, { c: '#69F0AE', a: 0.35 }, { c: '#00695C', a: 0.5 }] },
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
      {/* 45% Black Metallic Diffusion Layer matching the Android App */}
      <div className="absolute inset-0 bg-black/45 pointer-events-none" />
    </div>
  );
}