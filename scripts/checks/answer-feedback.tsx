import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TrueFalseQuestion } from '../../apps/web/src/components/question/TrueFalseQuestion';
import { gradeAnswer } from '../../apps/web/src/lib/grade';
import type { Question } from '../../apps/web/src/types';

// Exercise the rendered caller: the option marked correct must agree with grading,
// including English story answers, independently of the student's last selection.
for (const correct of ['True', 'TRUE', 'true', 'T', 'yes', '对', '正确', 'False', 'FALSE', 'F', 'no', '错']) {
  const question = { id: 1, type: 'true_false', question: 'Example', answer: correct, options: [], score: 1, difficulty: 1, knowledge_point: '', explanation: '' } as Question;
  for (const answer of ['对', '错']) {
    const html = renderToStaticMarkup(<TrueFalseQuestion question={question} answer={answer} phase="checked" isCorrect={gradeAnswer(question, answer)} onChange={() => {}} />);
    const buttons = html.match(/<button\b[\s\S]*?<\/button>/g) ?? [];
    const highlighted = buttons.filter(button => button.includes('option-card-correct'));
    assert.equal(highlighted.length, 1);
    const label = gradeAnswer(question, '对') ? '对' : '错';
    assert.match(highlighted[0], new RegExp(`>${label}<`), `Answer ${correct} must highlight ${label}`);
  }
}
console.log('Judgment feedback agrees with grading in 24 rendered cases.');
