# Comparison Report - Web app vs Excel (Stage 2)

Reference: Project_Schedule_Intelligence_System.xlsx, recalculated with LibreOffice (the file had no saved results). Sample data, data date 08-Nov-26, default settings, no filter. Tolerance 0.000001 for percentages; dates and counts exact.

## 1. Activity level
Columns compared: Status, Included, WBS Summary, LOE, Milestone, Phase, Discipline, Building, Floor, Location, Baseline Used, BL Start (used), BL Finish (used), Orig Dur (days), Weight, Planned %, Actual %, Variance (pp), EV (cost), PV (cost), Forecast: P6 Current Finish, Forecast: Performance, Forecast: Conservative, Forecast Finish (selected), Forecast Source, Finish Var vs BL used (days), Finish Var vs Original (days), Finish Var vs Revised (days), Start Var (days), Days Behind (equiv.), Behind, Open Past BL Finish, Finished Late, Not Started Past BL Start, Critical, Negative Float, Low Float, Total Float (days), Delayed, Delay Indicator, Performance, In Prev Snapshot, Prev Actual %, Period Progress, BL Finish Changed, Missing Baseline, Missing Progress, Unclassified, Missing Weight, Baseline Fallback, Duplicate ID.

| Source | Activities | Columns | Values compared | Differences |
|---|---|---|---|---|
| Workbook sample (RAW PRIMAVERA DATA) | 84 | 51 | 4284 | 0 |
| SAMPLE_P6_Export.xlsx | 84 | 51 | 4284 | 0 |

## 2. Project level (KPIs, groups, lists, S-curve, trend)

