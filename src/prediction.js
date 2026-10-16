export const PREDICTION_RULES = {
  gapHigh: -15,
  gapModerate: -5,
  delayHighDays: 30,
  delayModerateDays: 7,
  workforceShortagePct: 80,
  workforceSevereShortagePct: 60,
  trendSlowdownRatio: 0.8,
  trendSpeedupRatio: 1.2,
  recentWindowDays: 14,
  minReportsReliable: 3,
  minReportsTrend: 4,
  recoveryFeasibleMaxRatio: 1.25,
  recoveryImminentDays: 7,
  recoveryImminentRemainingPct: 10,
};

export const DISRUPTION_CATEGORIES = ['Material shortage', 'Adverse weather', 'Equipment problem', 'Labor shortage', 'Other'];

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const addDays = (date, days) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export const daysBetween = (from, to) => Math.round((new Date(`${to}T12:00:00`) - new Date(`${from}T12:00:00`)) / 86400000);

export const round1 = (value) => Math.round(value * 10) / 10;

export const isValidDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

const fmtISO = (value) =>
  isValidDate(value)
    ? new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : value;

const numOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const inPercentRange = (value) => (value === null ? null : value >= 0 && value <= 100 ? value : null);

// Keep reports with a valid date and a valid actual accomplishment (0-100),
// sort them by date, and drop duplicate dates (latest submission wins).
export function sanitizeReports(reports, projectId) {
  const list = (Array.isArray(reports) ? reports : []).filter(
    (r) => r && r.projectId && (!projectId || r.projectId === projectId)
  );
  const valid = [];
  for (const r of list) {
    if (!isValidDate(r.date)) continue;
    const actual = inPercentRange(numOrNull(r.actual));
    if (actual === null) continue;
    const planned = inPercentRange(numOrNull(r.planned));
    const workers = numOrNull(r.workers);
    const expectedWorkers = numOrNull(r.expectedWorkers);
    valid.push({
      ...r,
      actual,
      planned,
      workers: workers !== null && workers >= 0 ? workers : null,
      expectedWorkers: expectedWorkers !== null && expectedWorkers >= 0 ? expectedWorkers : null,
      disruption: typeof r.disruption === 'string' ? r.disruption : '',
    });
  }
  valid.sort((a, b) => a.date.localeCompare(b.date) || Number(a.id ?? 0) - Number(b.id ?? 0));
  const deduped = [];
  for (const r of valid) {
    if (deduped.length && deduped[deduped.length - 1].date === r.date) deduped[deduped.length - 1] = r;
    else deduped.push(r);
  }
  return deduped;
}

function sideRate(reports) {
  if (reports.length < 2) return null;
  const days = daysBetween(reports[0].date, reports[reports.length - 1].date);
  if (days <= 0) return null;
  return (reports[reports.length - 1].actual - reports[0].actual) / days;
}

