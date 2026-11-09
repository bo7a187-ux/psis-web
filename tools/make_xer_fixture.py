"""Builds test/fixtures/sample.xer (project + baseline copy, two calendars, resources) and
sample_arabic_1256.xer (Arabic names, Windows-1256, no baseline). Shaped like P6 'Export > XER'. SAMPLE DATA."""
import sys
out = sys.argv[1] if len(sys.argv) > 1 else 'test/fixtures'

def table(name, fields, rows):
    lines = [f'%T\t{name}', '%F\t' + '\t'.join(fields)]
    for r in rows:
        lines.append('%R\t' + '\t'.join(str(r.get(f, '')) for f in fields))
    return lines

PROJ_F = ['proj_id', 'fy_start_month_num', 'proj_short_name', 'clndr_id', 'sum_base_proj_id', 'last_recalc_date', 'plan_start_date', 'project_flag']
CAL_F = ['clndr_id', 'default_flag', 'clndr_name', 'proj_id', 'base_clndr_id', 'last_chng_date', 'clndr_type', 'day_hr_cnt', 'week_hr_cnt']
WBS_F = ['wbs_id', 'proj_id', 'obs_id', 'seq_num', 'proj_node_flag', 'sum_data_flag', 'status_code', 'wbs_short_name', 'wbs_name', 'parent_wbs_id']
TASK_F = ['task_id', 'proj_id', 'wbs_id', 'clndr_id', 'phys_complete_pct', 'rev_fdbk_flag', 'est_wt', 'lock_plan_flag', 'auto_compute_act_flag',
          'complete_pct_type', 'task_type', 'duration_type', 'status_code', 'task_code', 'task_name', 'rsrc_id', 'total_float_hr_cnt',
          'free_float_hr_cnt', 'remain_drtn_hr_cnt', 'act_work_qty', 'remain_work_qty', 'target_work_qty', 'target_drtn_hr_cnt',
          'target_equip_qty', 'act_equip_qty', 'remain_equip_qty', 'cstr_date', 'act_start_date', 'act_end_date', 'late_start_date',
          'late_end_date', 'expect_end_date', 'early_start_date', 'early_end_date', 'restart_date', 'reend_date', 'target_start_date',
          'target_end_date', 'rem_late_start_date', 'rem_late_end_date', 'cstr_type', 'priority_type', 'suspend_date', 'resume_date',
          'float_path', 'float_path_order', 'guid', 'tmpl_guid', 'cstr_date2', 'cstr_type2', 'driving_path_flag', 'act_this_per_work_qty',
          'act_this_per_equip_qty', 'external_early_start_date', 'external_late_end_date', 'create_date', 'update_date', 'create_user',
          'update_user', 'location_id']
RSRC_F = ['taskrsrc_id', 'task_id', 'proj_id', 'rsrc_id', 'target_qty', 'act_reg_qty', 'target_cost', 'act_reg_cost', 'act_ot_cost', 'remain_cost']

def task(tid, pid, wbs, cal, code, name, ttype, status, od_h, rd_h, tf_h, ts, te, es='', ee='', as_='', ae='', phys=0, cpt='CP_Phys', crit='N', aw='', rw='', tw=''):
    return dict(task_id=tid, proj_id=pid, wbs_id=wbs, clndr_id=cal, phys_complete_pct=phys, complete_pct_type=cpt, task_type=ttype,
                duration_type='DT_FixedDrtn', status_code=status, task_code=code, task_name=name, total_float_hr_cnt=tf_h,
                free_float_hr_cnt=tf_h, remain_drtn_hr_cnt=rd_h, target_drtn_hr_cnt=od_h, target_start_date=ts, target_end_date=te,
                early_start_date=es or ts, early_end_date=ee or te, act_start_date=as_, act_end_date=ae, restart_date=es or ts,
                reend_date=ee or te, driving_path_flag=crit, act_work_qty=aw, remain_work_qty=rw, target_work_qty=tw,
                rev_fdbk_flag='N', est_wt=1, lock_plan_flag='N', auto_compute_act_flag='N', priority_type='PT_Normal')

def build(tasks, extra, header='ERMHDR\t19.12\t2026-11-08\tProject\tadmin\tAdmin\tdbxDatabaseNoName\tProject Management\tSAR'):
    return '\n'.join([header] + extra + table('TASK', TASK_F, tasks) + ['%E', ''])

proj = [dict(proj_id=4521, proj_short_name='TWR-P2', clndr_id=101, sum_base_proj_id=4600, last_recalc_date='2026-02-15 00:00', project_flag='Y'),
        dict(proj_id=4600, proj_short_name='TWR-P2-BL1', clndr_id=101, sum_base_proj_id='', last_recalc_date='2026-01-01 00:00', project_flag='Y')]
cal = [dict(clndr_id=101, default_flag='Y', clndr_name='5d x 8h', clndr_type='CA_Base', day_hr_cnt=8, week_hr_cnt=40),
       dict(clndr_id=102, default_flag='N', clndr_name='6d x 10h', clndr_type='CA_Base', day_hr_cnt=10, week_hr_cnt=60)]
wbs = [dict(wbs_id=1, proj_id=4521, proj_node_flag='Y', wbs_short_name='TWR-P2', wbs_name='Riyadh Tower - Package 2', parent_wbs_id=''),
       dict(wbs_id=2, proj_id=4521, proj_node_flag='N', wbs_short_name='CIV', wbs_name='Civil Works', parent_wbs_id=1),
       dict(wbs_id=3, proj_id=4521, proj_node_flag='N', wbs_short_name='FDN', wbs_name='Foundations', parent_wbs_id=2),
       dict(wbs_id=9, proj_id=4600, proj_node_flag='Y', wbs_short_name='TWR-P2-BL1', wbs_name='Riyadh Tower - Package 2 (BL1)', parent_wbs_id='')]