| Item | Excel | Web app | Match |
|---|---|---|---|
| Planned % | 86.5480% | 86.5480% | Yes |
| Actual % | 83.5297% | 83.5297% | Yes |
| Variance | -3.0183% | -3.0183% | Yes |
| EV | 27089659 | 27089659 | Yes |
| PV | 28034341.384615 | 28034341.384615 | Yes |
| SPI | 0.966303 | 0.966303 | Yes |
| Cost coverage | 100.0000% | 100.0000% | Yes |
| Included activities | 82 | 82 | Yes |
| Completed | 60 | 60 | Yes |
| In progress | 13 | 13 | Yes |
| Not started | 9 | 9 | Yes |
| Delayed | 19 | 19 | Yes |
| Critical (open) | 5 | 5 | Yes |
| Negative float | 4 | 4 | Yes |
| Project BL start | 01-Mar-26 | 01-Mar-26 | Yes |
| Project BL finish | 30-Apr-27 | 30-Apr-27 | Yes |
| Forecast finish (selected) | 05-May-27 | 05-May-27 | Yes |
| Forecast - P6 | 05-May-27 | 05-May-27 | Yes |
| Forecast - performance | 30-Apr-27 | 30-Apr-27 | Yes |
| Forecast - conservative | 05-May-27 | 05-May-27 | Yes |
| Delay vs BL used (days) | 5 | 5 | Yes |
| Delay vs original (days) | 5 | 5 | Yes |
| Delay vs revised (days) | 5 | 5 | Yes |
| Project float (days) | -10 | -10 | Yes |
| Time elapsed | 59.1549% | 59.1549% | Yes |
| Critical path planned | 30.6122% | 30.6122% | Yes |
| Critical path actual | 23.0952% | 23.0952% | Yes |
| Health | AMBER | AMBER | Yes |
| Health reasons | Forecast 5 days late (amber limit 0) | Forecast 5 days late (amber limit 0) | Yes |
| Planned % (P6 file) | 86.5480% | 86.5480% | Yes |
| Actual % (P6 file) | 83.5297% | 83.5297% | Yes |
| Variance (P6 file) | -3.0183% | -3.0183% | Yes |
| EV (P6 file) | 27089659 | 27089659 | Yes |
| PV (P6 file) | 28034341.384615 | 28034341.384615 | Yes |
| SPI (P6 file) | 0.966303 | 0.966303 | Yes |
| Cost coverage (P6 file) | 100.0000% | 100.0000% | Yes |
| Included activities (P6 file) | 82 | 82 | Yes |
| Completed (P6 file) | 60 | 60 | Yes |
| In progress (P6 file) | 13 | 13 | Yes |
| Not started (P6 file) | 9 | 9 | Yes |
| Delayed (P6 file) | 19 | 19 | Yes |
| Critical (open) (P6 file) | 5 | 5 | Yes |
| Negative float (P6 file) | 4 | 4 | Yes |
| Project BL start (P6 file) | 01-Mar-26 | 01-Mar-26 | Yes |
| Project BL finish (P6 file) | 30-Apr-27 | 30-Apr-27 | Yes |
| Forecast finish (selected) (P6 file) | 05-May-27 | 05-May-27 | Yes |
| Forecast - P6 (P6 file) | 05-May-27 | 05-May-27 | Yes |
| Forecast - performance (P6 file) | 30-Apr-27 | 30-Apr-27 | Yes |
| Forecast - conservative (P6 file) | 05-May-27 | 05-May-27 | Yes |
| Delay vs BL used (days) (P6 file) | 5 | 5 | Yes |
| Delay vs original (days) (P6 file) | 5 | 5 | Yes |
| Delay vs revised (days) (P6 file) | 5 | 5 | Yes |
| Project float (days) (P6 file) | -10 | -10 | Yes |
| Time elapsed (P6 file) | 59.1549% | 59.1549% | Yes |
| Critical path planned (P6 file) | 30.6122% | 30.6122% | Yes |
| Critical path actual (P6 file) | 23.0952% | 23.0952% | Yes |
| Health (P6 file) | AMBER | AMBER | Yes |
| Health reasons (P6 file) | Forecast 5 days late (amber limit 0) | Forecast 5 days late (amber limit 0) | Yes |
| Behind planned progress | 13 | 13 | Yes |
| Open past baseline finish | 10 | 10 | Yes |
| Not started past baseline start | 1 | 1 | Yes |
| Finished late | 0 | 0 | Yes |
| Low float (open) | 9 | 9 | Yes |
| Baseline finish changed vs previous | 0 | 0 | Yes |
| Discipline Architectural - weight % | 25.2720% | 25.2720% | Yes |
| Discipline Architectural - planned | 86.4971% | 86.4971% | Yes |
| Discipline Architectural - actual | 84.4618% | 84.4618% | Yes |
| Discipline Architectural - variance | -2.0352% | -2.0352% | Yes |
| Discipline Architectural - period + | 1.4524% | 1.4524% | Yes |
| Discipline Architectural - delayed | 4 | 4 | Yes |
| Discipline Architectural - critical | 1 | 1 | Yes |
| Discipline Structural - weight % | 18.1009% | 18.1009% | Yes |
| Discipline Structural - planned | 100.0000% | 100.0000% | Yes |
| Discipline Structural - actual | 100.0000% | 100.0000% | Yes |
| Discipline Structural - variance | 0.0000% | 0.0000% | Yes |
| Discipline Structural - period + | 0.0000% | 0.0000% | Yes |
| Discipline Structural - delayed | 0 | 0 | Yes |
| Discipline Structural - critical | 0 | 0 | Yes |
| Discipline Mechanical - weight % | 15.0841% | 15.0841% | Yes |
| Discipline Mechanical - planned | 86.2295% | 86.2295% | Yes |
| Discipline Mechanical - actual | 78.4098% | 78.4098% | Yes |
| Discipline Mechanical - variance | -7.8197% | -7.8197% | Yes |
| Discipline Mechanical - period + | 2.1759% | 2.1759% | Yes |
| Discipline Mechanical - delayed | 5 | 5 | Yes |
| Discipline Mechanical - critical | 2 | 2 | Yes |
| Discipline Electrical - weight % | 19.1889% | 19.1889% | Yes |
| Discipline Electrical - planned | 73.9691% | 73.9691% | Yes |
| Discipline Electrical - actual | 70.0309% | 70.0309% | Yes |
| Discipline Electrical - variance | -3.9381% | -3.9381% | Yes |
| Discipline Electrical - period + | 2.4921% | 2.4921% | Yes |
| Discipline Electrical - delayed | 5 | 5 | Yes |
| Discipline Electrical - critical | 1 | 1 | Yes |
| Discipline Plumbing - weight % | 11.4738% | 11.4738% | Yes |
| Discipline Plumbing - planned | 87.0690% | 87.0690% | Yes |
| Discipline Plumbing - actual | 84.4828% | 84.4828% | Yes |
| Discipline Plumbing - variance | -2.5862% | -2.5862% | Yes |
| Discipline Plumbing - period + | 0.0000% | 0.0000% | Yes |
| Discipline Plumbing - delayed | 2 | 2 | Yes |
| Discipline Plumbing - critical | 1 | 1 | Yes |
| Discipline Fire Fighting - weight % | 10.8803% | 10.8803% | Yes |
| Discipline Fire Fighting - planned | 86.3636% | 86.3636% | Yes |
| Discipline Fire Fighting - actual | 83.8636% | 83.8636% | Yes |
| Discipline Fire Fighting - variance | -2.5000% | -2.5000% | Yes |
| Discipline Fire Fighting - period + | 0.0000% | 0.0000% | Yes |
| Discipline Fire Fighting - delayed | 2 | 2 | Yes |
| Discipline Fire Fighting - critical | 0 | 0 | Yes |
| Phase Engineering - weight % | 17.2107% | 17.2107% | Yes |
| Phase Engineering - planned | 100.0000% | 100.0000% | Yes |
| Phase Engineering - actual | 100.0000% | 100.0000% | Yes |
| Phase Engineering - variance | 0.0000% | 0.0000% | Yes |
| Phase Engineering - period + | 0.0000% | 0.0000% | Yes |
| Phase Engineering - delayed | 0 | 0 | Yes |
| Phase Engineering - critical | 0 | 0 | Yes |
| Phase Construction - weight % | 76.8546% | 76.8546% | Yes |
| Phase Construction - planned | 90.2188% | 90.2188% | Yes |
| Phase Construction - actual | 86.2915% | 86.2915% | Yes |
| Phase Construction - variance | -3.9273% | -3.9273% | Yes |
| Phase Construction - period + | 1.5269% | 1.5269% | Yes |
| Phase Construction - delayed | 16 | 16 | Yes |
| Phase Construction - critical | 3 | 3 | Yes |
| Phase Testing & Commissioning - weight % | 5.9347% | 5.9347% | Yes |
| Phase Testing & Commissioning - planned | 0.0000% | 0.0000% | Yes |
| Phase Testing & Commissioning - actual | 0.0000% | 0.0000% | Yes |
| Phase Testing & Commissioning - variance | 0.0000% | 0.0000% | Yes |
| Phase Testing & Commissioning - period + | 0.0000% | 0.0000% | Yes |
| Phase Testing & Commissioning - delayed | 2 | 2 | Yes |
| Phase Testing & Commissioning - critical | 2 | 2 | Yes |
| Building Main Building - weight % | 52.7201% | 52.7201% | Yes |
| Building Main Building - planned | 90.6191% | 90.6191% | Yes |
| Building Main Building - actual | 86.6388% | 86.6388% | Yes |
| Building Main Building - variance | -3.9803% | -3.9803% | Yes |
| Building Main Building - period + | 1.6397% | 1.6397% | Yes |
| Building Main Building - delayed | 11 | 11 | Yes |
| Building Main Building - critical | 3 | 3 | Yes |
| Building Utility Building - weight % | 24.1345% | 24.1345% | Yes |
| Building Utility Building - planned | 89.3443% | 89.3443% | Yes |
| Building Utility Building - actual | 85.5328% | 85.5328% | Yes |
| Building Utility Building - variance | -3.8115% | -3.8115% | Yes |
| Building Utility Building - period + | 1.2804% | 1.2804% | Yes |
| Building Utility Building - delayed | 5 | 5 | Yes |
| Building Utility Building - critical | 0 | 0 | Yes |
| Building General - weight % | 23.1454% | 23.1454% | Yes |
| Building General - planned | 74.3590% | 74.3590% | Yes |
| Building General - actual | 74.3590% | 74.3590% | Yes |
| Building General - variance | 0.0000% | 0.0000% | Yes |
| Building General - period + | 0.0000% | 0.0000% | Yes |
| Building General - delayed | 3 | 3 | Yes |
| Building General - critical | 2 | 2 | Yes |
| Floor Basement - weight % | 12.0673% | 12.0673% | Yes |
| Floor Basement - planned | 100.0000% | 100.0000% | Yes |
| Floor Basement - actual | 100.0000% | 100.0000% | Yes |
| Floor Basement - variance | 0.0000% | 0.0000% | Yes |
| Floor Basement - period + | 0.0000% | 0.0000% | Yes |
| Floor Basement - delayed | 0 | 0 | Yes |
| Floor Basement - critical | 0 | 0 | Yes |
| Floor Ground Floor - weight % | 24.1345% | 24.1345% | Yes |
| Floor Ground Floor - planned | 100.0000% | 100.0000% | Yes |
| Floor Ground Floor - actual | 98.1352% | 98.1352% | Yes |
| Floor Ground Floor - variance | -1.8648% | -1.8648% | Yes |
| Floor Ground Floor - period + | 1.2804% | 1.2804% | Yes |
| Floor Ground Floor - delayed | 2 | 2 | Yes |
| Floor Ground Floor - critical | 0 | 0 | Yes |
| Floor Level 1 - weight % | 24.1345% | 24.1345% | Yes |
| Floor Level 1 - planned | 82.7869% | 82.7869% | Yes |
| Floor Level 1 - actual | 78.5082% | 78.5082% | Yes |
| Floor Level 1 - variance | -4.2787% | -4.2787% | Yes |
| Floor Level 1 - period + | 2.2219% | 2.2219% | Yes |
| Floor Level 1 - delayed | 7 | 7 | Yes |
| Floor Level 1 - critical | 1 | 1 | Yes |
| Floor Level 2 - weight % | 12.0673% | 12.0673% | Yes |
| Floor Level 2 - planned | 77.0492% | 77.0492% | Yes |
| Floor Level 2 - actual | 66.8852% | 66.8852% | Yes |
| Floor Level 2 - variance | -10.1639% | -10.1639% | Yes |
| Floor Level 2 - period + | 1.2302% | 1.2302% | Yes |
| Floor Level 2 - delayed | 6 | 6 | Yes |
| Floor Level 2 - critical | 1 | 1 | Yes |
| Floor Roof - weight % | 4.4510% | 4.4510% | Yes |
| Floor Roof - planned | 86.6667% | 86.6667% | Yes |
| Floor Roof - actual | 79.7222% | 79.7222% | Yes |
| Floor Roof - variance | -6.9444% | -6.9444% | Yes |
| Floor Roof - period + | 4.0389% | 4.0389% | Yes |
| Floor Roof - delayed | 1 | 1 | Yes |
| Floor Roof - critical | 1 | 1 | Yes |
| Floor General - weight % | 23.1454% | 23.1454% | Yes |
| Floor General - planned | 74.3590% | 74.3590% | Yes |
| Floor General - actual | 74.3590% | 74.3590% | Yes |
| Floor General - variance | 0.0000% | 0.0000% | Yes |
| Floor General - period + | 0.0000% | 0.0000% | Yes |
| Floor General - delayed | 3 | 3 | Yes |
| Floor General - critical | 2 | 2 | Yes |
| Delay analysis list (late finish) - IDs in order | SMP-1400,SMP-1760,SMP-1510,SMP-1480,SMP-1740,SMP-1530,SMP-1580,SMP-1340,SMP-1440,SMP-1500,SMP-1730,SMP-1520,SMP-1800,SMP-1780,SMP-1490,SMP-1680,SMP-1830,SMP-1790,SMP-1390 | SMP-1400,SMP-1760,SMP-1510,SMP-1480,SMP-1740,SMP-1530,SMP-1580,SMP-1340,SMP-1440,SMP-1500,SMP-1730,SMP-1520,SMP-1800,SMP-1780,SMP-1490,SMP-1680,SMP-1830,SMP-1790,SMP-1390 | Yes |
| Delay analysis list - count | 19 | 19 | Yes |
| Top 10 delayed - IDs in order | SMP-1400,SMP-1510,SMP-1760,SMP-1480,SMP-1740,SMP-1530,SMP-1580,SMP-1340,SMP-1440,SMP-1500 | SMP-1400,SMP-1510,SMP-1760,SMP-1480,SMP-1740,SMP-1530,SMP-1580,SMP-1340,SMP-1440,SMP-1500 | Yes |
| S-curve baseline 28-Feb-26 | 0.0000% | 0.0000% | Yes |
| S-curve baseline 31-Mar-26 | 4.8961% | 4.8961% | Yes |
| S-curve baseline 30-Apr-26 | 16.5183% | 16.5183% | Yes |
| S-curve baseline 31-May-26 | 22.0574% | 22.0574% | Yes |
| S-curve baseline 30-Jun-26 | 28.7339% | 28.7339% | Yes |
| S-curve actual 30-Jun-26 | 28.7339% | 28.7339% | Yes |
| S-curve actual 31-Jul-26 | 40.1088% | 40.1088% | Yes |
| S-curve actual 31-Aug-26 | 55.8853% | 55.8853% | Yes |
| S-curve actual 30-Sep-26 | 71.5950% | 71.5950% | Yes |
| S-curve actual 31-Oct-26 | 82.3562% | 82.3562% | Yes |
| Trend rate per day | 0.004006 | 0.004006 | Yes |
| Trend completion (indicative) | 20-Dec-26 | 20-Dec-26 | Yes |

