"""Build the original direct wording layer; never rewrite the historical bank."""
from pathlib import Path
import hashlib,json,re,unicodedata

ROOT=Path(__file__).resolve().parents[1]
def read(name):return json.loads((ROOT/name).read_text(encoding='utf-8-sig'))
def opening(text):return re.sub(r'[\W_]+','',unicodedata.normalize('NFKC',re.split('[，。；：！？]',text)[0]))
seeds=read('research/bank-seeds-a.json')+read('research/bank-seeds-b.json')
items=read('research/question-copy-a.json')['items']+read('research/question-copy-b.json')['items']
lookup={x['seedId']:x for x in items}
assert len(lookup)==288 and set(lookup)=={x['id'] for x in seeds}
assert len({x['text'] for x in items})==288
seen={}
for item in items:
    text=item['text']
    assert 10<=len(re.findall('[\u3400-\u9fff]',text))<=48,(item['seedId'],text)
    assert not re.search('可能|也許|傾向|情境：|你對相關背景|你手邊有|你能選擇自己方便',text)
    key=opening(text)
    assert key not in seen,('duplicate visible opening',key,seen.get(key),item['seedId'])
    seen[key]=item['seedId']
value={'version':'direct-v1','editorialVersion':'plain-questions-v2','coreItemCount':288,'historicalVariantCount':100000,'parameters':{'maxSameFamily':1,'maxSameSemanticCluster':1,'maxSameOpeningClause':1,'includeClarifications':True,'genericContextPreamble':False,'unchangedFivePointValues':[-2,-1,0,1,2]},'items':sorted(items,key=lambda x:x['seedId'])}
body='/* Original direct behavior wording; historical QB records remain unchanged. */\nwindow.GuaData ||= {};\nwindow.GuaData.questionCopy = '+json.dumps(value,ensure_ascii=False,separators=(',',':'))+';\n'
(ROOT/'dist/data/question-copy.js').write_text(body,encoding='utf-8')
print(json.dumps({'version':value['version'],'items':len(items),'uniqueVisibleOpeningClauses':len(seen),'sha256':hashlib.sha256(body.encode()).hexdigest()}))
