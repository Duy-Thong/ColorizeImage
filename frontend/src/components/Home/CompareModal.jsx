import React from 'react';
import { Modal, Button } from 'antd';
import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider';

/**
 * Component for the comparison modal between original and colorized images
 */
const CompareModal = ({
  isVisible,
  onClose,
  imagePreview,
  colorizedImage,
  imageSize
}) => {
  if (!imagePreview || !colorizedImage) return null;
  
  return (
    <Modal
      title="So sánh ảnh gốc và ảnh tô màu"
      open={isVisible}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="close" onClick={onClose}>
          Đóng
        </Button>
      ]}
      className="image-compare-modal"
    >
      <div className="mt-4 mb-6">
        <p className="text-gray-600 mb-4 text-center">
          Kéo qua lại để so sánh ảnh gốc và ảnh đã tô màu
        </p>
        <div className="border border-gray-300 rounded-lg overflow-hidden compare-slider-container">
          <ReactCompareSlider
            itemOne={<ReactCompareSliderImage src={imagePreview} alt="Ảnh gốc" />}
            itemTwo={<ReactCompareSliderImage src={colorizedImage} alt="Ảnh tô màu" />}
            position={50}
            style={{
              width: '100%',
              height: 'auto',
              aspectRatio: imageSize.width / imageSize.height
            }}
          />
        </div>
        <div className="flex justify-between text-sm text-gray-500 mt-2 px-2">
          <span>Ảnh gốc</span>
          <span>Ảnh tô màu</span>
        </div>
      </div>
    </Modal>
  );
};

export default CompareModal;