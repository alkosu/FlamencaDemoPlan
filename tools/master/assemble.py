import json,re,numpy as np,cv2,math
from poi import POI,STAIRS,LEGEND
J=json.load(open('global.json')); W,H=J['size']
def tf(k,P): M=np.array(J['M'][k]); P=np.asarray(P,float).reshape(-1,2); return P@M[:,:2].T+M[:,2]
S123=json.load(open('stacks_f123.json'))
pd=open('/home/claude/flamencademoplan/data/plan-data.js',encoding='utf-8').read(); PD=json.loads(pd[pd.index('=')+1:].strip().rstrip(';'))
stacks=[]
for plan,lst in S123.items():
    for s in lst:
        P=tf(plan,s['poly']); c=tf(plan,[s['centre']])[0]
        stacks.append({'plan':plan,'phase':s['phase'],'block':s['block'],'kind':s['kind'],'units':s['units'],'poly':P,'c':c,'axis':s['axis']})
for cfg,g in zip(PD['config']['stacks'],PD['stacks']):
    polys=[np.array([[float(v) for v in p.split(',')] for p in poly.split()]) for poly in re.findall(r'M([^Z]+)Z',g['d'])]
    big=max(polys,key=lambda p:abs(cv2.contourArea(p.astype(np.float32))))
    stacks.append({'plan':'f4','phase':4,'block':cfg['building'],'kind':'apt','units':cfg['units'],'poly':tf('f4',big),'c':tf('f4',[g['c']])[0],'axis':'x' if cfg['building'] in ('16','17') else 'y'})
# stairs
stairs=[]
for plan,blocks,x,y in STAIRS:
    p=tf(plan,[[x,y]])[0]; stairs.append({'blocks':blocks,'x':p[0],'y':p[1],'plan':plan})
GROUP={'4.1':'4.1','3.1/3.2':'3','4.2':'4.2','2/1':'2','9.1/9.2':'9','9.1':'9','8.1/8.2':'8','7':'7','13':'13','12.1':'12.1','12.2':'12.2','11.2':'11.2','11.1':'11.1','10':'10','16':'16','17':'17','15':'15','14.1/14.2':'14'}
from collections import defaultdict
grp=defaultdict(list)
for i,s in enumerate(stairs): s['group']=GROUP['/'.join(s['blocks'])]; grp[s['group']].append(i)
for key,idx in grp.items():
    idx.sort(key=lambda i:(round(stairs[i]['y']/40),stairs[i]['x']))
    for n,i in enumerate(idx,1): stairs[i]['n']=n
f4n={(455,135):1,(590,140):2,(1225,140):1,(1340,140):2,(240,595):1,(225,740):2,(898,715):1,(898,595):2}
for (plan,blocks,x,y),s in zip(STAIRS,stairs):
    if plan=='f4': s['n']=f4n[(x,y)]
    if s['group']=='11.2': s['n']=2
    if s['group']=='11.1': s['n']=1
    s['id']=f"{s['group']}-E{s['n']}"
# assign stair to stack
def blk_main(b): return b
for st in stacks:
    cand=[s for s in stairs if st['block'] in s['blocks']]
    if not cand: st['stair']=None; continue
    best=min(cand,key=lambda s:math.hypot(s['x']-st['c'][0],s['y']-st['c'][1]))
    st['stair']=best['id']
# units
units=[]
for si,st in enumerate(stacks):
    for code in st['units']:
        if st['kind']=='local':
            m=re.match(r'^P(B|\d):Loc\.(\d+)$',code); fl=0 if m.group(1)=='B' else int(m.group(1)); num='L'+m.group(2); typ=''
        else:
            m=re.match(r'^([A-Z]{1,2})(\d)([a-z]?)-(\d+)$',code); fl=int(m.group(2)); num=int(m.group(4)); typ=m.group(1)+m.group(3)
        units.append({'num':num,'code':code,'phase':st['phase'],'block':st['block'],'floor':fl,'type':typ,'kind':st['kind'],'stack':si,'stair':st['stair']})
apts=[u for u in units if u['kind']=='apt']
nums=sorted(u['num'] for u in apts)
print('stacks',len(stacks),'apts',len(apts),'locals',len(units)-len(apts),'range',nums[0],nums[-1],'missing',sorted(set(range(1,507))-set(nums)),'dups',len(nums)-len(set(nums)))
print('stairs',[s['id'] for s in stairs])
print('stacks without stair',[st['units'][0] for st in stacks if not st['stair']])
pois=[]
for plan,lst in POI.items():
    for code,x,y in lst:
        p=tf(plan,[[x,y]])[0]; pois.append({'code':str(code),'x':round(p[0],1),'y':round(p[1],1)})
phases=json.load(open('phase_polys.json'))
OUT={'size':[W,H],'metersPerPx':round(0.1/np.hypot(*np.array(J['M']['f4'])[:,0]),4),
     'stacks':[{'block':s['block'],'phase':s['phase'],'kind':s['kind'],'units':s['units'],'stair':s['stair'],'axis':s['axis'],
                'poly':np.round(s['poly'],1).tolist(),'c':np.round(s['c'],1).tolist()} for s in stacks],
     'stairs':[{'id':s['id'],'group':s['group'],'blocks':s['blocks'],'n':s['n'],'x':round(s['x'],1),'y':round(s['y'],1)} for s in stairs],
     'pois':pois,'legend':LEGEND,'phases':phases,'units':units}
json.dump(OUT,open('model.json','w'),ensure_ascii=False)
