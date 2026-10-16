import { predict, sanitizeReports, daysBetween, addDays, PREDICTION_RULES } from '../src/prediction.js';

let passed = 0;
let failed = 0;
function check(name, condition, detail = '') {
  if (condition) { passed++; console.log(`PASS  ${name}`); }
  else { failed++; console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}
const report = (id, projectId, date, planned, actual, workers, expectedWorkers, disruption = '') =>
  ({ id, projectId, date, planned, actual, workers, expectedWorkers, disruption });
const TODAY = '2026-10-17';

// 1. Project progressing according to plan
{
  const p = { id: 'P1', startDate: '2026-09-01', targetDate: '2026-11-20', planned: 65, actual: 65, plannedWorkers: 20, actualWorkers: 20, status: 'Active' };
  const reports = [
    report(1, 'P1', '2026-10-01', 50, 50, 20, 20),
    report(2, 'P1', '2026-10-11', 60, 60, 20, 20),
    report(3, 'P1', '2026-10-16', 65, 65, 20, 20),
  ];
  const pr = predict(p, reports, TODAY);
  check('1. on-plan: gap is zero', pr.gap === 0, `gap=${pr.gap}`);
  check('1. on-plan: classified On track', pr.risk === 'On track', pr.risk);
  check('1. on-plan: no delay projected', pr.delayDays === 0, `delay=${pr.delayDays}`);
  check('1. on-plan: estimate equals target', pr.estimatedDate === '2026-11-20', pr.estimatedDate);
  check('1. on-plan: reliable forecast', pr.forecastStatus === 'ok', pr.forecastStatus);
  check('1. on-plan: workforce availability 100%', pr.workforce.availability === 100, String(pr.workforce.availability));
  check('1. on-plan: no warnings', pr.warnings.length === 0, pr.warnings.join(' | '));
}

// 2 + 9. Significantly behind schedule, estimated completion after target date
{
  const p = { id: 'P2', startDate: '2026-06-01', targetDate: '2026-10-31', planned: 70, actual: 45, plannedWorkers: 20, actualWorkers: 18, status: 'Active' };
  const reports = [
    report(1, 'P2', '2026-09-20', 60, 40, 18, 20),
    report(2, 'P2', '2026-10-05', 65, 42, 18, 20),
    report(3, 'P2', '2026-10-16', 70, 45, 18, 20),
  ];
  const pr = predict(p, reports, TODAY);
  const expectedEst = addDays('2026-10-16', Math.ceil(55 / ((45 - 42) / 11)));
  const expectedDelay = daysBetween(p.targetDate, expectedEst);
  check('2. behind schedule: gap -25 pp', pr.gap === -25, `gap=${pr.gap}`);
  check('2. behind schedule: classified High risk', pr.risk === 'High risk', pr.risk);
  check('2. behind schedule: delay exceeds 30 days', pr.delayDays > PREDICTION_RULES.delayHighDays, `delay=${pr.delayDays}`);
  check('9. estimate after target date', new Date(pr.estimatedDate) > new Date(p.targetDate), `${pr.estimatedDate} vs ${p.targetDate}`);
  check('9. delay matches estimated minus target', pr.delayDays === expectedDelay, `${pr.delayDays} vs ${expectedDelay}`);
}

// 3. Fewer workers present than expected
{
  const p = { id: 'P3', startDate: '2026-09-01', targetDate: '2026-11-20', planned: 65, actual: 65, plannedWorkers: 20, actualWorkers: 12, status: 'Active' };
  const reports = [
    report(1, 'P3', '2026-10-01', 50, 50, 12, 20),
    report(2, 'P3', '2026-10-11', 60, 60, 12, 20),
    report(3, 'P3', '2026-10-16', 65, 65, 12, 20),
  ];
  const pr = predict(p, reports, TODAY);
  check('3. workforce: availability 60%', pr.workforce.availability === 60, String(pr.workforce.availability));
  check('3. workforce: shortage flagged', pr.workforce.shortage === true);
  check('3. workforce: not severe at 60%', pr.workforce.severe === false);
  check('3. workforce: raises minimum risk to Low risk', pr.risk === 'Low risk', pr.risk);
  check('3. workforce: reason mentions shortage', pr.reasons.some((x) => x.toLowerCase().includes('shortage')));
  check('3. workforce: does not change productivity rate', Math.abs(pr.rate - 1) < 0.001, String(pr.rate));
}

// 4. Declining daily productivity
{
  const p = { id: 'P4', startDate: '2026-09-01', targetDate: '2027-03-01', planned: 50, actual: 47, plannedWorkers: 20, actualWorkers: 20, status: 'Active' };
  const reports = [
    report(1, 'P4', '2026-10-01', 25, 30, 20, 20),
    report(2, 'P4', '2026-10-06', 30, 40, 20, 20),
    report(3, 'P4', '2026-10-11', 40, 45, 20, 20),
    report(4, 'P4', '2026-10-16', 50, 47, 20, 20),
  ];
  const pr = predict(p, reports, TODAY);
  check('4. declining: trend is Slowing', pr.trend === 'Slowing', pr.trend);
  check('4. declining: earlier rate 2.00 pp/day', Math.abs(pr.earlierRate - 2) < 0.001, String(pr.earlierRate));
  check('4. declining: recent rate 0.40 pp/day', Math.abs(pr.recentRate - 0.4) < 0.001, String(pr.recentRate));
  check('4. declining: raises minimum risk to Moderate', pr.risk === 'Moderate', pr.risk);
  check('4. declining: reason mentions slowing', pr.reasons.some((x) => x.toLowerCase().includes('slowing')));
}

// 5. Recorded disruption
{
  const p = { id: 'P5', startDate: '2026-09-01', targetDate: '2026-11-20', planned: 65, actual: 65, plannedWorkers: 20, actualWorkers: 20, status: 'Active' };
  const reports = [
    report(1, 'P5', '2026-10-01', 50, 50, 20, 20),
    report(2, 'P5', '2026-10-11', 60, 60, 20, 20),
    report(3, 'P5', '2026-10-16', 65, 65, 20, 20, 'Material shortage'),
  ];
  const pr = predict(p, reports, TODAY);
  check('5. disruption: raises minimum risk to Low risk', pr.risk === 'Low risk', pr.risk);
  check('5. disruption: reason records the category', pr.reasons.some((x) => x.includes('Material shortage')));
}

// 6. Only one progress report
{
  const p = { id: 'P6', startDate: '2026-08-01', targetDate: '2026-12-31', planned: 20, actual: 10, plannedWorkers: 20, actualWorkers: 10, status: 'Active' };
  const reports = [report(1, 'P6', '2026-10-16', 20, 10, 10, 20)];
  const pr = predict(p, reports, TODAY);
  check('6. single report: counts one report', pr.reportCount === 1, String(pr.reportCount));
  check('6. single report: forecast provisional', pr.forecastStatus === 'provisional', pr.forecastStatus);
  check('6. single report: rate labelled provisional', pr.rateProvisional === true);
  check('6. single report: trend insufficient', pr.trend === 'Insufficient data', pr.trend);
  check('6. single report: warning displayed', pr.warnings.some((x) => x.toLowerCase().includes('only one valid progress report')));
  check('6. single report: not treated as reliable trend (trend has no rates)', pr.recentRate === null && pr.earlierRate === null);
}

// 7. Zero or unavailable productivity
{
  const p = { id: 'P7', startDate: '2026-09-01', targetDate: '2026-12-31', planned: 40, actual: 40, plannedWorkers: 20, actualWorkers: 20, status: 'Active' };
  const reports = [
    report(1, 'P7', '2026-10-10', 40, 40, 20, 20),
    report(2, 'P7', '2026-10-16', 42, 40, 20, 20),
  ];
  const pr = predict(p, reports, TODAY);
  check('7. zero productivity: rate unavailable', pr.rate === null, String(pr.rate));
  check('7. zero productivity: forecast status unavailable', pr.forecastStatus === 'unavailable', pr.forecastStatus);
  check('7. zero productivity: no completion date', pr.estimatedDate === null, String(pr.estimatedDate));
  check('7. zero productivity: no remaining days', pr.daysRemaining === null, String(pr.daysRemaining));
  check('7. zero productivity: unable-to-estimate message', pr.reliability.message.includes('zero or negative'), pr.reliability.message);
  check('7. zero productivity: reliability status unavailable', pr.reliability.status === 'unavailable', pr.reliability.status);
}

// 8. Completed project
{
  const p = { id: 'P8', startDate: '2026-05-01', targetDate: '2026-10-25', planned: 100, actual: 100, plannedWorkers: 12, actualWorkers: 0, status: 'Completed' };
  const reports = [report(1, 'P8', '2026-10-20', 100, 100, 0, 12)];
  const pr = predict(p, reports, TODAY);
  check('8. completed: risk Completed', pr.risk === 'Completed', pr.risk);
  check('8. completed: forecast status completed', pr.forecastStatus === 'completed', pr.forecastStatus);
  check('8. completed: zero remaining days', pr.daysRemaining === 0, String(pr.daysRemaining));
  check('8. completed: remaining work 0%', pr.remainingWork === 0, String(pr.remainingWork));
  check('8. completed: no warnings', pr.warnings.length === 0, pr.warnings.join(' | '));
}

// 10. Missing or invalid data
{
  const pInvalid = { id: 'P10', startDate: '2026-09-01', targetDate: '2026-12-31', planned: null, actual: 'not-a-number', plannedWorkers: null, actualWorkers: null, status: 'Active' };
  const pr = predict(pInvalid, [], TODAY);
  check('10. invalid data: risk Insufficient data', pr.risk === 'Insufficient data', pr.risk);
  check('10. invalid data: forecast insufficient', pr.forecastStatus === 'insufficient', pr.forecastStatus);
  check('10. invalid data: gap is null', pr.gap === null, String(pr.gap));
  check('10. invalid data: reason explains missing data', pr.reasons.some((x) => x.toLowerCase().includes('missing or invalid')));

  const pMixed = { id: 'P10B', startDate: '2026-09-01', targetDate: '2026-12-31', planned: 20, actual: 22, plannedWorkers: 20, actualWorkers: 20, status: 'Active' };
  const reports = [
    report(1, 'P10B', '2026-13-40', 20, 20, 20, 20),
    report(2, 'P10B', '2026-10-16', 20, 22, 20, 20),
  ];
  const prMixed = predict(pMixed, reports, TODAY);
  check('10. invalid data: invalid-date report excluded', prMixed.reportCount === 1, String(prMixed.reportCount));
}

// Extra: duplicate dates and out-of-order reports
{
  const p = { id: 'PX', startDate: '2026-09-01', targetDate: '2026-12-31', planned: 20, actual: 35, plannedWorkers: 20, actualWorkers: 20, status: 'Active' };
  const dupes = [
    report(1, 'PX', '2026-10-10', 25, 30, 20, 20),
    report(2, 'PX', '2026-10-10', 27, 35, 20, 20),
    report(3, 'PX', '2026-10-16', 30, 38, 20, 20),
  ];
  const sanitized = sanitizeReports(dupes, 'PX');
  check('extra. duplicate dates are merged', sanitized.length === 2, String(sanitized.length));
  check('extra. latest duplicate is kept', sanitized.find((r) => r.date === '2026-10-10').actual === 35);
  const outOfOrder = [report(1, 'PX', '2026-10-16', 30, 38, 20, 20), report(2, 'PX', '2026-10-01', 20, 25, 20, 20)];
  const prUnsorted = predict(p, outOfOrder, TODAY);
  check('extra. out-of-order reports are sorted chronologically', prUnsorted.reportingDate === '2026-10-16', prUnsorted.reportingDate);
  check('extra. productivity stays positive from sorted history', prUnsorted.rate > 0, String(prUnsorted.rate));
}

// Extra: expected workforce zero
{
  const p = { id: 'PZ', startDate: '2026-09-01', targetDate: '2026-12-31', planned: 20, actual: 10, plannedWorkers: 0, actualWorkers: 0, status: 'Active' };
  const reports = [report(1, 'PZ', '2026-10-16', 20, 10, 0, 0)];
  const pr = predict(p, reports, TODAY);
  check('extra. zero expected workforce yields no availability', pr.workforce.availability === null, String(pr.workforce.availability));
  check('extra. zero workforce produces explanatory note', pr.workforce.note.toLowerCase().includes('zero'));
}

// Fallback scenarios
{
  // 11. Recent productivity zero, older productivity positive -> historical fallback.
  const p = { id: 'F1', startDate: '2026-08-01', targetDate: '2026-12-31', planned: 40, actual: 40, plannedWorkers: 20, actualWorkers: 20, status: 'Active' };
  const reports = [
    report(1, 'F1', '2026-09-20', 20, 20, 20, 20),
    report(2, 'F1', '2026-10-01', 40, 40, 20, 20),
    report(3, 'F1', '2026-10-10', 40, 40, 20, 20),
    report(4, 'F1', '2026-10-16', 40, 40, 20, 20),
  ];
  const pr = predict(p, reports, TODAY);
  check('11. fallback: recent rate is zero', pr.recentWindowRate === 0, String(pr.recentWindowRate));
  check('11. fallback: historical rate positive', pr.historicalRate > 0, String(pr.historicalRate));
  check('11. fallback: forecast rate uses historical value', Math.abs(pr.rate - pr.historicalRate) < 0.001, `${pr.rate} vs ${pr.historicalRate}`);
  check('11. fallback: flagged as fellBack', pr.fellBack === true);
  check('11. fallback: forecast provisional', pr.forecastStatus === 'provisional', pr.forecastStatus);
  check('11. fallback: completion date still estimated', pr.estimatedDate !== null, String(pr.estimatedDate));
  check('11. fallback: reliability message mentions provisional', pr.reliability.status === 'provisional' && /provisional/i.test(pr.reliability.message), pr.reliability.message);
  check('11. fallback: stalls warning displayed', pr.warnings.some((x) => x.toLowerCase().includes('no measurable progress')), pr.warnings.join(' | '));
}

{
  // 12. Recent and older productivity both zero -> unavailable.
  const p = { id: 'F2', startDate: '2026-09-01', targetDate: '2026-12-31', planned: 40, actual: 40, plannedWorkers: 20, actualWorkers: 20, status: 'Active' };
  const reports = [report(1, 'F2', '2026-10-10', 40, 40, 20, 20), report(2, 'F2', '2026-10-16', 40, 40, 20, 20)];
  const pr = predict(p, reports, TODAY);
  check('12. both zero: rate unavailable', pr.rate === null, String(pr.rate));
  check('12. both zero: forecast unavailable', pr.forecastStatus === 'unavailable', pr.forecastStatus);
  check('12. both zero: no completion date', pr.estimatedDate === null, String(pr.estimatedDate));
  check('12. both zero: no fallback rate', pr.historicalRate === null, String(pr.historicalRate));
}

{
  // 13. Recent productivity negative, older positive -> historical fallback.
  const p = { id: 'F3', startDate: '2026-08-01', targetDate: '2026-12-31', planned: 45, actual: 44, plannedWorkers: 20, actualWorkers: 20, status: 'Active' };
  const reports = [
    report(1, 'F3', '2026-09-20', 30, 30, 20, 20),
    report(2, 'F3', '2026-10-01', 45, 45, 20, 20),
    report(3, 'F3', '2026-10-10', 45, 45, 20, 20),
    report(4, 'F3', '2026-10-16', 46, 44, 20, 20),
  ];
  const pr = predict(p, reports, TODAY);
  check('13. negative recent: recentStalled true', pr.recentStalled === true);
  check('13. negative recent: falls back to historical', pr.fellBack === true && pr.rate > 0, `fellBack=${pr.fellBack} rate=${pr.rate}`);
  check('13. negative recent: flagged as requiring review', pr.reliability.status === 'review' && pr.requiresReview === true, pr.reliability.status);
}

{
  // 14. Recent positive but substantially lower than historical -> slowdown warning.
  const p = { id: 'F4', startDate: '2026-09-01', targetDate: '2026-12-31', planned: 70, actual: 64, plannedWorkers: 20, actualWorkers: 20, status: 'Active' };
  const reports = [
    report(1, 'F4', '2026-09-20', 35, 40, 20, 20),
    report(2, 'F4', '2026-10-06', 60, 60, 20, 20),
    report(3, 'F4', '2026-10-16', 70, 64, 20, 20),
  ];
  const pr = predict(p, reports, TODAY);
  check('14. slowdown: recent rate positive but used', pr.recentWindowRate > 0 && pr.fellBack === false, `recent=${pr.recentWindowRate} fellBack=${pr.fellBack}`);
  check('14. slowdown: warning compares recent with historical', pr.warnings.some((x) => x.includes('substantially lower')), pr.warnings.join(' | '));
}

{
  // 15. Target completion date already passed.
  const p = { id: 'F5', startDate: '2026-09-01', targetDate: '2026-10-01', planned: 65, actual: 65, plannedWorkers: 20, actualWorkers: 20, status: 'Active' };
  const reports = [
    report(1, 'F5', '2026-10-01', 50, 50, 20, 20),
    report(2, 'F5', '2026-10-11', 60, 60, 20, 20),
    report(3, 'F5', '2026-10-16', 65, 65, 20, 20),
  ];
  const pr = predict(p, reports, TODAY);
  check('15. past target: warning displayed', pr.warnings.some((x) => x.toLowerCase().includes('already passed')), pr.warnings.join(' | '));
}

// Recovery feasibility, corrective actions, and data validation
{
  // 16. Recoverable at current pace (P1-style on-plan project).
  const p = { id: 'R1', startDate: '2026-09-01', targetDate: '2026-11-20', planned: 65, actual: 65, plannedWorkers: 20, actualWorkers: 20, status: 'Active' };
  const reports = [report(1, 'R1', '2026-10-01', 50, 50, 20, 20), report(2, 'R1', '2026-10-11', 60, 60, 20, 20), report(3, 'R1', '2026-10-16', 65, 65, 20, 20)];
  const pr = predict(p, reports, TODAY);
  check('16. recovery: recoverable at current pace', pr.recovery.status === 'recoverable', `${pr.recovery.status} (${pr.recovery.note})`);
  check('16. recovery: remaining work 35%', pr.recovery.remainingPct === 35, String(pr.recovery.remainingPct));
  check('16. recovery: required rate computed', pr.recovery.requiredRate === 1, String(pr.recovery.requiredRate));
  check('16. recovery: recommendation to maintain pace', pr.recommendations.some((x) => x.toLowerCase().includes('maintain the current pace')), pr.recommendations.join(' | '));
}

{
  // 17. Recovery required: required productivity modestly above observed.
  const p = { id: 'R2', startDate: '2026-09-01', targetDate: '2026-11-01', planned: 70, actual: 56, plannedWorkers: 20, actualWorkers: 20, status: 'Active' };
  const reports = [report(1, 'R2', '2026-10-06', 50, 32, 20, 20), report(2, 'R2', '2026-10-16', 70, 56, 20, 20)];
  const pr = predict(p, reports, TODAY);
  check('17. recovery: status recovery required', pr.recovery.status === 'recovery', `${pr.recovery.status} (${pr.recovery.note})`);
  check('17. recovery: ratio between 1 and 1.25', pr.recovery.ratio > 1 && pr.recovery.ratio <= PREDICTION_RULES.recoveryFeasibleMaxRatio, String(pr.recovery.ratio));
  check('17. recovery: recommendation targets required rate', pr.recommendations.some((x) => x.includes(`${pr.recovery.requiredRate} pp/day`)), pr.recommendations.join(' | '));
}

{
  // 18. High risk of missing the deadline (behind schedule, large gap).
  const p = { id: 'R3', startDate: '2026-06-01', targetDate: '2026-10-31', planned: 70, actual: 45, plannedWorkers: 20, actualWorkers: 12, status: 'Active' };
  const reports = [report(1, 'R3', '2026-09-20', 60, 40, 12, 20), report(2, 'R3', '2026-10-05', 65, 42, 12, 20), report(3, 'R3', '2026-10-16', 70, 45, 12, 20)];
  const pr = predict(p, reports, TODAY);
  check('18. recovery: high risk status', pr.recovery.status === 'high', `${pr.recovery.status} (${pr.recovery.note})`);
  check('18. recovery: recommendation to reallocate workers', pr.recommendations.some((x) => x.toLowerCase().includes('reallocating')), pr.recommendations.join(' | '));
  check('18. recovery: workforce shortage recommendation present', pr.recommendations.some((x) => x.toLowerCase().includes('workforce shortage')), pr.recommendations.join(' | '));
}

{
  // 19. Unable to determine (no reports / missing data).
  const p = { id: 'R4', startDate: '2026-09-01', targetDate: '2026-12-31', planned: null, actual: 'x', plannedWorkers: null, actualWorkers: null, status: 'Active' };
  const pr = predict(p, [], TODAY);
  check('19. recovery: unable to determine', pr.recovery.status === 'unable', pr.recovery.status);
  check('19. recovery: note requests more information', pr.recovery.note.toLowerCase().includes('missing') || pr.recovery.note.toLowerCase().includes('submit'), pr.recovery.note);
}

{
  // 20. Cumulative accomplishment decreases -> requires review.
  const p = { id: 'R5', startDate: '2026-09-01', targetDate: '2026-12-31', planned: 50, actual: 48, plannedWorkers: 20, actualWorkers: 20, status: 'Active' };
  const reports = [report(1, 'R5', '2026-10-01', 40, 50, 20, 20), report(2, 'R5', '2026-10-06', 45, 45, 20, 20), report(3, 'R5', '2026-10-16', 50, 48, 20, 20)];
  const pr = predict(p, reports, TODAY);
  check('20. data issue: decrease detected', pr.dataIssues.length === 1, String(pr.dataIssues.length));
  check('20. data issue: requires review flag', pr.requiresReview === true);
  check('20. data issue: forecast status review', pr.forecastStatus === 'review', pr.forecastStatus);
  check('20. data issue: reliability review status', pr.reliability.status === 'review', pr.reliability.status);
  check('20. data issue: warning describes the decrease', pr.warnings.some((x) => x.toLowerCase().includes('decreased')), pr.warnings.join(' | '));
  check('20. data issue: recommendation to verify reports', pr.recommendations.some((x) => x.toLowerCase().includes('verify or correct')), pr.recommendations.join(' | '));
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
