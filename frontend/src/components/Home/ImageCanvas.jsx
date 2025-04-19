import React from 'react';
import { Spin } from 'antd';

/**
 * Component for displaying the image and handling point selection/manipulation
 */
const ImageCanvas = ({
  imagePreview,
  colorizedImage,
  imageSize,
  colorPoints,
  selectedPoint,
  selectedColor,
  isColorizing,
  isAutoColorizing,
  draggingPointIndex,
  handleImageClick,
  handleDragStart,
  handleDragEnd,
  handlePointDoubleClick,
  handleDragOver,
  handleDrop
}) => {
  return (
    <div className="mb-6">
      <h3 className="text-xl font-semibold text-gray-800 mb-4 text-center">
        Ảnh gốc
      </h3>
      <div 
        className={`relative border-2 glassmorphism border-blue-500 rounded-lg mx-auto overflow-hidden ${draggingPointIndex !== null ? 'border-dashed border-green-500' : ''}`}
        style={{ 
          maxWidth: '100%',
          cursor: selectedPoint ? 'default' : (isColorizing || isAutoColorizing ? 'wait' : (draggingPointIndex !== null ? 'grabbing' : 'crosshair'))
        }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <img 
          src={imagePreview === colorizedImage ? null : imagePreview} 
          alt="Preview" 
          className="w-full h-auto rounded-lg"
          onClick={!(isColorizing || isAutoColorizing || draggingPointIndex !== null) ? handleImageClick : undefined}
          style={{ 
            display: imagePreview === colorizedImage ? 'none' : 'block', 
            pointerEvents: draggingPointIndex !== null ? 'none' : 'auto' 
          }}
        />

        {/* Display existing color points on the image */}
        {colorPoints.map((cp, index) => (
          <div 
            key={`point-${index}`}
            className={`absolute w-5 h-5 rounded-full border-2 border-white shadow-lg flex items-center justify-center ${!(isColorizing || isAutoColorizing) ? 'cursor-pointer' : 'cursor-not-allowed'}`}
            style={{
              backgroundColor: cp.displayColor,
              left: `${(cp.displayPoint.x / imageSize.width) * 100}%`, 
              top: `${(cp.displayPoint.y / imageSize.height) * 100}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: 10,
              display: imagePreview === colorizedImage ? 'none' : 'block',
              opacity: draggingPointIndex === index ? 0.5 : 1
            }}
            title={`Nhấp để sửa/xóa | Kéo để di chuyển | Nhấp đôi để đổi màu | Màu: ${cp.displayColor}`}
            draggable={!(isColorizing || isAutoColorizing)}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragEnd={handleDragEnd}
            onClick={(e) => {
              e.stopPropagation();
              if (!(isColorizing || isAutoColorizing)) {
                // These functions need to be passed from parent component
                // In the parent we would call:
                // setEditingPointIndex(index);
                // setSelectedPoint(cp.displayPoint);
                // setSelectedColor(cp.displayColor);
                // setShowColorPicker(true);
              }
            }}
            onDoubleClick={(e) => handlePointDoubleClick(e, index)}
          >
            {/* Display point number */}
            <span className="text-xs font-bold text-white" style={{ textShadow: '0px 0px 2px black' }}>
              {index + 1}
            </span>
          </div>
        ))}

        {/* Display the currently selected point before confirmation */}
        {selectedPoint && (
          <div 
            className="absolute w-5 h-5 rounded-full border-2 border-white shadow-lg animate-pulse" 
            style={{
              backgroundColor: selectedColor,
              left: `${(selectedPoint.x / imageSize.width) * 100}%`, 
              top: `${(selectedPoint.y / imageSize.height) * 100}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: 20
            }}
          />
        )}

        {/* Show loading overlay when processing */}
        {(isColorizing || isAutoColorizing) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 z-30">
            <Spin size="large" />
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageCanvas;