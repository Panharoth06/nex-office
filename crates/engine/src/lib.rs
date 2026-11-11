//! Wasm-facing entry point for the Office Engine layout and text core.
//!
//! The browser creates an [`EngineCore`], forwards keystrokes from the hidden
//! DOM proxy, and reads back shaped text for the Skia renderer.

pub mod document;
pub mod layout;
pub mod text;

use wasm_bindgen::prelude::*;

/// Install the panic hook when the `console_error_panic_hook` feature is enabled.
#[wasm_bindgen(start)]
pub fn init_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

fn parse_zone(zone: &str) -> Result<document::TextZone, JsValue> {
    document::TextZone::parse(zone)
        .ok_or_else(|| JsValue::from_str(&format!("unknown text zone: {zone}")))
}

/// Document state exposed to JavaScript.
#[wasm_bindgen]
pub struct EngineCore {
    doc: document::DocumentModel,
}

impl Default for EngineCore {
    fn default() -> Self {
        Self::new()
    }
}

#[wasm_bindgen]
impl EngineCore {
    /// Create an empty document.
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            doc: document::DocumentModel::new(),
        }
    }

    /// Insert `text` at character offset `pos`.
    ///
    /// # Errors
    ///
    /// Returns a JavaScript error when the CRDT rejects the operation.
    #[wasm_bindgen]
    pub fn insert_text(&mut self, pos: usize, text: &str) -> Result<(), JsValue> {
        self.doc
            .insert(pos, text)
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    /// Delete `len` characters starting at offset `pos`.
    ///
    /// # Errors
    ///
    /// Returns a JavaScript error when the CRDT rejects the operation.
    #[wasm_bindgen]
    pub fn delete_range(&mut self, pos: usize, len: usize) -> Result<(), JsValue> {
        self.doc
            .delete(pos, len)
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    /// Return the document's plain text.
    #[wasm_bindgen]
    pub fn get_text(&self) -> String {
        self.doc.get_text()
    }

    /// Apply or remove a boolean mark on a Unicode range.
    ///
    /// `enabled = true` applies the mark; `false` removes it.
    ///
    /// # Errors
    ///
    /// Returns a JavaScript error when the range is invalid.
    #[wasm_bindgen]
    pub fn set_mark(
        &mut self,
        start: usize,
        end: usize,
        key: &str,
        enabled: bool,
    ) -> Result<(), JsValue> {
        self.doc
            .set_mark(start, end, key, enabled)
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    /// Apply a string mark on a Unicode range.
    ///
    /// # Errors
    ///
    /// Returns a JavaScript error when the range is invalid.
    #[wasm_bindgen]
    pub fn set_mark_value(
        &mut self,
        start: usize,
        end: usize,
        key: &str,
        value: &str,
    ) -> Result<(), JsValue> {
        self.doc
            .set_mark_value(start, end, key, value)
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    /// Return the rich-text delta as JSON.
    ///
    /// # Errors
    ///
    /// Returns a JavaScript error when the delta cannot be serialized.
    #[wasm_bindgen]
    pub fn get_delta(&self) -> Result<String, JsValue> {
        self.doc
            .delta_json()
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    /// Insert `text` into a named zone (`body`, `header`, or `footer`).
    ///
    /// # Errors
    ///
    /// Returns a JavaScript error when the zone is unknown or the CRDT rejects
    /// the operation.
    #[wasm_bindgen]
    pub fn insert_text_in_zone(
        &mut self,
        pos: usize,
        text: &str,
        zone: &str,
    ) -> Result<(), JsValue> {
        let zone = parse_zone(zone)?;
        self.doc
            .insert_in_zone(zone, pos, text)
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    /// Delete `len` characters from a named zone.
    ///
    /// # Errors
    ///
    /// Returns a JavaScript error when the zone is unknown or the range is
    /// invalid.
    #[wasm_bindgen]
    pub fn delete_range_in_zone(
        &mut self,
        pos: usize,
        len: usize,
        zone: &str,
    ) -> Result<(), JsValue> {
        let zone = parse_zone(zone)?;
        self.doc
            .delete_in_zone(zone, pos, len)
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    /// Return a named zone's plain text.
    ///
    /// # Errors
    ///
    /// Returns a JavaScript error when the zone is unknown.
    #[wasm_bindgen]
    pub fn get_text_in_zone(&self, zone: &str) -> Result<String, JsValue> {
        Ok(self.doc.get_text_in_zone(parse_zone(zone)?))
    }

    /// Apply or remove a boolean mark on a named zone range.
    ///
    /// # Errors
    ///
    /// Returns a JavaScript error when the zone or range is invalid.
    #[wasm_bindgen]
    pub fn set_mark_in_zone(
        &mut self,
        start: usize,
        end: usize,
        key: &str,
        enabled: bool,
        zone: &str,
    ) -> Result<(), JsValue> {
        let zone = parse_zone(zone)?;
        self.doc
            .set_mark_in_zone(zone, start, end, key, enabled)
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    /// Apply a string mark on a named zone range.
    ///
    /// # Errors
    ///
    /// Returns a JavaScript error when the zone or range is invalid.
    #[wasm_bindgen]
    pub fn set_mark_value_in_zone(
        &mut self,
        start: usize,
        end: usize,
        key: &str,
        value: &str,
        zone: &str,
    ) -> Result<(), JsValue> {
        let zone = parse_zone(zone)?;
        self.doc
            .set_mark_value_in_zone(zone, start, end, key, value)
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    /// Return a named zone's rich-text delta as JSON.
    ///
    /// # Errors
    ///
    /// Returns a JavaScript error when the zone is unknown or the delta cannot
    /// be serialized.
    #[wasm_bindgen]
    pub fn get_delta_in_zone(&self, zone: &str) -> Result<String, JsValue> {
        self.doc
            .delta_json_in_zone(parse_zone(zone)?)
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    /// Undo the most recent local edit.
    ///
    /// # Errors
    ///
    /// Returns a JavaScript error when the undo step cannot be applied.
    #[wasm_bindgen]
    pub fn undo(&mut self) -> Result<bool, JsValue> {
        self.doc
            .undo()
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    /// Redo the most recently undone edit.
    ///
    /// # Errors
    ///
    /// Returns a JavaScript error when the redo step cannot be applied.
    #[wasm_bindgen]
    pub fn redo(&mut self) -> Result<bool, JsValue> {
        self.doc
            .redo()
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    /// Whether an undo step is available.
    #[wasm_bindgen]
    pub fn can_undo(&self) -> bool {
        self.doc.can_undo()
    }

    /// Whether a redo step is available.
    #[wasm_bindgen]
    pub fn can_redo(&self) -> bool {
        self.doc.can_redo()
    }

    /// Close the current undo group before a non-typing command.
    ///
    /// # Errors
    ///
    /// Returns a JavaScript error when the checkpoint cannot be recorded.
    #[wasm_bindgen]
    pub fn record_checkpoint(&mut self) -> Result<(), JsValue> {
        self.doc
            .record_checkpoint()
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    /// Export a binary Loro snapshot.
    ///
    /// # Errors
    ///
    /// Returns a JavaScript error when the snapshot cannot be encoded.
    #[wasm_bindgen]
    pub fn export_snapshot(&self) -> Result<Vec<u8>, JsValue> {
        self.doc
            .export_snapshot()
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    /// Import a binary Loro snapshot, replacing the current state.
    ///
    /// # Errors
    ///
    /// Returns a JavaScript error when the snapshot is malformed.
    #[wasm_bindgen]
    pub fn import_snapshot(&mut self, bytes: &[u8]) -> Result<(), JsValue> {
        self.doc
            .import_snapshot(bytes)
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }
}
