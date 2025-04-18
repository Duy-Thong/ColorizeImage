import os
import sys
import cv2
import numpy as np
from skimage import color
from flask import Flask, request, jsonify, send_file
from werkzeug.utils import secure_filename
import uuid
import datetime
from data import colorize_image as CI
from io import BytesIO
import base64
from flask_cors import CORS

# Add the caffe files path if needed
sys.path.append("./caffe_files")

app = Flask(__name__)
# Enable CORS for all routes and origins
CORS(app, resources={r"/*": {"origins": "*"}})

# Configuration
UPLOAD_FOLDER = "./uploads"
RESULTS_FOLDER = "./results"
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg"}
MODEL_PATH = "./models/pytorch/caffemodel.pth"

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
    # Check if an image was uploaded
    if "image" not in request.files:
        return jsonify({"error": "No image provided"}), 400

    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "No image selected"}), 400

    if file and allowed_file(file.filename):
        # Save the uploaded file
        filename = secure_filename(file.filename)
        unique_filename = f"{uuid.uuid4()}_{filename}"
        file_path = os.path.join(app.config["UPLOAD_FOLDER"], unique_filename)
        file.save(file_path)

        # Process the image using the colorization model
        try:
            # Get original image dimensions
            orig_img = cv2.imread(file_path)
            orig_height, orig_width = orig_img.shape[:2]

            # Load the image
            color_model.load_image(file_path)

            # Run the model for automatic colorization (no user input)
            input_ab = np.zeros((2, color_model.Xd, color_model.Xd))
            input_mask = np.zeros((1, color_model.Xd, color_model.Xd))

            # Process the image
            color_model.net_forward(input_ab, input_mask)

            # Get full resolution result instead of resizing the low-res output
            result_rgb = color_model.get_img_fullres()

            # Save the result
            suffix = datetime.datetime.now().strftime("%y%m%d_%H%M%S")
            result_filename = f"{os.path.splitext(unique_filename)[0]}_{suffix}.jpg"
            result_path = os.path.join(app.config["RESULTS_FOLDER"], result_filename)

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
                }
            )

        except Exception as e:
            return jsonify({"error": str(e)}), 500

    return jsonify({"error": "Invalid file format"}), 400


@app.route("/colorize_with_hints", methods=["POST"])
def colorize_with_hints():
    """
    Endpoint to colorize an image with user-provided color hints.
    Accepts:
        - image file
        - JSON with color hints {points: [{x, y, r, g, b, a}, ...]} (a is optional)
    Returns: colorized image
    """
    # Check if an image was uploaded
    if "image" not in request.files:
        return jsonify({"error": "No image provided"}), 400

    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "No image selected"}), 400

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

    if file and allowed_file(file.filename):
        # Save the uploaded file
        filename = secure_filename(file.filename)
        unique_filename = f"{uuid.uuid4()}_{filename}"
        file_path = os.path.join(app.config["UPLOAD_FOLDER"], unique_filename)
        file.save(file_path)

        # Process the image using the colorization model
        try:
            # Get original image dimensions
            orig_img = cv2.imread(file_path)
            orig_height, orig_width = orig_img.shape[:2]

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
                    for j in range(
                        max(0, x - radius), min(color_model.Xd, x + radius + 1)
                    ):
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

            # Save the result
            suffix = datetime.datetime.now().strftime("%y%m%d_%H%M%S")
            result_filename = (
                f"{os.path.splitext(unique_filename)[0]}_hint_{suffix}.jpg"
            )
            result_path = os.path.join(app.config["RESULTS_FOLDER"], result_filename)

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
                }
            )

        except Exception as e:
            return jsonify({"error": str(e)}), 500

    return jsonify({"error": "Invalid file format"}), 400


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

    Returns:
        Array of suggested colors in RGB format, ordered by probability/relevance
    """
    # Check if an image was uploaded
    if "image" not in request.files:
        return jsonify({"error": "No image provided"}), 400

    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "No image selected"}), 400

    # Get coordinates
    try:
        x_percent = float(request.form.get("x", 50))  # Default to center
        y_percent = float(request.form.get("y", 50))
        k = int(request.form.get("k", 5))  # Default to 5 suggestions
    except:
        return jsonify({"error": "Invalid coordinates"}), 400

    if file and allowed_file(file.filename):
        # Save the uploaded file
        filename = secure_filename(file.filename)
        unique_filename = f"{uuid.uuid4()}_{filename}"
        file_path = os.path.join(app.config["UPLOAD_FOLDER"], unique_filename)
        file.save(file_path)

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
            ab_colors, confidences = dist_model.get_ab_reccs(h=h, w=w, K=k, N=25000, return_conf=True)
            
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
                    suggestions.append({
                        "r": int(colors_rgb[i, 0]),
                        "g": int(colors_rgb[i, 1]),
                        "b": int(colors_rgb[i, 2]),
                        "confidence": float(confidences[i])
                    })

                return jsonify({
                    "status": "success", 
                    "suggestions": suggestions
                })
            else:
                return jsonify({"error": "Failed to generate color suggestions"}), 500

        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            print(f"Error in suggest_colors: {str(e)}\n{error_details}")
            return jsonify({"error": str(e)}), 500

    return jsonify({"error": "Invalid file format"}), 400


@app.route("/results/<filename>", methods=["GET"])
def get_result(filename):
    """Serve the resulting images"""
    return send_file(os.path.join(app.config["RESULTS_FOLDER"], filename))


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
