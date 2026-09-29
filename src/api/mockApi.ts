import { Analysis, Detection, DetectionStatus, FilterOptions, SummaryStats, AppSettings, BoundingBox } from '../types/sonar';
import { INITIAL_ANALYSES, generateSonarImage } from './seedData';
import { loadStoredAnalyses, saveStoredAnalyses, loadSettings, saveSettings } from '../lib/storage';
import { DEBRIS_CLASSES } from '../config/classes';

// Simulated delay helper
const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

let analysesInMemory: Analysis[] = loadStoredAnalyses() || INITIAL_ANALYSES;

function persistAnalyses() {
  saveStoredAnalyses(analysesInMemory);
}

export const mockApi = {
  /**
   * Get list of analyses with optional filtering
   */
  async getAnalyses(filters: FilterOptions = {}): Promise<Analysis[]> {
    await delay(200);
    let result = [...analysesInMemory];

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (a) => a.name.toLowerCase().includes(q) || (a.vessel && a.vessel.toLowerCase().includes(q))
      );
    }

    if (filters.status) {
      result = result.filter((a) => a.status === filters.status);
    }

    if (filters.hasLowConfidence) {
      const settings = loadSettings();
      result = result.filter((a) =>
        a.detections.some((d) => d.confidence < settings.reviewThreshold)
      );
    }

    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  /**
   * Get single analysis details with its detections
   */
  async getAnalysisById(id: string): Promise<Analysis | null> {
    await delay(150);
    const item = analysesInMemory.find((a) => a.id === id);
    return item ? JSON.parse(JSON.stringify(item)) : null;
  },

  /**
   * Create new analysis (simulates upload & ML inferencing)
   */
  async createAnalysis(data: {
    name: string;
    vessel?: string;
    sonarType?: string;
    positionSource?: 'metadata' | 'manual';
    lat?: number;
    lon?: number;
    heading?: number;
    fileSize?: number;
    filesCount?: number;
  }): Promise<Analysis> {
    await delay(400);

    const newId = `an-${Date.now().toString().slice(-4)}`;
    const settings = loadSettings();
    const baseLat = data.lat || settings.defaultMapView.lat;
    const baseLon = data.lon || settings.defaultMapView.lon;

    // Generate random synthetic detections for uploaded file
    const generatedDetections: Detection[] = Array.from({ length: 4 }).map((_, i) => {
      const confidence = Math.round((0.45 + Math.random() * 0.5) * 100) / 100;
      const cls = DEBRIS_CLASSES[i % DEBRIS_CLASSES.length];
      const isPending = confidence < settings.reviewThreshold;

      // Vary bbox shape by class: ship_wreck=large, cylinder=small, pipe=long+thin, ghost_net=wide
      const bboxByClass: Record<string, { w: number; h: number }> = {
        ship_wreck: { w: 0.18, h: 0.14 },
        cylinder:   { w: 0.05, h: 0.05 },
        pipe:       { w: 0.22, h: 0.03 },
        ghost_net:  { w: 0.15, h: 0.09 },
      };
      const bbox = bboxByClass[cls.id] || { w: 0.08, h: 0.08 };

      // Pick 2 alternative classes (excluding current)
      const altClasses = DEBRIS_CLASSES.filter((c) => c.id !== cls.id).slice(0, 2);

      return {
        id: `det-${Date.now()}-${i}`,
        analysisId: newId,
        analysisName: data.name,
        class: cls.id,
        confidence,
        bbox: {
          x: parseFloat((0.1 + i * 0.2).toFixed(2)),
          y: parseFloat((0.2 + (i % 2) * 0.35).toFixed(2)),
          w: bbox.w,
          h: bbox.h,
        },
        lat: parseFloat((baseLat + (Math.random() - 0.5) * 0.01).toFixed(5)),
        lon: parseFloat((baseLon + (Math.random() - 0.5) * 0.01).toFixed(5)),
        status: isPending ? 'pending_review' : 'auto_accepted',
        alternatives: altClasses.map((ac) => ({
          class: ac.id,
          confidence: parseFloat((0.05 + Math.random() * 0.2).toFixed(2)),
        })),
      };
    });

    const newAnalysis: Analysis = {
      id: newId,
      name: data.name,
      surveyDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      status: 'completed',
      imageUrl: '',
      imageWidth: 1600,
      imageHeight: 800,
      vessel: data.vessel || 'RV Oceanus',
      sonarType: data.sonarType || 'Klein 4900 Side-Scan',
      positionSource: data.positionSource || 'metadata',
      lat: baseLat,
      lon: baseLon,
      heading: data.heading || 0,
      fileSize: data.fileSize || 15000000,
      analysisDurationSec: Math.floor(25 + Math.random() * 20),
      detections: generatedDetections,
    };

    newAnalysis.imageUrl = generateSonarImage(
      newAnalysis.name,
      1600,
      800,
      generatedDetections.map((d) => ({
        x: d.bbox.x,
        y: d.bbox.y,
        w: d.bbox.w,
        h: d.bbox.h,
        label: d.class,
      }))
    );

    analysesInMemory.unshift(newAnalysis);
    persistAnalyses();
    return newAnalysis;
  },

  /**
   * Delete an analysis by ID
   */
  async deleteAnalysis(id: string): Promise<boolean> {
    await delay(200);
    const lenBefore = analysesInMemory.length;
    analysesInMemory = analysesInMemory.filter((a) => a.id !== id);
    persistAnalyses();
    return analysesInMemory.length < lenBefore;
  },

  /**
   * Get all detections across all analyses with filters
   */
  async getDetections(filters: FilterOptions = {}): Promise<Detection[]> {
    await delay(180);
    let allDetections: Detection[] = [];
    analysesInMemory.forEach((a) => {
      allDetections.push(...a.detections);
    });

    if (filters.search) {
      const q = filters.search.toLowerCase();
      allDetections = allDetections.filter(
        (d) =>
          d.class.toLowerCase().includes(q) ||
          d.id.toLowerCase().includes(q) ||
          (d.analysisName && d.analysisName.toLowerCase().includes(q))
      );
    }

    if (filters.debrisClass && filters.debrisClass !== 'ALL') {
      allDetections = allDetections.filter((d) => d.class === filters.debrisClass);
    }

    if (filters.status && filters.status !== 'ALL') {
      allDetections = allDetections.filter((d) => d.status === filters.status);
    }

    if (filters.minConfidence !== undefined) {
      allDetections = allDetections.filter((d) => d.confidence >= filters.minConfidence!);
    }

    if (filters.maxConfidence !== undefined) {
      allDetections = allDetections.filter((d) => d.confidence <= filters.maxConfidence!);
    }

    return allDetections;
  },

  /**
   * Get pending review queue items (confidence below review threshold)
   */
  async getReviewQueue(filters: FilterOptions = {}): Promise<Detection[]> {
    await delay(200);
    const settings = loadSettings();
    let queue: Detection[] = [];

    analysesInMemory.forEach((a) => {
      a.detections.forEach((d) => {
        if (d.status === 'pending_review') {
          queue.push(d);
        }
      });
    });

    if (filters.debrisClass && filters.debrisClass !== 'ALL') {
      queue = queue.filter((d) => d.class === filters.debrisClass);
    }

    if (filters.surveyName && filters.surveyName !== 'ALL') {
      queue = queue.filter((d) => d.analysisName === filters.surveyName);
    }

    return queue;
  },

  /**
   * Update verification status of a detection (Confirm, Change Class, Reject)
   */
  async updateDetectionStatus(
    detectionId: string,
    status: DetectionStatus,
    classOverride?: string,
    note?: string
  ): Promise<Detection | null> {
    await delay(200);

    let updatedDetection: Detection | null = null;
    for (const analysis of analysesInMemory) {
      const idx = analysis.detections.findIndex((d) => d.id === detectionId);
      if (idx !== -1) {
        const d = analysis.detections[idx];
        const oldClass = d.class;
        d.status = status;
        d.reviewedBy = 'Senior Surveyor (You)';
        d.reviewedAt = new Date().toISOString();
        if (note !== undefined) d.note = note;
        if (classOverride && classOverride !== oldClass) {
          d.originalClass = oldClass;
          d.class = classOverride;
          d.status = 'corrected';
        }
        updatedDetection = { ...d };
        break;
      }
    }

    if (updatedDetection) {
      persistAnalyses();
    }
    return updatedDetection;
  },

  /**
   * Update bounding box coordinates of a detection
   */
  async updateDetectionBBox(detectionId: string, bbox: BoundingBox): Promise<Detection | null> {
    await delay(150);
    let updated: Detection | null = null;

    for (const analysis of analysesInMemory) {
      const d = analysis.detections.find((det) => det.id === detectionId);
      if (d) {
        d.bbox = { ...bbox };
        updated = { ...d };
        break;
      }
    }

    if (updated) {
      persistAnalyses();
    }
    return updated;
  },

  /**
   * Get high-level summary statistics
   */
  async getSummaryStats(): Promise<SummaryStats> {
    await delay(150);
    const settings = loadSettings();
    let totalDetections = 0;
    let pendingCount = 0;
    let confidenceSum = 0;

    analysesInMemory.forEach((a) => {
      a.detections.forEach((d) => {
        totalDetections++;
        confidenceSum += d.confidence;
        if (d.status === 'pending_review') {
          pendingCount++;
        }
      });
    });

    return {
      totalImagesAnalyzed: analysesInMemory.length,
      totalDebrisDetected: totalDetections,
      pendingReviewCount: pendingCount,
      averageConfidence: totalDetections > 0 ? confidenceSum / totalDetections : 0,
    };
  },

  /**
   * Settings operations
   */
  async getSettings(): Promise<AppSettings> {
    await delay(100);
    return loadSettings();
  },

  async updateSettings(newSettings: Partial<AppSettings>): Promise<AppSettings> {
    await delay(150);
    const current = loadSettings();
    const updated = { ...current, ...newSettings };
    saveSettings(updated);
    return updated;
  },
};
