import XCTest
@testable import ChinaTextbookStudy

final class LessonSessionCompatibilityTests: XCTestCase {
    private func lesson(_ id: String = "chinese-g1up-u3-kp2") -> Lesson {
        Lesson(id: id, title: "拼音", bookId: "chinese-g1up", unitNumber: 3, unitTitle: "拼音", kpIndex: 2, kpTotal: 2,
            questions: [Question(id: 18, type: .fillBlankText, score: 5, difficulty: 2, knowledgePoint: "两拼", question: "p和à", options: [], answer: "怕", explanation: "pà")])
    }
    private func session(_ lesson: Lesson, key: String? = nil) -> ActiveLessonSession {
        ActiveLessonSession(bookId: lesson.bookId, lessonId: lesson.id, queueIds: [18], solvedIds: [1], missedIds: [], combo: 1, maxCombo: 1, sessionXp: 10, startedAt: "2026-10-25", contentKey: key)
    }
    func testAudioOnlyUpgradeKeepsTheSession() {
        let original = lesson()
        let saved = session(original, key: LessonSessionCompatibility.contentKey(original))
        var updated = original
        updated.questions[0].audio = QuestionAudio(question: "/audio/new.pinyin-1.mp3", options: [], explanation: nil)
        XCTAssertTrue(LessonSessionCompatibility.canResume(saved, lesson: updated))
    }
    func testChangedAnswerRejectsOldSession() {
        var old = lesson(); old.questions[0].answer = "跑"
        XCTAssertFalse(LessonSessionCompatibility.canResume(session(old, key: LessonSessionCompatibility.contentKey(old)), lesson: lesson()))
    }
    func testLegacySessionsOnlyRestartForTheCorrectedLesson() {
        XCTAssertFalse(LessonSessionCompatibility.canResume(session(lesson()), lesson: lesson()))
        let unchanged = lesson("chinese-g1up-u3-kp1")
        XCTAssertTrue(LessonSessionCompatibility.canResume(session(unchanged), lesson: unchanged))
    }
    func testAnotherBookCannotResumeTheSession() {
        let original = lesson(); var saved = session(original, key: LessonSessionCompatibility.contentKey(original))
        saved.bookId = "english-g3up"
        XCTAssertFalse(LessonSessionCompatibility.canResume(saved, lesson: original))
    }
}
