pub mod document;
pub mod layout;
pub mod text;

use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn init_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub struct EngineCore {
    doc: document::DocumentModel,
}

#[wasm_bindgen]
impl EngineCore {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            doc: document::DocumentModel::new(),
        }
    }

    #[wasm_bindgen]
    pub fn insert_text(&mut self, pos: usize, text: &str) -> Result<(), JsValue> {
        self.doc.insert(pos, text);
        Ok(())
    }

    #[wasm_bindgen]
    pub fn delete_range(&mut self, pos: usize, len: usize) -> Result<(), JsValue> {
        self.doc.delete(pos, len);
        Ok(())
    }

    #[wasm_bindgen]
    pub fn get_text(&self) -> String {
        self.doc.get_text()
    }
}
