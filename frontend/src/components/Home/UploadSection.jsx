import React from 'react';
import { Button, Upload } from 'antd';
import { UploadOutlined, FolderOpenOutlined } from '@ant-design/icons';

/**
 * Component for image upload section
 */
const UploadSection = ({
  handleUpload,
  beforeUpload,
  handleOpenProjects,
  isColorizing,
  isAutoColorizing
}) => {
  return (
    <div className="mb-8 flex flex-col items-center">
      <div className="flex justify-center gap-4 mb-4 w-full max-w-md">
        <Upload
          beforeUpload={beforeUpload}
          customRequest={handleUpload}
          showUploadList={false}
          accept=".jpg,.jpeg,.png"
          className="flex-grow"
          disabled={isColorizing || isAutoColorizing}
        >
          <Button 
            icon={<UploadOutlined />} 
            size="large" 
            className="w-full"
            disabled={isColorizing || isAutoColorizing}
          >
            Chọn ảnh để tô màu
          </Button>
        </Upload>
        
        <Button
          icon={<FolderOpenOutlined />}
          onClick={handleOpenProjects}
          size="large"
          disabled={isColorizing || isAutoColorizing}
        >
          Mở dự án
        </Button>
      </div>
      <p className="text-sm text-gray-500 text-center">Hỗ trợ JPG, PNG (tối đa 5MB), dài rộng tối đa 2000px</p>
    </div>
  );
};

export default UploadSection;