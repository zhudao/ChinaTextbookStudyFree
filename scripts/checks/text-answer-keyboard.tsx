import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FillBlankTextQuestion } from '../../apps/web/src/components/question/FillBlankTextQuestion';
import { gradeAnswer } from '../../apps/web/src/lib/grade';
import type { Question } from '../../apps/web/src/types';

for (const answer of ['thirty-first', 'in the library', 'didnt watch', '一百二十三']) {
  const question = { id: 19, type: 'fill_blank_text', question: 'Fill in', answer, options: [], score: 1, difficulty: 1, knowledge_point: '', explanation: '' } as Question;
  const html = renderToStaticMarkup(<FillBlankTextQuestion question={question} answer="" phase="answering" isCorrect={null} onChange={() => {}} />);
  const keys = new Set((html.match(/<button\b[\s\S]*?<\/button>/g) ?? []).map(button => button.replace(/<[^>]+>/g, '')));
  const typed = answer.toLowerCase().replace(/\s+/g, '');
  for (const ch of typed) assert.ok(keys.has(ch), `Keyboard cannot enter ${ch} in ${answer}`);
  assert.ok(gradeAnswer(question, typed));
}
console.log('Text keyboards expose every character needed for long and compound answers.');
