import os
import sys
import cv2
import numpy  as np
from skimage import color
from flask import Flask, request, jsonify, send_file
from werkzeug.utils import secure_filename
import uuid
from data import colorize_image as CI
import base64
from flask_cors import CORS

# Add the caffe files path if needed
sys.path.append("./caffe_files")

app = Flask(__name__)
app.secret_key = "ideepcolor_secret_key"  # Required for session
# Enable CORS for all routes and origins
CORS(app, resources={r"/*": {"origins": "*"}})

# Configuration
UPLOAD_FOLDER = "./uploads"
RESULTS_FOLDER = "./results"
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg"}
MODEL_PATH = "./models/pytorch/caffemodel.pth"

# Dictionary to track active sessions and their files
active_files = {}

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
if not os.path.exists(RESULTS_FOLDER):
    os.makedirs(RESULTS_FOLDER)

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["RESULTS_FOLDER"] = RESULTS_FOLDER
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16MB max upload size


# Initialize models
def init_models():
    # Initialize the colorization model with PyTorch backend
    color_model = CI.ColorizeImageTorch(Xd=256)
    color_model.prep_net(path=MODEL_PATH)

    # Initialize the distribution model
    dist_model = CI.ColorizeImageTorchDist(Xd=256)
    dist_model.prep_net(path=MODEL_PATH, dist=True)

    return color_model, dist_model


color_model, dist_model = init_models()


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "healthy"})