// Select the productivity rate used for forecasting using a strict priority chain:
//   1. Recent rate over the trailing reporting window when it is positive.
//   2. Extended historical rate from older reports when the recent rate is zero/negative
//      or cannot be measured (fallback, always provisional).
//   3. No rate: report why a reliable estimate is unavailable.
function selectRate(project, valid, today, cfg) {
  const out = {
    rate: null,
    source: null,
    provisional: false,
    fellBack: false,
    recentStalled: false,
    recentWindowRate: null,
    historicalRate: null,
    windowStart: null,
    windowEnd: null,
    unavailableReason: null,
  };
  if (valid.length === 0) {
    out.unavailableReason = 'No valid progress reports are available, so no productivity rate can be calculated.';
    return out;
  }

  const last = valid[valid.length - 1];
  if (valid.length === 1) {
    let elapsed = isValidDate(project.startDate) ? daysBetween(project.startDate, last.date) : 0;
    if (elapsed <= 0 && isValidDate(project.startDate)) elapsed = daysBetween(project.startDate, today);
    if (elapsed > 0 && last.actual > 0) {
      out.rate = last.actual / elapsed;
      out.source = `provisional average rate since project start (${elapsed} calendar days)`;
      out.provisional = true;
      out.fellBack = true;
    } else {
      out.unavailableReason = 'A single progress report with no measurable progress since the project start date cannot produce a productivity rate.';
    }
    return out;
  }

  const windowStart = addDays(last.date, -cfg.recentWindowDays);
  out.windowStart = windowStart;
  out.windowEnd = last.date;
  const inWindow = valid.filter((r) => r.date >= windowStart);
  const beforeWindow = valid.filter((r) => r.date < windowStart);

  // Priority 1 candidate: productivity over the recent reporting window.
  const recentRate = inWindow.length >= 2 ? sideRate(inWindow) : null;
  out.recentWindowRate = recentRate;
  out.recentStalled = recentRate !== null && recentRate <= 0;

  // Priority 2 candidate: productivity from reports older than the recent window,
  // anchored by the first in-window report so the rate bridges the two periods.
  const histSeg = beforeWindow.length >= 1 && inWindow.length >= 1 ? [...beforeWindow, inWindow[0]] : null;
  const historicalRate = histSeg ? sideRate(histSeg) : null;
  out.historicalRate = historicalRate;

  if (recentRate !== null && recentRate > 0) {
    out.rate = recentRate;
    out.source = `recent ${cfg.recentWindowDays}-day report window`;
    out.provisional = valid.length < cfg.minReportsReliable;
    return out;
  }

  if (historicalRate !== null && historicalRate > 0) {
    out.rate = historicalRate;
    out.source = 'extended historical reports (fallback)';
    out.fellBack = true;
    out.provisional = true;
    return out;
  }

  if (recentRate !== null && recentRate <= 0) {
    out.unavailableReason = `Daily productivity over the recent ${cfg.recentWindowDays}-day window is ${round1(recentRate)} pp/day (zero or negative), and older reports do not provide a positive historical rate, so no completion date is estimated.`;
  } else if (historicalRate !== null && historicalRate <= 0) {
    out.unavailableReason = `Recorded reports show a productivity rate of ${round1(historicalRate)} pp/day (zero or negative), so no completion date is estimated.`;
  } else {
    out.unavailableReason = 'The available reports do not establish a positive productivity rate, so no completion date is estimated.';
  }
  return out;
}

// Build a single situation-specific reliability message replacing the generic notice.
function buildReliability(o) {
  const { completed, reportCount, rate, rateProvisional, fellBack, recentStalled, requiresReview, issueCount, unavailableReason, cfg } = o;
  if (completed) {
    return { status: 'completed', tone: 'ok', title: 'Project completed', message: 'Actual accomplishment is 100%, so no completion-date forecast applies.' };
  }
  if (requiresReview) {
    return { status: 'review', tone: 'bad', title: 'Forecast requires review', message: `Cumulative accomplishment decreased in ${issueCount === 1 ? 'one progress report' : 'some progress reports'}. Verify or correct the inconsistent reports, then recalculate. The delay forecast and recovery assessment are not treated as reliable until the discrepancy is resolved.` };
  }
  if (reportCount === 0) {
    return { status: 'insufficient', tone: 'bad', title: 'Insufficient data', message: 'A reliable completion estimate is unavailable because no valid progress reports have been submitted yet. Submit dated progress reports to establish productivity.' };
  }
  if (rate === null) {
    return { status: 'unavailable', tone: 'bad', title: 'Unable to estimate', message: unavailableReason || 'A reliable completion estimate is unavailable because the available reports do not establish a positive productivity rate.' };
  }
  if (reportCount === 1) {
    return { status: 'provisional', tone: 'amber', title: 'Provisional forecast', message: 'Only one valid progress report is available. The completion estimate uses a provisional average rate since the project start and should be treated as provisional.' };
  }
  if (fellBack && recentStalled) {
    return { status: 'provisional', tone: 'amber', title: 'Provisional forecast', message: `Recent productivity is zero or negative. The completion estimate uses historical productivity (${rate.toFixed(2)} pp/day) and should be treated as provisional.` };
  }
  if (fellBack) {
    return { status: 'provisional', tone: 'amber', title: 'Provisional forecast', message: 'Not enough reports fall within the recent window, so the completion estimate uses extended historical productivity and should be treated as provisional.' };
  }
  if (rateProvisional) {
    return { status: 'provisional', tone: 'amber', title: 'Provisional forecast', message: `The forecast is provisional because fewer than ${cfg.minReportsReliable} valid reports are available.` };
  }
  return { status: 'reliable', tone: 'ok', title: 'Forecast reliability', message: 'Completion estimate is based on recent progress reports.' };
}

