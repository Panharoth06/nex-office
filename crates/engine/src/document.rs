use loro::{
    ExpandType, ExportMode, LoroDoc, LoroEncodeError, LoroResult, LoroText, StyleConfig,
    StyleConfigMap,
};

/// Editable text containers owned by a document.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TextZone {
    Body,
    Header,
    Footer,
}

impl TextZone {
    /// Parse the public zone identifier used by Wasm and TypeScript.
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "body" => Some(Self::Body),
            "header" => Some(Self::Header),
            "footer" => Some(Self::Footer),
            _ => None,
        }
    }

    fn container(self) -> &'static str {
        match self {
            Self::Body => "document_text",
            Self::Header => "header_text",
            Self::Footer => "footer_text",
        }
    }
}

/// Text-mark configuration shared by every zone.
///
/// Loro requires every mark key to have an expansion policy. Block-level marks
/// expand forward so text typed at the start of a paragraph inherits the
/// paragraph attributes stored on the preceding newline.
fn block_style_config() -> StyleConfigMap {
    let mut styles = StyleConfigMap::default_rich_text_config();
    for key in ["paragraph", "list", "list_level", "align"] {
        styles.insert(
            key.into(),
            StyleConfig {
                expand: ExpandType::After,
            },
        );
    }
    styles
}

/// Thin wrapper around a Loro document that owns body, header, and footer text.
pub struct DocumentModel {
    loro: LoroDoc,
}

impl Default for DocumentModel {
    fn default() -> Self {
        Self::new()
    }
}

impl DocumentModel {
    /// Create an empty Loro document.
    pub fn new() -> Self {
        let loro = LoroDoc::new();
        loro.config_text_style(block_style_config());

        Self { loro }
    }

    fn text(&self, zone: TextZone) -> LoroText {
        self.loro.get_text(zone.container())
    }

    /// Insert `text` into the document body at character offset `pos`.
    ///
    /// # Errors
    ///
    /// Returns [`loro::LoroError`] when the offset is out of bounds or the
    /// container cannot be updated.
    pub fn insert(&mut self, pos: usize, text: &str) -> LoroResult<()> {
        self.insert_in_zone(TextZone::Body, pos, text)
    }

    /// Insert `text` into a zone at character offset `pos`.
    ///
    /// # Errors
    ///
    /// Returns [`loro::LoroError`] when the offset is out of bounds or the
    /// container cannot be updated.
    pub fn insert_in_zone(&mut self, zone: TextZone, pos: usize, text: &str) -> LoroResult<()> {
        self.text(zone).insert(pos, text)
    }

    /// Delete `len` characters from the body starting at offset `pos`.
    ///
    /// # Errors
    ///
    /// Returns [`loro::LoroError`] when the range is out of bounds.
    pub fn delete(&mut self, pos: usize, len: usize) -> LoroResult<()> {
        self.delete_in_zone(TextZone::Body, pos, len)
    }

    /// Delete `len` characters from a zone starting at offset `pos`.
    ///
    /// # Errors
    ///
    /// Returns [`loro::LoroError`] when the range is out of bounds.
    pub fn delete_in_zone(&mut self, zone: TextZone, pos: usize, len: usize) -> LoroResult<()> {
        self.text(zone).delete(pos, len)
    }

    /// Return the body's plain text.
    pub fn get_text(&self) -> String {
        self.get_text_in_zone(TextZone::Body)
    }

    /// Return a zone's plain text.
    pub fn get_text_in_zone(&self, zone: TextZone) -> String {
        self.text(zone).to_string()
    }

    /// Apply or remove a boolean mark on a body range.
    ///
    /// # Errors
    ///
    /// Returns [`loro::LoroError`] when the range is out of bounds.
    pub fn set_mark(&self, start: usize, end: usize, key: &str, enabled: bool) -> LoroResult<()> {
        self.set_mark_in_zone(TextZone::Body, start, end, key, enabled)
    }

    /// Apply or remove a boolean mark on a zone range.
    ///
    /// # Errors
    ///
    /// Returns [`loro::LoroError`] when the range is out of bounds.
    pub fn set_mark_in_zone(
        &self,
        zone: TextZone,
        start: usize,
        end: usize,
        key: &str,
        enabled: bool,
    ) -> LoroResult<()> {
        if start >= end {
            return Ok(());
        }

        let text = self.text(zone);
        if enabled {
            text.mark(start..end, key, true)
        } else {
            text.unmark(start..end, key)
        }
    }

    /// Apply a string mark on a body range.
    ///
    /// # Errors
    ///
    /// Returns [`loro::LoroError`] when the range is out of bounds.
    pub fn set_mark_value(
        &self,
        start: usize,
        end: usize,
        key: &str,
        value: &str,
    ) -> LoroResult<()> {
        self.set_mark_value_in_zone(TextZone::Body, start, end, key, value)
    }

    /// Apply a string mark on a zone range.
    ///
    /// # Errors
    ///
    /// Returns [`loro::LoroError`] when the range is out of bounds.
    pub fn set_mark_value_in_zone(
        &self,
        zone: TextZone,
        start: usize,
        end: usize,
        key: &str,
        value: &str,
    ) -> LoroResult<()> {
        if start >= end {
            return Ok(());
        }

        self.text(zone).mark(start..end, key, value.to_string())
    }

    /// Return the body rich-text delta as JSON.
    ///
    /// # Errors
    ///
    /// Returns a JSON error when the delta cannot be serialized.
    pub fn delta_json(&self) -> Result<String, serde_json::Error> {
        self.delta_json_in_zone(TextZone::Body)
    }

    /// Return a zone rich-text delta as JSON.
    ///
    /// # Errors
    ///
    /// Returns a JSON error when the delta cannot be serialized.
    pub fn delta_json_in_zone(&self, zone: TextZone) -> Result<String, serde_json::Error> {
        serde_json::to_string(&self.text(zone).to_delta())
    }

    /// Export a full-state Loro snapshot.
    ///
    /// # Errors
    ///
    /// Returns [`LoroEncodeError`] when the document cannot be encoded.
    pub fn export_snapshot(&self) -> Result<Vec<u8>, LoroEncodeError> {
        self.loro.export(ExportMode::Snapshot)
    }

    /// Replace the current state with a Loro snapshot.
    ///
    /// # Errors
    ///
    /// Returns [`loro::LoroError`] when the snapshot is malformed.
    pub fn import_snapshot(&mut self, bytes: &[u8]) -> LoroResult<()> {
        self.loro.import(bytes).map(|_| ())
    }
}

#[cfg(test)]
mod tests;
