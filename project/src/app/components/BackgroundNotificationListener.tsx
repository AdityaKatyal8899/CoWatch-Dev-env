"use client";

import { useEffect } from 'react';
import { api } from '../lib/api';
import { toast } from 'sonner';

interface PendingVideo {
  id: string;
  title: string;
}

export function BackgroundNotificationListener() {
  useEffect(() => {
    const pollPendingVideos = async () => {
      const stored = localStorage.getItem('cowatch_pending_uploads');
      if (!stored) return;

      let pendingList: PendingVideo[] = [];
      try {
        pendingList = JSON.parse(stored);
      } catch {
        return;
      }

      if (pendingList.length === 0) return;

      const remainingList: PendingVideo[] = [];

      for (const video of pendingList) {
        try {
          const res = await api.getVideoStatus(video.id);
          if (res.status === 'ready') {
            toast.success(`"${video.title}" is ready!`, {
              description: 'You can now stream it in any room.',
              duration: 10000,
            });
          } else if (res.status === 'failed') {
            toast.error(`Processing failed for "${video.title}"`, {
              description: 'Please check the video format and try again.',
              duration: 10000,
            });
          } else {
            remainingList.push(video);
          }
        } catch (error) {
          console.error(`[Poll Error] Failed to get status for video ${video.id}:`, error);
          if (error instanceof Error && error.message.includes('404')) {
            // Remove since it doesn't exist
          } else {
            remainingList.push(video);
          }
        }
      }

      localStorage.setItem('cowatch_pending_uploads', JSON.stringify(remainingList));
    };

    // Poll every 20 seconds as requested
    const interval = setInterval(pollPendingVideos, 20000);
    // Initial run on mount
    pollPendingVideos();

    return () => clearInterval(interval);
  }, []);

  return null;
}
