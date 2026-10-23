#!/usr/bin/env python3
"""Reject publication that drops completed lessons, questions, knowledge or new courses."""
import argparse
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def clean(value):
    if isinstance(value, dict):
        return {key: clean(item) for key, item in value.items() if key != 'audio'}
    if isinstance(value, list):
        return [clean(item) for item in value]
    return value


def normalized_question(value):
    value = clean(value)
    if value['type'] in ('fill_blank', 'calculation') and not re.fullmatch(r'[0-9./-]+', value['answer'].strip()):
        value['type'] = 'fill_blank_text'
    return value


def digest(value):
    payload = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()
    return hashlib.sha256(payload).hexdigest()


def audit(public, baseline):
    index = json.loads((public / 'data/index.json').read_text(encoding='utf-8'))
    lessons = {}
    for book in index['books']:
        folder = public / 'data/books' / book['id']
        outline = json.loads((folder / 'outline.json').read_text(encoding='utf-8'))
        for meta in outline['lessons']:
            lesson = json.loads((folder / 'lessons' / (meta['id'] + '.json')).read_text(encoding='utf-8'))
            if lesson['id'] in lessons:
                raise ValueError('Duplicate lesson id: ' + lesson['id'])
            lessons[lesson['id']] = lesson
    errors, migrations = [], []
    for expected in baseline['lessons']:
        current = lessons.get(expected['id'])
        if current and current.get('legacyPracticeLessonId'):
            original = current['id']
            current = lessons.get(current['legacyPracticeLessonId'])
            if not current or current.get('restoresLessonId') != original:
                errors.append({'lesson': original, 'error': 'missing preserved pilot practice'})
                continue
            migrations.append({'original': original, 'practice': current['id']})
        if not current:
            errors.append({'lesson': expected['id'], 'error': 'missing released lesson'})
            continue
        questions = [normalized_question(q) for q in current['questions']]
        missing = set(expected['question_ids']) - {q['id'] for q in questions}
        if missing:
            errors.append({'lesson': expected['id'], 'error': 'missing released questions', 'ids': sorted(missing)})
        by_id = {q['id']: q for q in questions}
        if not missing and digest([by_id[qid] for qid in expected['question_ids']]) != expected['questions_sha256']:
            errors.append({'lesson': expected['id'], 'error': 'unapproved released question content change'})
        if digest(clean(current.get('knowledge'))) != expected['knowledge_sha256']:
            errors.append({'lesson': expected['id'], 'error': 'released knowledge changed or missing'})
    questions = sum(len(lesson['questions']) for lesson in lessons.values())
    for lesson in lessons.values():
        if not lesson.get('knowledge') or len(lesson['questions']) < 6:
            errors.append({'lesson': lesson['id'], 'error': 'missing knowledge or insufficient questions'})
    if len(lessons) < baseline['minimum_lessons'] or questions < baseline['minimum_questions']:
        errors.append({'error': 'restored corpus below required size'})
    if not any(book['id'] == baseline['required_additional_book'] for book in index['books']):
        errors.append({'error': 'new textbook missing'})
    if index['totalLessons'] != len(lessons) or index['totalQuestions'] != questions:
        errors.append({'error': 'index totals differ from actual lessons'})
    return {'status': 'failed' if errors else 'passed', 'baseline_release': baseline['source_release'],
            'baseline_lessons_verified': len(baseline['lessons']),
            'baseline_questions_verified': sum(len(item['question_ids']) for item in baseline['lessons']),
            'regular_lessons': len(lessons), 'regular_questions': questions,
            'missing_knowledge': sum(not lesson.get('knowledge') for lesson in lessons.values()),
            'below_six_questions': sum(len(lesson['questions']) < 6 for lesson in lessons.values()),
            'pilot_practice_migrations': migrations, 'errors': errors}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--public', type=Path, default=ROOT / 'apps/web/public')
    parser.add_argument('--baseline', type=Path, default=ROOT / 'release/content-baseline-v1.4.0.json')
    parser.add_argument('--report', type=Path, default=ROOT / 'deploy-output/content-retention.json')
    args = parser.parse_args()
    result = audit(args.public, json.loads(args.baseline.read_text(encoding='utf-8')))
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False))
    return result['status'] != 'passed'


if __name__ == '__main__':
    raise SystemExit(main())
