'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { onSnapshot, getDoc } from 'firebase/firestore';
import {
  auth,
  tenantDoc,
  isFounderEmail,
  getActiveCollegeId
} from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  role: string | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
  logout: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [collegeId, setCollegeId] = useState<string>(() => getActiveCollegeId());

  useEffect(() => {
    const handleCollegeChange = () => {
      setCollegeId(getActiveCollegeId());
    };
    window.addEventListener('college-changed', handleCollegeChange);
    return () => window.removeEventListener('college-changed', handleCollegeChange);
  }, []);

  useEffect(() => {
    let unsubRoleDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (unsubRoleDoc) {
        unsubRoleDoc();
        unsubRoleDoc = null;
      }

      if (currentUser && currentUser.email) {
        setUser(currentUser);
        const email = currentUser.email.toLowerCase().trim();

        // 1. Master Founder / Developer Override
        if (isFounderEmail(email)) {
          setRole('SUPER_ADMIN');
          setLoading(false);
          return;
        }

        // 2. Real-time Assigned Role Listener from Active College Tenant
        const docRef = tenantDoc('approved_faculty_emails', email);
        unsubRoleDoc = onSnapshot(
          docRef,
          async (docSnap) => {
            if (docSnap.exists()) {
              setRole(docSnap.data().role || 'NONE');
              setLoading(false);
            } else {
              // Fallback check in faculty_directory if uid document exists
              try {
                const dirSnap = await getDoc(tenantDoc('faculty_directory', currentUser.uid));
                if (dirSnap.exists()) {
                  setRole(dirSnap.data().role || 'NONE');
                } else {
                  setRole(null); // Unauthorized in this college vault
                }
              } catch {
                setRole(null);
              }
              setLoading(false);
            }
          },
          (error) => {
            console.error('Error fetching tenant role:', error);
            setRole(null);
            setLoading(false);
          }
        );
      } else {
        setUser(null);
        setRole(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubRoleDoc) unsubRoleDoc();
    };
  }, [collegeId]);

  const logout = async () => {
    setLoading(true);
    await signOut(auth);
    setUser(null);
    setRole(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);