import React, { useState, useEffect } from 'react';
import { getDatabase, ref, get, remove, update, query, orderByChild } from 'firebase/database';
import { useUser } from '../../contexts/UserContext';
import { useNavigate } from 'react-router-dom';
import { 
  Typography, 
  Spin, 
  Alert, 
  Card, 
  Button, 
  Input, 
  Modal, 
  message, 
  Pagination, 
  Tooltip,
  Dropdown,
  Space,
  Tag,
  Empty,
  Select
} from 'antd';
import { 
  SearchOutlined, 
  DeleteOutlined, 
  EditOutlined,
  MoreOutlined,
  SortAscendingOutlined,
  EyeOutlined,
  CalendarOutlined,
  TagOutlined,
  FileImageOutlined
} from '@ant-design/icons';
import axios from 'axios';
import Navbar from '../../components/Navbar';
import RequireLogin from '../../components/RequireLogin';

const { Title } = Typography;
const { Option } = Select;

const ProjectCard = ({ project, onEdit, onDelete, onSelect }) => {
  const [thumbnail, setThumbnail] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
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

  // Format date nicely
  const formatDate = (dateString) => {
    if (!dateString) return 'Không có ngày';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const items = [
    {
      key: 'edit',
      label: 'Đổi tên',
      icon: <EditOutlined />,
      onClick: () => onEdit(project)
    },
    {
      key: 'delete',
      label: 'Xóa dự án',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: () => onDelete(project)
    },
  ];
  
  return (
    <Card 
      hoverable
      className="project-card glassmorphism border-2 border-gray-200 shadow-lg"
      cover={
        <div 
          className="project-thumbnail" 
          onClick={() => onSelect(project)}
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
            <FileImageOutlined style={{ fontSize: '40px', color: '#bfbfbf' }} />
          )}
        </div>
      }
      actions={[
        <Tooltip title="Mở dự án">
          <Button 
            type="text" 
            icon={<EyeOutlined />} 
            onClick={() => onSelect(project)}
          />
        </Tooltip>,
        <Tooltip title="Đổi tên">
          <Button 
            type="text" 
            icon={<EditOutlined />} 
            onClick={(e) => {
              e.stopPropagation();
              onEdit(project);
            }}
          />
        </Tooltip>,
        <Tooltip title="Xóa dự án">
          <Button 
            type="text" 
            danger
            icon={<DeleteOutlined />} 
            onClick={(e) => {
              e.stopPropagation();
              onDelete(project);
            }}
          />
        </Tooltip>
      ]}
    >
      <Card.Meta
        title={
          <Tooltip title={project.name}>
            <div className="truncate-text" style={{ maxWidth: '100%' }}>
              {project.name || 'Dự án không tên'}
            </div>
          </Tooltip>
        }
        description={
          <div className="space-y-1">
            <div className="flex items-center text-xs text-gray-500">
              <CalendarOutlined style={{ marginRight: '4px' }} />
              {formatDate(project.createdAt)}
            </div>
            <div className="flex items-center text-xs text-gray-500">
              <TagOutlined style={{ marginRight: '4px' }} />
              {project.colorPoints?.length || 0} điểm màu
            </div>
          </div>
        }
      />
    </Card>
  );
};

