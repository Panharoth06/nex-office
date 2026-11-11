use serde::{Deserialize, Serialize};

/// Page geometry in CSS pixels at 96 DPI.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageDimensions {
    pub width: f32,
    pub height: f32,
    pub margin_top: f32,
    pub margin_bottom: f32,
    pub margin_left: f32,
    pub margin_right: f32,
}

impl Default for PageDimensions {
    fn default() -> Self {
        // Standard A4 dimensions at 96 DPI: 794 x 1123 px.
        Self {
            width: 794.0,
            height: 1123.0,
            margin_top: 96.0,
            margin_bottom: 96.0,
            margin_left: 96.0,
            margin_right: 96.0,
        }
    }
}

/// A laid-out line of text within a page.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LineBox {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    pub baseline: f32,
    pub char_start: usize,
    pub char_end: usize,
}