## 3. Issue found in the Excel workbook

EXECUTIVE DASHBOARD, cell T40 holds the label "rate/day" inside the column of S-curve month dates (T35:T70). Every month after it becomes #N/A, so the baseline S-curve in Excel stops at 30-Jun-26 instead of 30-Apr-27. The first 5 points match the web app exactly; the web app continues the curve to the baseline finish (100% at 30-Apr-27).

## 4. All automated tests (95 passed, 0 failed)

- test/engine-vs-excel.test.ts > Activity engine matches the Excel ACTIVITIES ENGINE (sample, defaults) > workbook sample: every column, every activity
- test/engine-vs-excel.test.ts > Activity engine matches the Excel ACTIVITIES ENGINE (sample, defaults) > SAMPLE_P6_Export.xlsx: every column, every activity
- test/engine-vs-excel.test.ts > Activity engine matches the Excel ACTIVITIES ENGINE (sample, defaults) > dims
- test/project-vs-excel.test.ts > Project level vs Excel (sample, defaults, no filter) > KPIs - workbook sample
- test/project-vs-excel.test.ts > Project level vs Excel (sample, defaults, no filter) > KPIs - SAMPLE_P6_Export.xlsx
- test/project-vs-excel.test.ts > Project level vs Excel (sample, defaults, no filter) > schedule control: exception counts
- test/project-vs-excel.test.ts > Project level vs Excel (sample, defaults, no filter) > schedule control: group tables (weight %, planned, actual, variance, period +, delayed, critical)
- test/project-vs-excel.test.ts > Project level vs Excel (sample, defaults, no filter) > delay analysis: "Late finish forecast" list - same activities in the same order
- test/project-vs-excel.test.ts > Project level vs Excel (sample, defaults, no filter) > executive dashboard: top 10 delayed - same activities in the same order
- test/project-vs-excel.test.ts > Project level vs Excel (sample, defaults, no filter) > S-curve: baseline monthly planned matches the points Excel calculates
- test/project-vs-excel.test.ts > Project level vs Excel (sample, defaults, no filter) > S-curve: actual history per snapshot and trend completion
- test/project-vs-excel.test.ts > Project level vs Excel (sample, defaults, no filter) > filters: Mechanical / Main Building + Level 1 run without distorting totals
- test/cases.test.ts > H1 Duration weighting > weighted planned = (10*1 + 20*0.5 + 10*0) / 40 = 50%
- test/cases.test.ts > H1 Duration weighting > weighted actual = (10*1 + 20*0.25 + 0) / 40 = 37.5%
- test/cases.test.ts > H1 Duration weighting > variance = -12.5 pp
- test/cases.test.ts > H1 Duration weighting > WBS Summary and LOE excluded; milestone counted with weight 0
- test/cases.test.ts > H1 Duration weighting > counts: 2 completed, 1 in progress, 1 not started, 1 delayed (B behind 25 pp)
- test/cases.test.ts > H1 Duration weighting > B performance forecast = DD + ROUNDUP(0.75*10/0.25) - 1 = 11-Jan + 29 = 09-Feb-26; conservative = later of P6 25-Jan and 09-Feb
- test/cases.test.ts > H1 Duration weighting > C not started: forecast = max(BL finish, DD + BL span) = 25-Jan (no delay)
- test/cases.test.ts > H1 Duration weighting > project: forecast 09-Feb-26 vs BL finish 25-Jan-26 = 15 days late; health RED with 3 written reasons
- test/cases.test.ts > H1 Duration weighting > critical and negative float (open only)
- test/cases.test.ts > H2 Cost weighting > planned = (1000*1 + 3000*0.5) / 5000 = 50%
- test/cases.test.ts > H2 Cost weighting > actual = (1000 + 3000*0.25) / 5000 = 35%
- test/cases.test.ts > H2 Cost weighting > EV = 1750, PV = 2500, SPI = 0.70 (cost coverage 100%)
- test/cases.test.ts > H2 Cost weighting > SPI does not depend on the weighting method
- test/cases.test.ts > H2 Cost weighting > SPI is N/A with the reason when cost coverage is below the threshold
- test/cases.test.ts > H2 Cost weighting > SPI is N/A when there is no cost at all
- test/cases.test.ts > H3 Man-hours weighting > planned = (100*1 + 100*0.5 + 200*0) / 400 = 37.5%
- test/cases.test.ts > H3 Man-hours weighting > actual = (100 + 25) / 400 = 31.25%
- test/cases.test.ts > H4 Missing baseline - reported and excluded, never zero > planned unchanged at 50% (D has no planned % and is left out of the planned figure)
- test/cases.test.ts > H4 Missing baseline - reported and excluded, never zero > actual includes D: (15 + 10*0.5) / 50 = 40%
- test/cases.test.ts > H4 Missing baseline - reported and excluded, never zero > D planned % is empty, not 0
- test/cases.test.ts > H4 Missing baseline - reported and excluded, never zero > validation reports it
- test/cases.test.ts > H4 Missing baseline - reported and excluded, never zero > missing progress is reported, not counted as 0%
- test/cases.test.ts > H5 Duplicate IDs > detected and block approval
- test/cases.test.ts > H6 Nothing started > 0% planned, 0% actual, no delays, GREEN
- test/cases.test.ts > H7 All completed > 100% actual (Actual Finish counts as 100%), all completed
- test/cases.test.ts > H7 All completed > finished late is counted, forecast = latest actual finish
- test/cases.test.ts > H8 On schedule > no delays, variance 0, SPI 1, GREEN with no reasons
- test/cases.test.ts > S1 Sample - history never changes > saved snapshots are untouched by recalculation
- test/cases.test.ts > S2/S3 Filters do not distort calculations > Mechanical filter = weighted figure of exactly the Mechanical activities
- test/cases.test.ts > S2/S3 Filters do not distort calculations > Main Building + Level 1 combined
- test/cases.test.ts > S2/S3 Filters do not distort calculations > group weights add up to 100% and the weighted mean of groups equals the total
- test/cases.test.ts > S4 Forecast methods > P6 Current Finish: project 25-Jan (B uses P6 date), 0 days late
- test/cases.test.ts > S4 Forecast methods > Performance-based: 09-Feb, 15 days late
- test/cases.test.ts > S4 Forecast methods > Conservative: later of the two
- test/cases.test.ts > S4 Forecast methods > sources are named
- test/cases.test.ts > S5 Duration % actual and P6 Schedule % planned > actual uses Duration % only: (10*0.6 + 30*0.3)/40 = 37.5%
- test/cases.test.ts > S5 Duration % actual and P6 Schedule % planned > planned uses P6 Schedule %: (10*0.7 + 30*0.5)/40 = 55%
- test/cases.test.ts > S6 Approval fingerprint > same data and settings -> same fingerprint (approved)
- test/cases.test.ts > S6 Approval fingerprint > one WBS character changed -> changed since approval
- test/cases.test.ts > S6 Approval fingerprint > +1% progress -> changed
- test/cases.test.ts > S6 Approval fingerprint > one setting changed -> changed
- test/cases.test.ts > S6 Approval fingerprint > classification change -> changed
- test/cases.test.ts > S6 Approval fingerprint > project title is display-only and does not void approval
- test/cases.test.ts > S6 Approval fingerprint > not approved yet -> pending
- test/cases.test.ts > S7 Monthly update: new, removed and re-baselined activities > new: C and M (included, not in previous)
- test/cases.test.ts > S7 Monthly update: new, removed and re-baselined activities > removed: Z
- test/cases.test.ts > S7 Monthly update: new, removed and re-baselined activities > re-baselined: B (BL finish 18-Jan -> 20-Jan)
- test/cases.test.ts > S7 Monthly update: new, removed and re-baselined activities > period progress of B = 25% - 10% = 15 pp
- test/cases.test.ts > S8 Revised baseline > B planned on Rev: (11-1)/40 = 25%
- test/cases.test.ts > S8 Revised baseline > A not in revision -> original used, flagged as fallback
- test/cases.test.ts > S8 Revised baseline > overall planned on Rev: (10*1 + 20*0.25 + 10*0)/40 = 37.5%
- test/cases.test.ts > S8 Revised baseline > delays vs revised and vs original are kept separate
- test/cases.test.ts > S9 Shuffled and renamed columns - full sample > reversed column order + alternative header names give identical results
- test/import-messy.test.ts > Messy export > picks the activity sheet and skips the title row
- test/import-messy.test.ts > Messy export > maps alternative names in any order
- test/import-messy.test.ts > Messy export > converts hours to days and reads mixed % formats on the 0-1 scale
- test/import-messy.test.ts > Messy export > reads text dates with time and " A" markers, and numeric d/m/y
- test/import-messy.test.ts > Messy export > reads currency text amounts
- test/import-messy.test.ts > Messy export > reports what it cannot read instead of guessing
- test/import-messy.test.ts > Messy export > validation: duplicate ID, missing ID, invalid values, missing baseline are reported
- test/sha256.test.ts > SHA-256 matches the standard implementation
- test/import.test.ts > Date parsing > 08-Nov-26
- test/import.test.ts > Date parsing > 8-Nov-2026
- test/import.test.ts > Date parsing > 01-Mar-26 A
- test/import.test.ts > Date parsing > 01-Mar-26*
- test/import.test.ts > Date parsing > 01-Mar-26 08:00 A
- test/import.test.ts > Date parsing > 2026-11-08
- test/import.test.ts > Date parsing > 2026-11-08T00:00:00
- test/import.test.ts > Date parsing > 08/11/2026
- test/import.test.ts > Date parsing > Nov 8, 2026
- test/import.test.ts > Date parsing > 08 November 2026
- test/import.test.ts > Date parsing > reports instead of guessing
- test/import.test.ts > Date parsing > MDY order when chosen
- test/import.test.ts > Date parsing > formats dd-Mmm-yy
- test/import.test.ts > Durations and percentages > reads units
- test/import.test.ts > Durations and percentages > detects % scale
- test/import.test.ts > Sample P6 export (2 header rows, text dates, "d" durations) > detects 2 header rows on sheet TASK
- test/import.test.ts > Sample P6 export (2 header rows, text dates, "d" durations) > maps every standard field
- test/import.test.ts > Sample P6 export (2 header rows, text dates, "d" durations) > reads 84 activities with no unreadable values
- test/import.test.ts > Sample P6 export (2 header rows, text dates, "d" durations) > reads actual dates with " A" and % on 0-100 scale
- test/import.test.ts > Both samples give identical activities > workbook raw data has 1 header row
- test/import.test.ts > Both samples give identical activities > same values field by field
- test/import.test.ts > Shuffled and renamed columns (S9) > maps by name regardless of order, and saved names are used
