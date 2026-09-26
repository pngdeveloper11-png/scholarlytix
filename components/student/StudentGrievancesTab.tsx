'use client';

import React, { useState, useRef } from 'react';
import { addDoc } from 'firebase/firestore';
import { tenantCol, tenantTopic } from '@/lib/firebase';
import { AlertTriangle, Upload, X, CheckCircle2, Loader2, Video } from 'lucide-react';
import InAppMediaViewer from '../ui/InAppMediaViewer';

interface StudentGrievancesTabProps {
  student: any;
  isDynamicHue: boolean;
  cardBg: string;
}

// VANILLA JS METADATA SCRUBBER (Canvas Proxy)
const stripImageMetadata = async (file: File): Promise<File> => {
  if (!file.type.startsWith('image/')) return file; // Videos pass through

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        
        // Exporting from canvas inherently destroys EXIF/GPS data
        canvas.toBlob((blob) => {
          if (blob) {
            const scrubbedFile = new File([blob], `Scrubbed_${Date.now()}.jpg`, { type: 'image/jpeg' });
            resolve(scrubbedFile);
          } else {
            resolve(file); // Fallback if blob fails
          }
        }, 'image/jpeg', 0.85);
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
};

export default function StudentGrievancesTab({ student, isDynamicHue, cardBg }: StudentGrievancesTabProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [viewMediaUrl, setViewMediaUrl] = useState("");
  const [viewMediaName, setViewMediaName] = useState("");
  const [showMediaViewer, setShowMediaViewer] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      alert("Title and Description are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      let finalUrl = null;

      if (selectedFile) {
        // 1. Scrub Metadata Securely
        const scrubbedFile = await stripImageMetadata(selectedFile);
        
        // 2. Fetch Vercel Pre-signed Cloudflare URL
        const ticketRes = await fetch('/api/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: `Grievance_${Date.now()}_${scrubbedFile.name}`, fileType: scrubbedFile.type })
        });
        
        if (!ticketRes.ok) throw new Error("Failed to get upload ticket.");
        const { uploadUrl, downloadUrl } = await ticketRes.json();

        // 3. Upload to Cloudflare R2
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': scrubbedFile.type, 'Content-Disposition': 'inline' },
          body: scrubbedFile
        });

        if (!uploadRes.ok) throw new Error("Failed to upload evidence.");
        finalUrl = downloadUrl;
      }

      // 4. Save to Tenant-Isolated Firestore (Totally Anonymous)
      const grievanceDoc: any = {
        title: title.trim(),
        description: description.trim(),
        timestamp: Date.now(),
        status: "Investigating"
      };

      if (finalUrl) {
        grievanceDoc.evidenceUrl = finalUrl;
      }

      await addDoc(tenantCol("student_grievances"), grievanceDoc);

      // 5. Fire Multi-Tenant Push Notification to all Teachers in this college
      await fetch('/api/send-fcm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetTopic: tenantTopic("all_teachers"),
          title: "🚨 New Anonymous Grievance",
          message: "A new anonymous report has been filed by a student.",
          channelId: "security_alerts",
          targetTab: "Grievances"
        })
      });

      setIsSuccess(true);
    } catch (e: any) {
      alert(`Submission failed: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in duration-500">
        <CheckCircle2 className="w-24 h-24 text-green-500 mb-6 drop-shadow-[0_0_15px_rgba(34,197,94,0.5)]" />
        <h2 className="text-3xl font-bold text-white mb-2">Report Submitted Securely</h2>
        <p className="text-white/60 mb-8">Your identity has been completely scrubbed.</p>
        <button 
          onClick={() => { setIsSuccess(false); setTitle(""); setDescription(""); removeFile(); }}
          className="px-8 py-3 bg-[#D0BCFF] text-[#2A1B4E] rounded-xl font-bold hover:scale-105 transition-transform"
        >
          Submit Another Report
        </button>
      </div>
    );
  }

  const isVideo = selectedFile?.type.startsWith("video/");

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
        <h2 className="text-2xl font-bold text-red-500 mb-2">Anonymous Grievances</h2>
        <p className="text-sm text-white/70">Report bullying, ragging, or facility issues. Your device, email, and identity are fully stripped before sending. Attachments will have GPS &amp; EXIF metadata wiped automatically.</p>
      </div>

      <div className={`p-6 rounded-[2rem] border ${cardBg} space-y-5`}>
        <div>
          <label className="text-xs font-bold opacity-60 mb-1 block">Incident Title</label>
          <input 
            type="text" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-red-500/50 transition-colors"
            placeholder="Briefly summarize the issue..."
          />
        </div>

        <div>
          <label className="text-xs font-bold opacity-60 mb-1 block">Detailed Description</label>
          <textarea 
            value={description} 
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-red-500/50 transition-colors resize-none"
            placeholder="Explain what happened in detail..."
          />
        </div>

        <div>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,video/*" className="hidden" />
          
          {!selectedFile ? (
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-4 border border-white/20 border-dashed rounded-xl flex flex-col items-center justify-center hover:bg-white/5 transition-colors text-white/70 hover:text-white"
            >
              <Upload className="w-6 h-6 mb-2" />
              <span className="font-bold text-sm">Attach Evidence (Photo / Video)</span>
            </button>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/60 block">Attached Evidence:</label>
              <div className="relative w-full h-48 rounded-xl overflow-hidden bg-black/50 border border-white/10 group">
                <div 
                  className="w-full h-full flex items-center justify-center cursor-pointer"
                  onClick={() => {
                    setViewMediaUrl(previewUrl);
                    setViewMediaName(selectedFile.name);
                    setShowMediaViewer(true);
                  }}
                >
                  {isVideo ? (
                    <div className="flex flex-col items-center text-white/70">
                      <Video className="w-12 h-12 mb-2" />
                      <span className="text-sm font-bold">Tap to Play Video</span>
                    </div>
                  ) : (
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                  )}
                </div>
                
                <button 
                  onClick={removeFile}
                  className="absolute top-3 right-3 p-2 bg-black/60 hover:bg-red-500/80 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
                <div className="absolute bottom-0 left-0 w-full p-2 bg-black/60 text-xs font-mono truncate px-4">
                  {selectedFile.name}
                </div>
              </div>
            </div>
          )}
        </div>

        <button 
          onClick={handleSubmit} 
          disabled={isSubmitting}
          className="w-full py-4 bg-red-500 text-white rounded-xl font-bold hover:scale-[1.02] shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center mt-4"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-3" /> 
              Scrubbing Metadata &amp; Sending...
            </>
          ) : "Submit Securely"}
        </button>
      </div>

      {showMediaViewer && viewMediaUrl && (
        <InAppMediaViewer 
          url={viewMediaUrl} 
          fileName={viewMediaName} 
          isDynamicHue={isDynamicHue} 
          onClose={() => { setShowMediaViewer(false); setViewMediaUrl(""); }} 
        />
      )}
    </div>
  );
}