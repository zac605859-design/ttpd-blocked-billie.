#!/usr/bin/env python3
from pathlib import Path
from html.parser import HTMLParser
from collections import Counter
import sys
ROOT=Path(__file__).resolve().parent
SKIP=("http://","https://","#","mailto:","tel:","javascript:")
class Parser(HTMLParser):
 def __init__(self): super().__init__(); self.ids=[]; self.refs=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if a.get("id"): self.ids.append(a["id"])
  if tag=="script" and a.get("src"): self.refs.append(a["src"])
  if tag=="link" and a.get("href") and "stylesheet" in a.get("rel",""): self.refs.append(a["href"])
  if tag in ("a","img") and a.get("href" if tag=="a" else "src"): self.refs.append(a.get("href" if tag=="a" else "src"))
pages=sorted(ROOT.glob("*.html")); errors=[]
for page in pages:
 p=Parser(); p.feed(page.read_text(encoding="utf-8"))
 dup=[k for k,v in Counter(p.ids).items() if v>1]
 if dup: errors.append(f"{page.name}: duplicate IDs {dup}")
 for ref in p.refs:
  if ref.startswith(SKIP): continue
  ref=ref.split("#")[0].split("?")[0]
  if ref and not (ROOT/ref).exists(): errors.append(f"{page.name}: missing local reference {ref}")
 print(("FAIL" if dup else "PASS"),page.name)
if errors:
 print("\n".join(errors)); sys.exit(1)
print(f"PASS — {len(pages)} HTML pages; no duplicate IDs or broken local references.")
