"""Check local links and image references in every exported HTML page."""
import argparse, json
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
    for page in pages:
        doc=References();doc.feed(page.read_text())
        for tag,url in doc.references:
            split=urlsplit(url)
            if split.scheme or split.netloc or not split.path:continue
            target=args.root/unquote(split.path).lstrip('/') if split.path.startswith('/') else page.parent/unquote(split.path)
            if split.path.endswith('/'):target=target/'index.html'
            elif not target.suffix and not target.is_file():target=target/'index.html'
            count+=1;unique.add(str(target))
            if not target.is_file():missing.append({'page':str(page.relative_to(args.root)),'tag':tag,'reference':url})
    report={'pages':len(pages),'references':count,'uniqueTargets':len(unique),'missing':missing}
    if args.report:args.report.write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps({'pages':len(pages),'references':count,'uniqueTargets':len(unique),'missingCount':len(missing)},ensure_ascii=False))
    raise SystemExit(bool(missing))
if __name__=='__main__':main()
