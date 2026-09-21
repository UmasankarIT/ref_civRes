import { MLAnalysis } from './types';

interface VisionRule {
  keywords: string[];
  category: string;
  baseSeverity: number;
  hazards: string[];
}

const VISION_CATEGORY_MAP: Record<string, VisionRule> = {
  ROAD_POTHOLE: {
    keywords: ['pothole', 'asphalt', 'crater', 'crack', 'road'],
    category: 'ROAD_POTHOLE',
    baseSeverity: 3.8,
    hazards: ['wheel_damage_risk', 'two_wheeler_skid_danger', 'traffic_bottleneck'],
  },
  DRAINAGE_OVERFLOW: {
    keywords: ['drain', 'sewage', 'waterlogging', 'overflow', 'manhole'],
    category: 'DRAINAGE_OVERFLOW',
    baseSeverity: 4.2,
    hazards: ['biohazard_contamination', 'open_manhole_risk', 'pedestrian_submersion'],
  },
  GARBAGE_DUMP: {
    keywords: ['garbage', 'trash', 'waste', 'dump', 'plastic'],
    category: 'GARBAGE_DUMP',
    baseSeverity: 3.1,
    hazards: ['pest_vector_breeding', 'foul_odor_spread', 'sidewalk_blockage'],
  },
  STREETLIGHT_OUTAGE: {
    keywords: ['light', 'pole', 'lamp', 'dark', 'electric'],
    category: 'STREETLIGHT_OUTAGE',
    baseSeverity: 2.8,
    hazards: ['pedestrian_safety_risk', 'crime_hotspot_blindspot', 'exposed_wiring'],
  },
  WATER_SUPPLY_BURST: {
    keywords: ['burst', 'pipe', 'pipeline', 'leak', 'flooding'],
    category: 'WATER_SUPPLY_BURST',
    baseSeverity: 4.6,
    hazards: ['potable_water_wastage', 'foundation_erosion', 'subsurface_cavity'],
  },
};

/**
 * Simulates a Vision Model (e.g., PyTorch / ONNX / ResNet-50 / YOLOv8 fine-tuned on civic dataset).
 * Inspects declared category and image features to return confidence and severity.
 */
export async function analyzeIssueImage(
  imageUrl: string,
  categoryCode: string,
  notes?: string
): Promise<MLAnalysis> {
  const startTime = Date.now();

  // Non-civic check: if note or URL indicates spam
  const lowerNotes = (notes || '').toLowerCase();
  const isSpam = lowerNotes.includes('selfie') || lowerNotes.includes('meme') || lowerNotes.includes('advertisement');

  if (isSpam) {
    return {
      predictedCategory: 'NON_CIVIC_SPAM',
      categoryConfidence: 0.96,
      estimatedSeverity: 1.0,
      isCivicIssue: false,
      detectedHazards: ['irrelevant_content', 'spam_rejected'],
      inferenceLatencyMs: Date.now() - startTime + 120,
    };
  }

  const rule = VISION_CATEGORY_MAP[categoryCode] || VISION_CATEGORY_MAP['ROAD_POTHOLE'];

  // Calculate dynamic variance to simulate realistic CV outputs
  const randomVariance = (Math.random() * 0.8 - 0.4); // -0.4 to +0.4
  const estimatedSeverity = Math.min(Math.max(Number((rule.baseSeverity + randomVariance).toFixed(1)), 1.0), 5.0);

  const confidence = Number((0.88 + Math.random() * 0.09).toFixed(2));

  // Simulate network inference latency
  await new Promise((resolve) => setTimeout(resolve, 150));

  return {
    predictedCategory: rule.category,
    categoryConfidence: confidence,
    estimatedSeverity,
    isCivicIssue: true,
    detectedHazards: rule.hazards,
    inferenceLatencyMs: Date.now() - startTime,
  };
}
