import React from 'react';
import { Button, ColorPicker } from 'antd';
import { HighlightOutlined } from '@ant-design/icons';

const ColorPickerPanel = ({
  selectedPoint,
  selectedColor,
  handleColorSelect,
  addColorPoint,
  isColorizing,
  isAutoColorizing
}) => {
  if (!selectedPoint) return null;

  return (
    <div className="flex justify-center items-center gap-4 mt-5">
      <div className="flex items-center gap-2">
        <span className="text-gray-700">Chọn màu:</span>
        <ColorPicker
          value={selectedColor}
          onChange={handleColorSelect}
          disabled={isColorizing || isAutoColorizing}
          showAlpha={true}
          defaultFormat="rgb"
        />
      </div>
      <Button
        type="primary"
        icon={<HighlightOutlined />}
        onClick={addColorPoint}
        disabled={!selectedPoint || isColorizing || isAutoColorizing}
        size="large"
      >
        Thêm điểm màu
      </Button>
    </div>
  );
};

export default ColorPickerPanel;