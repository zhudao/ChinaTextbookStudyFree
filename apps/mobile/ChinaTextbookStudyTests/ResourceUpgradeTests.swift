import XCTest
import ZIPFoundation
@testable import ChinaTextbookStudy

final class ResourceUpgradeTests: XCTestCase {
    func testDataOnlyAndAudioOnlyUpdatesInvalidateTheInstalledReceipt() {
        func entry(_ data: String, _ audio: String) -> ManifestEntry {
            ManifestEntry(bookId: "chinese-g1up", audioRefCount: 1,
                data: ManifestBundle(name: "data.zip", bytes: 1, sha256: data),
                audio: ManifestBundle(name: "audio.zip", bytes: 1, sha256: audio))
        }
        let old = AssetDownloader.bundleFingerprint(entry("data-old", "audio-old"))
        XCTAssertNotEqual(old, AssetDownloader.bundleFingerprint(entry("data-new", "audio-old")))
        XCTAssertNotEqual(old, AssetDownloader.bundleFingerprint(entry("data-old", "audio-new")))
        XCTAssertEqual(old, AssetDownloader.bundleFingerprint(entry("data-old", "audio-old")))
    }

    func testArchiveUpgradeReplacesExistingResourcesAndPreservesOtherFiles() throws {
        let fm = FileManager.default
        let root = fm.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? fm.removeItem(at: root) }
        let source = root.appendingPathComponent("source")
        let destination = root.appendingPathComponent("installed")
        try fm.createDirectory(at: source, withIntermediateDirectories: true)
        try fm.createDirectory(at: destination, withIntermediateDirectories: true)
        try Data("new lesson and pinyin paths".utf8).write(to: source.appendingPathComponent("lesson.json"))
        try Data("old lesson".utf8).write(to: destination.appendingPathComponent("lesson.json"))
        let progress = Data("existing completed grades".utf8)
        try progress.write(to: destination.appendingPathComponent("other-file.json"))
        let archive = root.appendingPathComponent("update.zip")
        try fm.zipItem(at: source, to: archive, shouldKeepParent: false)
        try AssetDownloader.installArchive(archive, destination: destination)
        XCTAssertEqual(try Data(contentsOf: destination.appendingPathComponent("lesson.json")), Data("new lesson and pinyin paths".utf8))
        XCTAssertEqual(try Data(contentsOf: destination.appendingPathComponent("other-file.json")), progress)
        // A repeated verified install is idempotent.
        try AssetDownloader.installArchive(archive, destination: destination)
        XCTAssertEqual(try Data(contentsOf: destination.appendingPathComponent("other-file.json")), progress)
    }

    func testCorruptArchiveDoesNotChangeInstalledResources() throws {
        let fm = FileManager.default
        let root = fm.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? fm.removeItem(at: root) }
        try fm.createDirectory(at: root, withIntermediateDirectories: true)
        let file = root.appendingPathComponent("lesson.json")
        let original = Data("existing lesson".utf8)
        try original.write(to: file)
        let corrupt = root.appendingPathComponent("corrupt.zip")
        try Data("not a zip".utf8).write(to: corrupt)
        XCTAssertThrowsError(try AssetDownloader.installArchive(corrupt, destination: root))
        XCTAssertEqual(try Data(contentsOf: file), original)
    }
}
