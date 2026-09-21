from fastapi import FastAPI, File, UploadFile, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
import math
import io
from PIL import Image

app = FastAPI(
    title="CivicResolve ML Vision & Prioritization Service",
    version="1.0.0",
    description="Automated infrastructure visual categorization, severity estimation, and priority scoring"
)

class AnalysisResult(BaseModel):
    category: str = Field(..., description="Detected category e.g. pothole, waterlogging, garbage, road_damage, spam")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Model classification confidence")
    severity_score: float = Field(..., ge=1.0, le=5.0, description="Estimated severity score from 1.0 (minor) to 5.0 (critical)")
    is_civic_issue: bool = Field(..., description="False if image is non-civic, spam, or selfie")
    tags: list[str]

class PriorityRequest(BaseModel):
    ml_severity: float = Field(..., ge=1.0, le=5.0)
    report_count: int = Field(..., ge=1)
    community_upvotes: int = Field(..., ge=0)
    urgency_decay_factor: float = Field(..., ge=1.0, le=5.0)

class PriorityResponse(BaseModel):
    priority_score: float = Field(..., description="Dynamic priority score (1.0 to 5.0)")
    breakdown: dict

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "civicresolve-ml"}

@app.post("/api/v1/analyze-issue", response_model=AnalysisResult)
async def analyze_issue_image(file: UploadFile = File(...)):
    """
    Accepts an uploaded infrastructure damage image and predicts:
    1. Issue category (pothole, waterlogging, garbage, road_damage, spam)
    2. Model confidence
    3. Structural damage severity (1.0 to 5.0)
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a valid image")

    contents = await file.read()
    try:
        image = Image.open(io.BytesIO(contents))
        image.verify() # Verify image integrity
    except Exception:
        raise HTTPException(status_code=400, detail="Corrupted or invalid image data")

    # In production, this invokes an optimized Vision Transformer (ViT) or YOLOv8 fine-tuned on civic datasets.
    # Baseline heuristic / inference placeholder:
    return AnalysisResult(
        category="pothole",
        confidence=0.932,
        severity_score=3.80,
        is_civic_issue=True,
        tags=["asphalt_damage", "road_hazard", "water_collection"]
    )

@app.post("/api/v1/compute-priority", response_model=PriorityResponse)
def compute_priority(req: PriorityRequest):
    """
    Computes priority based on the official formula:
    Priority = (ML_Severity * 0.35) + (log(Report_Count + 1) * 0.30) + (Community_Upvotes * 0.20) + (Urgency_Decay_Factor * 0.15)
    """
    # Scale log(report_count + 1) to align with 1-5 score range
    scaled_report = min(5.0, math.log10(req.report_count + 1) * 3.32)
    # Scale community upvotes to 1-5 score range
    scaled_upvotes = min(5.0, 1.0 + (req.community_upvotes * 0.20))

    comp_severity = req.ml_severity * 0.35
    comp_report = scaled_report * 0.30
    comp_upvotes = scaled_upvotes * 0.20
    comp_urgency = req.urgency_decay_factor * 0.15

    total_priority = round(comp_severity + comp_report + comp_upvotes + comp_urgency, 3)

    return PriorityResponse(
        priority_score=total_priority,
        breakdown={
            "severity_component": round(comp_severity, 3),
            "report_count_component": round(comp_report, 3),
            "upvotes_component": round(comp_upvotes, 3),
            "urgency_decay_component": round(comp_urgency, 3)
        }
    )
