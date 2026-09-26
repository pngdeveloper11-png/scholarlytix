"use client";

import React, { useState, useEffect } from 'react';
import { tenantDoc } from '@/lib/firebase';
import { onSnapshot, updateDoc, deleteField } from 'firebase/firestore';

export default function StudentSettings({ session, isParentMode, onLogout }: { session: any, isParentMode: boolean, onLogout: any }) {
    const [linkedParents, setLinkedParents] = useState<string[]>([]);

    useEffect(() => {
        if (!session?.studentId) return;
        const unsub = onSnapshot(tenantDoc("students_directory", session.studentId), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const emailsSet = new Set<string>();
                if (Array.isArray(data.linkedParentEmails)) {
                    data.linkedParentEmails.forEach((e: string) => {
                        if (e) emailsSet.add(e);
                    });
                }
                if (data.linkedParentEmail) {
                    emailsSet.add(data.linkedParentEmail);
                }
                setLinkedParents(Array.from(emailsSet));
            }
        });
        return () => unsub();
    }, [session?.studentId]);

    const handleRevokeSingle = async (emailToRemove: string) => {
        try {
            const remaining = linkedParents.filter(e => e !== emailToRemove);
            await updateDoc(tenantDoc("students_directory", session.studentId), {
                linkedParentEmails: remaining,
                linkedParentEmail: remaining.length > 0 ? remaining[0] : deleteField()
            });
            alert(`Parent Access Revoked (${emailToRemove})`);
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-6 space-y-6">
            <h2 className="text-2xl font-bold text-white">Settings</h2>
            
            {/* LINKED PARENT SECTION */}
            {linkedParents.length > 0 && (
                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                    <h3 className="font-bold text-white">Linked Parent Account{linkedParents.length > 1 ? 's' : ''}</h3>
                    {linkedParents.map((parentEmail) => (
                        <div key={parentEmail} className="flex items-center justify-between pt-2 border-t border-white/5 first:border-none first:pt-0">
                            <p className="text-green-400 font-semibold text-sm">Monitoring by: {parentEmail}</p>
                            {/* ONLY STUDENTS CAN CLICK REVOKE */}
                            {!isParentMode && (
                                <button 
                                  onClick={() => handleRevokeSingle(parentEmail)} 
                                  className="px-6 py-2 text-sm font-bold text-red-500 rounded-lg hover:bg-red-500/10 transition-colors"
                                >
                                    Revoke Access
                                </button>
                            )}
                        </div>
                    ))}
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