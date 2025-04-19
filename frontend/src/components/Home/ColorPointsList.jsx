import React from 'react';
import { Button } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';

/**
 * Component to display the list of color points
 */
const ColorPointsList = ({ colorPoints, isColorizing, isAutoColorizing, handleDeletePoint }) => {
  if (colorPoints.length === 0) {
    return (
      <div className="text-center text-gray-500 h-full flex items-center justify-center">
        <p>Chưa có điểm màu nào được chọn.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto md:mx-0">
      <h4 className="text-lg font-semibold text-gray-700 mb-3 text-center">Điểm màu đã chọn ({colorPoints.length})</h4>
      <ul className="space-y-2 max-h-40 overflow-y-auto px-2">
        {colorPoints.map((cp, index) => (
          <li key={`list-${index}`} className="flex items-center justify-between bg-gray-50 p-2 rounded border border-gray-200">
            <div className="flex items-center gap-2">
              <div 
                className="w-5 h-5 rounded border border-gray-400 flex items-center justify-center" 
                style={{ backgroundColor: cp.displayColor }}
              >
                <span className="text-xs font-bold text-white" style={{ textShadow: '0px 0px 2px black' }}>
                  {index + 1}
                </span>
              </div>
              <span className="text-sm text-gray-600">
                Màu: {cp.displayColor} (X: {cp.displayPoint.x}, Y: {cp.displayPoint.y})
              </span>
            </div>
            <Button
              icon={<DeleteOutlined />}
              size="small"
              danger
              onClick={() => handleDeletePoint(index)}
              disabled={isColorizing || isAutoColorizing} 
            />
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ColorPointsList;