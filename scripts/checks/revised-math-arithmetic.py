#!/usr/bin/env python3
"""Independently recompute self-contained arithmetic prompts using exact fractions.

This deliberately does not infer equations from word problems or grade approximate,
remainder or geometry tasks. Those require the separate semantic content review.
"""
import argparse
import ast
from fractions import Fraction
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]


def evaluate(expression):
    def visit(node):
        if isinstance(node, ast.Constant) and type(node.value) in (int, float):
            return Fraction(str(node.value))
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
            return visit(node.operand) * (-1 if isinstance(node.op, ast.USub) else 1)
        if isinstance(node, ast.BinOp):
            a, b = visit(node.left), visit(node.right)
            if isinstance(node.op, ast.Add): return a + b
            if isinstance(node.op, ast.Sub): return a - b
            if isinstance(node.op, ast.Mult): return a * b
            if isinstance(node.op, ast.Div): return a / b
        raise ValueError('Unsupported arithmetic syntax')
    return visit(ast.parse(expression, mode='eval').body)


def arithmetic_prompt(question):
    text = re.sub(r'\s+|\$', '', question)
    text = re.sub(r'\\+(?:times|cdot)(?![A-Za-z])', '*', text)
    text = re.sub(r'\\+div(?![A-Za-z])', '/', text)
    text = text.translate(str.maketrans({'×': '*', '÷': '/', '－': '-', '−': '-', '＋': '+', '（': '(', '）': ')'}))
    match = re.fullmatch(r'(?:计算[：:]?|口算[：:]?|用笔算计算[：:]?|用竖式计算[：:]?|算一算[：:]?)?([\d.+*/()\-]+?)(?:的结果是多少|的结果是|等于多少|=\?|=？|\?|？|=)?[。.]?', text)
    if not match or not re.search(r'[+*/-]', match[1]):
        return None
    return match[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report', type=Path, default=ROOT/'deploy-output/revised-math-arithmetic.json')
    args = parser.parse_args()
    catalog = json.loads((ROOT/'content/editions/2026/catalog.json').read_text())
    checked, failures, books = 0, [], {}
    for book in catalog['books']:
        if book['subject'] != 'math': continue
        books[book['id']] = 0
        for unit in book['units']:
            path = ROOT/'output/math/quizzes'/f"{book['stem']}_unit{unit['unit_number']}.json"
            data = json.loads(path.read_text())
            for section in ['unit_test', 'exam']:
                for q in data[section]['questions']:
                    if q['type'] not in ('calculation', 'choice') or not re.fullmatch(r'-?\d+(?:\.\d+)?', q['answer']): continue
                    expression = arithmetic_prompt(q['question'])
                    if expression is None: continue
                    actual, expected = Fraction(q['answer']), evaluate(expression)
                    checked += 1; books[book['id']] += 1
                    if actual != expected:
                        failures.append({'book': book['id'], 'unit': unit['unit_number'], 'question': q['id'],
                                         'expression': expression, 'answer': q['answer'], 'computed': str(expected)})
    assert checked > 0, 'No arithmetic prompts were validated'
    report = {'status': 'failed' if failures else 'passed', 'exactArithmeticChecked': checked,
              'perBook': books, 'failures': failures,
              'scope': 'Complete explicit arithmetic prompts with exact numeric answers; not a substitute for semantic or teacher review.'}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps(report, ensure_ascii=False))
    return bool(failures)


if __name__ == '__main__':
    raise SystemExit(main())
