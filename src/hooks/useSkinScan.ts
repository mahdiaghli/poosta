import { useState, useCallback } from 'react';
import { skinAnalysisService } from '@/services/skinAnalysisService';
import { useAppStore } from '@/store/useAppStore';
import type { ImageQualityResult } from '@/types';

/** Encapsulates the Photo -> quality check -> analyze flow for the Scan page. */
export function useSkinScan() {
  const [quality, setQuality] = useState<ImageQualityResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const runScan = useAppStore((s) => s.runScan);

  const checkImage = useCallback(async (imageDataUrl: string) => {
    setChecking(true);
    const result = await skinAnalysisService.checkImageQuality(imageDataUrl);
    setQuality(result);
    setChecking(false);
    return result;
  }, []);

  const analyze = useCallback(async (imageDataUrl: string, thumbnailUrl?: string, mode: 'accurate' | 'standard' = 'standard') => {
    setAnalyzing(true);
    try {
      await runScan(imageDataUrl, thumbnailUrl, mode);
    } finally {
      setAnalyzing(false);
    }
  }, [runScan]);

  return { quality, checking, analyzing, checkImage, analyze, resetQuality: () => setQuality(null) };
}
