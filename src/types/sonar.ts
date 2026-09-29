export type AnalysisStatus = 'queued' | 'analyzing' | 'completed' | 'failed';

export type DetectionStatus = 
  | 'auto_accepted' 
  | 'pending_review' 
  | 'verified' 
  | 'corrected' 
  | 'rejected';

export interface BoundingBox {
  x: number; // Normalized 0..1
  y: number; // Normalized 0..1
  w: number; // Normalized 0..1
  h: number; // Normalized 0..1
}

export interface AlternativeClass {
  class: string;
  confidence: number;
}

export interface Detection {
  id: string;
  analysisId: string;
  analysisName?: string;
  class: string;
  confidence: number; // 0..1
  bbox: BoundingBox;
  lat: number;
  lon: number;
  status: DetectionStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  note?: string;
  alternatives?: AlternativeClass[];
  originalClass?: string;
  createdAt?: string;
}

export interface Analysis {
  id: string;
  name: string;
  surveyDate: string;
  createdAt: string;
  status: AnalysisStatus;
  imageUrl: string;
  thumbnailUrl?: string; // Lightweight max 320px thumbnail
  previewUrl?: string; // 640px preview image
  imageWidth: number;
  imageHeight: number;
  detections: Detection[];
  vessel?: string;
  sonarType?: string;
  positionSource?: 'metadata' | 'manual';
  lat?: number;
  lon?: number;
  heading?: number;
  fileSize?: number; // in bytes
  analysisDurationSec?: number;
}

export interface DebrisClassConfig {
  id: string;
  name: string;
  color: string;
  description: string;
}

export interface AppSettings {
  reviewThreshold: number; // e.g. 0.70 (70%)
  coordFormat: 'DD' | 'DMS';
  unitSystem: 'metric' | 'nautical';
  defaultMapView: {
    lat: number;
    lon: number;
    zoom: number;
  };
  debrisClasses: DebrisClassConfig[];
}

export interface SummaryStats {
  totalImagesAnalyzed: number;
  totalDebrisDetected: number;
  pendingReviewCount: number;
  averageConfidence: number;
}

export interface FilterOptions {
  search?: string;
  status?: string;
  debrisClass?: string;
  minConfidence?: number;
  maxConfidence?: number;
  dateFrom?: string;
  dateTo?: string;
  surveyName?: string;
  hasLowConfidence?: boolean;
}
