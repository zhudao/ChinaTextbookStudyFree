import XCTest
@testable import ChinaTextbookStudy

final class ReviewContentResolverTests: XCTestCase {
    private func question(_ answer: String, _ audio: String) -> Question {
        Question(id: 18, type: .fillBlankText, score: 5, difficulty: 2, knowledgePoint: "两拼", question: "p和à", options: [], answer: answer, explanation: answer, audio: QuestionAudio(question: audio))
    }
    private func entry() -> MistakeEntry {
        MistakeEntry(lessonId: "chinese-g1up-u3-kp2", lessonTitle: "旧标题", question: question("跑", "/audio/old-english.mp3"), addedAt: "2026-10-20", box: 2, correctCount: 1, lastReviewedAt: "2026-10-24", nextReviewDate: "2026-10-26", graduated: false)
    }
    private func lesson() -> Lesson {
        Lesson(id: "chinese-g1up-u3-kp2", title: "当前标题", bookId: "chinese-g1up", unitNumber: 3, unitTitle: "拼音", kpIndex: 2, kpTotal: 2, questions: [question("怕", "/audio/new.pinyin-context.mp3")])
    }
    func testOldSnapshotUsesCurrentAnswerAndAudioWithoutRegradingHistory() {
        let original = entry()
        let updated = ReviewContentResolver.refresh([original]) { _ in self.lesson() }[0]
        XCTAssertTrue(Grade.gradeAnswer(question: updated.question, userAnswer: "怕"))
        XCTAssertFalse(Grade.gradeAnswer(question: updated.question, userAnswer: "跑"))
        XCTAssertEqual(updated.question.audio?.question, "/audio/new.pinyin-context.mp3")
        var expected = original; expected.question = lesson().questions[0]; expected.lessonTitle = lesson().title
        XCTAssertEqual(updated, expected)
        XCTAssertEqual(original.question.answer, "跑") // Source bank was not mutated.
    }
    func testUnavailableBookDoesNotReuseStalePinyinInRunner() {
        XCTAssertTrue(ReviewContentResolver.refresh([entry()]) { _ in nil }.isEmpty)
        // The hub retains a visible entry so the update/download action is reachable.
        XCTAssertEqual(ReviewContentResolver.refresh([entry()], preserveUnavailable: true) { _ in nil }, [entry()])
    }
    func testRemovedQuestionIsNotGradedUsingHistoricalAnswer() {
        var current = lesson(); current.questions = []
        XCTAssertTrue(ReviewContentResolver.refresh([entry()]) { _ in current }.isEmpty)
    }
    func testOtherSubjectsKeepTheirOfflineSnapshots() {
        var english = entry(); english.lessonId = "english-g3up-u1-kp1"
        XCTAssertEqual(ReviewContentResolver.refresh([english]) { _ in nil }, [english])
    }
    func testOldEnglishAudioFilesCannotPassThePinyinResourceGate() throws {
        let fm = FileManager.default
        let book = fm.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? fm.removeItem(at: book) }
        let lessons = book.appendingPathComponent("lessons")
        try fm.createDirectory(at: lessons, withIntermediateDirectories: true)
        let file = lessons.appendingPathComponent("lesson.json")
        try Data("{\"audio\":\"/audio/old.mp3\"}".utf8).write(to: file)
        XCTAssertFalse(ReviewContentResolver.hasPinyinReferences(in: book))
        try Data("{\"audio\":\"/audio/new.pinyin-123.mp3\"}".utf8).write(to: file)
        XCTAssertTrue(ReviewContentResolver.hasPinyinReferences(in: book))
    }
}
