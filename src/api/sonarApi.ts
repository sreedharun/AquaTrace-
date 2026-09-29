/**
 * SonarTrace API Interface Layer connected to real YOLO26m backend
 */

import { mockApi } from './mockApi';
import { Analysis, Detection, DetectionStatus, FilterOptions, SummaryStats, AppSettings, BoundingBox } from '../types/sonar';

const USE_MOCK_API = false;
const REAL_API_BASE_URL = '/api';

export const sonarApi = {
  async getAnalyses(filters?: FilterOptions): Promise<Analysis[]> {
    if (USE_MOCK_API) return mockApi.getAnalyses(filters);

    const cleanFilters: Record<string, string> = {};
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          cleanFilters[k] = String(v);
        }
      });
    }
    const params = new URLSearchParams(cleanFilters).toString();
    const res = await fetch(`${REAL_API_BASE_URL}/analyses${params ? '?' + params : ''}`);
    if (!res.ok) throw new Error('Failed to fetch analyses');
    return res.json();
  },

  async getAnalysisById(id: string): Promise<Analysis | null> {
    if (USE_MOCK_API) return mockApi.getAnalysisById(id);

    const res = await fetch(`${REAL_API_BASE_URL}/analyses/${id}`);
    if (!res.ok) return null;
    return res.json();
  },

  async createAnalysis(formData: {
    file?: File;
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
    if (USE_MOCK_API) return mockApi.createAnalysis(formData);

    const body = new FormData();
    if (formData.file) {
      body.append('file', formData.file);
    }
    body.append('name', formData.name);
    if (formData.vessel) body.append('vessel', formData.vessel);
    if (formData.sonarType) body.append('sonarType', formData.sonarType);
    if (formData.positionSource) body.append('positionSource', formData.positionSource);
    if (formData.lat !== undefined) body.append('lat', String(formData.lat));
    if (formData.lon !== undefined) body.append('lon', String(formData.lon));
    if (formData.heading !== undefined) body.append('heading', String(formData.heading));
    if (formData.fileSize !== undefined) body.append('fileSize', String(formData.fileSize));

    const res = await fetch(`${REAL_API_BASE_URL}/analyses`, {
      method: 'POST',
      body,
    });
    if (!res.ok) throw new Error('Failed to create analysis with YOLO model');
    return res.json();
  },

  async deleteAnalysis(id: string): Promise<boolean> {
    if (USE_MOCK_API) return mockApi.deleteAnalysis(id);

    const res = await fetch(`${REAL_API_BASE_URL}/analyses/${id}`, {
      method: 'DELETE',
    });
    return res.ok;
  },

  async getDetections(filters?: FilterOptions): Promise<Detection[]> {
    if (USE_MOCK_API) return mockApi.getDetections(filters);

    const cleanFilters: Record<string, string> = {};
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          cleanFilters[k] = String(v);
        }
      });
    }
    const params = new URLSearchParams(cleanFilters).toString();
    const res = await fetch(`${REAL_API_BASE_URL}/detections${params ? '?' + params : ''}`);
    if (!res.ok) throw new Error('Failed to fetch detections');
    return res.json();
  },

  async getReviewQueue(filters?: FilterOptions): Promise<Detection[]> {
    if (USE_MOCK_API) return mockApi.getReviewQueue(filters);

    const cleanFilters: Record<string, string> = {};
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          cleanFilters[k] = String(v);
        }
      });
    }
    const params = new URLSearchParams(cleanFilters).toString();
    const res = await fetch(`${REAL_API_BASE_URL}/review-queue${params ? '?' + params : ''}`);
    if (!res.ok) throw new Error('Failed to fetch review queue');
    return res.json();
  },

  async updateDetectionStatus(
    detectionId: string,
    status: DetectionStatus,
    classOverride?: string,
    note?: string
  ): Promise<Detection | null> {
    if (USE_MOCK_API) return mockApi.updateDetectionStatus(detectionId, status, classOverride, note);

    const res = await fetch(`${REAL_API_BASE_URL}/detections/${detectionId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, classOverride, note }),
    });
    if (!res.ok) throw new Error('Failed to update detection status');
    return res.json();
  },

  async updateDetectionBBox(detectionId: string, bbox: BoundingBox): Promise<Detection | null> {
    if (USE_MOCK_API) return mockApi.updateDetectionBBox(detectionId, bbox);

    const res = await fetch(`${REAL_API_BASE_URL}/detections/${detectionId}/bbox`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bbox }),
    });
    if (!res.ok) throw new Error('Failed to update bounding box');
    return res.json();
  },

  async getSummaryStats(): Promise<SummaryStats> {
    if (USE_MOCK_API) return mockApi.getSummaryStats();

    const res = await fetch(`${REAL_API_BASE_URL}/stats`);
    if (!res.ok) throw new Error('Failed to fetch summary stats');
    return res.json();
  },

  async getSettings(): Promise<AppSettings> {
    if (USE_MOCK_API) return mockApi.getSettings();

    const res = await fetch(`${REAL_API_BASE_URL}/settings`);
    if (!res.ok) throw new Error('Failed to fetch settings');
    return res.json();
  },

  async updateSettings(newSettings: Partial<AppSettings>): Promise<AppSettings> {
    if (USE_MOCK_API) return mockApi.updateSettings(newSettings);

    const res = await fetch(`${REAL_API_BASE_URL}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSettings),
    });
    if (!res.ok) throw new Error('Failed to update settings');
    return res.json();
  },
};
