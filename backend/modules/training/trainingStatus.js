const SUCCESSFUL_COMPLETION_SQL = `s.status = 'completed' AND (
    COALESCE(s.requires_quiz, 1) = 0
    OR (
        s.quiz_score IS NOT NULL
        AND s.quiz_score >= COALESCE(s.pass_score, 0)
    )
)`;

function isSuccessfulCompletion({
    status,
    requires_quiz: requiresQuiz,
    quiz_score: quizScore,
    pass_score: passScore
}) {
    if (status !== 'completed') return false;
    if (requiresQuiz === false || Number(requiresQuiz) === 0) return true;
    if (quizScore === null || quizScore === undefined) return false;
    return Number(quizScore) >= Number(passScore || 0);
}

module.exports = {
    SUCCESSFUL_COMPLETION_SQL,
    isSuccessfulCompletion
};
