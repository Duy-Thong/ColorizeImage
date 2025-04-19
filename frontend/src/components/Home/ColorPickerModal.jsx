import React from 'react';
import { Modal, Button, ColorPicker, Spin, Tooltip } from 'antd';
import { SendOutlined, BulbOutlined } from '@ant-design/icons';

/**
 * Component for the color picker modal
 */
const ColorPickerModal = ({
  isVisible,
  selectedColor,
  handleColorSelect,
  handleAddPoint,
  handleCancel,
  isColorizing,
  isAutoColorizing,
  editingPointIndex,
  colorSuggestions,
  isFetchingSuggestions,
  handleSuggestionSelect
}) => {
  return (
    <Modal
      title="Chọn màu"
      open={isVisible}
      onCancel={handleCancel}
      footer={[
        <Button 
          key="cancel" 
          onClick={handleCancel} 
          disabled={isColorizing || isAutoColorizing}
        >
          Hủy
        </Button>,
        <Button 
          key="submit" 
          type="primary" 
          onClick={handleAddPoint}
          icon={<SendOutlined />}
          disabled={isColorizing || isAutoColorizing}
        >
          {editingPointIndex !== null ? 'Cập nhật' : 'Xác nhận'}
        </Button>,
      ]}
    >
      <div className="flex flex-col items-center gap-5">
        <div className="flex items-center gap-3 w-full justify-center">
          <span>Chọn màu và độ mờ:</span>
          <ColorPicker
            value={selectedColor}
            onChange={handleColorSelect}
            disabled={isColorizing || isAutoColorizing}
            showAlpha={true}
            defaultFormat="rgb"
          />
        </div>
        
        {/* Color suggestions section */}
        <div className="w-full border-t border-gray-200 pt-4 mt-2">
          <h4 className="text-sm font-medium flex items-center gap-1 mb-2">
            <BulbOutlined style={{ color: '#faad14' }} />
            Gợi ý màu cho vị trí này:
          </h4>
          
          {isFetchingSuggestions ? (
            <div className="flex justify-center py-2">
              <Spin size="small" tip="Đang tải gợi ý..." />
            </div>
          ) : colorSuggestions.length > 0 ? (
            <div className="flex justify-center gap-2 flex-wrap">
              {colorSuggestions.map((suggestion, idx) => (
                <Tooltip 
                  key={idx} 
                  title={`Đề xuất ${idx + 1} - Độ tin cậy: ${Math.round(suggestion.confidence * 100)}%`}
                >
                  <div
                    className="w-10 h-10 rounded-full border-2 border-gray-200 hover:border-blue-500 cursor-pointer transition-all"
                    style={{ backgroundColor: suggestion.color }}
                    onClick={() => handleSuggestionSelect(suggestion.color)}
                  />
                </Tooltip>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500 text-center">
              Không có gợi ý màu hoặc đã xảy ra lỗi khi tải gợi ý.
            </p>
          )}
        </div>
        
        <div className="w-full pt-2">
          <p className="text-gray-600 text-sm mb-2 text-center">
            Độ đậm của màu sẽ ảnh hưởng đến mức độ tác động của điểm tô màu.
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default ColorPickerModal;