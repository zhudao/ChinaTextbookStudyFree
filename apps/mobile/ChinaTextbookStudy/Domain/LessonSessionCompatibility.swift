import Foundation
import CryptoKit

/// Updating voices preserves an unfinished lesson. Updating its answers does not.
enum LessonSessionCompatibility {
    static func contentKey(_ lesson: Lesson) -> String {
        var content = lesson
        content.questions = content.questions.map { q in var copy = q; copy.audio = nil; return copy }
        content.knowledge?.audio = nil
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        // Lesson has only concrete Codable values; encoding failure must not
        // collapse different lessons to a shared resumable key.
        guard let data = try? encoder.encode(content) else { return "invalid-\(UUID().uuidString)" }
        return SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }

    static func canResume(_ session: ActiveLessonSession, lesson: Lesson) -> Bool {
        guard session.bookId == lesson.bookId, session.lessonId == lesson.id else { return false }
        if let key = session.contentKey { return key == contentKey(lesson) }
        // This release changes two answers in this existing lesson. Legacy
        // sessions have no content key, so only that known correction restarts.
        return lesson.id != "chinese-g1up-u3-kp2"
    }
}
