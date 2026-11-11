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

#[test]
fn block_marks_are_reflected_in_the_delta() {
    let mut doc = DocumentModel::new();
    doc.insert(0, "One").expect("insert should succeed");
    doc.insert(3, "\n").expect("insert should succeed");
    doc.set_mark_value(0, 3, "list", "ol")
        .expect("list mark should succeed");
    doc.set_mark_value(0, 3, "list_level", "1")
        .expect("list level mark should succeed");
    doc.set_mark_value(3, 4, "list", "ol")
        .expect("leading newline mark should succeed");
    doc.set_mark_value(0, 3, "align", "center")
        .expect("align mark should succeed");

    let delta: serde_json::Value =
        serde_json::from_str(&doc.delta_json().expect("delta should serialize"))
            .expect("delta should be valid JSON");

    assert_eq!(delta[0]["insert"], "One");
    assert_eq!(delta[0]["attributes"]["list"], "ol");
    assert_eq!(delta[0]["attributes"]["list_level"], "1");
    assert_eq!(delta[0]["attributes"]["align"], "center");
    assert_eq!(delta[1]["insert"], "\n");
    assert_eq!(delta[1]["attributes"]["list"], "ol");
}

#[test]
fn unmark_removes_block_mark() {
    let mut doc = DocumentModel::new();
    doc.insert(0, "One").expect("insert should succeed");
    doc.set_mark_value(0, 3, "list", "ul")
        .expect("mark should succeed");
    doc.set_mark(0, 3, "list", false)
        .expect("unmark should succeed");

    let delta: serde_json::Value =
        serde_json::from_str(&doc.delta_json().expect("delta should serialize"))
            .expect("delta should be valid JSON");

    assert!(delta[0]["attributes"].get("list").is_none());
}

#[test]
fn snapshot_round_trip_preserves_block_marks() {
    let mut doc = DocumentModel::new();
    doc.insert(0, "One\n").expect("insert should succeed");
    doc.set_mark_value(0, 3, "list", "ol")
        .expect("mark should succeed");
    doc.set_mark_value(0, 3, "list_level", "2")
        .expect("mark should succeed");
    doc.set_mark_value(3, 4, "align", "right")
        .expect("mark should succeed");

    let snapshot = doc.export_snapshot().expect("snapshot should export");
    let mut restored = DocumentModel::new();
    restored
        .import_snapshot(&snapshot)
        .expect("snapshot should import");

    let delta: serde_json::Value =
        serde_json::from_str(&restored.delta_json().expect("delta should serialize"))
            .expect("delta should be valid JSON");

    assert_eq!(delta[0]["attributes"]["list"], "ol");
    assert_eq!(delta[0]["attributes"]["list_level"], "2");
    assert_eq!(delta[1]["attributes"]["align"], "right");
}

#[test]
fn zones_are_isolated() {
    let mut doc = DocumentModel::new();
    doc.insert(0, "Body").expect("body insert should succeed");
    doc.insert_in_zone(TextZone::Header, 0, "Header")
        .expect("header insert should succeed");
    doc.insert_in_zone(TextZone::Footer, 0, "Footer")
        .expect("footer insert should succeed");

    assert_eq!(doc.get_text(), "Body");
    assert_eq!(doc.get_text_in_zone(TextZone::Header), "Header");
    assert_eq!(doc.get_text_in_zone(TextZone::Footer), "Footer");
}

#[test]
fn snapshot_round_trip_preserves_all_zones() {
    let mut doc = DocumentModel::new();
    doc.insert(0, "Body").expect("body insert should succeed");
    doc.insert_in_zone(TextZone::Header, 0, "Header")
        .expect("header insert should succeed");
    doc.insert_in_zone(TextZone::Footer, 0, "Footer")
        .expect("footer insert should succeed");

    let snapshot = doc.export_snapshot().expect("snapshot should export");
    let mut restored = DocumentModel::new();
    restored
        .import_snapshot(&snapshot)
        .expect("snapshot should import");

    assert_eq!(restored.get_text(), "Body");
    assert_eq!(restored.get_text_in_zone(TextZone::Header), "Header");
    assert_eq!(restored.get_text_in_zone(TextZone::Footer), "Footer");
}

#[test]
fn header_marks_are_isolated_from_body_marks() {
    let mut doc = DocumentModel::new();
    doc.insert(0, "Body").expect("body insert should succeed");
    doc.insert_in_zone(TextZone::Header, 0, "Header")
        .expect("header insert should succeed");
    doc.set_mark_value_in_zone(TextZone::Header, 0, 6, "align", "center")
        .expect("header mark should succeed");

    let body_delta: serde_json::Value =
        serde_json::from_str(&doc.delta_json().expect("body delta should serialize"))
            .expect("body delta should be valid JSON");
    let header_delta: serde_json::Value = serde_json::from_str(
        &doc.delta_json_in_zone(TextZone::Header)
            .expect("header delta should serialize"),
    )
    .expect("header delta should be valid JSON");

    assert!(body_delta[0]["attributes"].get("align").is_none());
    assert_eq!(header_delta[0]["attributes"]["align"], "center");
}

#[test]
fn text_zone_parses_public_identifiers() {
    assert_eq!(TextZone::parse("body"), Some(TextZone::Body));
    assert_eq!(TextZone::parse("header"), Some(TextZone::Header));
    assert_eq!(TextZone::parse("footer"), Some(TextZone::Footer));
    assert_eq!(TextZone::parse("sidebar"), None);
}
