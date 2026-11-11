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