@app.route("/colorize", methods=["POST"])
def colorize_image():
    """
    Endpoint to colorize a grayscale image.
    Accepts: image file
    Returns: colorized image
    """
    # Generate or retrieve session ID
    session_id = request.form.get("session_id")

    # Check if we have an existing file for this session or need to save a new one
    file_path = None
    result_path = None
    file_exists = False
    result_filename = None

    if session_id and session_id in active_files:
        # Use existing file path if session exists
        file_path = active_files[session_id]["upload_path"]
        result_path = active_files[session_id]["result_path"]
        result_filename = os.path.basename(result_path)
        file_exists = os.path.exists(file_path)

    # If file doesn't exist or no session ID, process new upload
    if not file_exists:
        # Check if an image was uploaded
        if "image" not in request.files:
            return jsonify({"error": "No image provided"}), 400

        file = request.files["image"]
        if file.filename == "":
            return jsonify({"error": "No image selected"}), 400

        if not file or not allowed_file(file.filename):
            return jsonify({"error": "Invalid file format"}), 400

        # Generate new session ID if not provided
        if not session_id:
            session_id = str(uuid.uuid4())

        # Save the uploaded file with consistent naming based on session
        filename = secure_filename(file.filename)
        base_filename = f"session_{session_id}_{filename}"
        file_path = os.path.join(app.config["UPLOAD_FOLDER"], base_filename)
        result_filename = f"result_{session_id}.jpg"
        result_path = os.path.join(app.config["RESULTS_FOLDER"], result_filename)

        # Save the file
        file.save(file_path)

        # Store file paths in active_files dictionary
        active_files[session_id] = {
            "upload_path": file_path,
            "result_path": result_path,
        }

    # Process the image using the colorization model
    try:
        # Load the image
        color_model.load_image(file_path)

        # Run the model for automatic colorization (no user input)
        input_ab = np.zeros((2, color_model.Xd, color_model.Xd))
        input_mask = np.zeros((1, color_model.Xd, color_model.Xd))

        # Process the image
        color_model.net_forward(input_ab, input_mask)

        # Get full resolution result instead of resizing the low-res output
        result_rgb = color_model.get_img_fullres()

        # Convert result to BGR for OpenCV
        result_bgr = cv2.cvtColor(result_rgb, cv2.COLOR_RGB2BGR)
        cv2.imwrite(result_path, result_bgr)

        # Return the image as base64
        with open(result_path, "rb") as image_file:
            encoded_image = base64.b64encode(image_file.read()).decode("utf-8")

        return jsonify(
            {
                "status": "success",
                "image": encoded_image,
                "filename": result_filename,
                "session_id": session_id,
            }
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/colorize_with_hints", methods=["POST"])
def colorize_with_hints():
    """
    Endpoint to colorize an image with user-provided color hints.
    Accepts:
        - image file
        - JSON with color hints {points: [{x, y, r, g, b, a}, ...]} (a is optional)
    Returns: colorized image
    """
    # Generate or retrieve session ID
    session_id = request.form.get("session_id")

    # Check for color hints
    hints = request.form.get("hints")
    if not hints:
        return jsonify({"error": "No color hints provided"}), 400

    import json

    try:
        hints = json.loads(hints)
        # Validate hints structure
        if not isinstance(hints, dict):
            return jsonify({"error": "Hints should be a JSON object"}), 400

        # Check if points key exists and is a list
        if "points" not in hints:
            return jsonify({"error": "Hints object missing 'points' array"}), 400

        if not isinstance(hints["points"], list):
            return jsonify({"error": "'points' should be an array"}), 400

        # Validate each point has required attributes
        for i, point in enumerate(hints["points"]):
            if not all(key in point for key in ["x", "y", "r", "g", "b"]):
                return (
                    jsonify(
                        {
                            "error": f"Point {i} missing required attributes (x, y, r, g, b)"
                        }
                    ),
                    400,
                )
    except json.JSONDecodeError:
        return jsonify({"error": "Invalid JSON format for hints"}), 400
    except Exception as e:
        return jsonify({"error": f"Error processing hints: {str(e)}"}), 400

    # Check if we have an existing file for this session or need to save a new one
    file_path = None
    result_path = None
    file_exists = False
    result_filename = None

    if session_id and session_id in active_files:
        # Use existing file path if session exists
        file_path = active_files[session_id]["upload_path"]
        result_path = active_files[session_id]["result_path"]
        result_filename = os.path.basename(result_path)
        file_exists = os.path.exists(file_path)

    # If file doesn't exist or no session ID, process new upload
    if not file_exists:
        # Check if an image was uploaded
        if "image" not in request.files:
            return jsonify({"error": "No image provided"}), 400

        file = request.files["image"]
        if file.filename == "":
            return jsonify({"error": "No image selected"}), 400

        if not file or not allowed_file(file.filename):
            return jsonify({"error": "Invalid file format"}), 400

        # Generate new session ID if not provided
        if not session_id:
            session_id = str(uuid.uuid4())

        # Save the uploaded file with consistent naming based on session
        filename = secure_filename(file.filename)
        base_filename = f"session_{session_id}_{filename}"
        file_path = os.path.join(app.config["UPLOAD_FOLDER"], base_filename)
        result_filename = f"result_{session_id}.jpg"
        result_path = os.path.join(app.config["RESULTS_FOLDER"], result_filename)

        # Save the file
        file.save(file_path)

        # Store file paths in active_files dictionary
        active_files[session_id] = {
            "upload_path": file_path,
            "result_path": result_path,
        }

    # Process the image using the colorization model
    try:
        # Load the image
        color_model.load_image(file_path)

        # Initialize empty inputs
        input_ab = np.zeros((2, color_model.Xd, color_model.Xd))
        input_mask = np.zeros((1, color_model.Xd, color_model.Xd))

        # Add color hints
        for hint in hints["points"]:
            # Scale coordinates to model dimensions
            x = int(
                hint["x"] * color_model.Xd / 100
            )  # Assuming coordinates are in percent
            y = int(hint["y"] * color_model.Xd / 100)

            # Get alpha value (intensity) for this point (default to 1.0 if not provided)
            alpha = float(hint.get("a", 1.0))
            alpha = max(0.0, min(1.0, alpha))  # Clamp between 0.0 and 1.0

            # Convert RGB to LAB - fixing the conversion and indexing
            rgb = np.array([[[hint["r"], hint["g"], hint["b"]]]], dtype=np.uint8)
            lab = color.rgb2lab(rgb / 255.0)

            # Extract a and b values - properly indexed now
            # Scale by alpha to control color intensity
            a_value = lab[0, 0, 1] * alpha  # a channel with intensity
            b_value = lab[0, 0, 2] * alpha  # b channel with intensity

            # Add hint to input
            input_ab[0, y, x] = a_value
            input_ab[1, y, x] = b_value
            input_mask[0, y, x] = 1.0

            # Make hints affect surrounding pixels (create a small patch)
            radius = 3
            for i in range(max(0, y - radius), min(color_model.Xd, y + radius + 1)):
                for j in range(max(0, x - radius), min(color_model.Xd, x + radius + 1)):
                    dist = np.sqrt((i - y) ** 2 + (j - x) ** 2)
                    if dist <= radius:
                        input_ab[0, i, j] = a_value
                        input_ab[1, i, j] = b_value
                        input_mask[0, i, j] = max(
                            input_mask[0, i, j], 1.0 - dist / radius
                        )

        # Process the image
        color_model.net_forward(input_ab, input_mask)

        # Get full resolution result instead of resizing the low-res output
        result_rgb = color_model.get_img_fullres()

        # Convert result to BGR for OpenCV
        result_bgr = cv2.cvtColor(result_rgb, cv2.COLOR_RGB2BGR)
        cv2.imwrite(result_path, result_bgr)

        # Return the image as base64
        with open(result_path, "rb") as image_file:
            encoded_image = base64.b64encode(image_file.read()).decode("utf-8")

        return jsonify(
            {
                "status": "success",
                "image": encoded_image,
                "filename": result_filename,
                "session_id": session_id,
            }
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/suggest_colors", methods=["POST"])
def suggest_colors():
    """
    Endpoint to get AI-generated color suggestions for a specific point in an image.
    This function helps users by providing intelligent color recommendations
    that they can apply to their grayscale or partially colored images.

    Accepts:
        - image file: The image to analyze
        - x, y coordinates: Position to get color suggestions for (as percent of image width/height)
        - k: Number of color suggestions to return (default: 5)
        - session_id: Optional session ID to reuse existing uploaded file

    Returns:
        Array of suggested colors in RGB format, ordered by probability/relevance
    """
    # Generate or retrieve session ID
    session_id = request.form.get("session_id")

    # Get coordinates
    try:
        x_percent = float(request.form.get("x", 50))  # Default to center
        y_percent = float(request.form.get("y", 50))
        k = int(request.form.get("k", 5))  # Default to 5 suggestions
    except:
        return jsonify({"error": "Invalid coordinates"}), 400

    # Check if we have an existing file for this session or need to save a new one
    file_path = None
    file_exists = False

    if session_id and session_id in active_files:
        # Use existing file path if session exists
        file_path = active_files[session_id]["upload_path"]
        file_exists = os.path.exists(file_path)

    # If file doesn't exist or no session ID, process new upload
    if not file_exists:
        # Check if an image was uploaded
        if "image" not in request.files:
            return jsonify({"error": "No image provided"}), 400

        file = request.files["image"]
        if file.filename == "":
            return jsonify({"error": "No image selected"}), 400

        if not file or not allowed_file(file.filename):
            return jsonify({"error": "Invalid file format"}), 400

        # Generate new session ID if not provided
        if not session_id:
            session_id = str(uuid.uuid4())

        # Save the uploaded file with consistent naming based on session
        filename = secure_filename(file.filename)
        base_filename = f"session_{session_id}_{filename}"
        file_path = os.path.join(app.config["UPLOAD_FOLDER"], base_filename)
        result_filename = f"result_{session_id}.jpg"
        result_path = os.path.join(app.config["RESULTS_FOLDER"], result_filename)

        # Save the file
        file.save(file_path)

        # Store file paths in active_files dictionary
        active_files[session_id] = {
            "upload_path": file_path,
            "result_path": result_path,
        }

    if allowed_file(os.path.basename(file_path)):
        try:
            # Load the image directly with the model's load_image method
            # This handles all necessary resizing and preprocessing
            dist_model.load_image(file_path)

            # Run empty prediction to initialize the model
            input_ab = np.zeros((2, dist_model.Xd, dist_model.Xd))
            input_mask = np.zeros((1, dist_model.Xd, dist_model.Xd))
            dist_model.net_forward(input_ab, input_mask)

            # Convert percentage to model coordinates
            # (coordinates need to be in the model's downsampled space)
            h = int(y_percent * dist_model.Xd / 100)
            w = int(x_percent * dist_model.Xd / 100)

            # Ensure coordinates are within valid range
            h = max(0, min(dist_model.Xd - 1, h))
            w = max(0, min(dist_model.Xd - 1, w))

            # Get color suggestions with coordinates in the right format (h, w)
            # This matches how it's used in gui_draw.py
            ab_colors, confidences = dist_model.get_ab_reccs(
                h=h, w=w, K=k, N=25000, return_conf=True
            )

            if ab_colors is not None:
                # Add L channel (from the image) to create LAB colors
                L = np.tile(dist_model.img_l[0, h, w], (k, 1))
                colors_lab = np.concatenate((L, ab_colors), axis=1)

                # Reshape for conversion to RGB
                colors_lab3 = colors_lab[:, np.newaxis, :]

                # Convert LAB to RGB
                colors_rgb = np.clip(np.squeeze(color.lab2rgb(colors_lab3)), 0, 1)

                # Convert to 0-255 range
                colors_rgb = (colors_rgb * 255).astype(np.uint8)

                # Format for return
                suggestions = []
                for i in range(colors_rgb.shape[0]):
                    suggestions.append(
                        {
                            "r": int(colors_rgb[i, 0]),
                            "g": int(colors_rgb[i, 1]),
                            "b": int(colors_rgb[i, 2]),
                            "confidence": float(confidences[i]),
                        }
                    )

                return jsonify(
                    {
                        "status": "success",
                        "suggestions": suggestions,
                        "session_id": session_id,
                    }
                )
            else:
                return jsonify({"error": "Failed to generate color suggestions"}), 500

        except Exception as e:
            import traceback

            error_details = traceback.format_exc()
            print(f"Error in suggest_colors: {str(e)}\n{error_details}")
            return jsonify({"error": str(e)}), 500

    return jsonify({"error": "Invalid file format"}), 400


@app.route("/get_session_image", methods=["GET"])
def get_session_image():
    """
    Endpoint to retrieve the original image associated with a session ID.
    Used to restore projects without requiring the user to re-upload the original image.
    """
    session_id = request.form.get("session_id")
    original_file_name = request.form.get("original_file_name")

    # If form data is empty, try to get from URL parameters
    if not session_id:
        session_id = request.args.get("session_id")
    if not original_file_name:
        original_file_name = request.args.get("original_file_name")

    if not session_id:
        return jsonify({"error": "Session ID is required"}), 400

    if not original_file_name:
        return jsonify({"error": "Original file name is required"}), 400

    # Look for the file in the active_files dictionary if available
    file_path = None
    if session_id in active_files:
        file_path = active_files[session_id]["upload_path"]
    else:
        # Fall back to constructing the path from the session_id and original filename
        file_path = os.path.join(
            app.config["UPLOAD_FOLDER"], f"session_{session_id}_{original_file_name}"
        )

    # Check if the file exists
    if not os.path.exists(file_path):
        # Try direct filename as fallback
        direct_path = os.path.join(app.config["UPLOAD_FOLDER"], original_file_name)
        if not os.path.exists(direct_path):
            return jsonify({"error": "Image not found"}), 404
        file_path = direct_path

    # Determine the mime type based on file extension
    mime_type = "image/jpeg"  # Default
    if original_file_name.lower().endswith(".png"):
        mime_type = "image/png"
    elif original_file_name.lower().endswith((".jpg", ".jpeg")):
        mime_type = "image/jpeg"

    return send_file(file_path, mimetype=mime_type)


@app.route("/get_result_file", methods=["GET"])
def get_result():
    """
    Serve the resulting colorized images for a specific session.
    This endpoint is used to retrieve colorized results when reopening saved projects.
    """
    # Try to get session_id from form data first, then from URL parameters
    session_id = request.form.get("session_id")
    if not session_id:
        session_id = request.args.get("session_id")
    
    if not session_id:
        return jsonify({"error": "Session ID is required"}), 400
        
    filename = "result_" + session_id + ".jpg"
    result_path = os.path.join(app.config["RESULTS_FOLDER"], filename)
    
    # Check if result file exists
    if not os.path.exists(result_path):
        return jsonify({"error": "Colorized result not found for this session"}), 404
        
    # Serve the file with appropriate content type
    return send_file(result_path, mimetype="image/jpeg")


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
