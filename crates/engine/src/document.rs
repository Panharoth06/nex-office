use loro::LoroDoc;

pub struct DocumentModel {
    loro: LoroDoc,
}

impl DocumentModel {
    pub fn new() -> Self {
        Self {
            loro: LoroDoc::new(),
        }
    }

    pub fn insert(&mut self, pos: usize, text: &str) {
        let text_container = self.loro.get_text("document_text");
        text_container.insert(&self.loro, pos, text).unwrap_or(());
    }

    pub fn delete(&mut self, pos: usize, len: usize) {
        let text_container = self.loro.get_text("document_text");
        text_container.delete(&self.loro, pos, len).unwrap_or(());
    }

    pub fn get_text(&self) -> String {
        let text_container = self.loro.get_text("document_text");
        text_container.to_string()
    }
}
