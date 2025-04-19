import React from 'react';
import { Modal, Button, List, Card, Spin } from 'antd';
import { BgColorsOutlined } from '@ant-design/icons';

/**
 * Component for the projects modal to display and load saved projects
 */
const ProjectsModal = ({
  isVisible,
  onClose,
  onLoadProject,
  savedProjects,
  loadingProjects,
}) => {
  // Component for project thumbnails
  const ProjectThumbnail = ({ project }) => {
    const [thumbnail, setThumbnail] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    
    React.useEffect(() => {
      const fetchThumbnail = async () => {
        if (!project.sessionId || !project.hasColorizedResult) {
          setLoading(false);
          return;
        }
        
        try {
          const response = await fetch(`http://127.0.0.1:5000/get_result_file?session_id=${project.sessionId}`);
          if (response.ok) {
            const blob = await response.blob();
            setThumbnail(URL.createObjectURL(blob));
          }
        } catch (error) {
          console.error('Error fetching thumbnail:', error);
        } finally {
          setLoading(false);
        }
      };
      
      fetchThumbnail();
    }, [project.sessionId, project.hasColorizedResult]);
    
    return (
      <div 
        style={{
          height: '180px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          backgroundColor: '#f0f2f5',
          cursor: 'pointer'
        }}
      >
        {loading ? (
          <Spin size="small" />
        ) : thumbnail ? (
          <img 
            src={thumbnail} 
            alt={project.name} 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
          />
        ) : (
          <div style={{ fontSize: '40px', color: '#bfbfbf' }}>{project.name?.charAt(0) || '?'}</div>
        )}
      </div>
    );
  };

  return (
    <Modal
      title="Dự án đã lưu"
      open={isVisible}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          Đóng
        </Button>
      ]}
      width={700}
    >
      {loadingProjects ? (
        <div className="flex justify-center py-8">
          <Spin size="large" tip="Đang tải dự án..." />
        </div>
      ) : savedProjects.length > 0 ? (
        <List
          grid={{ gutter: 16, xs: 1, sm: 2, md: 2, lg: 2, xl: 3, xxl: 3 }}
          dataSource={savedProjects}
          renderItem={(project) => (
            <List.Item>
              <Card 
                hoverable
                style={{ width: '200px' }}
                onClick={() => onLoadProject(project)}
                cover={<ProjectThumbnail project={project} />}
              >
                <Card.Meta 
                  title={project.name || 'Dự án không tên'}
                  description={
                    <div>
                      <p className="text-xs text-gray-500">
                        {project.createdAt.toLocaleString('vi-VN')}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {project.hasColorizedResult ? 
                          <><BgColorsOutlined /> Có ảnh tô màu</> : 
                          <>{project.colorPoints?.length || 0} điểm màu</>
                        }
                      </p>
                    </div>
                  }
                />
              </Card>
            </List.Item>
          )}
        />
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-500">Chưa có dự án nào được lưu.</p>
          <p className="text-gray-500 mt-2">Hãy tạo một dự án mới và sử dụng nút "Lưu" để lưu lại.</p>
        </div>
      )}
    </Modal>
  );
};

export default ProjectsModal;