function computeTrend(valid, cfg) {
  const out = { trend: 'Insufficient data', recentRate: null, earlierRate: null, note: '' };
  if (valid.length < cfg.minReportsTrend) {
    out.note = `At least ${cfg.minReportsTrend} dated reports are needed to compare recent and earlier productivity (currently ${valid.length}).`;
    return out;
  }
  const mid = Math.floor(valid.length / 2);
  const earlier = sideRate(valid.slice(0, mid));
  const recent = sideRate(valid.slice(mid));
  out.earlierRate = earlier;
  out.recentRate = recent;
  if (earlier === null || recent === null) {
    out.note = 'Report dates within one half of the history are too close together to compare productivity.';
    return out;
  }
  if (earlier > 0) {
    const ratio = recent / earlier;
    out.trend = ratio < cfg.trendSlowdownRatio ? 'Slowing' : ratio > cfg.trendSpeedupRatio ? 'Accelerating' : 'Stable';
  } else {
    out.trend = recent > earlier ? 'Accelerating' : recent < earlier ? 'Slowing' : 'Stable';
  }
  out.note = `Recent ${recent.toFixed(2)} pp/day vs earlier ${earlier.toFixed(2)} pp/day.`;
  return out;
}

function computeWorkforce(project, latest, cfg) {
  const expected = latest && latest.expectedWorkers !== null ? latest.expectedWorkers : numOrNull(project.plannedWorkers);
  const present = latest && latest.workers !== null ? latest.workers : numOrNull(project.actualWorkers);
  const out = { expected, present, availability: null, shortage: false, severe: false, note: '' };
  if (expected === null || expected <= 0) {
    out.note = expected === 0
      ? 'Expected workforce is zero, so workforce availability cannot be calculated.'
      : 'Expected workforce is not recorded, so workforce availability cannot be calculated.';
    return out;
  }
  if (present === null) {
    out.note = 'Workers present are not recorded, so workforce availability cannot be calculated.';
    return out;
  }
  out.availability = (present / expected) * 100;
  out.shortage = out.availability < cfg.workforceShortagePct;
  out.severe = out.availability < cfg.workforceSevereShortagePct;
  return out;
}

// Flag cumulative accomplishment decreases between consecutive sorted reports.
function detectDataIssues(valid) {
  const issues = [];
  for (let i = 1; i < valid.length; i += 1) {
    if (valid[i].actual < valid[i - 1].actual) {
      issues.push({
        date: valid[i].date,
        previousDate: valid[i - 1].date,
        previousActual: valid[i - 1].actual,
        actual: valid[i].actual,
      });
    }
  }
  return issues;
}

// Recovery Feasibility Analysis: compare the productivity needed to finish by the
// deadline with the productivity observed from valid reports.
function computeRecovery({ completed, actual, reportingDate, deadline, rate, cfg }) {
  const out = {
    status: 'unable',
    label: 'Unable to determine',
    remainingPct: null,
    remainingDays: null,
    requiredRate: null,
    observedRate: rate === null ? null : round1(rate),
    ratio: null,
    note: '',
  };
  if (completed) {
    out.status = 'completed';
    out.label = 'Completed';
    out.note = 'The project is already 100% complete, so no recovery is required.';
    return out;
  }
  if (actual === null) {
    out.note = 'Verified accomplishment is missing, so recovery feasibility cannot be assessed.';
    return out;
  }
  out.remainingPct = Math.max(0, round1(100 - actual));
  if (!isValidDate(deadline) || !isValidDate(reportingDate)) {
    out.note = 'A valid project deadline and reporting date are needed to assess recovery.';
    return out;
  }
  out.remainingDays = daysBetween(reportingDate, deadline);

  if (out.remainingDays <= 0) {
    if (out.remainingPct > 0) {
      out.status = 'high';
      out.label = 'At high risk of missing the deadline';
      out.note = `The deadline (${fmtISO(deadline)}) has passed with ${out.remainingPct}% of work remaining.`;
    } else {
      out.status = 'completed';
      out.label = 'Completed';
      out.note = 'All work was completed by the deadline.';
    }
    return out;
  }

  out.requiredRate = out.remainingPct > 0 ? round1(out.remainingPct / out.remainingDays) : 0;
  if (out.remainingPct <= 0) {
    out.status = 'recoverable';
    out.label = 'Recoverable at current pace';
    out.note = 'No measurable work remains.';
    return out;
  }
  if (rate === null) {
    out.note = `Observed productivity cannot be established from the available reports, so recovery over the remaining ${out.remainingDays} days cannot be determined. Submit more dated progress reports.`;
    return out;
  }

  out.ratio = rate > 0 ? out.requiredRate / rate : null;
  if (out.requiredRate <= rate) {
    out.status = 'recoverable';
    out.label = 'Recoverable at current pace';
    out.note = `Observed productivity (${out.observedRate} pp/day) meets or exceeds the required ${out.requiredRate} pp/day for the remaining ${out.remainingDays} days.`;
  } else if (out.requiredRate <= rate * cfg.recoveryFeasibleMaxRatio) {
    out.status = 'recovery';
    out.label = 'Recovery required';
    out.note = `Required productivity (${out.requiredRate} pp/day) is above the observed ${out.observedRate} pp/day for the remaining ${out.remainingDays} days. Corrective action is needed.`;
  } else {
    out.status = 'high';
    out.label = 'At high risk of missing the deadline';
    out.note = `Required productivity (${out.requiredRate} pp/day) is far above the observed ${out.observedRate} pp/day for the remaining ${out.remainingDays} days.`;
  }
  if (out.remainingDays <= cfg.recoveryImminentDays && out.remainingPct > cfg.recoveryImminentRemainingPct) {
    out.status = 'high';
    out.label = 'At high risk of missing the deadline';
    out.note += ` The deadline is only ${out.remainingDays} day${out.remainingDays === 1 ? '' : 's'} away with ${out.remainingPct}% of work remaining.`;
  }
  return out;
}

