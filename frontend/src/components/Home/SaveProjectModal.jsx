import React from 'react';
import { Modal, Button, Input } from 'antd';

/**
 * Component for the save project modal
 */
const SaveProjectModal = ({
  isVisible,
  onClose,
  onSave,
  projectName,
  onProjectNameChange,
  isSaving,
  currentProjectId
}) => {
  return (
    <Modal
      title={currentProjectId ? "Cập nhật dự án tô màu" : "Lưu dự án tô màu"}
      open={isVisible}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={isSaving}>
          Hủy
        </Button>,
        <Button 
          key="save" 
          type="primary" 
          loading={isSaving}
          onClick={onSave}
        >
          {currentProjectId ? 'Cập nhật' : 'Lưu dự án'}
        </Button>
      ]}
    >
      <div className="py-4">
        <p className="mb-4">
          {currentProjectId 
            ? 'Cập nhật tên cho dự án tô màu này:' 
            : 'Đặt tên cho dự án tô màu này để dễ dàng tìm kiếm sau này:'}
        </p>
        <Input 
          placeholder="Tên dự án tô màu" 
          value={projectName}
          onChange={onProjectNameChange}
          maxLength={50}
          showCount
        />
        <div className="mt-4">
          <p className="text-sm text-gray-500">
            {currentProjectId 
              ? 'Dự án sẽ được cập nhật với các điểm màu và thiết lập hiện tại.'
              : 'Dự án sẽ lưu lại các điểm màu đã chọn và cài đặt hiện tại.'}
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default SaveProjectModal;