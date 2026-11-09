"""Builds test/fixtures/p6_real_export.xlsx and p6_no_baseline.xlsx: activity exports shaped like
Primavera P6 'File > Export > Spreadsheet (XLSX)' output (USERDATA sheet, TASK sheet with a row of
field codes and a row of labels, "(*)" read-only markers, units in the labels). SAMPLE DATA."""
import datetime as dt, sys
from openpyxl import Workbook

D = dt.datetime
out = sys.argv[1] if len(sys.argv) > 1 else 'test/fixtures'

def build(path, codes, labels, rows, extra_sheets=True):
    wb = Workbook()
    ws = wb.active
    ws.title = 'USERDATA'
    ws.append(['user_data'])
    ws.append(['UserSettings Do Not Edit'])
    ws.append(['DurationQtyType=QT_Day\nShowAsPercentage=0\nSmallScaleQtyType=QT_Hour'])
    t = wb.create_sheet('TASK', 0)
    t.append(codes)
    t.append(labels)
    for r in rows:
        t.append(r)
    for row in t.iter_rows(min_row=3):
        for c in row:
            if isinstance(c.value, dt.datetime):
                c.number_format = 'dd-mmm-yy'
    if extra_sheets:
        p = wb.create_sheet('TASKPRED')
        p.append(['task_pred_id', 'task_id', 'pred_task_id', 'pred_type'])
        p.append(['', 'Successor', 'Predecessor', 'Relationship Type'])
        p.append([1, 'A1010', 'A1000', 'PR_FS'])
    wb.save(path)

codes = ['task_code', 'status_code', 'task_name', 'wbs_id', 'task_type', 'target_drtn_hr_cnt', 'remain_drtn_hr_cnt',
         'total_float_hr_cnt', 'driving_path_flag', 'bl_project_start', 'bl_project_finish', 'start_date', 'end_date',
         'act_start_date', 'act_end_date', 'phys_complete_pct', 'complete_pct', 'target_cost', 'delete_record_flag']
labels = ['Activity ID', 'Activity Status', 'Activity Name', 'WBS Code', 'Activity Type', 'Original Duration(d)',
          'Remaining Duration(d)', '(*)Total Float(d)', '(*)Critical', '(*)BL Project Start', '(*)BL Project Finish',
          '(*)Start', '(*)Finish', 'Actual Start', 'Actual Finish', 'Physical % Complete(%)', '(*)Activity % Complete(%)',
          'Budgeted Total Cost(SAR)', 'Delete This Row']
rows = [
    ['A1000', 'Completed', 'Mobilisation', 'PRJ.GEN', 'Start Milestone', 0, 0, 0, 'No', D(2026, 1, 4), D(2026, 1, 4),
     D(2026, 1, 4), D(2026, 1, 4), D(2026, 1, 4), D(2026, 1, 4), 100, 100, 0, None],
    ['A1010', 'In Progress', 'Excavation', 'PRJ.CIV', 'Task Dependent', 20, 6, -3, 'Yes', D(2026, 1, 5), D(2026, 1, 30),
     '05-Jan-26 08:00 A', '12-Feb-26 17:00', '05-Jan-26 08:00', None, 60, 70, '125,000.00', None],
    ['A1020', 'Not Started', 'Footings', 'PRJ.CIV', 'Task Dependent', 15, 15, 12.5, 'No', D(2026, 2, 1), D(2026, 2, 20),
     '15-Feb-26', '04-Mar-26', None, None, 0, 0, 98000, None],
    ['A1030', 'Not Started', 'Handover', 'PRJ.GEN', 'Finish Milestone', 0, 0, 0, 'Yes', D(2026, 3, 1), D(2026, 3, 1),
     D(2026, 3, 20), D(2026, 3, 20), None, None, 0, 0, 0, None],
    ['A1040', 'In Progress', 'Site Management', 'PRJ.GEN', 'Level of Effort', 60, 20, 0, 'No', D(2026, 1, 4), D(2026, 3, 1),
     D(2026, 1, 4), D(2026, 3, 20), D(2026, 1, 4), None, 66, 66, 300000, None],
]
build(f'{out}/p6_real_export.xlsx', codes, labels, rows)

# Same activities, hour-based user settings, P6 internal codes, and no baseline columns
codes2 = ['task_code', 'status_code', 'task_name', 'task_type', 'target_drtn_hr_cnt', 'total_float_hr_cnt',
          'target_start_date', 'target_end_date', 'start_date', 'end_date', 'act_start_date', 'act_end_date', 'phys_complete_pct']
labels2 = ['Activity ID', 'Activity Status', 'Activity Name', 'Activity Type', 'Planned Duration(h)', '(*)Total Float(h)',
           'Planned Start', 'Planned Finish', '(*)Start', '(*)Finish', 'Actual Start', 'Actual Finish', 'Physical % Complete(%)']
rows2 = [
    ['B1', 'TK_Complete', 'Design', 'TT_Task', 80, 0, D(2026, 1, 1), D(2026, 1, 14), D(2026, 1, 1), D(2026, 1, 14), D(2026, 1, 1), D(2026, 1, 14), 100],
    ['B2', 'TK_Active', 'Approval', 'TT_Task', 40, -16, D(2026, 1, 15), D(2026, 1, 21), D(2026, 1, 18), D(2026, 1, 30), D(2026, 1, 18), None, 40],
    ['B3', 'TK_NotStart', 'Award', 'TT_FinMile', 0, 8, D(2026, 2, 1), D(2026, 2, 1), D(2026, 2, 9), D(2026, 2, 9), None, None, 0],
]
build(f'{out}/p6_no_baseline.xlsx', codes2, labels2, rows2, extra_sheets=False)
print('ok')