cur = [
    task(1, 4521, 1, 101, 'A1000', 'Mobilisation', 'TT_Mile', 'TK_Complete', 0, 0, 0, '2026-01-04 08:00', '2026-01-04 08:00', as_='2026-01-04 08:00', ae='2026-01-04 08:00', phys=100),
    task(2, 4521, 3, 102, 'A1010', 'Excavation', 'TT_Task', 'TK_Active', 200, 60, -30, '2026-01-05 07:00', '2026-01-26 17:00',
         es='2026-02-15 07:00', ee='2026-02-21 17:00', as_='2026-01-05 07:00', phys=60, crit='Y', aw=1400, rw=600, tw=2000),
    task(3, 4521, 3, 101, 'A1020', 'Footings', 'TT_Task', 'TK_NotStart', 120, 120, 100, '2026-01-27 08:00', '2026-02-13 17:00',
         es='2026-02-22 08:00', ee='2026-03-11 17:00', cpt='CP_Drtn'),
    task(4, 4521, 1, 101, 'A1030', 'Handover', 'TT_FinMile', 'TK_NotStart', 0, 0, 0, '2026-03-01 17:00', '2026-03-01 17:00', es='2026-03-20 17:00', ee='2026-03-20 17:00', crit='Y'),
    task(5, 4521, 1, 101, 'A1040', 'Site Management', 'TT_LOE', 'TK_Active', 480, 160, 0, '2026-01-04 08:00', '2026-03-01 17:00',
         es='2026-02-15 08:00', ee='2026-03-20 17:00', as_='2026-01-04 08:00', phys=66),
    task(6, 4521, 2, 101, 'WBS-CIV', 'Civil Works', 'TT_WBS', 'TK_Active', 0, 0, 0, '2026-01-04 08:00', '2026-03-11 17:00'),
]
bl = [
    task(101, 4600, 9, 101, 'A1000', 'Mobilisation', 'TT_Mile', 'TK_NotStart', 0, 0, 0, '2026-01-04 08:00', '2026-01-04 08:00'),
    task(102, 4600, 9, 102, 'A1010', 'Excavation', 'TT_Task', 'TK_NotStart', 200, 200, 0, '2026-01-05 07:00', '2026-01-24 17:00'),
    task(103, 4600, 9, 101, 'A1020', 'Footings', 'TT_Task', 'TK_NotStart', 120, 120, 0, '2026-01-25 08:00', '2026-02-11 17:00'),
    task(104, 4600, 9, 101, 'A1030', 'Handover', 'TT_FinMile', 'TK_NotStart', 0, 0, 0, '2026-02-28 17:00', '2026-02-28 17:00'),
]
rsrc = [dict(taskrsrc_id=1, task_id=2, proj_id=4521, rsrc_id=7, target_cost=125000, act_reg_cost=70000, act_ot_cost=5000),
        dict(taskrsrc_id=2, task_id=2, proj_id=4521, rsrc_id=8, target_cost=25000, act_reg_cost=10000, act_ot_cost=0),
        dict(taskrsrc_id=3, task_id=3, proj_id=4521, rsrc_id=7, target_cost=98000, act_reg_cost=0, act_ot_cost=0)]
extra = table('PROJECT', PROJ_F, proj) + table('CALENDAR', CAL_F, cal) + table('PROJWBS', WBS_F, wbs)
xer = build(cur + bl, extra + table('TASKRSRC', RSRC_F, rsrc))
open(f'{out}/sample.xer', 'w', encoding='utf-8', newline='\r\n').write(xer)

# Arabic names, Windows-1256, no baseline project
proj2 = [dict(proj_id=77, proj_short_name='HSP-01', clndr_id=101, last_recalc_date='2026-03-01 00:00', project_flag='Y')]
wbs2 = [dict(wbs_id=1, proj_id=77, proj_node_flag='Y', wbs_short_name='HSP-01', wbs_name='مستشفى تجريبي', parent_wbs_id=''),
        dict(wbs_id=2, proj_id=77, proj_node_flag='N', wbs_short_name='STR', wbs_name='الأعمال الإنشائية', parent_wbs_id=1)]
t2 = [task(1, 77, 2, 101, 'H100', 'حفر الأساسات', 'TT_Task', 'TK_Complete', 80, 0, 0, '2026-01-01 08:00', '2026-01-12 17:00', as_='2026-01-01 08:00', ae='2026-01-14 17:00', phys=100),
      task(2, 77, 2, 101, 'H110', 'صب خرسانة القواعد', 'TT_Task', 'TK_Active', 160, 64, -16, '2026-01-13 08:00', '2026-02-03 17:00', es='2026-03-01 08:00', ee='2026-03-10 17:00', as_='2026-01-15 08:00', phys=55),
      task(3, 77, 2, 101, 'H120', 'أعمدة الطابق الأرضي', 'TT_Task', 'TK_NotStart', 120, 120, 24, '2026-02-04 08:00', '2026-02-20 17:00', es='2026-03-11 08:00', ee='2026-03-27 17:00')]
xer2 = build(t2, table('PROJECT', PROJ_F, proj2) + table('CALENDAR', CAL_F, cal[:1]) + table('PROJWBS', WBS_F, wbs2))
open(f'{out}/sample_arabic_1256.xer', 'w', encoding='cp1256', newline='\r\n').write(xer2)
print('ok')
