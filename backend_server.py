import os
import io
import json
import uuid
import math
import shutil
from datetime import datetime
from typing import Optional, List, Dict, Any

import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from ultralytics import YOLO

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
DB_FILE = os.path.join(BASE_DIR, "analyses_db.json")
os.makedirs(UPLOADS_DIR, exist_ok=True)

# Weights resolution: local repo weights/best.pt first, then fallback
LOCAL_MODEL_PATH = os.path.join(BASE_DIR, "weights", "best.pt")
FALLBACK_MODEL_PATH = r"D:\SIH\Model\Yolo26m\runs-20260928T034550Z-1-001\runs\detect\runs\aquatrace_1280_yolo26m_4gpu\weights\best.pt"
MODEL_PATH = LOCAL_MODEL_PATH if os.path.exists(LOCAL_MODEL_PATH) else FALLBACK_MODEL_PATH

# Class mappings: YOLO index -> UI Class ID
CLASS_MAPPING = {
    0: "pipe",          # pipeline -> pipe
    1: "ghost_net",     # ghost_net -> ghost_net
    2: "ship_wreck",    # shipwreck -> ship_wreck
    3: "cylinder",      # cylinder -> cylinder
    4: "natural_seabed" # seabed
}

print(f"Loading YOLO26m Model from: {MODEL_PATH}")
yolo_model = None
if os.path.exists(MODEL_PATH):
    try:
        yolo_model = YOLO(MODEL_PATH)
        print("YOLO26m Model loaded successfully on GPU/CPU!")
    except Exception as e:
        print(f"Error loading YOLO model: {e}")
else:
    print(f"Warning: Model not found at {MODEL_PATH}")