// Practical corrective actions derived from the recovery outlook and supporting indicators.
function buildRecommendations({ recovery, workforce, trend, disruption, requiresReview }) {
  const recs = [];
  if (requiresReview) {
    recs.push('Verify or correct the inconsistent progress reports before relying on this forecast, then recalculate.');
  }
  if (recovery.status === 'high') {
    recs.push('Review the schedule and prioritize delayed activities to protect the deadline.');
    recs.push('Consider reallocating available workers to critical activities.');
    recs.push('Evaluate overtime or additional workers when feasible.');
  } else if (recovery.status === 'recovery') {
    recs.push(`Raise daily productivity toward ${recovery.requiredRate} pp/day to recover the remaining work by the deadline.`);
    recs.push('Review the schedule and prioritize delayed activities.');
    recs.push('Evaluate overtime or additional workers when feasible.');
  } else if (recovery.status === 'recoverable') {
    recs.push('Maintain the current pace to stay on schedule.');
  } else if (recovery.status === 'unable') {
    recs.push('Submit more dated progress reports to establish a reliable productivity rate.');
    recs.push('Confirm that the project deadline is correct and up to date.');
  }
  if (workforce.shortage) {
    const shortfall = workforce.expected !== null && workforce.present !== null ? ` (${round1(workforce.expected - workforce.present)} workers short)` : '';
    recs.push(`Investigate the cause of the workforce shortage${shortfall}.`);
  }
  if (trend === 'Slowing') recs.push('Investigate the cause of declining productivity with the site team.');
  if (disruption) recs.push(`Address the recorded disruption: ${disruption}.`);
  recs.push('Monitor progress more frequently until the forecast stabilises.');
  recs.push('Recalculate the recovery plan after new reports are submitted.');
  return [...new Set(recs)];
}

