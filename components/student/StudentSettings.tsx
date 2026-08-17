"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, deleteField } from 'firebase/firestore';

export default function StudentSettings({ session, isParentMode, onLogout }: { session: any, isParentMode: boolean, onLogout: any }) {
    const [linkedParentEmail, setLinkedParentEmail] = useState<string | null>(null);

    useEffect(() => {
        if (!session?.studentId) return;
        const unsub = onSnapshot(doc(db, "students_directory", session.studentId), (docSnap) => {
            if (docSnap.exists()) {
                setLinkedParentEmail(docSnap.data().linkedParentEmail);
            }
        });
        return () => unsub();
    }, [session?.studentId]);

    const handleRevoke = async () => {
        try {
            await updateDoc(doc(db, "students_directory", session.studentId), {
                linkedParentEmail: deleteField()
            });
            alert("Parent Access Revoked");
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-6 space-y-6">
            <h2 className="text-2xl font-bold text-white">Settings</h2>
            
            {/* LINKED PARENT SECTION */}
            {linkedParentEmail && (
                <div className="flex items-center justify-between p-6 rounded-2xl bg-white/5 border border-white/10">
                    <div>
                        <h3 className="font-bold text-white">Linked Parent Account</h3>
                        <p className="text-green-400 font-semibold text-sm">Monitoring by: {linkedParentEmail}</p>
                    </div>
                    {/* ONLY STUDENTS CAN CLICK REVOKE */}
                    {!isParentMode && (
                        <button 
                          onClick={handleRevoke} 
                          className="px-6 py-2 text-sm font-bold text-red-500 rounded-lg hover:bg-red-500/10 transition-colors"
                        >
                            Revoke Access
                        </button>
                    )}
                </div>
            )}

            {/* Existing Settings / Logout Button */}
            <button 
              onClick={onLogout} 
              className="w-full p-4 font-bold text-red-500 bg-red-500/10 rounded-xl hover:bg-red-500/20 transition-colors"
            >
              Sign Out
            </button>
        </div>
    );
}