/**
 * Common types shared across tools and pipeline stages.
 */

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type LayoutHint =
  | "horizontal_stack"
  | "vertical_stack"
  | "grid"
  | "absolute"
  | "unknown";

export type NodeType =
  | "container"
  | "text"
  | "image"
  | "button"
  | "input"
  | "unknown";

export interface ComponentNode {
  id: string;
  type: NodeType;
  bbox: BoundingBox;
  layout_hint?: LayoutHint;
  children?: ComponentNode[];
  text?: string;
  meta?: Record<string, unknown>;
}

export interface AnalyzeResult {
  root: ComponentNode;
  detected_patterns: string[];
  confidence: number;
  processing_time_ms: number;
}

export interface TextBlock {
  text: string;
  bbox: BoundingBox;
  font_size_est?: number;
  weight_est?: "normal" | "bold";
  confidence: number;
}

export interface ImageInput {
  image_url: string;
  mime_type?: string;
}

export type Framework = "react" | "react-native" | "vue" | "html";
export type StyleSystem = "tailwind" | "emotion" | "css-modules" | "inline";
