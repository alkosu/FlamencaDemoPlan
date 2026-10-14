#!/usr/bin/env python3
"""Стартовый GeoPackage для правки в QGIS: data/qgis/flamenca.gpkg

Слои: paths (дорожки), stairs, starts (точки «Откуда»), stacks (стояки, справочно),
lifts и water_panels (пустые шаблоны). Стили и выпадающие списки атрибутов
записаны в файл — QGIS применит их сам.

Координаты — «метры плана»: X = px·0,1, Y = −py·0,1. Подложка source/master.jpg
получает world-файл master.jgw с тем же масштабом, поэтому всё совпадает без привязки.

ВНИМАНИЕ: перезаписывает data/qgis/flamenca.gpkg. Нужен один раз, дальше правьте файл в QGIS.
    pip install pyogrio shapely numpy
    python tools/qgis_export.py
"""
import json, re, sqlite3
from pathlib import Path
import numpy as np
import pyogrio.raw as raw
import shapely

ROOT = Path(__file__).resolve().parent.parent
S = 0.1
CRS = 'LOCAL_CS["Flamenca plan (metres)",LOCAL_DATUM["plan",0],UNIT["metre",1],AXIS["X",EAST],AXIS["Y",NORTH]]'
OUT = ROOT / "data/qgis/flamenca.gpkg"
rd = lambda p: json.loads((ROOT / p).read_text(encoding="utf-8"))
CFG, MODEL = rd("data/complex.json"), rd("data/master/model.json")
m = lambda p: (round(p[0] * S, 2), round(-p[1] * S, 2))

KIND = ["auto", "footpath", "gallery", "crossing", "road", "ramp", "steps"]
ACCESS = ["residents", "public", "closed"]
PLACE = ["galería", "portal", "escalera", "sótano", "exterior"]
WKIND = ["contadores", "llave de corte", "ambos"]


def write(layer, geoms, fields):
    names = list(fields)
    raw.write(str(OUT), geometry=np.array(shapely.to_wkb(geoms), dtype=object),
              field_data=[np.array(fields[k], dtype=object) for k in names], fields=names,
              layer=layer, driver="GPKG", crs=CRS, geometry_type=geoms[0].geom_type)


def value_map(field, values):
    opts = "".join(f'<Option type="Map"><Option name="{v}" type="QString" value="{v}"/></Option>' for v in values)
    return (f'<field name="{field}" configurationFlags="NoFlag"><editWidget type="ValueMap"><config><Option type="Map">'
            f'<Option name="map" type="List">{opts}</Option></Option></config></editWidget></field>')


def checkbox(field):
    return (f'<field name="{field}" configurationFlags="NoFlag"><editWidget type="CheckBox"><config><Option type="Map">'
            f'<Option name="CheckedState" type="QString" value="1"/><Option name="UncheckedState" type="QString" value="0"/>'
            f'</Option></config></editWidget></field>')


def symbol(kind, color, size_or_width):
    if kind == "line":
        lyr = (f'<layer class="SimpleLine" enabled="1" pass="0" locked="0"><Option type="Map">'
               f'<Option name="line_color" type="QString" value="{color}"/><Option name="line_width" type="QString" value="{size_or_width}"/>'
               f'<Option name="line_width_unit" type="QString" value="MM"/><Option name="capstyle" type="QString" value="round"/>'
               f'<Option name="joinstyle" type="QString" value="round"/></Option></layer>')
    elif kind == "marker":
        lyr = (f'<layer class="SimpleMarker" enabled="1" pass="0" locked="0"><Option type="Map">'
               f'<Option name="color" type="QString" value="{color}"/><Option name="name" type="QString" value="square"/>'
               f'<Option name="size" type="QString" value="{size_or_width}"/><Option name="outline_color" type="QString" value="255,255,255,255"/>'
               f'<Option name="outline_width" type="QString" value="0.4"/></Option></layer>')
    else:
        lyr = (f'<layer class="SimpleFill" enabled="1" pass="0" locked="0"><Option type="Map">'
               f'<Option name="color" type="QString" value="{color}"/><Option name="outline_color" type="QString" value="87,98,122,255"/>'
               f'<Option name="outline_width" type="QString" value="{size_or_width}"/></Option></layer>')
    return f'<symbol type="{kind if kind != "marker" else "marker"}" name="0" alpha="1" clip_to_extent="1" force_rhr="0">{lyr}</symbol>'


def qml(sym, fields="", label=None):
    lab = ""
    if label:
        lab = (f'<labeling type="simple"><settings calloutType="simple"><text-style fieldName="{label}" fontSize="8" textColor="20,20,20,255">'
               f'<text-buffer bufferDraw="1" bufferSize="0.8" bufferColor="255,255,255,255"/></text-style>'
               f'<placement placement="1" dist="1"/></settings></labeling>')
    return ("<!DOCTYPE qgis PUBLIC 'http://mrcc.com/qgis.dtd' 'SYSTEM'>"
            '<qgis version="3.34.0" styleCategories="Symbology|Labeling|Fields|Forms">'
            f'<renderer-v2 type="singleSymbol" symbollevels="0" enableorderby="0" forceraster="0"><symbols>{sym}</symbols></renderer-v2>'
            f'{lab}<fieldConfiguration>{fields}</fieldConfiguration></qgis>')


