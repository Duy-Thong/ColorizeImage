import React, { useState, useEffect, useRef } from 'react';
import { getDatabase, ref, get, push, set } from "firebase/database";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { useUser } from '../../contexts/UserContext';
import { useNavigate } from 'react-router-dom';
import { Typography, Upload, Button, message, Spin, Alert, Modal, ColorPicker, Slider, Tooltip, Input, List, Avatar, Card } from 'antd';
import { UploadOutlined, HighlightOutlined, SendOutlined, ReloadOutlined, BgColorsOutlined, DeleteOutlined, DragOutlined, DownloadOutlined, EyeOutlined, BulbOutlined, SwapLeftOutlined, SaveOutlined, ShareAltOutlined, FacebookOutlined, TwitterOutlined, FolderOutlined, FolderOpenOutlined} from '@ant-design/icons';
import axios from 'axios';
import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider';

import Navbar from '../../components/Navbar';
import RequireLogin from '../../components/RequireLogin';

const { Title: AntTitle } = Typography;

const Home = () => {    
    const [username, setUsername] = useState('');
    const { userId, logout } = useUser();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [imageFile, setImageFile] = useState(null);
    const [imagePath, setImagePath] = useState('');
    const [imagePreview, setImagePreview] = useState('');
    const [selectedPoint, setSelectedPoint] = useState(null);
    const [selectedColor, setSelectedColor] = useState('#00C80080'); // Default green with 50% alpha
    const [colorizedImage, setColorizedImage] = useState('');
    const [isColorizing, setIsColorizing] = useState(false);
    const [isAutoColorizing, setIsAutoColorizing] = useState(false); // Add state for auto colorization
    const [isSaving, setIsSaving] = useState(false); // Add state for saving
    const [projectName, setProjectName] = useState(''); // Add state for project name
    const [showSaveModal, setShowSaveModal] = useState(false); // Add state for save modal
    const [apiError, setApiError] = useState(null);
    const [retryCount, setRetryCount] = useState(0);
    const [showColorPicker, setShowColorPicker] = useState(false); // Re-add the missing state
    const imageRef = useRef(null);
    const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
    const [colorPoints, setColorPoints] = useState([]);
    const [draggingPointIndex, setDraggingPointIndex] = useState(null); // State to track dragged point index
    const [editingPointIndex, setEditingPointIndex] = useState(null); // Add state for tracking which point is being edited
    const [colorSuggestions, setColorSuggestions] = useState([]);
    const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
    const [sessionId, setSessionId] = useState(null); // Add state for session ID
    const [showCompareModal, setShowCompareModal] = useState(false);
    const [showProjectsModal, setShowProjectsModal] = useState(false);
    const [savedProjects, setSavedProjects] = useState([]);
    const [loadingProjects, setLoadingProjects] = useState(false);
    const [selectedProject, setSelectedProject] = useState(null);
    const [currentProjectId, setCurrentProjectId] = useState(null); // Add state to track current project ID

    useEffect(() => {
        if (userId) {
            setLoading(true);
            const db = getDatabase();
            const userRef = ref(db, 'users/' + userId);
            get(userRef)
                .then((snapshot) => {
                    if (snapshot.exists()) {
                        const userData = snapshot.val();
                        setUsername(userData.username);
                    }
                })
                .catch(() => {
                    setError("Không thể tải dữ liệu. Vui lòng thử lại sau.");
                })
                .finally(() => setLoading(false));
        }
    }, [userId]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };
    
    const beforeUpload = (file) => {
        // Check file type
        const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png';
        if (!isJpgOrPng) {
            message.error('Chỉ có thể tải lên file JPG/PNG!');
            return false;
        }
        
        // Check file size
        const isLt5M = file.size / 1024 / 1024 < 5;
        if (!isLt5M) {
            message.error('Kích thước ảnh phải nhỏ hơn 5MB!');
            return false;
        }
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const img = new Image();
                img.src = reader.result;
                img.onload = () => {
                    const width = img.width;
                    const height = img.height;
                    
                    if (width > 2000 || height >2000) {
                        message.error('Kích thước ảnh không được vượt quá 2000x2000 pixel!');
                        reject(false);
                    } else {
                        resolve(true);
                    }
                };
                img.onerror = () => {
                    message.error('Không thể đọc file ảnh!');
                    reject(false);
                };
            };
        });
    };

    const handleUpload = ({ file }) => {
        // If we're in a project, confirm before proceeding
        if (currentProjectId) {
            Modal.confirm({
                title: 'Bạn muốn làm gì với ảnh mới?',
                content: (
                    <div>
                        <p>Bạn đang chỉnh sửa một dự án. Bạn muốn:</p>
                        <ul className="list-disc pl-5 mt-2">
                            <li>Tạo dự án mới với ảnh mới này</li>
                            <li>Cập nhật dự án hiện tại với ảnh mới (giữ các điểm màu hiện có)</li>
                        </ul>
                    </div>
                ),
                okText: 'Cập nhật dự án hiện tại',
                cancelText: 'Tạo dự án mới',
                onOk() {
                    // Update current project with new image
                    handleImageUploadForExistingProject(file);
                },
                onCancel() {
                    // Create new project with new image (reset project data)
                    const localPath = URL.createObjectURL(file);
                    setImageFile(file);
                    setImagePreview(localPath);
                    setSelectedPoint(null);
                    setColorizedImage('');
                    setColorPoints([]); // Reset color points
                    setApiError(null);
                    setRetryCount(0);
                    setSessionId(null); // Reset session ID
                    setCurrentProjectId(null); // Reset current project ID
                    setProjectName(''); // Reset project name
                    
                    // Read the file to get image dimensions
                    const reader = new FileReader();
                    reader.onload = () => {
                        const img = new Image();
                        img.onload = () => {
                            setImageSize({ 
                                width: img.width, 
                                height: img.height,
                                normalizedWidth: 256,
                                normalizedHeight: 256
                            });
                        };
                        img.src = reader.result;
                    };
                    reader.readAsDataURL(file);
                    // Store the file name for reference 
                    setImagePath("D:\\\\Learning\\\\ideepcolor\\\\test_img\\\\" + file.name);
                },
            });
            return;
        }

        // Normal upload flow for new projects (no current project)
        const localPath = URL.createObjectURL(file);
        setImageFile(file);
        setImagePreview(localPath);
        setSelectedPoint(null);
        setColorizedImage('');
        setColorPoints([]);
        setApiError(null);
        setRetryCount(0);
        setSessionId(null);
        
        // Read the file to get image dimensions
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                setImageSize({ 
                    width: img.width, 
                    height: img.height,
                    normalizedWidth: 256,
                    normalizedHeight: 256
                });
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
        // Store the file name for reference 
        setImagePath("D:\\\\Learning\\\\ideepcolor\\\\test_img\\\\" + file.name);

        // Reset project info when uploading a new image without a current project
        setCurrentProjectId(null);
        setProjectName('');
    };

    const handleImageClick = (e) => {
        if (!imagePreview) return;
        
        const rect = e.target.getBoundingClientRect();
        
        // Calculate scaled coordinates relative to original image size
        const scaleX = imageSize.width / rect.width;
        const scaleY = imageSize.height / rect.height;
        
        // Get click coordinates relative to the image
        const x = Math.round((e.clientX - rect.left) * scaleX);
        const y = Math.round((e.clientY - rect.top) * scaleY);
        
        // Normalize to 256x256 coordinates for model input
        const normalizedX = Math.round((x / imageSize.width) * 256);
        const normalizedY = Math.round((y / imageSize.height) * 256);
        
        // Store both original coordinates (for display) and normalized coordinates (for API)
        const newPoint = { 
            x, 
            y,
            normalizedX,
            normalizedY
        };
        
        setSelectedPoint(newPoint);
        setShowColorPicker(true);
        
        // Request color suggestions for this point
        fetchColorSuggestions(newPoint);
    };

    // New function to fetch color suggestions from the API
    const fetchColorSuggestions = async (point) => {
        if (!imageFile || !point) return;
        
        setIsFetchingSuggestions(true);
        setColorSuggestions([]);
        
        try {
            // Prepare form data
            const formData = new FormData();
            formData.append('image', imageFile);
            
            // Convert coordinates to percentage of image dimensions
            const xPercent = (point.x / imageSize.width) * 100;
            const yPercent = (point.y / imageSize.height) * 100;
            
            formData.append('x', xPercent.toString());
            formData.append('y', yPercent.toString());
            formData.append('k', '5'); // Request 5 suggestions
            
            // Include session ID if available to maintain the same session
            if (sessionId) {
                formData.append('session_id', sessionId);
            }
            
            const response = await axios.post(
                'http://127.0.0.1:5000/suggest_colors',
                formData,
                { timeout: 30000 }
            );
            
            if (response.data && response.data.status === 'success' && response.data.suggestions) {
                // Store the suggestions
                setColorSuggestions(response.data.suggestions.map(suggestion => ({
                    color: `rgba(${suggestion.r}, ${suggestion.g}, ${suggestion.b}, 1.0)`,
                    confidence: suggestion.confidence || 0
                })));
                
                // Save the session ID if provided and not already set
                if (response.data.session_id && !sessionId) {
                    setSessionId(response.data.session_id);
                }
            } else {
                console.warn('No color suggestions received');
            }
        } catch (error) {
            console.error('Error fetching color suggestions:', error);
            message.error('Không thể tải gợi ý màu. Vui lòng thử lại.');
        } finally {
            setIsFetchingSuggestions(false);
        }
    };
    
    // Add function to apply a suggested color
    const applySuggestedColor = (colorValue) => {
        setSelectedColor(colorValue);
    };
    
    const handleColorSelect = (color) => {
        // Extract RGBA values from the color
        const rgb = color.toRgb();
        setSelectedColor(`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${rgb.a})`);
    };    // Add current point and color to the colorPoints array
    const addColorPoint = () => {
        if (!selectedPoint) {
            message.error('Vui lòng chọn điểm tô màu!');
            return;
        }
        
        // Convert color from CSS format to array format with alpha
        let colorArray = [0, 200, 0]; // RGB default
        let alpha = 1.0; // Default full opacity
        
        if (selectedColor.startsWith('rgba')) {
            // Extract RGBA values from the CSS color string
            const rgba = selectedColor.match(/\d+\.?\d*/g);
            if (rgba && rgba.length === 4) {
                colorArray = rgba.slice(0, 3).map(Number);
                alpha = parseFloat(rgba[3]);
            }
        } else if (selectedColor.startsWith('rgb')) {
            // Extract RGB values from the CSS color string
            const rgb = selectedColor.match(/\d+/g);
            if (rgb && rgb.length === 3) {
                colorArray = rgb.map(Number);
            }
        }
        
        // Create a new point object with alpha
        const newPoint = {
            point: [selectedPoint.normalizedX, selectedPoint.normalizedY],
            color: colorArray,
            alpha: alpha, // Store alpha separately
            displayPoint: { ...selectedPoint },
            displayColor: selectedColor
        };
        
        // If we're editing an existing point
        if (editingPointIndex !== null) {
            setColorPoints(prevPoints => 
                prevPoints.map((point, i) => 
                    i === editingPointIndex ? newPoint : point
                )
            );
            message.success('Màu điểm đã được cập nhật!');
            setEditingPointIndex(null); // Reset the editing index
        } else {
            // Add to the colorPoints array
            setColorPoints(prevPoints => [...prevPoints, newPoint]);
            message.success('Điểm màu đã được thêm!');
        }
        
        // Reset selected point
        setSelectedPoint(null);
        setShowColorPicker(false);
    };

    // Function to delete a color point by index
    const handleDeletePoint = (indexToDelete) => {
        setColorPoints(prevPoints => prevPoints.filter((_, index) => index !== indexToDelete));
        // Reset UI state to ensure list and buttons are shown
        setSelectedPoint(null);
        setShowColorPicker(false);
        setEditingPointIndex(null);
        message.info('Điểm màu đã được xóa.');
    };

    // New function for automatic colorization (no hints)
    const handleAutoColorize = async () => {
        if (!imageFile) {
            message.error('Vui lòng tải lên ảnh để tô màu!');
            return;
        }

        setIsAutoColorizing(true); // Use separate loading state
        setApiError(null);
        setColorizedImage(''); // Clear previous results

        try {
            const formData = new FormData();
            formData.append('image', imageFile);
            
            // Include session ID if available
            if (sessionId) {
                formData.append('session_id', sessionId);
            }

            // Configure the request
            let requestConfig = { 
                timeout: 60000, // 60 seconds timeout
            };
            
            // Send the request to the /colorize endpoint
            const response = await axios.post(
                'http://127.0.0.1:5000/colorize', // Use the endpoint without hints
                formData, 
                requestConfig
            );
            
            setRetryCount(0); // Reset retry count on success

            if (response.data && response.data.status === 'success' && response.data.image) {
                // Save the session ID for future requests
                if (response.data.session_id) {
                    setSessionId(response.data.session_id);
                }
                
                // Decode base64 image
                const byteCharacters = atob(response.data.image);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const colorizedBlob = new Blob([byteArray], { type: 'image/jpeg' }); 
                const colorizedUrl = URL.createObjectURL(colorizedBlob);

                setColorizedImage(colorizedUrl);
                message.success('Ảnh đã được tô màu tự động thành công!');
            } else {
                throw new Error(response.data?.error || 'Không nhận được ảnh tô màu từ máy chủ.');
            }
        } catch (error) {
            console.error('Error auto colorizing image:', error);
            let errorMessage = 'Có lỗi khi tô màu ảnh tự động. ';
            
            if (error.message && error.message.includes('Network Error')) {
                errorMessage = 'Lỗi kết nối đến máy chủ tô màu. Vui lòng kiểm tra máy chủ đã khởi động và cấu hình CORS phù hợp.';
                setApiError({ message: errorMessage, isCors: true });
            } else if (error.response) {
                let backendError = 'Lỗi không xác định từ máy chủ.';
                if (error.response.data && typeof error.response.data === 'object' && error.response.data.error) {
                    backendError = error.response.data.error;
                } else if (typeof error.response.data === 'string') {
                    backendError = error.response.data;
                }
                errorMessage += `${backendError} (Mã lỗi: ${error.response.status})`;
                setApiError({ message: errorMessage, isCors: false });
            } else {
                errorMessage += error.message;
                setApiError({ message: errorMessage, isCors: false });
            }
            
            message.error(errorMessage);
        } finally {
            setIsAutoColorizing(false); // Turn off auto colorizing loading state
        }
    };

    const handleColorizeImage = async () => {
        if (!imageFile) {
            message.error('Vui lòng tải lên ảnh để tô màu!');
            return;
        }
        
        // If a point is currently selected, add it first
        if (selectedPoint) {
            addColorPoint(); // This function already updates colorPoints state
        }
        
        // Use the updated colorPoints state after potential addition
        const currentPoints = colorPoints; 

        if (currentPoints.length === 0) {
            message.error('Vui lòng chọn ít nhất một điểm tô màu!');
            return;
        }
        
        setIsColorizing(true);
        setApiError(null);
        setColorizedImage(''); // Clear previous results
        
        try {
            // Prepare FormData
            const formData = new FormData();
            formData.append('image', imageFile);

            // Include session ID if available
            if (sessionId) {
                formData.append('session_id', sessionId);
            }

            // Format hints according to backend requirements (percentage coordinates)
            const hints = {
                points: currentPoints.map(cp => {
                    // Convert normalized coordinates (0-256) back to original image coordinates
                    const originalX = (cp.point[0] / 256) * imageSize.width;
                    const originalY = (cp.point[1] / 256) * imageSize.height;
                    
                    // Convert original coordinates to percentage
                    const xPercent = (originalX / imageSize.width) * 100;
                    const yPercent = (originalY / imageSize.height) * 100;

                    return {
                        x: xPercent,
                        y: yPercent,
                        r: cp.color[0],
                        g: cp.color[1],
                        b: cp.color[2],
                        a: cp.alpha || 1.0 // Include alpha value, default to 1.0 if not set
                    };
                })
            };
            formData.append('hints', JSON.stringify(hints));

            // Configure the request
            let requestConfig = { 
                timeout: 60000, // Increase timeout to 60 seconds
            };
            
            // Send the request to the correct endpoint
            const response = await axios.post(
                'http://127.0.0.1:5000/colorize_with_hints', // Updated endpoint
                formData, 
                requestConfig
            );
            
            // Reset retry count on success
            setRetryCount(0);

            // Store the session ID if provided
            if (response.data && response.data.session_id) {
                setSessionId(response.data.session_id);
            }

            // Handle JSON response with base64 image
            if (response.data && response.data.status === 'success' && response.data.image) {
                // Decode base64 image
                const byteCharacters = atob(response.data.image);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const colorizedBlob = new Blob([byteArray], { type: 'image/jpeg' }); // Assuming JPEG, adjust if needed
                const colorizedUrl = URL.createObjectURL(colorizedBlob);

                // Update the state to display the colorized image
                setColorizedImage(colorizedUrl);
                message.success('Ảnh đã được tô màu thành công!');
            } else {
                // Handle cases where the backend returns success but no image, or other issues
                throw new Error(response.data?.error || 'Không nhận được ảnh tô màu từ máy chủ.');
            }

        } catch (error) {
            console.error('Error colorizing image:', error);
            
            let errorMessage = 'Có lỗi khi tô màu ảnh. ';
            
            // Enhanced CORS error detection
            if (error.message && error.message.includes('Network Error')) {
                errorMessage = 'Lỗi kết nối đến máy chủ tô màu. Vui lòng kiểm tra máy chủ đã khởi động và cấu hình CORS phù hợp.';
                setApiError({
                    message: errorMessage,
                    isCors: true,
                    details: "Máy chủ Python có thể đang đặt header CORS không đúng cách. Hãy kiểm tra cấu hình CORS trong mã máy chủ."
                });
            } else if (error.response) {
                // Server responded with an error (e.g., 400, 500)
                // Try to parse JSON error message from backend
                let backendError = 'Lỗi không xác định từ máy chủ.';
                if (error.response.data && typeof error.response.data === 'object' && error.response.data.error) {
                    backendError = error.response.data.error;
                } else if (typeof error.response.data === 'string') {
                    // Sometimes error might be plain text
                    backendError = error.response.data;
                }
                errorMessage += `${backendError} (Mã lỗi: ${error.response.status})`;
                setApiError({
                    message: errorMessage,
                    isCors: false
                });
            } else {
                // Other errors (e.g., client-side issues, request setup errors)
                errorMessage += error.message;
                setApiError({
                    message: errorMessage,
                    isCors: false
                });
            }
            
            message.error(errorMessage);
        } finally {
            setIsColorizing(false);
        }
    };

    // Combined handler for the main colorize button
    const handleMainColorize = () => {
        if (colorPoints.length === 0) {
            handleAutoColorize();
        } else {
            // If a point is currently selected but not added, add it first
            if (selectedPoint) {
                 // Need to ensure addColorPoint finishes before proceeding
                 // Option 1: Make addColorPoint async (complex state update)
                 // Option 2: Don't allow colorizing if a point is selected but not added
                 // Option 3 (Chosen): Add the point synchronously then call colorize
                 addColorPoint(); 
                 // Note: addColorPoint updates state asynchronously. 
                 // The handleColorizeImage call below might use the state *before* the update.
                 // A better approach might involve useEffect or passing the new point directly.
                 // For simplicity now, we rely on the subsequent call using the latest state.
                 // Consider refactoring if race conditions occur.
                 
                 // Call handleColorizeImage *after* ensuring the point is added (or trigger via useEffect)
                 // Let's call it directly, assuming state updates reasonably fast for UI interaction.
                 handleColorizeImage(); 

            } else {
                 handleColorizeImage(); // Call with existing points
            }
        }
    };

    const handleRetry = () => {
        setRetryCount(prev => prev + 1);
        setApiError(null);
        // Decide which function to retry based on context? 
        // For simplicity, let's assume retry always uses hints if possible,
        // but for now, we'll default to hint-based if points exist.
        if (colorPoints.length > 0) {
            handleColorizeImage();
        } else {
            handleAutoColorize(); // Retry auto-colorize if no points were involved
        }
    };

    // Function to handle starting the drag of a color point
    const handleDragStart = (e, index) => {
        if (isColorizing || isAutoColorizing) {
            e.preventDefault(); // Prevent dragging during processing
            return;
        }
        setDraggingPointIndex(index);
        e.dataTransfer.setData('text/plain', index); // Store index for drop event
        // Optional: Add visual feedback (e.g., reduced opacity)
        e.target.style.opacity = '0.5'; 
    };

    // Function to handle dragging over the drop zone (image container)
    const handleDragOver = (e) => {
        e.preventDefault(); // Necessary to allow dropping
        if (draggingPointIndex !== null) {
            e.dataTransfer.dropEffect = 'move'; // Indicate it's a move operation
        } else {
            e.dataTransfer.dropEffect = 'none'; // Don't allow dropping if not dragging a point
        }
    };

    // Function to handle dropping the color point
    const handleDrop = (e) => {
        e.preventDefault();
        if (draggingPointIndex === null) return; // Only handle drops of our points

        const index = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (isNaN(index) || index !== draggingPointIndex) {
            // Safety check
            setDraggingPointIndex(null);
            return;
        }

        const rect = e.currentTarget.getBoundingClientRect(); // Use currentTarget (the div with the handler)

        // Calculate scaled coordinates relative to original image size
        const scaleX = imageSize.width / rect.width;
        const scaleY = imageSize.height / rect.height;
        
        // Get drop coordinates relative to the image container
        const x = Math.round((e.clientX - rect.left) * scaleX);
        const y = Math.round((e.clientY - rect.top) * scaleY);
        
        // Normalize to 256x256 coordinates for model input
        const normalizedX = Math.round((x / imageSize.width) * 256);
        const normalizedY = Math.round((y / imageSize.height) * 256);

        // Update the specific point in the colorPoints array
        setColorPoints(prevPoints => 
            prevPoints.map((point, i) => {
                if (i === index) {
                    return {
                        ...point,
                        point: [normalizedX, normalizedY], // Update normalized point for API
                        displayPoint: { // Update display point for rendering
                            x, 
                            y,
                            normalizedX,
                            normalizedY 
                        }
                    };
                }
                return point;
            })
        );

        // Reset dragging state
        setDraggingPointIndex(null); 
        // Note: Opacity reset happens in handleDragEnd
    };

    // Function to handle the end of a drag operation (whether dropped successfully or not)
    const handleDragEnd = (e) => {
        // Reset opacity regardless of drop success
        if (e.target && e.target.style) {
            e.target.style.opacity = '1'; 
        }
        setDraggingPointIndex(null); // Ensure dragging state is cleared
    };

    // Function to handle double-clicking on a point to edit its color
    const handlePointDoubleClick = (e, index) => {
        e.stopPropagation(); // Prevent triggering image click event
        
        if (isColorizing || isAutoColorizing) {
            return; // Don't allow editing during processing
        }
        
        // Get the point being edited
        const pointToEdit = colorPoints[index];
        
        // Set the selected point to the position of the point being edited
        setSelectedPoint(pointToEdit.displayPoint);
        
        // Set the selected color to the current color of the point
        setSelectedColor(pointToEdit.displayColor);
        
        // Set the editing index
        setEditingPointIndex(index);
        
        // Open the color picker
        setShowColorPicker(true);
    };

    // Add function to handle image download
    const handleDownloadImage = () => {
        if (!colorizedImage) {
            message.error('Không có ảnh để tải xuống!');
            return;
        }
        
        try {
            // Create an anchor element and set properties for download
            const link = document.createElement('a');
            link.href = colorizedImage;
            
            // Create a filename with timestamp to avoid duplicates
            const date = new Date();
            const timestamp = `${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}_${date.getHours().toString().padStart(2, '0')}${date.getMinutes().toString().padStart(2, '0')}`;
            link.download = `colorized_image_${timestamp}.jpg`; 
            
            // Append to the body, trigger click, and clean up
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            message.success('Đã tải xuống ảnh thành công!');
        } catch (error) {
            console.error('Download error:', error);
            message.error('Có lỗi khi tải xuống ảnh!');
        }
    };

    const handleSaveProject = async () => {
      if (!userId || !imageFile) {
        message.warning('Cần tải lên ảnh để lưu dự án');
        return;
      }
      
      if (!sessionId) {
        message.error('Không thể lưu dự án: thiếu session ID');
        return;
      }
      
      try {
        setIsSaving(true);
        const db = getDatabase();
        
        // Lưu thông tin dự án vào database (không bao gồm ảnh)
        const projectData = {
          sessionId,
          colorPoints: colorPoints || [], // Ensure it's always an array even if empty
          updatedAt: new Date().toISOString(),
          name: projectName || `Dự án ngày ${new Date().toLocaleDateString('vi-VN')}`,
          originalFilename: imageFile.name // Chỉ lưu tên file gốc để tham khảo
        };
        
        // Thêm URL ảnh đã tô màu nếu có (không lưu file thật)
        if (colorizedImage) {
          projectData.hasColorizedResult = true;
        }
        
        let projectRef;
        
        // Nếu đang mở một dự án có sẵn, cập nhật dự án đó thay vì tạo mới
        if (currentProjectId) {
          projectRef = ref(db, `color-projects/${userId}/${currentProjectId}`);
          // Giữ lại ngày tạo ban đầu của dự án
          const snapshot = await get(projectRef);
          if (snapshot.exists()) {
            projectData.createdAt = snapshot.val().createdAt;
          } else {
            projectData.createdAt = new Date().toISOString();
          }
          await set(projectRef, projectData);
          message.success('Đã cập nhật dự án tô màu thành công!');
        } else {
          // Tạo dự án mới
          projectData.createdAt = new Date().toISOString();
          const projectsRef = ref(db, `color-projects/${userId}`);
          const newProjectRef = push(projectsRef);
          await set(newProjectRef, projectData);
          // Cập nhật ID của dự án hiện tại
          setCurrentProjectId(newProjectRef.key);
          message.success('Đã lưu dự án tô màu thành công!');
        }
        
        setShowSaveModal(false);
      } catch (error) {
        console.error('Error saving project:', error);
        message.error('Lỗi khi lưu dự án. Vui lòng thử lại.');
      } finally {
        setIsSaving(false);
      }
    };
    
    const handleShareResult = async () => {
      if (!colorizedImage) {
        message.error('Vui lòng tô màu ảnh trước khi chia sẻ!');
        return;
      }
      
      // Tạo modal chia sẻ với nút mạng xã hội
      Modal.confirm({
        title: 'Chia sẻ kết quả tô màu',
        content: (
          <div className="flex flex-col gap-4 mt-4">
            <p>Bạn muốn chia sẻ kết quả tô màu này tới đâu?</p>
            <div className="flex justify-center gap-3">
              <Button 
                icon={<FacebookOutlined />} 
                onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, '_blank')}
              >
                Facebook
              </Button>
              <Button 
                icon={<TwitterOutlined />}
                onClick={() => window.open(`https://twitter.com/intent/tweet?text=Tôi vừa tô màu ảnh đen trắng bằng AI!&url=${encodeURIComponent(window.location.href)}`, '_blank')}
              >
                Twitter
              </Button>
            </div>
          </div>
        ),
        footer: null,
      });
    };

    // Function to fetch saved projects
    const fetchSavedProjects = async () => {
      if (!userId) return;
      
      setLoadingProjects(true);
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
            createdAt: new Date(projectsData[key].createdAt)
          }));
          
          // Sort by creation date (newest first)
          projectsArray.sort((a, b) => b.createdAt - a.createdAt);
          
          setSavedProjects(projectsArray);
        } else {
          setSavedProjects([]);
          message.info('Không tìm thấy dự án đã lưu nào.');
        }
      } catch (error) {
        console.error('Error fetching saved projects:', error);
        message.error('Không thể tải dự án đã lưu. Vui lòng thử lại.');
      } finally {
        setLoadingProjects(false);
      }
    };
    
    // Function to open the projects modal
    const handleOpenProjects = () => {
      fetchSavedProjects();
      setShowProjectsModal(true);
    };
    
    // Function to load a selected project
    const handleLoadProject = async (project) => {
      if (!project || !project.sessionId) {
        message.error('Dự án không hợp lệ hoặc thiếu session ID');
        return;
      }
      
      try {
        setLoading(true);
        setSelectedProject(project);
        
        // Reset current state
        setColorPoints([]);
        setColorizedImage('');
        setSelectedPoint(null);
        setApiError(null);
        
        // Set session ID from the project
        setSessionId(project.sessionId);
        
        // Set project name and ID for later editing
        setProjectName(project.name || '');
        setCurrentProjectId(project.id);
        
        // Load the original image using the session ID and original filename
        const imageLoaded = await loadImageWithSessionId(project.sessionId, project.originalFilename);
        
        // Load the colorized result if the project has one
        if (project.hasColorizedResult) {
          try {
            const resultUrl = `http://127.0.0.1:5000/get_result_file?session_id=${project.sessionId}`;
            const response = await fetch(resultUrl);
            
            if (response.ok) {
              const resultBlob = await response.blob();
              const colorizedUrl = URL.createObjectURL(resultBlob);
              setColorizedImage(colorizedUrl);
              message.success('Đã tải kết quả tô màu từ dự án!');
            } else {
              console.warn('Could not load colorized result:', response.status);
            }
          } catch (error) {
            console.error('Error loading colorized result:', error);
            message.warning('Không thể tải kết quả tô màu đã lưu.');
          }
        }
        
        // Set color points from the project only after successfully loading the image or if we have points
        if (project.colorPoints && project.colorPoints.length > 0) {
          setColorPoints(project.colorPoints);
          
          // If image failed to load but we have points, show a more detailed error
          if (!imageLoaded) {
            message.warning(
              'Không thể tải ảnh gốc từ máy chủ, nhưng điểm màu đã được tải. Bạn cần tải lại ảnh đen trắng gốc để tiếp tục.',
              7
            );
          }
        }
        
        // Close the modal on either success or partial success
        setShowProjectsModal(false);
        
        // If we couldn't load the image and we closed the modal, remind the user to upload the original
        if (!imageLoaded && !project.hasColorizedResult) {
          setTimeout(() => {
            message.info('Hãy tải lên ảnh đen trắng gốc để tiếp tục chỉnh sửa dự án này', 5);
          }, 1000);
        }
      } catch (error) {
        console.error('Error loading project:', error);
        message.error('Không thể tải dự án. Vui lòng thử lại.');
      } finally {
        setLoading(false);
      }
    };

    // Helper function to load image data using session ID
    const loadImageWithSessionId = async (sessionId, originalFilename) => {
      if (!sessionId) return false;

      try {
        // First, try to fetch the last image used with this session from the server
        const response = await axios.get(
          `http://127.0.0.1:5000/get_session_image?session_id=${sessionId}&original_file_name=${encodeURIComponent(originalFilename || 'unknown.jpg')}`,
          { responseType: 'blob' }
        );
        
        if (response.status === 200) {
          // Create a file from the blob
          const imageBlob = response.data;
          const file = new File([imageBlob], originalFilename || 'project-image.jpg', { 
            type: imageBlob.type || 'image/jpeg' 
          });
          
          // Set up the image preview as if it was uploaded
          const localPath = URL.createObjectURL(imageBlob);
          setImageFile(file);
          setImagePreview(localPath);
          
          // Read the file to get image dimensions
          const reader = new FileReader();
          reader.onload = () => {
            const img = new Image();
            img.onload = () => {
              setImageSize({ 
                width: img.width, 
                height: img.height,
                normalizedWidth: 256,
                normalizedHeight: 256
              });
            };
            img.src = reader.result;
          };
          reader.readAsDataURL(file);
          
          message.success('Dự án đã được tải. Sẵn sàng tiếp tục chỉnh sửa!');
          return true;
        } else {
          throw new Error('Không thể tải ảnh từ máy chủ.');
        }
      } catch (error) {
        console.error('Error fetching image with session ID:', error);
        message.warning('Không thể tải ảnh dự án từ máy chủ. Vui lòng tải lại ảnh gốc để tiếp tục.', 5);
        return false;
      }
    };

    // Add this function to reset the state when a project fails to load completely
    const handleImageUploadForExistingProject = (file) => {
        if (!currentProjectId || !sessionId) {
            // This shouldn't happen with our new flow, but keep as safety
            return handleUpload({ file });
        }
        
        // Special handling for uploads during project editing
        const localPath = URL.createObjectURL(file);
        setImageFile(file);
        setImagePreview(localPath);
        
        // Keep existing color points but reset result
        setColorizedImage('');
        setApiError(null);
        setRetryCount(0);
        
        // Read dimensions
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                setImageSize({ 
                    width: img.width, 
                    height: img.height,
                    normalizedWidth: 256,
                    normalizedHeight: 256
                });
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
        
        message.success('Ảnh đã được cập nhật trong dự án hiện tại. Các điểm màu hiện có đã được giữ nguyên.');
        
        // Return false to prevent the default upload behavior
        return false;
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Spin size="large" />
            </div>
        );
    }

    if (error) {
        return (
            <Alert
                message="Error"
                description={error}
                type="error"
                showIcon
                className="m-4"
            />
        );
    }

    if (!userId) {
        return <RequireLogin />;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-100 to-blue-300">
            <Navbar onLogout={handleLogout} />

            <div className="container mx-auto px-4 py-8 flex flex-col items-center justify-center">
                <div className="text-center mb-8 mt-12 md:mt-16 px-4 w-full">
                    
                </div>

                <div className="w-5/6 glassmorphism bg-opacity-90 rounded-lg shadow-xl p-8 mb-10">
                    <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">
                        Tô màu ảnh đen trắng
                        {currentProjectId && (
                            <span className="text-sm font-normal text-gray-600 block mt-1">
                                Đang chỉnh sửa: {projectName || 'Dự án chưa đặt tên'}
                            </span>
                        )}
                    </h2>

                    <div className="mb-8 flex flex-col items-center">
                        {/* Add button to open projects */}
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

                    {imagePreview && (
                        <> {/* Use a Fragment to wrap the grid and the elements below it */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* --- Left Column: Image Preview and Point Selection --- */}
                                <div className="mb-6">
                                    <h3 className="text-xl font-semibold text-gray-800 mb-4 text-center">
                                        Ảnh gốc
                                    </h3>
                                    {/* ... existing image container div ... */}
                                    <div 
                                        className={`relative border-2 glassmorphism border-blue-500 rounded-lg mx-auto overflow-hidden ${draggingPointIndex !== null ? 'border-dashed border-green-500' : ''}`} // Add visual feedback for drop zone
                                        style={{ 
                                            maxWidth: '100%', 
                                            cursor: selectedPoint ? 'default' : (isColorizing || isAutoColorizing ? 'wait' : (draggingPointIndex !== null ? 'grabbing' : 'crosshair')) // Change cursor during drag
                                        }}
                                        onDragOver={handleDragOver} // Add drag over handler
                                        onDrop={handleDrop} // Add drop handler
                                    >
                                        {/* ... img and mapped points ... */}
                                        <img 
                                            src={imagePreview === colorizedImage ? null : imagePreview} 
                                            alt="Preview" 
                                            className="w-full h-auto rounded-lg"
                                            onClick={!(isColorizing || isAutoColorizing || draggingPointIndex !== null) ? handleImageClick : undefined} // Disable click during drag
                                            ref={imageRef}
                                            style={{ display: imagePreview === colorizedImage ? 'none' : 'block', pointerEvents: draggingPointIndex !== null ? 'none' : 'auto' }} // Prevent image interfering with drop
                                        />

                                        {/* Display existing color points on the image */}
                                        {colorPoints.map((cp, index) => (
                                            <div 
                                                key={`point-${index}`}
                                                className={`absolute w-5 h-5 rounded-full border-2 border-white shadow-lg flex items-center justify-center ${!(isColorizing || isAutoColorizing) ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                                                style={{
                                                    backgroundColor: cp.displayColor,
                                                    left: `${(cp.displayPoint.x / imageSize.width) * 100}%`, 
                                                    top: `${(cp.displayPoint.y / imageSize.height) * 100}%`,
                                                    transform: 'translate(-50%, -50%)',
                                                    zIndex: 10,
                                                    display: imagePreview === colorizedImage ? 'none' : 'block',
                                                    opacity: draggingPointIndex === index ? 0.5 : 1
                                                }}
                                                title={`Nhấp để sửa/xóa | Kéo để di chuyển | Nhấp đôi để đổi màu | Màu: ${cp.displayColor}`}
                                                draggable={!(isColorizing || isAutoColorizing)}
                                                onDragStart={(e) => handleDragStart(e, index)}
                                                onDragEnd={handleDragEnd}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (!(isColorizing || isAutoColorizing)) {
                                                        setEditingPointIndex(index);
                                                        setSelectedPoint(cp.displayPoint);
                                                        setSelectedColor(cp.displayColor);
                                                        setShowColorPicker(true);
                                                    }
                                                }}
                                                onDoubleClick={(e) => handlePointDoubleClick(e, index)}
                                            >
                                                {/* Display point number */}
                                                <span className="text-xs font-bold text-white" style={{ textShadow: '0px 0px 2px black' }}>
                                                    {index + 1}
                                                </span>
                                            </div>
                                        ))}

                                        {/* Display the currently selected point before confirmation */}
                                        {selectedPoint && (
                                            <div 
                                                className="absolute w-5 h-5 rounded-full border-2 border-white shadow-lg animate-pulse" 
                                                style={{
                                                    backgroundColor: selectedColor,
                                                    // Calculate position based on selectedPoint and current image dimensions
                                                    left: `${(selectedPoint.x / imageSize.width) * 100}%`, 
                                                    top: `${(selectedPoint.y / imageSize.height) * 100}%`,
                                                    transform: 'translate(-50%, -50%)', // Center the dot
                                                    zIndex: 20
                                                }}
                                            />
                                        )}
                                    </div>
                                    {/* ... existing paragraph ... */}
                                    

                                    {/* Color Picker and Add Point Button */}
                                    {selectedPoint && (
                                        <div className="flex justify-center items-center gap-4 mt-5">
                                            {/* ... ColorPicker and Button ... */}
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-700">Chọn màu:</span>
                                                <ColorPicker
                                                    value={selectedColor}
                                                    onChange={handleColorSelect}
                                                    disabled={isColorizing || isAutoColorizing}
                                                    showAlpha={true} // Enable alpha selection
                                                    defaultFormat="rgb"
                                                />
                                            </div>
                                            <Button
                                                type="primary"
                                                icon={<HighlightOutlined />}
                                                // No loading state needed here, addColorPoint is fast
                                                onClick={addColorPoint}
                                                disabled={!selectedPoint || isColorizing || isAutoColorizing}
                                                size="large"
                                            >
                                                Thêm điểm màu
                                            </Button>
                                        </div>
                                    )}

                                    {/* --- Section to List Added Color Points (MOVED BELOW) --- */}
                                    {/* {colorPoints.length > 0 && !selectedPoint && ( ... list code removed from here ... )} */}
                                </div>

                                {/* --- Right Column: Colorized Result --- */}
                                <div className="mb-6 flex flex-col"> {/* Use flex-col to manage button placement */}
                                    <h3 className="text-xl font-semibold text-gray-800 mb-4 text-center">
                                        {isColorizing || isAutoColorizing ? 'Đang xử lý...' : (colorizedImage ? 'Kết quả tô màu' : 'Ảnh chưa tô màu')}
                                    </h3>
                                    <div className={`flex-grow  ${isColorizing || isAutoColorizing ? 'border-yellow-500 animate-pulse' : (colorizedImage ? 'border-green-500' : 'border-gray-300')} rounded-lg border-1 mx-auto w-full flex items-center justify-center glassmorphism overflow-hidden`} 
                                       
                                    >
                                        {/* ... existing result display logic (Spin, Image, Placeholder) ... */}
                                         {isColorizing || isAutoColorizing ? (
                                            <Spin size="large" tip="Đang tô màu..." />
                                        ) : colorizedImage ? (
                                            <div className="relative w-full">
                                                <img 
                                                    src={colorizedImage} 
                                                    alt="Colorized" 
                                                    className="w-full h-auto rounded-lg object-contain" // Use object-contain
                                                />
                                                <Button
                                                    type="primary"
                                                    icon={<DownloadOutlined />}
                                                    onClick={handleDownloadImage}
                                                    className="absolute bottom-2 right-2 download-btn"
                                                    size="large"
                                                >
                                                    <span className="download-text">Tải xuống</span>
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="text-center text-gray-500 p-4">
                                                <p>Kết quả tô màu sẽ hiển thị ở đây.</p>
                                                {imagePreview && colorPoints.length === 0 && <p>Nhấn 'Tô màu tự động' hoặc chọn điểm màu.</p>}
                                                {imagePreview && colorPoints.length > 0 && <p>Thêm điểm màu hoặc nhấn 'Tô màu với điểm đã chọn'.</p>
                                                }
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* --- Main Colorize Button (MOVED BELOW) --- */}
                                    {/* {imagePreview && !selectedPoint && ( ... button code removed from here ... )} */}
                                </div>
                            </div> {/* End of the two-column grid */}

                            {/* --- New Grid Container for Points List and Button --- */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8 pt-8 border-t border-gray-300 w-full"> {/* Add top margin/border */}
                                
                                {/* --- Left Column (New Grid): Points List --- */}
                                <div> {/* Wrapper div for the list column */}
                                    {colorPoints.length > 0 && !selectedPoint && (
                                        <div className="w-full max-w-lg mx-auto md:mx-0"> {/* Adjust width/margin for grid context */}
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
                                                                Màu: {cp.displayColor} (X: {cp.displayPoint.x}, Y: {cp.displayPoint.y}) {/* Show coordinates */}
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
                                    )}
                                    {/* Optional: Add a placeholder if no points are selected */}
                                    {colorPoints.length === 0 && !selectedPoint && imagePreview && (
                                         <div className="text-center text-gray-500 h-full flex items-center justify-center">
                                             <p>Chưa có điểm màu nào được chọn.</p>
                                         </div>
                                    )}
                                </div>

                                {/* --- Right Column (New Grid): Main Button --- */}
                                <div className="flex items-center justify-center"> {/* Center button vertically and horizontally */}
                                    {imagePreview && !selectedPoint && (
                                        <div className="flex justify-center w-full gap-2"> {/* Button container */}
                                            <Button
                                                type="primary"
                                                icon={colorPoints.length > 0 ? <HighlightOutlined /> : <BgColorsOutlined />}
                                                loading={colorPoints.length > 0 ? isColorizing : isAutoColorizing} 
                                                onClick={handleMainColorize} 
                                                size="large"
                                                disabled={isColorizing || isAutoColorizing} 
                                                className="w-full max-w-xs" // Give button reasonable widthw-fullth
                                            >
                                                Tô màu
                                            </Button>
                                            
                                            {/* Add Compare button - only show when we have a colorized image */}
                                            {colorizedImage && (
                                                <>
                                                    <Button
                                                        type="default"
                                                        icon={<SwapLeftOutlined />}
                                                        onClick={() => setShowCompareModal(true)}
                                                        size="large"
                                                        className="max-w-xs"
                                                    >
                                                        So sánh
                                                    </Button>
                                                    
                                                    {/* Add Save Project button */}
                                                    <Button
                                                        type="default"
                                                        icon={<SaveOutlined />}
                                                        onClick={() => setShowSaveModal(true)}
                                                        size="large"
                                                        className="max-w-xs"
                                                        loading={isSaving}
                                                    >
                                                        Lưu
                                                    </Button>
                                                    
                                                    {/* Add Share button */}
                                                    <Button
                                                        type="default"
                                                        icon={<ShareAltOutlined />}
                                                        onClick={handleShareResult}
                                                        size="large"
                                                        className="max-w-xs"
                                                    >
                                                        Chia sẻ
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div> {/* End of the new two-column grid */}
                        </> 
                    )}

                    {apiError && (
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
                                        onClick={handleRetry}
                                        type="primary"
                                    >
                                        Thử lại ({retryCount})
                                    </Button>
                                }
                            />
                        </div>
                    )}
                </div>
            </div>
            
            {/* Color Picker Modal */}
            <Modal
                title="Chọn màu"
                open={showColorPicker}
                onCancel={() => {
                    setShowColorPicker(false);
                    setEditingPointIndex(null); // Reset editing index when canceling
                    setSelectedPoint(null); // Also clear selected point when closing
                    setColorSuggestions([]); // Clear suggestions when closing
                }}
                footer={[
                    <Button key="cancel" onClick={() => {
                        setShowColorPicker(false);
                        setEditingPointIndex(null); // Reset editing index when canceling
                        setSelectedPoint(null); // Also clear selected point when closing
                        setColorSuggestions([]); // Clear suggestions when closing
                    }} disabled={isColorizing || isAutoColorizing}>
                        Hủy
                    </Button>,
                    <Button 
                        key="submit" 
                        type="primary" 
                        onClick={addColorPoint} // Modal confirm still just adds the point
                        icon={<SendOutlined />}
                        // No loading state needed here
                        disabled={isColorizing || isAutoColorizing}
                    >
                        {editingPointIndex !== null ? 'Cập nhật ' : 'Xác nhận'}
                    </Button>,
                ]}
            >
                <div className="flex flex-col items-center gap-5">
                    <div className="flex items-center gap-3 w-full justify-center">
                        <span>Chọn màu và độ mờ:</span>
                        <ColorPicker
                            value={selectedColor}
                            onChange={handleColorSelect}
                            disabled={isColorizing || isAutoColorizing} // Disable during loading
                            showAlpha={true} // Enable alpha in modal too
                            defaultFormat="rgb"
                        />
                    </div>
                    
                   
                    
                    {/* Add suggestions section */}
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
                                            onClick={() => applySuggestedColor(suggestion.color)}
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
            
            {/* Add CSS for checkerboard background to visualize transparency */}
            <style jsx="true">{`
                .checkerboard-bg {
                    background-image: 
                        linear-gradient(45deg, #ccc 25%, transparent 25%), 
                        linear-gradient(-45deg, #ccc 25%, transparent 25%),
                        linear-gradient(45deg, transparent 75%, #ccc 75%),
                        linear-gradient(-45deg, transparent 75%, #ccc 75%);
                    background-size: 10px 10px;
                    background-position: 0 0, 0 5px, 5px -5px, -5px 0px;
                }
            `}</style>

            {/* Modal for image comparison */}
            <Modal
                title="So sánh ảnh gốc và ảnh tô màu"
                open={showCompareModal}
                onCancel={() => setShowCompareModal(false)}
                width={800}
                footer={[
                    <Button key="close" onClick={() => setShowCompareModal(false)}>
                        Đóng
                    </Button>
                ]}
                className="image-compare-modal" // Add a class for better styling
            >
                <div className="mt-4 mb-6">
                    <p className="text-gray-600 mb-4 text-center">
                        Kéo qua lại để so sánh ảnh gốc và ảnh đã tô màu
                    </p>
                    <div className="border border-gray-300 rounded-lg overflow-hidden compare-slider-container">
                        {imagePreview && colorizedImage && (
                            <ReactCompareSlider
                                itemOne={<ReactCompareSliderImage src={imagePreview} alt="Ảnh gốc" />}
                                itemTwo={<ReactCompareSliderImage src={colorizedImage} alt="Ảnh tô màu" />}
                                position={50}
                                style={{
                                    width: '100%',
                                    height: 'auto',
                                    maxHeight: '70vh',
                                    aspectRatio: imageSize.width / imageSize.height
                                }}
                            />
                        )}
                    </div>
                    <div className="flex justify-between text-sm text-gray-500 mt-2 px-2">
                        <span>Ảnh gốc</span>
                        <span>Ảnh tô màu</span>
                    </div>
                </div>
            </Modal>
            
            {/* Add additional CSS for responsive comparison */}
            <style jsx="true">{`
                .checkerboard-bg {
                    background-image: 
                        linear-gradient(45deg, #ccc 25%, transparent 25%), 
                        linear-gradient(-45deg, #ccc 25%, transparent 25%),
                        linear-gradient(45deg, transparent 75%, #ccc 75%),
                        linear-gradient(-45deg, transparent 75%, #ccc 75%);
                    background-size: 10px 10px;
                    background-position: 0 0, 0 5px, 5px -5px, -5px 0px;
                }
                
                /* Responsive styling for comparison slider */
                @media (max-width: 768px) {
                    .image-compare-modal .ant-modal-content {
                        width: 95vw !important;
                        margin: 0 auto;
                    }
                    
                    .compare-slider-container {
                        width: 100%;
                        max-height: 80vh;
                        overflow: hidden;
                    }
                    
                    /* Better button spacing for mobile */
                    .ant-btn {
                        margin: 4px;
                    }
                    
                    /* Make download button smaller on mobile */
                    .download-btn {
                        padding: 4px 8px !important;
                        font-size: 12px !important;
                        height: auto !important;
                        min-height: 32px !important;
                        bottom: 4px !important;
                        right: 4px !important;
                    }
                    
                    /* Make colorize/compare buttons smaller on tablets */
                    .max-w-xs {
                        font-size: 14px !important;
                    }
                }
                
                /* Additional adjustments for small mobile phones */
                @media (max-width: 480px) {
                    /* Download button - icon only */
                    .download-btn {
                        min-height: 32px !important;
                        width: 32px !important;
                        padding: 0 !important;
                        display: flex !important;
                        align-items: center !important;
                        justify-content: center !important;
                    }
                    
                    .download-btn .download-text {
                        display: none !important;
                    }
                    
                    /* Fix colorize and compare buttons */
                    .w-full.max-w-xs {
                        font-size: 12px !important;
                        padding: 0 10px !important;
                        height: 36px !important;
                        min-height: 36px !important;
                    }
                    
                    /* Fix spacing between buttons */
                    .flex.justify-center.w-full.gap-2 {
                        gap: 6px !important;
                    }
                }
                
                /* Make sure colorize buttons have proper spacing and width */
                @media (max-width: 480px) {
                    .flex-grow.max-w-xs {
                        min-width: 100px !important;
                        max-width: 100% !important;
                        flex-basis: auto !important;
                        margin-bottom: 8px !important;
                    }
                }
            `}</style>

            {/* Add Save Project Modal */}
            <Modal
                title={currentProjectId ? "Cập nhật dự án tô màu" : "Lưu dự án tô màu"}
                open={showSaveModal}
                onCancel={() => setShowSaveModal(false)}
                footer={[
                    <Button key="cancel" onClick={() => setShowSaveModal(false)} disabled={isSaving}>
                        Hủy
                    </Button>,
                    <Button 
                        key="save" 
                        type="primary" 
                        loading={isSaving}
                        onClick={handleSaveProject}
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
                        onChange={e => setProjectName(e.target.value)}
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
        
            {/* Add the Projects Modal */}
            <Modal
                title="Dự án đã lưu"
                open={showProjectsModal}
                onCancel={() => setShowProjectsModal(false)}
                footer={[
                    <Button key="close" onClick={() => setShowProjectsModal(false)}>
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
                                    onClick={() => handleLoadProject(project)}
                                    cover={<ProjectThumbnail project={project} />}
                                >
                                    <Card.Meta 
                                        title={project.name}
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
        </div>
    );
};

// Add this new component for thumbnail with loading state
const ProjectThumbnail = ({ project }) => {
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
    
    if (loading) {
        return (
            <div className="h-32 flex items-center justify-center bg-gray-50">
                <Spin size="small" />
            </div>
        );
    }
    
    if (thumbnail) {
        return (
            <div className="h-32 bg-gray-50 flex items-center justify-center overflow-hidden">
                <img 
                    src={thumbnail} 
                    alt={project.name} 
                    className="w-full h-full object-cover"
                />
            </div>
        );
    }
    
    return (
        <div className="h-32 flex items-center justify-center bg-gray-100">
            <FolderOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
        </div>
    );
};

export default Home;