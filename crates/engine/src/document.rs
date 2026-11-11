use loro::{
    ExpandType, ExportMode, LoroDoc, LoroEncodeError, LoroResult, StyleConfig, StyleConfigMap,
};

/// Thin wrapper around a Loro document that owns the `document_text` container.
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
        let mut styles = StyleConfigMap::default_rich_text_config();
        styles.insert(
            "paragraph".into(),
            StyleConfig {
                expand: ExpandType::After,
            },
        );
        loro.config_text_style(styles);

        Self { loro }
    }

    /// Insert `text` at character offset `pos`.
    ///
    /// # Errors
    ///
    /// Returns [`loro::LoroError`] when the offset is out of bounds or the
    /// container cannot be updated.
    pub fn insert(&mut self, pos: usize, text: &str) -> LoroResult<()> {
        let text_container = self.loro.get_text("document_text");
        text_container.insert(pos, text)
    }

    /// Delete `len` characters starting at offset `pos`.
    ///
    /// # Errors
    ///
    /// Returns [`loro::LoroError`] when the range is out of bounds.
    pub fn delete(&mut self, pos: usize, len: usize) -> LoroResult<()> {
        let text_container = self.loro.get_text("document_text");
        text_container.delete(pos, len)
    }

    /// Return the document's plain text.
    pub fn get_text(&self) -> String {
        let text_container = self.loro.get_text("document_text");
        text_container.to_string()
    }

    /// Apply or remove a boolean mark on a Unicode range.
    ///
    /// `enabled = true` marks the range; `false` removes the mark. The range is
    /// measured in Unicode scalar values, matching `insert` and `delete`.
    ///
    /// # Errors
    ///
    /// Returns [`loro::LoroError`] when the range is out of bounds.
    pub fn set_mark(&self, start: usize, end: usize, key: &str, enabled: bool) -> LoroResult<()> {
        if start >= end {
            return Ok(());
        }

        let text_container = self.loro.get_text("document_text");
        if enabled {
            text_container.mark(start..end, key, true)
        } else {
            text_container.unmark(start..end, key)
        }
    }

    /// Apply a string mark (for example a paragraph style) on a Unicode range.
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
        if start >= end {
            return Ok(());
        }

        let text_container = self.loro.get_text("document_text");
        text_container.mark(start..end, key, value.to_string())
    }

    /// Return the rich-text delta as JSON.
    ///
    /// The delta is a Quill-style array of `insert` segments with optional
    /// `attributes`, which the renderer converts into styled runs.
    ///
    /// # Errors
    ///
    /// Returns a JSON error when the delta cannot be serialized.
    pub fn delta_json(&self) -> Result<String, serde_json::Error> {
        let text_container = self.loro.get_text("document_text");
        serde_json::to_string(&text_container.to_delta())
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
mod tests {
    use super::*;

    #[test]
    fn insert_is_reflected_in_text() {
        let mut doc = DocumentModel::new();
        doc.insert(0, "hello").expect("insert should succeed");
        assert_eq!(doc.get_text(), "hello");
    }

    #[test]
    fn delete_removes_the_requested_range() {
        let mut doc = DocumentModel::new();
        doc.insert(0, "hello world").expect("insert should succeed");
        doc.delete(5, 6).expect("delete should succeed");
        assert_eq!(doc.get_text(), "hello");
    }

    #[test]
    fn insert_handles_cjk_text() {
        let mut doc = DocumentModel::new();
        doc.insert(0, "你好，世界").expect("insert should succeed");
        assert_eq!(doc.get_text(), "你好，世界");
    }

    #[test]
    fn snapshot_round_trip_preserves_text() {
        let mut doc = DocumentModel::new();
        doc.insert(0, "hello 你好").expect("insert should succeed");
        let snapshot = doc.export_snapshot().expect("snapshot should export");

        let mut restored = DocumentModel::new();
        restored
            .import_snapshot(&snapshot)
            .expect("snapshot should import");

        assert_eq!(restored.get_text(), "hello 你好");
    }

    #[test]
    fn marks_are_reflected_in_the_delta() {
        let mut doc = DocumentModel::new();
        doc.insert(0, "hello").expect("insert should succeed");
        doc.set_mark(0, 5, "bold", true)
            .expect("mark should succeed");

        let delta: serde_json::Value =
            serde_json::from_str(&doc.delta_json().expect("delta should serialize"))
                .expect("delta should be valid JSON");

        assert_eq!(delta[0]["attributes"]["bold"], true);
    }

    #[test]
    fn unmark_removes_the_attribute() {
        let mut doc = DocumentModel::new();
        doc.insert(0, "hello").expect("insert should succeed");
        doc.set_mark(0, 5, "bold", true)
            .expect("mark should succeed");
        doc.set_mark(0, 5, "bold", false)
            .expect("unmark should succeed");

        let delta: serde_json::Value =
            serde_json::from_str(&doc.delta_json().expect("delta should serialize"))
                .expect("delta should be valid JSON");

        assert!(delta[0]["attributes"].get("bold").is_none());
    }

    #[test]
    fn string_marks_are_reflected_in_the_delta() {
        let mut doc = DocumentModel::new();
        doc.insert(0, "Heading").expect("insert should succeed");
        doc.set_mark_value(0, 7, "paragraph", "h1")
            .expect("mark should succeed");

        let delta: serde_json::Value =
            serde_json::from_str(&doc.delta_json().expect("delta should serialize"))
                .expect("delta should be valid JSON");

        assert_eq!(delta[0]["attributes"]["paragraph"], "h1");
    }

    #[test]
    fn snapshot_round_trip_preserves_marks() {
        let mut doc = DocumentModel::new();
        doc.insert(0, "hello").expect("insert should succeed");
        doc.set_mark(0, 5, "italic", true)
            .expect("mark should succeed");
        let snapshot = doc.export_snapshot().expect("snapshot should export");

        let mut restored = DocumentModel::new();
        restored
            .import_snapshot(&snapshot)
            .expect("snapshot should import");

        let delta: serde_json::Value =
            serde_json::from_str(&restored.delta_json().expect("delta should serialize"))
                .expect("delta should be valid JSON");
        assert_eq!(delta[0]["attributes"]["italic"], true);
    }
}