export function predict(project, reports, today = todayISO()) {
  const cfg = PREDICTION_RULES;
  const warnings = [];
  const reasons = [];
  const allForProject = (Array.isArray(reports) ? reports : []).filter((r) => r && r.projectId === project.id);
  const valid = sanitizeReports(allForProject);

  const lastReport = valid.length ? valid[valid.length - 1] : null;
  const planned = lastReport && lastReport.planned !== null ? lastReport.planned : inPercentRange(numOrNull(project.planned));
  const actual = lastReport ? lastReport.actual : inPercentRange(numOrNull(project.actual));
  const gap = planned === null || actual === null ? NaN : round1(actual - planned);
  const reportingDate = lastReport ? lastReport.date : isValidDate(today) ? today : null;
  const completed = project.status === 'Completed' || (actual !== null && actual >= 100);

  const rateInfo = selectRate(project, valid, today, cfg);
  const { rate, source: rateSource, provisional: rateProvisional, fellBack, recentStalled, recentWindowRate, historicalRate, windowStart, windowEnd, unavailableReason } = rateInfo;
  const trendInfo = computeTrend(valid, cfg);
  const workforce = computeWorkforce(project, lastReport, cfg);
  const remainingWork = actual === null ? null : Math.max(0, round1(100 - actual));
  const dataIssues = detectDataIssues(valid);
  const requiresReview = dataIssues.length > 0 && !completed;

  let daysRemaining = completed ? 0 : null;
  let estimatedDate = null;
  let delayDays = null;

  if (!completed && actual !== null) {
    if (rate !== null) {
      if (remainingWork <= 0) {
        daysRemaining = 0;
        estimatedDate = reportingDate;
      } else {
        daysRemaining = Math.ceil(remainingWork / rate);
        estimatedDate = addDays(reportingDate, daysRemaining);
      }
      if (isValidDate(project.targetDate)) {
        delayDays = Math.max(0, daysBetween(project.targetDate, estimatedDate));
      } else {
        warnings.push('Target completion date is missing or invalid, so the estimated delay cannot be calculated.');
      }
    }
  }

  if (!completed) {
    if (valid.length === 0) {
      warnings.push('No valid progress reports are available for this project, so a productivity-based forecast cannot be produced.');
    } else if (valid.length === 1) {
      warnings.push('Only one valid progress report exists. Any productivity figure is provisional and is not based on a report history trend.');
    }
    if (rate !== null && rateProvisional && !fellBack && valid.length > 1) {
      warnings.push(`The forecast is provisional: it is based on ${valid.length} valid reports (fewer than ${cfg.minReportsReliable}).`);
    }
    if (fellBack && recentStalled && windowStart && windowEnd) {
      warnings.push(`No measurable progress has been recorded in the recent ${cfg.recentWindowDays}-day reporting window (${fmtISO(windowStart)} – ${fmtISO(windowEnd)}). Review the latest site progress report, because the project may have stalled even though a provisional estimate is shown.`);
    }
    if (recentWindowRate !== null && recentWindowRate > 0 && historicalRate !== null && historicalRate > 0 && recentWindowRate < cfg.trendSlowdownRatio * historicalRate) {
      warnings.push(`Recent productivity (${round1(recentWindowRate)} pp/day) is substantially lower than the historical rate (${round1(historicalRate)} pp/day).`);
    }
    if (isValidDate(project.targetDate) && isValidDate(reportingDate) && project.targetDate < reportingDate) {
      warnings.push(`The target completion date (${fmtISO(project.targetDate)}) has already passed.`);
    }
    for (const issue of dataIssues) {
      warnings.push(`Cumulative accomplishment decreased from ${issue.previousActual}% on ${fmtISO(issue.previousDate)} to ${issue.actual}% on ${fmtISO(issue.date)}. Verify or correct this report.`);
    }
  }

  let risk;
  let forecastStatus;
  if (completed) {
    risk = 'Completed';
    forecastStatus = 'completed';
    reasons.push(actual !== null && actual >= 100 ? 'Actual accomplishment has reached 100%, so no delay forecast applies.' : 'The project is marked as completed.');
  } else if (!Number.isFinite(gap)) {
    risk = 'Insufficient data';
    forecastStatus = valid.length === 0 ? 'insufficient' : forecastStatusFrom(rate, rateProvisional, valid.length, cfg);
    reasons.push('Planned or actual accomplishment is missing or invalid, so the risk level cannot be classified.');
    if (valid.length === 0) reasons.push('No valid progress reports are available for this project.');
  } else {
    let level = 0;
    forecastStatus = forecastStatusFrom(rate, rateProvisional, valid.length, cfg);

    if (gap <= cfg.gapHigh) {
      level = 3;
      reasons.push(`Progress gap of ${gap} pp is at or beyond the high-risk threshold (${cfg.gapHigh} pp).`);
    } else if (gap < cfg.gapModerate) {
      level = 2;
      reasons.push(`Progress gap of ${gap} pp is beyond the moderate-risk threshold (${cfg.gapModerate} pp).`);
    } else if (gap < 0) {
      level = 1;
      reasons.push(`Progress gap of ${gap} pp shows the project is slightly behind the reported plan.`);
    } else {
      reasons.push(`Progress gap of ${gap} pp is within the on-track threshold (${cfg.gapModerate} pp or better).`);
    }

    if (delayDays !== null) {
      if (delayDays > cfg.delayHighDays) {
        level = Math.max(level, 3);
        reasons.push(`Estimated delay of ${delayDays} calendar days exceeds the high-risk threshold (${cfg.delayHighDays} days).`);
      } else if (delayDays > cfg.delayModerateDays) {
        level = Math.max(level, 2);
        reasons.push(`Estimated delay of ${delayDays} calendar days exceeds the moderate-risk threshold (${cfg.delayModerateDays} days).`);
      } else if (delayDays > 0) {
        level = Math.max(level, 1);
        reasons.push(`Estimated delay of ${delayDays} calendar days is projected beyond the target date.`);
      } else {
        reasons.push('Estimated completion is on or before the target completion date.');
      }
    } else if (rate === null && actual !== null) {
      reasons.push('Estimated delay could not be calculated because daily productivity is zero, negative, or unavailable.');
    }

    if (workforce.availability !== null) {
      const availabilityText = `${round1(workforce.availability)}% (${workforce.present} of ${workforce.expected} expected workers)`;
      if (workforce.severe) {
        level = Math.max(level, 2);
        reasons.push(`Workforce availability is ${availabilityText} — severe shortage below ${cfg.workforceSevereShortagePct}% raises the minimum risk level to Moderate.`);
      } else if (workforce.shortage) {
        level = Math.max(level, 1);
        reasons.push(`Workforce availability is ${availabilityText} — significant shortage below ${cfg.workforceShortagePct}% flags delay risk.`);
      } else {
        reasons.push(`Workforce availability is ${availabilityText} — no shortage flagged.`);
      }
    } else if (workforce.note) {
      reasons.push(workforce.note);
    }

    if (trendInfo.trend === 'Slowing') {
      level = Math.max(level, gap < 0 ? 2 : 1);
      reasons.push(`Productivity is slowing: ${trendInfo.note} A declining trend raises the minimum risk level.`);
    } else if (trendInfo.trend === 'Accelerating') {
      reasons.push(`Productivity is accelerating: ${trendInfo.note}`);
    } else if (trendInfo.trend === 'Stable') {
      reasons.push(`Productivity is stable: ${trendInfo.note}`);
    } else if (valid.length > 0) {
      reasons.push(`Productivity trend not calculated: ${trendInfo.note}`);
    }

    if (lastReport && lastReport.disruption) {
      level = Math.max(level, 1);
      reasons.push(`The latest progress report records a disruption: ${lastReport.disruption}.`);
    }

    risk = ['On track', 'Low risk', 'Moderate', 'High risk'][level];
  }

  if (!completed && requiresReview && rate !== null) forecastStatus = 'review';

  const recovery = computeRecovery({
    completed,
    actual,
    reportingDate,
    deadline: isValidDate(project.targetDate) ? project.targetDate : null,
    rate,
    cfg,
  });

  const recommendations = buildRecommendations({
    recovery,
    workforce,
    trend: trendInfo.trend,
    disruption: lastReport ? lastReport.disruption : '',
    requiresReview,
  });

  const reliability = buildReliability({
    completed,
    reportCount: valid.length,
    rate,
    rateProvisional,
    fellBack,
    recentStalled,
    requiresReview,
    issueCount: dataIssues.length,
    unavailableReason,
    cfg,
  });

  return {
    planned,
    actual,
    gap: Number.isFinite(gap) ? gap : null,
    reportingDate,
    reportCount: valid.length,
    rate: rate !== null ? round1(rate) : null,
    rateRaw: rate,
    rateSource,
    rateProvisional,
    fellBack,
    recentStalled,
    recentWindowRate: recentWindowRate !== null ? round1(recentWindowRate) : null,
    historicalRate: historicalRate !== null ? round1(historicalRate) : null,
    windowStart,
    windowEnd,
    trend: trendInfo.trend,
    trendNote: trendInfo.note,
    recentRate: trendInfo.recentRate,
    earlierRate: trendInfo.earlierRate,
    remainingWork,
    daysRemaining,
    estimatedDate,
    delayDays,
    workforce,
    risk,
    forecastStatus,
    reliability,
    recovery,
    recommendations,
    dataIssues,
    requiresReview,
    reasons,
    warnings,
  };
}

function forecastStatusFrom(rate, rateProvisional, reportCount, cfg) {
  if (reportCount === 0) return 'insufficient';
  if (rate === null) return 'unavailable';
  if (rateProvisional || reportCount < cfg.minReportsReliable) return 'provisional';
  return 'ok';
}
