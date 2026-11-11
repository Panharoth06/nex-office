use serde::{Deserialize, Serialize};

/// A shaped glyph positioned within a line.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlyphRun {
    pub glyph_id: u32,
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub char_index: usize,
}
