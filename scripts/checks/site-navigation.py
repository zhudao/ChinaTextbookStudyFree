"""Check local links and image references in every exported HTML page."""
import argparse, json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote

class References(HTMLParser):
    def __init__(self):
        super().__init__(); self.references=[]
    def handle_starttag(self, tag, attrs):
        attrs=dict(attrs)
        key='href' if tag=='a' else 'src' if tag=='img' else None
        if key and attrs.get(key): self.references.append((tag,attrs[key]))

def main():
    parser=argparse.ArgumentParser();parser.add_argument('root',type=Path);parser.add_argument('--report',type=Path);args=parser.parse_args()
    pages=list(args.root.rglob('*.html')); missing=[];count=0;unique=set()
    def check_page(page):
        doc=References();doc.feed(page.read_text(encoding='utf-8'))
        targets=[];page_missing=[]
        for tag,url in doc.references:
            split=urlsplit(url)
            if split.scheme or split.netloc or not split.path:continue
            target=args.root/unquote(split.path).lstrip('/') if split.path.startswith('/') else page.parent/unquote(split.path)
            if split.path.endswith('/'):target=target/'index.html'
            elif not target.suffix and not target.is_file():target=target/'index.html'
            targets.append(str(target))
            if not target.is_file():page_missing.append({'page':str(page.relative_to(args.root)),'tag':tag,'reference':url})
        return targets,page_missing
    with ThreadPoolExecutor(max_workers=16) as pool:
        for completed,(targets,page_missing) in enumerate(pool.map(check_page,pages),1):
            count+=len(targets);unique.update(targets);missing.extend(page_missing)
            if completed % 500 == 0:print(f'Checked {completed}/{len(pages)} pages',flush=True)
    report={'pages':len(pages),'references':count,'uniqueTargets':len(unique),'missing':missing}
    if args.report:args.report.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'pages':len(pages),'references':count,'uniqueTargets':len(unique),'missingCount':len(missing)},ensure_ascii=False))
    raise SystemExit(bool(missing))
if __name__=='__main__':main()
