import React, { useEffect, useRef, useState } from 'react';
import { X, ZoomIn, ZoomOut, Check, Move } from 'lucide-react';

interface ImageCropperModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  title?: string;
  shape?: 'circle' | 'square';
  outputSize?: number;
  onClose: () => void;
  onConfirm: (croppedDataUrl: string) => void;
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  isOpen,
  imageSrc,
  title = 'Crop & Adjust Image',
  shape = 'circle',
  outputSize = 240,
  onClose,
  onConfirm,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState<number>(100);
  const [minZoom, setMinZoom] = useState<number>(20);
  const [maxZoom, setMaxZoom] = useState<number>(300);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const CROP_VIEW_SIZE = 260;

  useEffect(() => {
    if (!isOpen || !imageSrc) return;
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const fitScale = Math.max(CROP_VIEW_SIZE / img.width, CROP_VIEW_SIZE / img.height);
      const fitPct = Math.round(fitScale * 100);
      const minP = Math.max(10, Math.round(fitPct * 0.5));
      const maxP = Math.max(300, fitPct * 3);
      setMinZoom(minP);
      setMaxZoom(maxP);
      setZoom(fitPct);
      setOffset({
        x: (CROP_VIEW_SIZE - img.width * fitScale) / 2,
        y: (CROP_VIEW_SIZE - img.height * fitScale) / 2,
      });
    };
    img.src = imageSrc;
  }, [isOpen, imageSrc]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !isOpen) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = zoom / 100;
    ctx.clearRect(0, 0, CROP_VIEW_SIZE, CROP_VIEW_SIZE);
    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(0, 0, CROP_VIEW_SIZE, CROP_VIEW_SIZE);

    ctx.save();
    ctx.beginPath();
    if (shape === 'circle') {
      ctx.arc(CROP_VIEW_SIZE / 2, CROP_VIEW_SIZE / 2, CROP_VIEW_SIZE / 2 - 4, 0, Math.PI * 2);
    } else {
      ctx.roundRect(8, 8, CROP_VIEW_SIZE - 16, CROP_VIEW_SIZE - 16, 12);
    }
    ctx.clip();
    ctx.drawImage(img, offset.x, offset.y, img.width * scale, img.height * scale);
    ctx.restore();

    ctx.strokeStyle = '#cc0000';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    if (shape === 'circle') {
      ctx.arc(CROP_VIEW_SIZE / 2, CROP_VIEW_SIZE / 2, CROP_VIEW_SIZE / 2 - 4, 0, Math.PI * 2);
    } else {
      ctx.roundRect(8, 8, CROP_VIEW_SIZE - 16, CROP_VIEW_SIZE - 16, 12);
    }
    ctx.stroke();
  }, [zoom, offset, isOpen, shape, imageSrc]);

  if (!isOpen || !imageSrc) return null;

  const handleZoomChange = (newZoom: number) => {
    const img = imgRef.current;
    if (!img) return;
    const clamped = Math.max(minZoom, Math.min(maxZoom, newZoom));
    const oldScale = zoom / 100;
    const newScale = clamped / 100;
    const centerX = (CROP_VIEW_SIZE / 2 - offset.x) / oldScale;
    const centerY = (CROP_VIEW_SIZE / 2 - offset.y) / oldScale;
    setZoom(clamped);
    setOffset({
      x: CROP_VIEW_SIZE / 2 - centerX * newScale,
      y: CROP_VIEW_SIZE / 2 - centerY * newScale,
    });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setDragging(true);
    dragStartRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragging) return;
    setOffset({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => setDragging(false);

  const handleApply = () => {
    const img = imgRef.current;
    if (!img) return;
    const outCanvas = document.createElement('canvas');
    outCanvas.width = outputSize;
    outCanvas.height = outputSize;
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) return;

    const ratio = outputSize / CROP_VIEW_SIZE;
    const scale = zoom / 100;

    if (shape === 'circle') {
      outCtx.beginPath();
      outCtx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
      outCtx.clip();
    } else {
      outCtx.fillStyle = '#111622';
      outCtx.fillRect(0, 0, outputSize, outputSize);
    }

    outCtx.drawImage(
      img,
      offset.x * ratio,
      offset.y * ratio,
      img.width * scale * ratio,
      img.height * scale * ratio
    );

    const dataUrl = outCanvas.toDataURL('image/jpeg', 0.86);
    onConfirm(dataUrl);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-700/80 bg-[#121620] text-slate-100 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <h3 className="font-heading text-base font-bold tracking-wider uppercase text-white">
              {title}
            </h3>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
              <Move className="w-3.5 h-3.5 text-red-500" /> Drag to reposition · Scroll or slide to zoom
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center">
          <div className="relative rounded-2xl overflow-hidden shadow-inner border border-slate-800 bg-[#0b0e14]">
            <canvas
              ref={canvasRef}
              width={CROP_VIEW_SIZE}
              height={CROP_VIEW_SIZE}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={(e) => {
                e.preventDefault();
                handleZoomChange(zoom + (e.deltaY < 0 ? 8 : -8));
              }}
              className="cursor-grab active:cursor-grabbing block"
            />
          </div>

          <div className="w-full mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleZoomChange(zoom - 10)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <input
              type="range"
              min={minZoom}
              max={maxZoom}
              value={zoom}
              onChange={(e) => handleZoomChange(Number(e.target.value))}
              className="flex-1 accent-[#cc0000] cursor-pointer"
            />
            <button
              type="button"
              onClick={() => handleZoomChange(zoom + 10)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <span className="font-mono-tabular text-xs text-slate-400 w-12 text-right">
              {zoom}%
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-800 bg-slate-900/50 px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="flex items-center gap-1.5 rounded-lg bg-[#cc0000] hover:bg-red-700 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-red-950/40 transition-colors"
          >
            <Check className="w-4 h-4" /> Apply Crop
          </button>
        </div>
      </div>
    </div>
  );
};