const Projects = () => {
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingProject, setEditingProject] = useState(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [sortOrder, setSortOrder] = useState('newest');
  const [hasColorizedFilter, setHasColorizedFilter] = useState('all');
  
  const { userId, logout } = useUser();
  const navigate = useNavigate();
  
  // Fetch projects on component mount
  useEffect(() => {
    if (userId) {
      fetchProjects();
    }
  }, [userId]);
  
  // Apply filters when search text, sort order, or colorized filter changes
  useEffect(() => {
    applyFilters();
  }, [projects, searchText, sortOrder, hasColorizedFilter]);
  
  const fetchProjects = async () => {
    setLoading(true);
    try {
      const db = getDatabase();
      const projectsRef = ref(db, `color-projects/${userId}`);
      const snapshot = await get(projectsRef);
      
      if (snapshot.exists()) {
        const projectsData = snapshot.val();
        // Convert Firebase object to array with IDs
        const projectsArray = Object.keys(projectsData).map(key => ({
          id: key,
          ...projectsData[key],
        }));
        
        setProjects(projectsArray);
        setFilteredProjects(projectsArray);
      } else {
        setProjects([]);
        setFilteredProjects([]);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError('Không thể tải dự án. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };
  
  // Apply filters and sort to projects
  const applyFilters = () => {
    // Start with all projects
    let filtered = [...projects];
    
    // Apply search filter
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(project => 
        (project.name && project.name.toLowerCase().includes(searchLower)) || 
        (project.originalFilename && project.originalFilename.toLowerCase().includes(searchLower))
      );
    }
    
    // Apply colorized filter
    if (hasColorizedFilter !== 'all') {
      const hasResults = hasColorizedFilter === 'with';
      filtered = filtered.filter(project => project.hasColorizedResult === hasResults);
    }
    
    // Apply sort
    if (sortOrder === 'newest') {
      filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    } else if (sortOrder === 'oldest') {
      filtered.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    } else if (sortOrder === 'name') {
      filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sortOrder === 'updated') {
      filtered.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
    }
    
    setFilteredProjects(filtered);
  };
  
  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  
  const handleSelectProject = (project) => {
    // Navigate to home with the project ID to load
    navigate(`/home?projectId=${project.id}`);
  };
  
  const handleEditProject = (project) => {
    setEditingProject(project);
    setNewProjectName(project.name || '');
    setIsEditModalVisible(true);
  };
  
  const handleDeleteProject = (project) => {
    Modal.confirm({
      title: 'Xác nhận xóa dự án',
      content: `Bạn có chắc chắn muốn xóa dự án "${project.name || 'không tên'}"? Hành động này không thể hoàn tác.`,
      okText: 'Xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          const db = getDatabase();
          const projectRef = ref(db, `color-projects/${userId}/${project.id}`);
          await remove(projectRef);
          message.success('Đã xóa dự án thành công!');
          
          // Remove from local state
          setProjects(prev => prev.filter(p => p.id !== project.id));
        } catch (err) {
          console.error('Error deleting project:', err);
          message.error('Không thể xóa dự án. Vui lòng thử lại.');
        }
      }
    });
  };
  
  const handleUpdateProjectName = async () => {
    if (!editingProject) return;
    
    try {
      const db = getDatabase();
      const projectRef = ref(db, `color-projects/${userId}/${editingProject.id}`);
      
      await update(projectRef, {
        name: newProjectName.trim() || `Dự án ngày ${new Date().toLocaleDateString('vi-VN')}`,
        updatedAt: new Date().toISOString()
      });
      
      message.success('Đã cập nhật tên dự án!');
      
      // Update project in local state
      setProjects(prev => prev.map(p => {
        if (p.id === editingProject.id) {
          return {
            ...p,
            name: newProjectName.trim() || `Dự án ngày ${new Date().toLocaleDateString('vi-VN')}`,
            updatedAt: new Date().toISOString()
          };
        }
        return p;
      }));
      
      setIsEditModalVisible(false);
    } catch (err) {
      console.error('Error updating project name:', err);
      message.error('Không thể cập nhật tên dự án. Vui lòng thử lại.');
    }
  };
  
  // Calculate current page data
  const paginatedData = filteredProjects.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  if (error) {
    return (
      <div>
        <Navbar onLogout={handleLogout} />
        <div className="container mx-auto px-4 py-8">
          <Alert
            message="Lỗi"
            description={error}
            type="error"
            showIcon
          />
        </div>
      </div>
    );
  }

  if (!userId) {
    return <RequireLogin />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-blue-300">
      <Navbar onLogout={handleLogout} />
      <div className="container mx-auto px-4 py-8">
        <div className="glassmorphism bg-opacity-90 rounded-lg shadow-xl p-6 mb-10 mt-28">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <Title level={2} className="m-0">Dự án tô màu của tôi</Title>
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <Input 
                placeholder="Tìm kiếm dự án..." 
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                style={{ maxWidth: '300px' }}
                allowClear
              />
              
              <Select
                value={sortOrder}
                onChange={value => setSortOrder(value)}
                style={{ width: '150px' }}
                placeholder="Sắp xếp theo"
              >
                <Option value="newest">Mới nhất</Option>
                <Option value="oldest">Cũ nhất</Option>
                <Option value="name">Tên A-Z</Option>
                <Option value="updated">Cập nhật gần đây</Option>
              </Select>
              
              <Select
                value={hasColorizedFilter}
                onChange={value => setHasColorizedFilter(value)}
                style={{ width: '180px' }}
                placeholder="Lọc dự án"
              >
                <Option value="all">Tất cả dự án</Option>
                <Option value="with">Có kết quả tô màu</Option>
                <Option value="without">Chưa có kết quả</Option>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Spin size="large" tip="Đang tải dự án..." />
            </div>
          ) : filteredProjects.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                {paginatedData.map(project => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onSelect={handleSelectProject}
                    onEdit={handleEditProject}
                    onDelete={handleDeleteProject}
                  />
                ))}
              </div>
              
              {filteredProjects.length > pageSize && (
                <div className="flex justify-center mt-8">
                  <Pagination
                    current={currentPage}
                    onChange={page => setCurrentPage(page)}
                    pageSize={pageSize}
                    total={filteredProjects.length}
                    showSizeChanger
                    onShowSizeChange={(_, size) => {
                      setPageSize(size);
                      setCurrentPage(1);
                    }}
                    pageSizeOptions={['8', '12', '16', '24', '32']}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="py-12">
              <Empty
                description={
                  searchText 
                    ? 'Không tìm thấy dự án nào phù hợp với tìm kiếm của bạn' 
                    : 'Bạn chưa có dự án tô màu nào. Hãy tạo dự án mới từ trang chủ!'
                }
              >
                <Button type="primary" onClick={() => navigate('/home')}>
                  Tạo dự án mới
                </Button>
              </Empty>
            </div>
          )}
        </div>
      </div>
      
      {/* Edit Project Modal */}
      <Modal
        title="Đổi tên dự án"
        open={isEditModalVisible}
        onCancel={() => setIsEditModalVisible(false)}
        onOk={handleUpdateProjectName}
        okText="Lưu thay đổi"
        cancelText="Hủy"
      >
        <div className="py-4">
          <p className="mb-4">Nhập tên mới cho dự án:</p>
          <Input 
            placeholder="Tên dự án" 
            value={newProjectName}
            onChange={e => setNewProjectName(e.target.value)}
            maxLength={50}
            showCount
          />
        </div>
      </Modal>

      <style jsx="true">{`
        .glassmorphism {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(10px);
          border-radius: 10px;
          box-shadow: 0 8px 32px rgba(31, 38, 135, 0.15);
        }
        
        .project-card:hover {
          transform: translateY(-3px);
          transition: transform 0.3s ease;
        }
        
        .truncate-text {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        /* Responsive styling for small screens */
        @media (max-width: 640px) {
          .ant-card-actions {
            justify-content: space-around;
          }
          
          .ant-pagination {
            font-size: 0.8rem;
          }
        }
      `}</style>
    </div>
  );
};

export default Projects;
