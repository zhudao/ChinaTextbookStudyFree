import SwiftUI

/// Walks the SRS-due mistakes one at a time — same tactile feel as a lesson,
/// but no hearts are lost and finishing awards review XP.
struct MistakeReviewRunnerView: View {
    @ObservedObject var progressStore: ProgressStore
    @Binding var path: [AppRoute]

    @ObservedObject private var downloader = AssetDownloader.shared
    @State private var preparing = true
    @State private var downloadEntry: ManifestEntry?
    @State private var preparationError: String?

    @State private var queue: [MistakeEntry] = []
    @State private var index: Int = 0
    @State private var phase: LessonRunnerView.QuestionPhase = .answering
    @State private var currentAnswer: String = ""
    @State private var isCorrect: Bool? = nil
    @State private var correctCount: Int = 0
    @State private var awarded = false
    /// 本轮里新毕业（🎓 已掌握）的题数 — reviewMistake 返回值累加。
    @State private var graduatedCount: Int = 0
    /// 本轮真的领到了那颗心（content-7 断心联动）；结算页展示用。
    /// 只由 `claimReviewHeartIfEligible` 的返回值决定 —— 领没领得成由 store
    /// 的按天账本说了算，这里的 @State 只负责显示（iosretention-4）。
    @State private var heartRewarded = false

    private let xpPerCorrect = 5