if OUT.exists():
    OUT.unlink()
OUT.parent.mkdir(parents=True, exist_ok=True)

# дорожки: автосеть + ручные отрезки из complex.json
auto = rd("data/master/paths.json")
lines = [shapely.LineString([m(p) for p in l]) for l in auto]
verts = np.array([p for l in auto for p in l])
snapv = lambda p: verts[((verts - p) ** 2).sum(1).argmin()].tolist()
# концы ручных отрезков ставим ровно на вершины автосети, чтобы в QGIS они были соединены
extra = [[snapv(l[0])] + l + [snapv(l[-1])] for l in CFG.get("extraPaths", {}).get("paths", [])]
lines += [shapely.LineString([m(p) for p in l]) for l in extra]
write("paths", lines, {"kind": ["auto"] * (len(lines) - len(extra)) + ["footpath"] * len(extra),
                       "access": ["residents"] * len(lines), "steps": [0] * len(lines),
                       "note": [""] * (len(lines) - len(extra)) + ["extraPaths"] * len(extra)})
st = MODEL["stairs"]
write("stairs", [shapely.Point(m((s["x"], s["y"]))) for s in st],
      {"id": [s["id"] for s in st], "block": [s["group"] for s in st], "n": [s["n"] for s in st]})
sp = CFG["starts"]
write("starts", [shapely.Point(m((s["x"], s["y"]))) for s in sp],
      {"id": [s["id"] for s in sp], **{f"name_{l}": [s["name"][l] for s in sp] for l in CFG["languages"]}})
write("stacks", [shapely.Polygon([m(p) for p in s["poly"]]) for s in MODEL["stacks"]],
      {"block": [s["block"] for s in MODEL["stacks"]], "units": [" ".join(s["units"]) for s in MODEL["stacks"]],
       "stair": [s["stair"] or "" for s in MODEL["stacks"]]})
far = [shapely.Point(-20, 20)]  # служебная точка-пример за пределами плана; удалите после первой своей
write("lifts", far, {"id": ["EXAMPLE"], "block": [""], "stair_id": [""], "floors": ["0-3"], "serves": [""], "note": ["пример — удалить"]})
write("water_panels", far, {"id": ["EXAMPLE"], "block": [""], "floor": [0], "place": ["galería"], "serves": [""],
                            "kind": ["contadores"], "note": ["пример — удалить"], "photo": [""]})

STYLES = {
    "paths": qml(symbol("line", "31,79,209,255", "0.7"), value_map("kind", KIND) + value_map("access", ACCESS) + checkbox("steps")),
    "stairs": qml(symbol("marker", "47,122,77,255", "3.2"), label="id"),
    "starts": qml(symbol("marker", "29,36,32,255", "3.6"), label="id"),
    "stacks": qml(symbol("fill", "230,238,251,120", "0.2")),
    "lifts": qml(symbol("marker", "31,79,209,255", "3.0"), label="id"),
    "water_panels": qml(symbol("marker", "46,149,194,255", "3.0"), value_map("place", PLACE) + value_map("kind", WKIND), label="id"),
}
con = sqlite3.connect(OUT)
con.execute("""CREATE TABLE IF NOT EXISTS layer_styles (id INTEGER PRIMARY KEY AUTOINCREMENT, f_table_catalog TEXT(256),
  f_table_schema TEXT(256), f_table_name TEXT(256), f_geometry_column TEXT(256), styleName TEXT(30), styleQML TEXT,
  styleSLD TEXT, useAsDefault BOOLEAN, description TEXT, owner TEXT(30), ui TEXT(30), update_time DATETIME DEFAULT CURRENT_TIMESTAMP)""")
for t, q in STYLES.items():
    g = con.execute("select column_name from gpkg_geometry_columns where table_name=?", (t,)).fetchone()[0]
    con.execute("insert into layer_styles (f_table_catalog,f_table_schema,f_table_name,f_geometry_column,styleName,styleQML,styleSLD,useAsDefault,description,owner,ui)"
                " values ('','',?,?,?,?,'',1,'FlamencaDemoPlan','','')", (t, g, t, q))
con.commit(); con.close()
(ROOT / "source/master.jgw").write_text(f"{S}\n0\n0\n{-S}\n{S / 2}\n{-S / 2}\n")
(ROOT / "source/master.jpg.aux.xml").write_text(f"<PAMDataset><SRS>{CRS}</SRS></PAMDataset>\n")
print(f"OK: {OUT.relative_to(ROOT)} — {len(lines)} линий дорожек, {len(st)} лестниц, {len(sp)} точек старта; стили записаны")
