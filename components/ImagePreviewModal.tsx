
import React from 'react';
import { X, Plus, Minus, RotateCcw } from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

interface ImagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
  altText?: string;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({ isOpen, onClose, imageUrl, altText = "Preview" }) => {
  if (!isOpen || !imageUrl) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Close Button - Fixed positioning relative to viewport, High Z-Index */}
      <button 
        onClick={(e) => {
            e.stopPropagation();
            onClose();
        }}
        className="fixed top-4 right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-3 rounded-full transition-all z-[10000] cursor-pointer"
      >
        <X size={32} />
      </button>

      {/* Main Container */}
      <div 
        className="w-full h-full flex items-center justify-center overflow-hidden"
        onClick={(e) => e.stopPropagation()} 
      >
        <TransformWrapper
          initialScale={1}
          minScale={0.5}
          maxScale={4}
          centerOnInit={true}
          wheel={{ step: 0.1 }}
        >
          {({ zoomIn, zoomOut, resetTransform }) => (
            <React.Fragment>
               {/* Controls Bar - Fixed positioning relative to viewport to stay visible when zoomed */}
               <div 
                 className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[10001] flex gap-4 bg-black/60 backdrop-blur-md px-6 py-3 rounded-full border border-white/10 shadow-xl"
                 onClick={(e) => e.stopPropagation()} // Prevent closing when clicking toolbar
               >
                  <button onClick={() => zoomOut()} className="text-white/80 hover:text-white hover:bg-white/20 p-2 rounded-full transition-colors">
                    <Minus size={24}/>
                  </button>
                  <button onClick={() => resetTransform()} className="text-white/80 hover:text-white hover:bg-white/20 p-2 rounded-full transition-colors border-x border-white/10 mx-1 px-4">
                    <RotateCcw size={20}/>
                  </button>
                  <button onClick={() => zoomIn()} className="text-white/80 hover:text-white hover:bg-white/20 p-2 rounded-full transition-colors">
                    <Plus size={24}/>
                  </button>
               </div>

               {/* The Image Area */}
               <TransformComponent 
                  wrapperClass="!w-screen !h-screen" 
                  contentClass="!w-screen !h-screen flex items-center justify-center"
               >
                  <div className="bg-[url('https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Grey_square.svg/20px-Grey_square.svg.png')] bg-repeat rounded-lg shadow-2xl overflow-hidden max-w-[95vw] max-h-[85vh]">
                      <img
                        src={imageUrl}
                        alt={altText}
                        className="max-w-[95vw] max-h-[85vh] object-contain block"
                        onClick={(e) => e.stopPropagation()}
                      />
                  </div>
               </TransformComponent>
            </React.Fragment>
          )}
        </TransformWrapper>
      </div>
    </div>
  );
};
