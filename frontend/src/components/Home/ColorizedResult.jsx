import React from 'react';
import { Spin } from 'antd';

/**
 * Component to display the colorized result image
 */
const ColorizedResult = ({
  isColorizing,
  isAutoColorizing,
  colorizedImage,
  imagePreview,
  colorPoints
}) => {
  return (
    <div className="mb-6 flex flex-col">
      <h3 className="text-xl font-semibold text-gray-800 mb-4 text-center">
        {isColorizing || isAutoColorizing ? 'Đang xử lý...' : (colorizedImage ? 'Kết quả tô màu' : 'Ảnh chưa tô màu')}
      </h3>
      <div className={`flex-grow ${isColorizing || isAutoColorizing ? 'border-yellow-500 animate-pulse' : (colorizedImage ? 'border-green-500' : 'border-gray-300')} rounded-lg border-1 mx-auto w-full flex items-center justify-center glassmorphism overflow-hidden`}>
        {isColorizing || isAutoColorizing ? (
          <Spin size="large" tip="Đang tô màu..." />
        ) : colorizedImage ? (
          <div className="relative w-full">
            <img 
              src={colorizedImage} 
              alt="Colorized" 
              className="w-full h-auto rounded-lg object-contain"
            />
          </div>
        ) : (
          <div className="text-center text-gray-500 p-4">
            <p>Kết quả tô màu sẽ hiển thị ở đây.</p>
            {imagePreview && colorPoints.length === 0 && <p>Nhấn 'Tô màu tự động' hoặc chọn điểm màu.</p>}
            {imagePreview && colorPoints.length > 0 && <p>Thêm điểm màu hoặc nhấn 'Tô màu với điểm đã chọn'.</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default ColorizedResult;