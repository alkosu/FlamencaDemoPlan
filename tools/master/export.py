import json,csv,html
M=json.load(open('model.json')); V=json.load(open('vec_master.json')); W,H=M['size']
LEG=M['legend']
def pstr(P): return 'M'+' '.join(f'{x:.1f},{y:.1f}' for x,y in P)+'Z'
FLOORS=['0','1','2','3']
FN={'0':'Этаж 0 (planta baja)','1':'Этаж 1','2':'Этаж 2','3':'Этаж 3'}
L=lambda gid,name,body,vis=True:f'<g id="{gid}" inkscape:groupmode="layer" inkscape:label="{name}"{"" if vis else " style=\"display:none\""}>{body}</g>'
p=lambda d,fill,extra='':f'<path d="{d}" fill="{fill}" fill-rule="evenodd"{extra}/>'
out=[f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" viewBox="0 0 {W} {H}" width="{W}" height="{H}">',
 '<style>text{font-family:"IBM Plex Mono",monospace}</style>',
 L('raster','Исходные планы (сводная подложка)','<image href="master.jpg" width="%d" height="%d" opacity="0.6"/>'%(W,H),False),
 L('road','Проезды',p(V['road'],'#d3d6d3')),
 L('walk','Пешеходные дорожки',p(V['walk'],'#e9dcbd')),
 L('lawn','Озеленение',p(V['lawn'],'#bcd592')+p(V['trees'],'#79a858')),
 L('pool','Бассейны и пляжи',p(V['deck'],'#cdb79b')+p(V['pool'],'#57c1ea',' stroke="#2e95c2" stroke-width="1.5"')),
 L('parking','Парковка',p(V['parking'],'#848985')),
 L('buildings','Корпуса и террасы',p(V['bldbody'],'#e7e1d3',' stroke="#a99d86" stroke-width="1"')+p(V['terrace'],'#d9cfbb')),
 L('gallery','Галереи и лестничные ядра',p(V['gallery'],'#efd57c',' stroke="#c9a93f" stroke-width=".8"')),
]
ph=''.join(f'<path d="{pstr(v)}" fill="none" stroke="#9a3b2b" stroke-width="3" stroke-dasharray="12 7"><title>{k}</title></path>' for k,v in M['phases'].items())
out.append(L('phases','Границы фаз',ph))
# floor layers
for f in FLOORS:
    g=[]
    for s in M['stacks']:
        code=next((c for c in s['units'] if (c.startswith('PB') if f=='0' else c.startswith('P'+f+':')) or (':' not in c and c[len(c.split('-')[0].rstrip('abcdefghijklmnopqrstuvwxyz'))-1]==f)),None)
        if code is None: continue
        num=code.split('-')[1] if '-' in code else code.split(':')[1]
        cx,cy=s['c']; fs=17
        g.append(f'<g id="u-{html.escape(code)}" data-code="{html.escape(code)}" data-block="{s["block"]}" data-stair="{s["stair"] or ""}">'
                 f'<path d="{pstr(s["poly"])}" fill="{"#e6eefb" if s["kind"]=="apt" else "#f3e4f2"}" stroke="#57627a" stroke-width="1.4"/>'
                 f'<text x="{cx:.1f}" y="{cy+6:.1f}" text-anchor="middle" font-size="{fs}" fill="#1d2420">{html.escape(num)}</text></g>')
    out.append(L(f'floor{f}',FN[f],''.join(g),f=='0'))
st=''.join(f'<g id="stair-{s["id"]}"><rect x="{s["x"]-10:.1f}" y="{s["y"]-10:.1f}" width="20" height="20" rx="4" fill="#2f7a4d" stroke="#fff" stroke-width="2"/><text x="{s["x"]:.1f}" y="{s["y"]+4:.1f}" text-anchor="middle" font-size="11" fill="#fff" font-weight="700">E{s["n"]}</text><title>Escalera {s["n"]} · корпус {s["group"]}</title></g>' for s in M['stairs'])
out.append(L('stairs','Лестницы',st))
lf=''.join(f'<g id="lift-{s["id"]}"><rect x="{s["x"]+11:.1f}" y="{s["y"]-9:.1f}" width="16" height="18" rx="2" fill="#1f4fd1" stroke="#fff" stroke-width="2"/><text x="{s["x"]+19:.1f}" y="{s["y"]+4:.1f}" text-anchor="middle" font-size="10" fill="#fff" font-weight="700">L</text><title>Лифт у Escalera {s["n"]}, корпус {s["group"]} (предположительно)</title></g>' for s in M['stairs'])
out.append(L('lifts','Лифты (предположительно, у лестниц)',lf))
po=''.join(f'<g><circle cx="{q["x"]}" cy="{q["y"]}" r="13" fill="#fff" stroke="#3a3f3b" stroke-width="1.5"/><text x="{q["x"]}" y="{q["y"]+4}" text-anchor="middle" font-size="{11 if len(q["code"])<3 else 9}" fill="#3a3f3b">{q["code"]}</text><title>{q["code"]} — {LEG.get(q["code"],{}).get("ru","")}</title></g>' for q in M['pois'])
out.append(L('pois','Объекты инфраструктуры (легенда)',po))
out.append('</svg>')
open('../out/flamenca_master_layers.svg','w').write(''.join(out))
# CSV
rows=sorted(M['units'],key=lambda u:(u['kind']!='apt',u['num'] if u['kind']=='apt' else int(u['num'][1:])))
with open('../out/flamenca_apartments.csv','w',newline='',encoding='utf-8-sig') as fh:
    w=csv.writer(fh,delimiter=';')
    w.writerow(['№','Код','Тип','Фаза','Корпус','Этаж','Лестница','Лифт (предп.)'])
    for u in rows:
        sid=u['stair'] or ''; n=sid.split('-E')[1] if sid else ''
        w.writerow([u['num'],u['code'],'апартамент' if u['kind']=='apt' else 'коммерческое помещение',u['phase'],u['block'],u['floor'],
                    f'Escalera {n} ({sid})' if sid else '—', ('не нужен' if u['floor']==0 else f'у Escalera {n} ({sid})') if sid else '—'])
print('ok', len(rows))
