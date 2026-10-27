import Foundation

/// Current questions replace stale G1 pinyin snapshots only for presentation and
/// grading. The original SRS counters, dates and completed grades stay intact.
enum ReviewContentResolver {
    static func isPinyinBook(_ bookId: String) -> Bool {
        bookId == "chinese-g1up" || bookId == "chinese-g1down"
    }

    static func refresh(_ entries: [MistakeEntry], preserveUnavailable: Bool = false, lookup: (String) -> Lesson?) -> [MistakeEntry] {
        var lessons: [String: Lesson] = [:]
        return entries.compactMap { entry in
            guard let bookId = Backup.bookId(fromLessonId: entry.lessonId), isPinyinBook(bookId) else { return entry }
            let lesson = lessons[entry.lessonId] ?? lookup(entry.lessonId)
            guard let lesson else { return preserveUnavailable ? entry : nil }
            guard let question = lesson.questions.first(where: { $0.id == entry.question.id }) else { return nil }
            lessons[entry.lessonId] = lesson
            var updated = entry
            updated.question = question
            updated.lessonTitle = lesson.title
            return updated
        }
    }

    static func currentEntries(_ entries: [MistakeEntry], preserveUnavailable: Bool = false) -> [MistakeEntry] {
        refresh(entries, preserveUnavailable: preserveUnavailable) { lessonId in
            guard let bookId = Backup.bookId(fromLessonId: lessonId) else { return nil }
            return try? DataLoader.shared.loadLesson(bookId: bookId, lessonId: lessonId)
        }
    }

    /// An old cached manifest must not make old English-letter resources look
    /// current when a review starts offline immediately after upgrading the app.
    static func hasPinyinReferences(in bookDirectory: URL) -> Bool {
        let lessons = bookDirectory.appendingPathComponent("lessons")
        guard let files = try? FileManager.default.contentsOfDirectory(at: lessons, includingPropertiesForKeys: nil) else { return false }
        return files.filter { $0.pathExtension == "json" }.contains { file in
            (try? String(contentsOf: file, encoding: .utf8).contains(".pinyin-")) == true
        }
    }
}