    var body: some View {
        Group {
            if let entry = downloadEntry {
                VStack(spacing: 16) {
                    Text("先更新语文教材，再复习拼音").duoFont(.heading)
                    BookDownloadCard(entry: entry, downloader: downloader) { Task { await prepareReview() } }
                }.padding(20)
            } else if let error = preparationError {
                VStack(spacing: 16) {
                    Text(error).duoFont(.body)
                    Button("重试") { Task { await prepareReview() } }.buttonStyle(ChunkyButtonStyle(.secondary))
                }.padding(20)
            } else if preparing {
                ProgressView("正在准备错题…")
            } else if queue.isEmpty {
                emptyState
            } else if index >= queue.count {
                summary
            } else {
                runner
            }
        }
        .background(DuoColors.bg.ignoresSafeArea())
        .navigationTitle("错题复习")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .topBarTrailing) { MuteToggle() } }
        .task { if queue.isEmpty { await prepareReview() } }
        .onDisappear { AudioPlayer.shared.stop() }
    }

    @MainActor
    private func prepareReview() async {
        preparing = true
        preparationError = nil
        downloadEntry = nil
        defer { preparing = false }
        let due = progressStore.dueMistakes
        let books = Set(due.compactMap { Backup.bookId(fromLessonId: $0.lessonId) }.filter(ReviewContentResolver.isPinyinBook))
        func ready(_ book: String) -> Bool {
            let directory = DataLoader.shared.sandboxDataRoot.appendingPathComponent("books/\(book)")
            return downloader.isBookDownloaded(book) && ReviewContentResolver.hasPinyinReferences(in: directory)
        }
        if !books.isEmpty && !books.allSatisfy(ready) {
            // Old cached manifests cannot authorize old letter audio. Updated
            // local books remain reviewable offline without a network wait.
            let fetched: Bool
            do {
                try await withThrowingTaskGroup(of: Void.self) { group in
                    defer { group.cancelAll() }
                    group.addTask { @MainActor in _ = try await downloader.loadManifest() }
                    group.addTask { try await Task.sleep(nanoseconds: 10_000_000_000); throw URLError(.timedOut) }
                    _ = try await group.next()
                }
                fetched = true
            } catch { fetched = false }
            for book in books.sorted() {
                if !ready(book) {
                    guard fetched, let entry = downloader.manifest?.books.first(where: { $0.bookId == book }) else {
                        preparationError = "请联网更新语文教材资源后，再复习拼音。原错题和成绩已保留。"
                        return
                    }
                    downloadEntry = entry
                    return
                }
            }
        }
        queue = ReviewContentResolver.currentEntries(due)
    }

    private var emptyState: some View {
        VStack(spacing: 14) {
            MascotView(mood: .proud, size: 96)
            Text("没有要复习的错题").duoFont(.heading).foregroundStyle(DuoColors.ink)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var summary: some View {
        VStack(spacing: 18) {
            MascotView(mood: .proud, size: 110, reactTo: .levelup)
            Text("复习完成！").duoFont(.title).foregroundStyle(DuoColors.ink)
            Text("答对 \(correctCount) / \(queue.count)").duoFont(.subhead).foregroundStyle(DuoColors.inkMuted)

            HStack(spacing: 10) {
                HStack(spacing: 6) {
                    Image(systemName: "bolt.fill").font(.system(size: 15, weight: .heavy))
                    Text("+\(correctCount * xpPerCorrect) XP").duoNumeral(.subhead)
                }
                .foregroundStyle(DuoColors.secondary)
                .padding(.horizontal, 16).padding(.vertical, 9)
                .background(DuoColors.secondary.opacity(0.14), in: .capsule)

                if heartRewarded {
                    HStack(spacing: 6) {
                        Image(systemName: "heart.fill").font(.system(size: 15, weight: .heavy))
                        Text("+1").duoNumeral(.subhead)
                    }
                    .foregroundStyle(DuoColors.danger)
                    .padding(.horizontal, 16).padding(.vertical, 9)
                    .background(DuoColors.danger.opacity(0.12), in: .capsule)
                    .accessibilityLabel("恢复一颗红心")
                }
            }

            if heartRewarded {
                Text("坚持复习，补回一颗红心！").duoFont(.caption).foregroundStyle(DuoColors.inkMuted)
            }

            if graduatedCount > 0 {
                Text("🎓 \(graduatedCount) 道题毕业了！")
                    .duoFont(.subhead).foregroundStyle(DuoColors.primary)
                    .padding(.horizontal, 16).padding(.vertical, 9)
                    .background(DuoColors.primary.opacity(0.12), in: .capsule)
            }

            Button("返回错题本") { path.removeLast() }
                .buttonStyle(ChunkyButtonStyle(.primary))
                .padding(.horizontal, 32)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
        .onAppear {
            guard !awarded else { return }
            awarded = true
            progressStore.awardReviewXP(correctCount * xpPerCorrect, reviewedCount: queue.count)
            // content-7 断心联动：走完一整轮到期错题，缺心时补 1 颗。
            // 领取资格（最低答对数 + 按天账本）全在 store 里判，@State 挡不住
            // 「答错→立刻到期→再刷一轮」的循环（iosretention-4）。
            heartRewarded = progressStore.claimReviewHeartIfEligible(
                correctCount: correctCount,
                now: Date()
            )
            SFXEngine.shared.play(.complete); HapticEngine.shared.success()
        }
    }

    private var runner: some View {
        let entry = queue[index]
        let q = entry.question
        return VStack(spacing: 0) {
            HStack(spacing: 14) {
                Button { path.removeLast() } label: {
                    Image(systemName: "xmark").font(.system(size: 20, weight: .black)).foregroundStyle(DuoColors.inkMuted).frame(width: 36, height: 36)
                }
                StyledProgressBar(progress: Double(index) / Double(max(queue.count, 1)), height: 14, trackColor: DuoColors.surfaceAlt)
                Text("\(index + 1)/\(queue.count)").duoNumeral(.caption).foregroundStyle(DuoColors.inkMuted)
            }
            .padding(.horizontal, 18).padding(.top, 6).padding(.bottom, 10)

            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Text("复习错题").duoFont(.caption).foregroundStyle(DuoColors.fox)
                    HStack(alignment: .top, spacing: 8) {
                        Text(MathText.render(q.question)).duoFont(.subhead, weight: .medium).foregroundStyle(DuoColors.ink)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        SlowTTSButton(path: q.audio?.question)
                    }
                    QuestionRendererView(question: q, answer: currentAnswer, phase: phase, isCorrect: isCorrect, onChange: { currentAnswer = $0 })
                        .id(q.id)
                }
                .padding(20)
            }
        }
        .safeAreaInset(edge: .bottom) {
            footer(entry: entry, q: q)
        }
    }

    @ViewBuilder
    private func footer(entry: MistakeEntry, q: Question) -> some View {
        VStack(spacing: 0) {
            if phase == .checked, let ok = isCorrect {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 10) {
                        Image(systemName: ok ? "checkmark.circle.fill" : "xmark.circle.fill")
                            .font(.system(size: 22, weight: .bold))
                            .foregroundStyle(ok ? DuoColors.primary : DuoColors.danger)
                        Text(ok ? "答对了！" : "正确答案：\(MathText.render(q.answer))")
                            .duoFont(.caption).foregroundStyle(ok ? DuoColors.primary : DuoColors.danger)
                        Spacer()
                    }
                    // content-7：判题后展示解析 + 解析朗读按钮
                    if !q.explanation.isEmpty {
                        HStack(alignment: .top, spacing: 8) {
                            Text(MathText.render(q.explanation)).duoFont(.caption).foregroundStyle(DuoColors.inkMuted)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            SlowTTSButton(path: q.audio?.explanation, size: 14)
                        }
                    }
                }
                .padding(.horizontal, 20).padding(.top, 12)
            }
            Button {
                phase == .answering ? check(entry: entry) : advance()
            } label: {
                Text(phase == .answering ? "检查" : (index + 1 >= queue.count ? "完成复习" : "下一题"))
            }
            .buttonStyle(ChunkyButtonStyle(phase == .answering && currentAnswer.trimmingCharacters(in: .whitespaces).isEmpty ? .disabled : .primary))
            .disabled(phase == .answering && currentAnswer.trimmingCharacters(in: .whitespaces).isEmpty)
            .padding(.horizontal, 20).padding(.bottom, 32).padding(.top, 12)
        }
        .background(DuoColors.bg)
    }

    private func check(entry: MistakeEntry) {
        let ok = Grade.gradeAnswer(question: entry.question, userAnswer: currentAnswer)
        withAnimation(Motion.reveal) { phase = .checked; isCorrect = ok }
        if ok { correctCount += 1; SFXEngine.shared.play(.correct); HapticEngine.shared.correct() }
        else { SFXEngine.shared.play(.wrong); HapticEngine.shared.wrong() }
        let newlyGraduated = progressStore.reviewMistake(lessonId: entry.lessonId, questionId: entry.question.id, isCorrect: ok)
        if newlyGraduated { graduatedCount += 1 }
        // 答错时自动朗读解析，帮孩子当场弄懂（content-7）。
        if !ok, let explanationAudio = entry.question.audio?.explanation {
            AudioPlayer.shared.play(path: explanationAudio)
        }
    }

    private func advance() {
        SFXEngine.shared.play(.progressTick); HapticEngine.shared.tap()
        withAnimation(.easeInOut(duration: 0.2)) {
            index += 1; currentAnswer = ""; isCorrect = nil; phase = .answering
        }
    }
}