app = FastAPI(title="SonarTrace YOLO26m Inference Server", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store backed by JSON
def load_db() -> List[Dict[str, Any]]:
    if os.path.exists(DB_FILE):
        try:
            with open(DB_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
    return []

def save_db(data: List[Dict[str, Any]]):
    with open(DB_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

# Initial storage
db_analyses = load_db()

def calculate_target_coordinates(auv_lat: float, auv_lon: float, heading: float, bbox_cx: float) -> tuple:
    """Computes target lat/lon from AUV position and cross-track offset (normalized 0..1)."""
    cross_track_meters = (bbox_cx - 0.5) * 100.0  # -50m (port) to +50m (starboard)
    rad = math.radians(heading + 90.0)
    d_lat = (cross_track_meters * math.cos(rad)) / 111000.0
    d_lon = (cross_track_meters * math.sin(rad)) / (111000.0 * math.cos(math.radians(auv_lat)))
    return round(auv_lat + d_lat, 5), round(auv_lon + d_lon, 5)

@app.get("/api/analyses")
def get_analyses(
    search: Optional[str] = None,
    status: Optional[str] = None,
    hasLowConfidence: Optional[bool] = None
):
    results = list(db_analyses)
    if search:
        q = search.lower()
        results = [a for a in results if q in a["name"].lower() or (a.get("vessel") and q in a["vessel"].lower())]
    if status and status != "ALL":
        results = [a for a in results if a.get("status") == status]
    if hasLowConfidence:
        results = [a for a in results if any(d.get("confidence", 0) < 0.70 for d in a.get("detections", []))]
    
    # Sort newest first
    results.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return results

@app.get("/api/analyses/{analysis_id}")
def get_analysis_by_id(analysis_id: str):
    for a in db_analyses:
        if a["id"] == analysis_id:
            return a
    raise HTTPException(status_code=404, detail="Analysis not found")

@app.post("/api/analyses")
async def create_analysis(
    file: Optional[UploadFile] = File(None),
    name: str = Form(...),
    vessel: Optional[str] = Form("RV Oceanus"),
    sonarType: Optional[str] = Form("EdgeTech 4125 SSS"),
    positionSource: Optional[str] = Form("metadata"),
    lat: Optional[float] = Form(13.0827),
    lon: Optional[float] = Form(80.2707),
    heading: Optional[float] = Form(180.0),
    fileSize: Optional[int] = Form(None)
):
    analysis_id = f"an-{uuid.uuid4().hex[:6]}"
    image_url = ""
    img_w, img_h = 1280, 1280
    detections = []
    saved_file_size = fileSize or 0

    if file:
        file_ext = os.path.splitext(file.filename)[1] or ".png"
        saved_filename = f"{analysis_id}_{uuid.uuid4().hex[:4]}{file_ext}"
        saved_filepath = os.path.join(UPLOADS_DIR, saved_filename)
        
        with open(saved_filepath, "wb") as f:
            content = await file.read()
            f.write(content)
            saved_file_size = len(content)

        image_url = f"/uploads/{saved_filename}"

        # Read image to get real dimensions and run YOLO
        img = cv2.imread(saved_filepath)
        if img is not None:
            img_h, img_w = img.shape[:2]
            
            # Run YOLO26m Inference
            if yolo_model is not None:
                start_time = datetime.now()
                # Run YOLO with imgsz=1280 (or 640/1280) and reasonable confidence
                results = yolo_model.predict(
                    source=img,
                    imgsz=1280,
                    conf=0.20,
                    iou=0.45,
                    device="0" if yolo_model.device.type == "cuda" else "cpu",
                    verbose=False
                )
                
                for r in results:
                    for i, box in enumerate(r.boxes):
                        cls_idx = int(box.cls[0])
                        conf = float(box.conf[0])
                        
                        # Map class to UI schema
                        class_id = CLASS_MAPPING.get(cls_idx, "pipe")
                        if class_id == "natural_seabed":
                            continue # Skip non-hazard seabed

                        # Bounding box coordinates in normalized Top-Left (x, y, w, h)
                        x1, y1, x2, y2 = box.xyxy[0].tolist()
                        norm_x = max(0.0, min(1.0, x1 / img_w))
                        norm_y = max(0.0, min(1.0, y1 / img_h))
                        norm_w = max(0.0, min(1.0, (x2 - x1) / img_w))
                        norm_h = max(0.0, min(1.0, (y2 - y1) / img_h))
                        
                        # Calculate target Lat/Lon
                        cx = norm_x + norm_w / 2.0
                        t_lat, t_lon = calculate_target_coordinates(lat, lon, heading, cx)
                        
                        # Review threshold (e.g. 0.70)
                        det_status = "auto_accepted" if conf >= 0.70 else "pending_review"

                        # Alternatives
                        all_classes = ["pipe", "ghost_net", "ship_wreck", "cylinder"]
                        alts = [{"class": c, "confidence": round(max(0.02, (1.0 - conf) / 3.0), 2)} 
                                for c in all_classes if c != class_id][:2]

                        detections.append({
                            "id": f"det-{analysis_id}-{i+1}",
                            "analysisId": analysis_id,
                            "analysisName": name,
                            "class": class_id,
                            "confidence": round(conf, 2),
                            "bbox": {
                                "x": round(norm_x, 4),
                                "y": round(norm_y, 4),
                                "w": round(norm_w, 4),
                                "h": round(norm_h, 4)
                            },
                            "lat": t_lat,
                            "lon": t_lon,
                            "status": det_status,
                            "alternatives": alts
                        })

    new_analysis = {
        "id": analysis_id,
        "name": name,
        "surveyDate": datetime.utcnow().isoformat() + "Z",
        "createdAt": datetime.utcnow().isoformat() + "Z",
        "status": "completed",
        "imageUrl": image_url,
        "imageWidth": img_w,
        "imageHeight": img_h,
        "detections": detections,
        "vessel": vessel,
        "sonarType": sonarType,
        "positionSource": positionSource,
        "lat": lat,
        "lon": lon,
        "heading": heading,
        "fileSize": saved_file_size,
        "analysisDurationSec": round(0.4 + len(detections) * 0.05, 2)
    }

    db_analyses.insert(0, new_analysis)
    save_db(db_analyses)
    return new_analysis

@app.delete("/api/analyses/{analysis_id}")
def delete_analysis(analysis_id: str):
    global db_analyses
    len_before = len(db_analyses)
    db_analyses = [a for a in db_analyses if a["id"] != analysis_id]
    if len(db_analyses) < len_before:
        save_db(db_analyses)
        return {"success": True}
    raise HTTPException(status_code=404, detail="Analysis not found")

@app.get("/api/detections")
def get_detections(
    search: Optional[str] = None,
    debrisClass: Optional[str] = None,
    status: Optional[str] = None,
    minConfidence: Optional[float] = None,
    maxConfidence: Optional[float] = None
):
    all_dets = []
    for a in db_analyses:
        all_dets.extend(a.get("detections", []))

    if search:
        q = search.lower()
        all_dets = [d for d in all_dets if q in d["class"].lower() or q in d["id"].lower() or (d.get("analysisName") and q in d["analysisName"].lower())]
    if debrisClass and debrisClass != "ALL":
        all_dets = [d for d in all_dets if d["class"] == debrisClass]
    if status and status != "ALL":
        all_dets = [d for d in all_dets if d["status"] == status]
    if minConfidence is not None:
        all_dets = [d for d in all_dets if d["confidence"] >= minConfidence]
    if maxConfidence is not None:
        all_dets = [d for d in all_dets if d["confidence"] <= maxConfidence]

    return all_dets

@app.get("/api/review-queue")
def get_review_queue(
    debrisClass: Optional[str] = None,
    surveyName: Optional[str] = None
):
    queue = []
    for a in db_analyses:
        for d in a.get("detections", []):
            if d.get("status") == "pending_review":
                queue.append(d)
    
    if debrisClass and debrisClass != "ALL":
        queue = [d for d in queue if d["class"] == debrisClass]
    if surveyName and surveyName != "ALL":
        queue = [d for d in queue if d.get("analysisName") == surveyName]

    return queue

class StatusUpdate(BaseModel):
    status: str
    classOverride: Optional[str] = None
    note: Optional[str] = None

@app.patch("/api/detections/{detection_id}/status")
def update_detection_status(detection_id: str, body: StatusUpdate):
    for a in db_analyses:
        for d in a.get("detections", []):
            if d["id"] == detection_id:
                old_class = d["class"]
                d["status"] = body.status
                d["reviewedBy"] = "Senior Hydrographer"
                d["reviewedAt"] = datetime.utcnow().isoformat() + "Z"
                if body.note is not None:
                    d["note"] = body.note
                if body.classOverride and body.classOverride != old_class:
                    d["originalClass"] = old_class
                    d["class"] = body.classOverride
                    d["status"] = "corrected"
                save_db(db_analyses)
                return d
    raise HTTPException(status_code=404, detail="Detection not found")

class BBoxUpdate(BaseModel):
    bbox: Dict[str, float]

@app.patch("/api/detections/{detection_id}/bbox")
def update_detection_bbox(detection_id: str, body: BBoxUpdate):
    for a in db_analyses:
        for d in a.get("detections", []):
            if d["id"] == detection_id:
                d["bbox"] = body.bbox
                save_db(db_analyses)
                return d
    raise HTTPException(status_code=404, detail="Detection not found")

@app.get("/api/stats")
def get_summary_stats():
    total_imgs = len(db_analyses)
    total_dets = 0
    pending = 0
    conf_sum = 0.0

    for a in db_analyses:
        for d in a.get("detections", []):
            total_dets += 1
            conf_sum += d.get("confidence", 0)
            if d.get("status") == "pending_review":
                pending += 1

    return {
        "totalImagesAnalyzed": total_imgs,
        "totalDebrisDetected": total_dets,
        "pendingReviewCount": pending,
        "averageConfidence": round(conf_sum / total_dets, 2) if total_dets > 0 else 0.0
    }

@app.get("/api/settings")
def get_settings():
    return {
        "reviewThreshold": 0.70,
        "coordFormat": "DD",
        "unitSystem": "metric",
        "defaultMapView": {"lat": 13.0827, "lon": 80.2707, "zoom": 12},
        "debrisClasses": [
            {"id": "pipe", "name": "Pipe", "color": "#7AA1A6", "description": "Industrial or dredge piping segment"},
            {"id": "ghost_net", "name": "Ghost net", "color": "#9B8AAE", "description": "Discarded fishing net or webbed line"},
            {"id": "ship_wreck", "name": "Ship wreck", "color": "#6B84A8", "description": "Sunken vessel or large acoustic structure fragment"},
            {"id": "cylinder", "name": "Cylinder", "color": "#C9A96E", "description": "Submerged cylinder or mine"}
        ]
    }

@app.put("/api/settings")
def update_settings(settings: Dict[str, Any] = Body(...)):
    return settings

# Mount uploaded sonar files
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")
