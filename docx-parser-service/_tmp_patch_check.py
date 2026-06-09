import pathlib
p=pathlib.Path('docx-parser-service/main.py')
t=p.read_text()
needle='text = re.sub(r"[\\n\\r\\t]+", " ", text)'
print('found', needle in t)
print('snippet around:')
idx=t.find('text = re.sub')
print(t[idx:idx+120])

