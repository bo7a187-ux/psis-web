"""Builds test/fixtures/messy_export.xlsx - an awkward export used by the importer tests."""
import datetime, openpyxl
wb = openpyxl.Workbook()
ws = wb.active; ws.title = 'Activities'
ws.append(['Exported from P6 - Project X'])          # title row above the headers
ws.append(['Activity Code', 'Unknown Column', 'Physical %', 'Description', 'Status', 'Type',
           'Original Duration', 'BL1 Finish', 'BL1 Start', 'Actual Start', 'Actual Finish', 'TF', 'Budget Cost'])
D = datetime.datetime
rows = [
    ['A100', 'x', 0.5, 'Excavation', 'In Progress', 'Task Dependent', 80, D(2026, 2, 10), D(2026, 1, 1), '05-Jan-26 08:00 A', None, -16, '1,200.50'],
    ['A110', 'x', '45%', 'Footings', 'In Progress', 'Task Dependent', 160, '28/02/2026', '01/02/2026', '02-Feb-26 A', None, 0, 'SAR 3,000'],
    ['A120', 'x', 0, 'Columns', 'Not Started', 'Task Dependent', 120, '31/02/2026', '15/02/2026', None, None, 40, 2000],
    ['A120', 'x', 0, 'Columns (dup)', 'Not Started', 'Task Dependent', 120, D(2026, 3, 30), D(2026, 3, 1), None, None, 40, 2000],
    ['A130', 'x', None, 'Slab', 'Not Started', 'Task Dependent', 'ten', None, None, None, None, 8, None],
    ['A140', 'x', 1, 'Handover', 'Completed', 'Finish Milestone', 0, D(2026, 1, 20), D(2026, 1, 20), D(2026, 1, 18), D(2026, 1, 18), 0, 0],
    [None, 'stray note', None, None, None, None, None, None, None, None, None, None, None],
    [None, None, None, 'Orphan row without ID', 'Not Started', 'Task Dependent', 8, D(2026, 4, 1), D(2026, 3, 25), None, None, 0, 10],
]
for r in rows: ws.append(r)
wb.create_sheet('Notes').append(['nothing here'])
wb.save('test/fixtures/messy_export.xlsx')
