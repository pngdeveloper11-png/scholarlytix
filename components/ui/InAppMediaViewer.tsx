'use client';

import React from 'react';
import { X, Download, FileText, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface InAppMediaViewerProps {
  url: string;
  fileName: string;
  isDynamicHue: boolean;
  onClose: () => void;
}

export default function InAppMediaViewer({ url, fileName, isDynamicHue, onClose }: InAppMediaViewerProps) {
  const cleanUrl = url.toLowerCase().split('?')[0];
  const lowerName = fileName.toLowerCase();
  
  const isVideo = cleanUrl.endsWith(".mp4") || cleanUrl.endsWith(".mkv") || cleanUrl.endsWith(".webm") || lowerName.endsWith(".mp4");
  const isImage = cleanUrl.endsWith(".jpg") || cleanUrl.endsWith(".jpeg") || cleanUrl.endsWith(".png") || cleanUrl.endsWith(".webp") || lowerName.endsWith(".jpg") || lowerName.endsWith(".png");
  const isPdf = cleanUrl.endsWith(".pdf") || lowerName.endsWith(".pdf");

  const bgColor = isDynamicHue ? 'bg-black/95 backdrop-blur-2xl' : 'bg-[#121212]';

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`fixed inset-0 z-[999] flex flex-col ${bgColor} text-white`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/50">
          <div className="flex items-center space-x-4 flex-1 overflow-hidden">
            <button 
              onClick={onClose}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-lg font-bold truncate">{fileName}</h2>
          </div>
          <a 
            href={url} 
            download={fileName}
            target="_blank"
            rel="noreferrer"
            className="p-2 bg-[#D0BCFF] text-[#2A1B4E] hover:scale-105 rounded-full transition-transform ml-4"
          >
            <Download className="w-5 h-5" />
          </a>
        </div>

        {/* Media Container */}
        <div className="flex-1 w-full h-full flex items-center justify-center p-4 overflow-hidden relative">
          {isImage && (
            <img 
              src={url} 
              alt={fileName} 
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
            />
          )}

          {isVideo && (
            <video 
              src={url} 
              controls 
              autoPlay
              playsInline
              className="max-w-full max-h-full rounded-xl shadow-2xl outline-none"
            >
              Your browser does not support the video tag.
            </video>
          )}

          {isPdf && (
            <iframe 
              src={`https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`}
              className="w-full h-full rounded-xl shadow-2xl bg-white"
              title={fileName}
            />
          )}

          {!isImage && !isVideo && !isPdf && (
            <div className="flex flex-col items-center justify-center space-y-4 opacity-70">
              <FileText className="w-24 h-24 text-[#D0BCFF]" />
              <p className="text-lg font-bold">Preview not available for this file type.</p>
              <a 
                href={url} 
                download={fileName}
                target="_blank"
                rel="noreferrer"
                className="px-6 py-3 bg-[#D0BCFF] text-[#2A1B4E] rounded-xl font-bold hover:scale-105 transition-transform"
              >
                Download to View
              </a>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}