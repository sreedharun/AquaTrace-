import React, { useRef } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { Detection } from '../../types/sonar';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { getDebrisClassInfo } from '../../config/classes';

interface AnnotatedImageProps {
  imageUrl: string;
  imageWidth?: number;
  imageHeight?: number;
  detections: Detection[];
  hoveredDetectionId?: string | null;
  selectedDetectionId?: string | null;
  onSelectDetection: (id: string) => void;
  onHoverDetection?: (id: string | null) => void;
  showLabels?: boolean;
  confidenceThreshold?: number;
  isInteractive?: boolean;
  maxHeight?: string;
}

export const AnnotatedImage: React.FC<AnnotatedImageProps> = React.memo(({
  imageUrl,
  imageWidth = 1280,
  imageHeight = 1280,
  detections,
  hoveredDetectionId = null,
  selectedDetectionId = null,
  onSelectDetection,
  onHoverDetection,
  showLabels = true,
  confidenceThreshold = 0,
  isInteractive = true,
  maxHeight = '580px',
}) => {
  const transformRef = useRef<any>(null);

  // Filter detections by confidence threshold
  const visibleDetections = detections.filter((d) => d.confidence >= confidenceThreshold);

  return (
    <div className="relative w-full h-[520px] md:h-[620px] bg-[#0A131C] rounded-card border border-border overflow-hidden group select-none flex flex-col">
      <TransformWrapper
        ref={transformRef}
        initialScale={1}
        minScale={0.5}
        maxScale={8}
        centerOnInit
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            {/* Overlay Control Bar */}
            {isInteractive && (
              <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 p-1.5 bg-surface/90 backdrop-blur-md rounded-button border border-border shadow-popover">
                <button
                  type="button"
                  onClick={() => zoomIn()}
                  className="p-1.5 text-text hover:text-primary rounded hover:bg-background transition-colors"
                  title="Zoom In (+)"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => zoomOut()}
                  className="p-1.5 text-text hover:text-primary rounded hover:bg-background transition-colors"
                  title="Zoom Out (-)"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <div className="w-[1px] h-4 bg-border mx-0.5" />
                <button
                  type="button"
                  onClick={() => resetTransform()}
                  className="p-1.5 text-text hover:text-primary rounded hover:bg-background transition-colors"
                  title="Fit to Screen"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Image Canvas with SVG Overlay */}
            <TransformComponent
              wrapperStyle={{ width: '100%', height: '100%' }}
              contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <div className="relative inline-block max-w-full max-h-full">
                {/* Sonar Base Image */}
                <img
                  src={imageUrl}
                  alt="Annotated Side-Scan Sonar Analysis"
                  className="block w-full h-auto object-contain pointer-events-none"
                  style={{ maxHeight }}
                />

                {/* SVG Overlay for Bounding Boxes */}
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox="0 0 1 1"
                  preserveAspectRatio="none"
                  style={{ overflow: 'visible' }}
                >
                  {visibleDetections.map((d) => {
                    const isHovered = hoveredDetectionId === d.id;
                    const isSelected = selectedDetectionId === d.id;
                    const classInfo = getDebrisClassInfo(d.class);
                    const strokeColor = isSelected ? '#38bdf8' : isHovered ? '#60a5fa' : (classInfo?.color || '#f59e0b');

                    return (
                      <g key={d.id} className="pointer-events-auto">
                        <rect
                          x={d.bbox.x}
                          y={d.bbox.y}
                          width={d.bbox.w}
                          height={d.bbox.h}
                          fill={strokeColor}
                          fillOpacity={isSelected ? 0.25 : isHovered ? 0.18 : 0.08}
                          stroke={strokeColor}
                          strokeDasharray={d.status === 'pending_review' ? '0.008 0.004' : undefined}
                          style={{
                            vectorEffect: 'non-scaling-stroke',
                            strokeWidth: isSelected ? 3.5 : isHovered ? 2.5 : 2,
                            cursor: 'pointer'
                          }}
                          onClick={() => onSelectDetection(d.id)}
                          onMouseEnter={() => onHoverDetection && onHoverDetection(d.id)}
                          onMouseLeave={() => onHoverDetection && onHoverDetection(null)}
                        />
                      </g>
                    );
                  })}
                </svg>

                {/* HTML Label Chips over Bounding Boxes */}
                {showLabels &&
                  visibleDetections.map((d) => {
                    const isHovered = hoveredDetectionId === d.id;
                    const isSelected = selectedDetectionId === d.id;
                    const classInfo = getDebrisClassInfo(d.class);
                    const badgeColor = classInfo?.color || '#38bdf8';

                    return (
                      <div
                        key={`label-${d.id}`}
                        style={{
                          left: `${(d.bbox.x + d.bbox.w / 2) * 100}%`,
                          top: `${d.bbox.y * 100}%`,
                          transform: 'translate(-50%, -100%)',
                        }}
                        className={`absolute z-10 pointer-events-none mb-1 transition-all duration-150 flex items-center gap-1 ${
                          isHovered || isSelected ? 'scale-110 z-20' : 'scale-90 opacity-90'
                        }`}
                      >
                        <div
                          className={`px-1.5 py-0.5 rounded bg-surface/95 backdrop-blur-xs border text-[10px] font-semibold flex items-center gap-1 text-text whitespace-nowrap shadow-popover ${
                            isSelected ? 'border-primary ring-1 ring-primary' : 'border-border'
                          }`}
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: badgeColor }}
                          />
                          <span>{classInfo?.name || d.class}</span>
                          <span className="text-muted font-mono">{Math.round(d.confidence * 100)}%</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </TransformComponent>
          </>
        )}
      </TransformWrapper>

      {/* Range Scale Info Footer */}
      <div className="px-4 py-2 bg-surface/95 border-t border-border flex items-center justify-between text-xs text-muted font-mono z-10">
        <span>Acoustic Target Normalized BBox Overlay</span>
        <span>
          Showing <strong className="text-text">{visibleDetections.length}</strong> / {detections.length} Detections
        </span>
      </div>
    </div>
  );
});

AnnotatedImage.displayName = 'AnnotatedImage';
