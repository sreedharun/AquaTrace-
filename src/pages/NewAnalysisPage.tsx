import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/common/PageHeader';
import { DragDropZone } from '../components/new-analysis/DragDropZone';
import { FileList, UploadItem } from '../components/new-analysis/FileList';
import { SurveyMetadataForm, SurveyMetadata } from '../components/new-analysis/SurveyMetadataForm';
import { Card } from '../components/common/Card';
import { useAnalyses } from '../hooks/useAnalyses';
import { useSonarContext } from '../context/SonarContext';
import { useToast } from '../context/ToastContext';
import { Play, RotateCcw, CheckCircle, ArrowRight, CheckSquare, ExternalLink, ShieldCheck, Compass, FileImage, AlertTriangle } from 'lucide-react';
import { Analysis } from '../types/sonar';

export const NewAnalysisPage: React.FC = () => {
  const navigate = useNavigate();
  const { createAnalysis, isCreating } = useAnalyses();
  const { settings } = useSonarContext();
  const { showToast } = useToast();

  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [completedAnalyses, setCompletedAnalyses] = useState<Analysis[]>([]);

  const [metadata, setMetadata] = useState<SurveyMetadata>({
    surveyName: `Survey ${new Date().toISOString().substring(0, 10)}-B101`,
    surveyDate: new Date().toISOString(),
    vessel: 'RV Oceanus',
    sonarType: 'Klein 4900 Side-Scan Sonar',
    positionSource: 'metadata',
    lat: 37.8049,
    lon: -122.4194,
    heading: 180,
  });

  const handleFilesSelected = (newFiles: File[]) => {
    const items: UploadItem[] = newFiles.map((file) => ({
      id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      progress: 0,
      status: 'queued',
    }));
    setUploadItems((prev) => [...prev, ...items]);
  };

  const handleRemoveFile = (id: string) => {
    setUploadItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearAll = () => {
    setUploadItems([]);
    setCompletedAnalyses([]);
  };

  const processSingleFile = async (item: UploadItem, index: number, total: number) => {
    // 1. Mark analyzing
    setUploadItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, status: 'analyzing', progress: 15 } : it))
    );

    // 2. Simulate progress ticks
    await new Promise((r) => setTimeout(r, 200));
    setUploadItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, progress: 65 } : it))
    );

    await new Promise((r) => setTimeout(r, 300));

    try {
      // 3. Perform real YOLO26m neural analysis
      const created = await createAnalysis({
        file: item.file,
        name: metadata.surveyName + (total > 1 ? ` (File ${index + 1})` : ''),
        vessel: metadata.vessel,
        sonarType: metadata.sonarType,
        positionSource: metadata.positionSource,
        lat: metadata.lat,
        lon: metadata.lon,
        heading: metadata.heading,
        fileSize: item.file.size,
      });

      // 4. Mark completed
      setUploadItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, status: 'completed', progress: 100 } : it))
      );

      setCompletedAnalyses((prev) => [...prev, created]);

      // Per-file completion toast with "View results" action
      showToast({
        type: 'success',
        title: 'Sonar Analysis Complete',
        description: `Neural model detected ${created.detections.length} acoustic targets in ${created.name}.`,
        actionLabel: 'View Results',
        onAction: () => navigate(`/analyses/${created.id}`),
      });

      return created;
    } catch (e) {
      setUploadItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? { ...it, status: 'failed', progress: 0, error: 'Neural inferencing timeout' }
            : it
        )
      );
      return null;
    }
  };

  const handleStartAnalysis = async () => {
    const pendingItems = uploadItems.filter((it) => it.status === 'queued' || it.status === 'failed');
    if (pendingItems.length === 0) return;

    for (let i = 0; i < pendingItems.length; i++) {
      await processSingleFile(pendingItems[i], i, pendingItems.length);
    }
  };

  const handleRetryFile = async (id: string) => {
    const item = uploadItems.find((it) => it.id === id);
    if (item) {
      await processSingleFile(item, 0, 1);
    }
  };

  const isProcessing = uploadItems.some((it) => it.status === 'analyzing');
  const validFilesCount = uploadItems.filter((it) => it.status !== 'failed').length;
  const allCompleted = uploadItems.length > 0 && uploadItems.every((it) => it.status === 'completed');

  // Compute batch completion stats
  const totalDetectionsFound = completedAnalyses.reduce((acc, a) => acc + a.detections.length, 0);
  const totalNeedsReview = completedAnalyses.reduce(
    (acc, a) => acc + a.detections.filter((d) => d.status === 'pending_review').length,
    0
  );

  const isManualCoordInvalid =
    metadata.positionSource === 'manual' &&
    (metadata.lat < -90 || metadata.lat > 90 || metadata.lon < -180 || metadata.lon > 180 || metadata.heading < 0 || metadata.heading > 360);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page Header */}
      <PageHeader
        title="New Analysis"
        subtitle="Upload side-scan or multibeam acoustic imagery for automated neural debris detection"
      />

      {/* Batch Completion Summary Card */}
      {allCompleted && completedAnalyses.length > 0 && (
        <Card className="p-6 bg-success-tint/40 border-success/30 space-y-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-success/20 text-success flex items-center justify-center shrink-0">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-text">Campaign Analysis Batch Complete</h3>
                <p className="text-xs text-muted mt-0.5">
                  All {completedAnalyses.length} sonar file{completedAnalyses.length === 1 ? '' : 's'} successfully processed by neural inference engine.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-3 bg-surface rounded-card border border-border">
              <span className="text-[11px] font-semibold uppercase text-muted">Files Processed</span>
              <p className="text-xl font-bold font-mono text-text mt-1">{completedAnalyses.length}</p>
            </div>
            <div className="p-3 bg-surface rounded-card border border-border">
              <span className="text-[11px] font-semibold uppercase text-muted">Detections Found</span>
              <p className="text-xl font-bold font-mono text-primary mt-1">{totalDetectionsFound}</p>
            </div>
            <div className="p-3 bg-surface rounded-card border border-border">
              <span className="text-[11px] font-semibold uppercase text-muted">Needs Verification</span>
              <p className={`text-xl font-bold font-mono mt-1 ${totalNeedsReview > 0 ? 'text-warning' : 'text-success'}`}>
                {totalNeedsReview}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-border/60">
            <button
              onClick={() => navigate(`/analyses/${completedAnalyses[0].id}`)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-text bg-surface border border-border hover:bg-background rounded-button transition-colors shadow-subtle"
            >
              <ExternalLink className="w-4 h-4 text-primary" />
              <span>View Results</span>
            </button>
            {totalNeedsReview > 0 && (
              <button
                onClick={() => navigate('/review-queue')}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-warning hover:bg-warning/90 rounded-button transition-colors shadow-subtle"
              >
                <CheckSquare className="w-4 h-4" />
                <span>Go to Review Queue ({totalNeedsReview})</span>
              </button>
            )}
          </div>
        </Card>
      )}

      {/* Drag & Drop Upload Zone */}
      <DragDropZone onFilesSelected={handleFilesSelected} />

      {/* Selected File List */}
      <FileList files={uploadItems} onRemove={handleRemoveFile} onRetry={handleRetryFile} />

      {/* Optional Metadata Configuration Card */}
      <SurveyMetadataForm metadata={metadata} onChange={(up) => setMetadata((p) => ({ ...p, ...up }))} />

      {/* Primary & Secondary Action Controls */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <button
          onClick={handleClearAll}
          disabled={uploadItems.length === 0 || isProcessing}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-muted hover:text-danger border border-border hover:border-danger/30 rounded-button transition-colors disabled:opacity-40"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Clear All</span>
        </button>

        <button
          onClick={handleStartAnalysis}
          disabled={uploadItems.length === 0 || isProcessing || isCreating || allCompleted || isManualCoordInvalid}
          className="flex items-center gap-2 px-6 py-2.5 text-xs font-semibold text-white bg-primary hover:bg-primary-hover rounded-button transition-colors disabled:opacity-40 shadow-subtle"
        >
          {isProcessing ? (
            <span>Analyzing Batch...</span>
          ) : allCompleted ? (
            <>
              <CheckCircle className="w-4 h-4" />
              <span>Batch Completed</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Start Analysis</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
