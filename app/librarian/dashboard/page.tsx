'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import {
  auth,
  tenantCol,
  tenantDoc,
  getActiveCollegeName,
  isFounderEmail,
  CustomRoleDef,
  resolveWebRole,
  formatWebRoleBadge
} from '@/lib/firebase';
import { BookOpen, LogOut, Loader2 } from 'lucide-react';
import DynamicHueBackground from '@/components/DynamicHueBackground';
import CursorGlow from '@/components/CursorGlow';
import FacultyLibraryTab from '@/components/faculty/FacultyLibraryTab';

export default function LibrarianDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [librarianName, setLibrarianName] = useState('Librarian');
  const [librarianEmail, setLibrarianEmail] = useState('');
  const [rawScope, setRawScope] = useState('LIBRARIAN');
  const [customRolesMap, setCustomRolesMap] = useState<Record<string, CustomRoleDef>>({});
  const [collegeName, setCollegeName] = useState('MIT Mumbai');

  useEffect(() => {
    setCollegeName(getActiveCollegeName());

    const unsubRoles = onSnapshot(tenantCol('custom_roles'), (snap) => {
      const map: Record<string, CustomRoleDef> = {};
      snap.docs.forEach((d) => {
        map[d.id] = { roleId: d.id, ...(d.data() as any) };
      });
      setCustomRolesMap(map);
    });

    let unsubAuthDoc: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user || !user.email) {
        router.replace('/faculty/login?portal=librarian');
        return;
      }

      const email = user.email.toLowerCase().trim();
      setLibrarianEmail(email);
      setLibrarianName(user.displayName || localStorage.getItem('academiq_faculty_name') || 'Librarian');

      if (unsubAuthDoc) unsubAuthDoc();
      unsubAuthDoc = onSnapshot(tenantDoc('approved_faculty_emails', email), (snap) => {
        if (isFounderEmail(email)) {
          setRawScope('SUPER_ADMIN');
          setLoading(false);
          return;
        }
        if (!snap.exists()) {
          signOut(auth);
          router.replace('/');
          return;
        }
        const data = snap.data();
        const roleStr = data.roleScope || data.role || 'LIBRARIAN';
        setRawScope(roleStr);
        setLoading(false);
      });
    });

    return () => {
      unsubRoles();
      unsubAuth();
      if (unsubAuthDoc) unsubAuthDoc();
    };
  }, [router]);

  const handleLogout = async () => {
    localStorage.removeItem('academiq_faculty_id');
    localStorage.removeItem('academiq_faculty_name');
    localStorage.removeItem('userRole');
    await signOut(auth);
    router.replace('/');
  };

  const resolvedPerms = resolveWebRole(rawScope, customRolesMap, librarianEmail);
  const badgeText = formatWebRoleBadge(rawScope, customRolesMap, librarianEmail);

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#D0BCFF] animate-spin" />
      </div>
    );
  }

  if (!resolvedPerms.canManageLibrary && rawScope !== 'LIBRARIAN' && !resolvedPerms.canManageAdminPanel) {
    return (
      <div className="min-h-screen w-full bg-black text-white flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold text-red-400 mb-2">Library Access Restricted</h2>
        <p className="text-sm text-white/70 max-w-md mb-6">
          Your account ({librarianEmail}) does not have Librarian permissions enabled. Ask the Super Admin to assign you the Librarian role.
        </p>
        <button
          onClick={handleLogout}
          className="px-6 py-3 rounded-xl bg-[#D0BCFF] text-black font-bold text-sm"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <main className="relative min-h-screen w-full flex flex-col overflow-x-hidden bg-transparent text-white">
      <DynamicHueBackground {...({ theme: 'indigo' } as any)} />
      <CursorGlow />

      <div className="max-w-5xl w-full mx-auto px-6 pt-8 pb-20 z-10 flex-1 flex flex-col">
        {/* Top Dedicated Librarian Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8 pb-6 border-b border-white/10">
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-[#D0BCFF]/15 border border-[#D0BCFF]/40 text-[#D0BCFF]">
              <BookOpen className="w-7 h-7" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#D0BCFF]">
                {collegeName} • {badgeText}
              </p>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Library Management Portal
              </h1>
              <p className="text-xs text-white/60 mt-0.5">
                Logged in as {librarianName} ({librarianEmail})
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="px-4 py-2.5 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 font-bold text-xs flex items-center gap-2 transition"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>

        {/* Dedicated Library Module */}
        <div className="flex-1">
          <FacultyLibraryTab isDark={true} />
        </div>
      </div>
    </main>
  );
}