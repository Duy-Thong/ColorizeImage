import React from 'react';
import { Button } from 'antd';
import { 
  HighlightOutlined, 
  BgColorsOutlined, 
  SwapLeftOutlined, 
  DownloadOutlined,
  SaveOutlined,
  ShareAltOutlined
} from '@ant-design/icons';

/**
 * Component for action buttons (colorize, download, save, etc.)
 */
const ActionButtons = ({
  colorPoints,
  isColorizing,
  isAutoColorizing,
  colorizedImage,
  handleMainColorize,
  handleDownloadImage,
  handleShowCompareModal,
  handleShowSaveModal,
  handleShareResult,
  isSaving
}) => {
  return (
    <div className="flex flex-col justify-center w-full gap-2 items-center">
      <Button
        type="primary"
        icon={colorPoints.length > 0 ? <HighlightOutlined /> : <BgColorsOutlined />}
        loading={colorPoints.length > 0 ? isColorizing : isAutoColorizing} 
        onClick={handleMainColorize} 
        size="large"
        disabled={isColorizing || isAutoColorizing} 
        className="w-full max-w-xs"
      >
        Tô màu
      </Button>
      
      {colorizedImage && (
        <div className="action-buttons-group flex flex-wrap gap-2">
          <Button
            type="default"
            icon={<SwapLeftOutlined />}
            onClick={handleShowCompareModal}
            size="large"
            className="result-action-btn"
          >
            <span className="btn-text">So sánh</span>
          </Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleDownloadImage}
            className="result-action-btn"
            size="large"
          >
            <span className="btn-text">Tải xuống</span>
          </Button>
          <Button
            type="default"
            icon={<SaveOutlined />}
            onClick={handleShowSaveModal}
            size="large"
            className="result-action-btn"
            loading={isSaving}
          >
            <span className="btn-text">Lưu</span>
          </Button>
          <Button
            type="default"
            icon={<ShareAltOutlined />}
            onClick={handleShareResult}
            size="large"
            className="result-action-btn"
          >
            <span className="btn-text">Chia sẻ</span>
          </Button>
        </div>
      )}
    </div>
  );
};

export default ActionButtons;