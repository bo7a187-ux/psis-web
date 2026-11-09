"""Extract sample data + recalculated reference results from the Excel workbook.
Usage: python3 extract_reference.py <recalculated.xlsx> <out.json>
The workbook must be recalculated first (e.g. LibreOffice headless convert)."""
import sys, json, datetime, openpyxl

EPOCH = datetime.datetime(1899, 12, 30)
def v(x):
    if isinstance(x, datetime.datetime):
        d = (x - EPOCH)
        return {"serial": d.days + d.seconds / 86400}
    if isinstance(x, str) and x.startswith('#'):
        return {"error": x}
    return x

wb = openpyxl.load_workbook(sys.argv[1], data_only=True, read_only=True)
out = {}

def rows(name, r1, r2=None, c1=1, c2=None):
    ws = wb[name]
    return [[v(c) for c in r] for r in ws.iter_rows(min_row=r1, max_row=r2, min_col=c1, max_col=c2, values_only=True)]

raw = rows('RAW PRIMAVERA DATA', 1)
out['raw'] = [r for r in raw if any(c is not None for c in r)]

s = {}
for r in rows('SETTINGS', 4, 27, 2, 3):
    if r[0]: s[r[0]] = r[1]
out['settings'] = s

out['mapping'] = [r[:5] for r in rows('COLUMN MAPPING', 8, 36, 2, 6)]

cl = rows('CLASSIFICATION', 5, 19, 1, 10)
out['lists'] = {k: [r[i] for r in cl if r[i] not in (None, '')] for k, i in
                [('phase', 0), ('discipline', 2), ('building', 4), ('floor', 6), ('location', 8)]}
out['rules'] = [r[:8] for r in rows('CLASSIFICATION', 24, 63, 1, 8) if r[0]]
out['overrides'] = [r for r in rows('CLASSIFICATION', 24, 323, 11, 16) if r[0]]

br = rows('BASELINE REGISTER', 7, 2007, 1, 23)
out['baselineRegisterHeader'] = rows('BASELINE REGISTER', 3, 6, 1, 23)
out['originalBaseline'] = [r[7:11] for r in br if r[7]]
out['revisionLog'] = [r[12:16] for r in br if r[12]]
out['revisedBaselines'] = [r[17:23] for r in br if r[17]]

hs = rows('HISTORICAL SNAPSHOTS', 10, 129, 2, 18)
out['historyHeader'] = rows('HISTORICAL SNAPSHOTS', 9, 9, 2, 18)[0]
out['historyLive'] = rows('HISTORICAL SNAPSHOTS', 6, 6, 2, 15)[0]
out['history'] = [r for r in hs if isinstance(r[0], dict)]
sa = rows('SNAPSHOT ACTIVITIES', 6, 2005, 15, 27)
out['snapshotActivitiesHeader'] = rows('SNAPSHOT ACTIVITIES', 5, 5, 15, 27)[0]
out['snapshotActivities'] = [r for r in sa if r[1]]

eng = rows('ACTIVITIES ENGINE', 7, 2007)
hdr = eng[0]
out['engineHeader'] = hdr
out['engine'] = [r for r in eng[1:] if r[3] not in (None, '')]

out['execDashboard'] = rows('EXECUTIVE DASHBOARD', 1, 144, 1, 30)
out['scheduleControl'] = rows('SCHEDULE CONTROL', 1, 103, 1, 20)
out['delayAnalysis'] = rows('DELAY ANALYSIS', 1, 41, 1, 21)
out['validationLog'] = rows('VALIDATION LOG', 1, 98, 1, 8)
out['monthlyReport'] = rows('MONTHLY REPORT', 1, 67, 1, 8)
ws = wb['EXECUTIVE DASHBOARD']
helpers = {}
for r in ws.iter_rows(min_row=1, max_row=31, min_col=20, max_col=21, values_only=True):
    if r[0]: helpers[r[0]] = v(r[1])
for r in ws.iter_rows(min_row=1, max_row=6, min_col=29, max_col=30, values_only=True):
    if r[0]: helpers['AD:' + str(r[0])] = v(r[1])
out['execHelpers'] = helpers
out['sCurve'] = [[v(c) for c in r] for r in ws.iter_rows(min_row=35, max_row=70, min_col=20, max_col=24, values_only=True)]
out['trendHelpers'] = [v(ws.cell(row=r, column=22).value) for r in range(39, 43)]
json.dump(out, open(sys.argv[2], 'w'), indent=0, default=str)
print('raw rows', len(out['raw']), 'engine rows', len(out['engine']), 'orig BL', len(out['originalBaseline']),
      'revised', len(out['revisedBaselines']), 'revlog', out['revisionLog'], 'history', len(out['history']),
      'snapAct', len(out['snapshotActivities']), 'rules', len(out['rules']), 'overrides', out['overrides'])
