import React from 'react';
import { Alert, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

/**
 * Component to display API errors with retry functionality
 */
const ErrorAlert = ({ apiError, retryCount, onRetry }) => {
  if (!apiError) return null;
  
  return (
    <div className="mb-8">
      <Alert
        message="Lỗi khi tô màu"
        description={
          <div className="pt-3">
            <p>{apiError.message}</p>
            {apiError.isCors && (
              <div className="mt-3 text-sm text-gray-600">
                <p>Giải pháp có thể:</p>
                <ol className="list-decimal pl-5">
                  <li>Kiểm tra máy chủ Python đã được khởi động</li>
                  <li>Kiểm tra cấu hình CORS trong máy chủ Python</li>
                </ol>
              </div>
            )}
          </div>
        }
        type="error"
        showIcon
        action={
          <Button 
            icon={<ReloadOutlined />} 
            onClick={onRetry}
            type="primary"
          >
            Thử lại ({retryCount})
          </Button>
        }
      />
    </div>
  );
};

export default ErrorAlert;