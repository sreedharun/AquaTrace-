import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAnalysisDetail, useAnalyses } from '../hooks/useAnalyses';
import { PageHeader } from '../components/common/PageHeader';
import { AnnotatedImage } from '../components/common/AnnotatedImage';
import { DetectionsList } from '../components/analysis-detail/DetectionsList';
import { ViewerToolbar } from '../components/analysis-detail/ViewerToolbar';
import { NeedsReviewBanner } from '../components/analysis-detail/NeedsReviewBanner';
import { AnalysisMapCard } from '../components/analysis-detail/AnalysisMapCard';
import { CardSkeleton } from '../components/common/SkeletonLoader';
import { StatusBadge } from '../components/common/StatusBadge';
import { Card } from '../components/common/Card';
import { useSonarContext } from '../context/SonarContext';
import { useToast } from '../context/ToastContext';
import { ArrowLeft, CheckSquare, Compass, Calendar, Ship, RefreshCw, AlertCircle, CheckCircle, FileX } from 'lucide-react';
import { formatDate } from '../lib/utils';

export const AnalysisDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { settings } = useSonarContext();
  const { showToast } = useToast();

  const { data: analysis, isLoading, isError, refetch } = useAnalysisDetail(id || '');

  const [hoveredDetectionId, setHoveredDetectionId] = useState<string | null>(null);
  const [selectedDetectionId, setSelectedDetectionId] = useState<string | null>(null);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0);
  const [showLabels, setShowLabels] = useState<boolean>(true);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  // Not Found State
  if (isError || !analysis) {
    return (
      <div className="p-12 text-center bg-surface rounded-card border border-border space-y-4 max-w-lg mx-auto my-12">
        <div className="w-12 h-12 rounded-full bg-danger-tint text-danger flex items-center justify-center mx-auto">
          <FileX className="w-6 h-6" />
        </div>
        <h2 className="text-base font-semibold text-text">Analysis Campaign Not Found</h2>
        <p className="text-xs text-muted leading-relaxed">
          The requested sonar analysis campaign (ID: <span className="font-mono">{id}</span>) could not be located or may have been deleted.
        </p>
        <button
          onClick={() => navigate('/analyses')}
          className="px-4 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary-hover rounded-button transition-colors"
        >
          Back to Analyses List
        </button>
      </div>
    );
  }

  // Failed Analysis State
  if (analysis.status === 'failed') {
    return (
      <div className="p-12 text-center bg-surface rounded-card border border-border space-y-4 max-w-lg mx-auto my-12">
        <div className="w-12 h-12 rounded-full bg-danger-tint text-danger flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-semibold text-text">Neural Inferencing Failed</h2>
        <p className="text-xs text-muted leading-relaxed">
          A processing error occurred during acoustic feature extraction for {analysis.name}.
        </p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary-hover rounded-button transition-colors flex items-center gap-2 mx-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Inferencing</span>
        </button>
      </div>
    );
  }

  const pendingCount = analysis.detections.filter(
    (d) => d.status === 'pending_review'
  ).length;

  const handleDownloadAnnotated = () => {
    const a = document.createElement('a');
    a.href = analysis.imageUrl;
    a.download = `${analysis.name.replace(/[^a-z0-9]/gi, '_')}_annotated.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    showToast({
      type: 'info',
      title: 'Image Export Started',
      description: 'Downloading high-resolution annotated acoustic sonar image.',
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header with Breadcrumb Back */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/analyses')}
            className="p-2 text-muted hover:text-text rounded-button hover:bg-surface border border-border transition-colors shrink-0"
            title="Back to Analyses Archive"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-text truncate">{analysis.name}</h1>
              <StatusBadge status={analysis.detections.length === 0 ? 'auto_accepted' : pendingCount > 0 ? 'pending_review' : 'verified'} />
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-1 text-xs text-muted font-mono">
              <span className="flex items-center gap-1">
                <Ship className="w-3.5 h-3.5 text-primary" /> {analysis.vessel || 'RV Oceanus'}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-primary" /> {analysis.sonarType || 'Klein 4900'}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-primary" /> {formatDate(analysis.surveyDate)}
              </span>
            </div>
          </div>
        </div>

        {pendingCount > 0 && (
          <button
            onClick={() => navigate(`/review-queue?analysisId=${analysis.id}`)}
            className="px-4 py-2 text-xs font-semibold text-white bg-warning hover:bg-warning/90 rounded-button transition-colors flex items-center gap-1.5 shadow-subtle shrink-0"
          >
            <CheckSquare className="w-4 h-4" />
            <span>Review {pendingCount} Pending</span>
          </button>
        )}
      </div>

      {/* Needs Review Banner if low confidence targets exist */}
      <NeedsReviewBanner
        analysisId={analysis.id}
        pendingCount={pendingCount}
        reviewThreshold={settings.reviewThreshold}
      />

      {/* Zero Detections State Banner */}
      {analysis.detections.length === 0 ? (
        <Card className="p-12 text-center space-y-3 bg-surface border-border">
          <div className="w-12 h-12 rounded-full bg-success-tint text-success flex items-center justify-center mx-auto">
            <CheckCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-text">No Debris Detected</h3>
          <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
            Neural feature extraction completed with zero acoustic anomaly returns detected. The scanned seabed area is clean.
          </p>
        </Card>
      ) : (
        <>
          {/* Viewer Toolbar */}
          <ViewerToolbar
            confidenceThreshold={confidenceThreshold}
            onThresholdChange={setConfidenceThreshold}
            showLabels={showLabels}
            onToggleLabels={() => setShowLabels(!showLabels)}
            onDownloadAnnotated={handleDownloadAnnotated}
          />

          {/* Main 70% / 30% Desktop Split Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left ~70%: Annotated Sonar Image Viewer */}
            <div className="lg:col-span-8">
              <AnnotatedImage
                imageUrl={analysis.imageUrl}
                imageWidth={analysis.imageWidth}
                imageHeight={analysis.imageHeight}
                detections={analysis.detections}
                hoveredDetectionId={hoveredDetectionId}
                selectedDetectionId={selectedDetectionId}
                onSelectDetection={setSelectedDetectionId}
                onHoverDetection={setHoveredDetectionId}
                showLabels={showLabels}
                confidenceThreshold={confidenceThreshold}
              />
            </div>

            {/* Right ~30%: Detections Panel */}
            <div className="lg:col-span-4 space-y-6">
              <DetectionsList
                detections={analysis.detections}
                hoveredDetectionId={hoveredDetectionId}
                selectedDetectionId={selectedDetectionId}
                onSelectDetection={setSelectedDetectionId}
                onHoverDetection={setHoveredDetectionId}
                confidenceThreshold={confidenceThreshold}
              />
            </div>
          </div>

          {/* Small Map Card Below List */}
          <div className="w-full">
            <AnalysisMapCard
              detections={analysis.detections}
              selectedDetectionId={selectedDetectionId}
              onSelectDetection={setSelectedDetectionId}
            />
          </div>
        </>
      )}
    </div>
  );
};
