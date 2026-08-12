'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export default function GlassDropdown({ 
  label, value, options, onChange, isDark = true, zIndex = 50 
}: { 
  label?: string, value: string, options: string[], onChange: (val: string) => void, isDark?: boolean, zIndex?: number 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // The button itself
  const buttonBg = isDark 
    ? 'bg-white/[0.05] border-white/10 text-white hover:bg-white/[0.1]' 
    : 'bg-black/5 border-black/10 text-neutral-900 hover:bg-black/10';
  
  // FIX: Pure, ultra-clear frosted glass perfectly matching the Student Login screen!
  // FIX: Changed 'bg-white/[0.03]' to 'bg-black/40' to act as a dark tint over bright buttons!
  const menuBgClass = isDark 
    ? 'bg-black/30 border-white/[0.12] text-white' 
    : 'bg-white/70 border-black/10 text-neutral-900';

  const optionHover = isDark 
    ? 'hover:bg-white/[0.08] text-white' 
    : 'hover:bg-black/5 text-neutral-900';

  const optionSelected = isDark 
    ? 'bg-white/[0.12] text-[#D0BCFF] font-bold' 
    : 'bg-black/10 text-black font-bold';

  return (
    <div className="flex-1 relative w-full" ref={dropdownRef} style={{ zIndex: isOpen ? zIndex + 10 : zIndex }}>
      {label && <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ml-1 ${isDark ? 'text-white/70' : 'text-neutral-500'}`}>{label}</label>}
      
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full border rounded-2xl p-4 flex justify-between items-center cursor-pointer transition-all backdrop-blur-[40px] shadow-[0_4px_16px_rgba(0,0,0,0.1)] ${buttonBg}`}
      >
        <span className="font-semibold text-sm truncate pr-4">{value ? value.replace("Semester ", "Sem ") : "Select"}</span>
        <ChevronDown className={`w-5 h-5 transition-transform duration-200 opacity-50 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      
      {isOpen && (
        <div className={`absolute top-[calc(100%+8px)] left-0 w-full border rounded-2xl overflow-y-auto max-h-60 py-2 backdrop-blur-[40px] shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] ${menuBgClass}`}>
          {options.map(opt => (
            <div 
              key={opt}
              onClick={() => { onChange(opt); setIsOpen(false); }}
              className={`px-4 py-3 flex items-center justify-between cursor-pointer transition-colors text-sm font-medium ${value === opt ? optionSelected : optionHover}`}
            >
              <span className="truncate pr-2">{opt.replace("Semester ", "Sem ")}</span>
              {value === opt && <Check className="w-4 h-4 flex-shrink-0" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}