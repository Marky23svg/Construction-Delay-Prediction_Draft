# BuildTrack — Construction Project Monitoring Prototype

A one-day React prototype for monitoring construction project progress and estimating schedule risk.

## Features
- Dashboard with project metrics and planned-vs-actual chart
- Add and edit construction projects
- Submit dated progress reports (planned/actual accomplishment, expected vs actual workers, disruption category, remarks)
- Workforce-aware, rule-based risk classification with written reasons
- Progress-rate-based completion estimate using dated report history
- Productivity trend (accelerating / stable / slowing)
- Explicit provisional and insufficient-data handling
- Progress history chart
- CSV report export including workforce and productivity indicators
- Browser localStorage persistence

## How the forecast works
All factors are evaluated in `src/prediction.js`. Durations use **calendar days**.

- **Progress gap** = Actual % − Planned %. Negative means behind plan.
- **Productivity rate** is selected with a strict priority chain. **1.** The rate over the most recent 14-day window, when it is positive and at least two reports fall inside it. **2.** When recent productivity is zero or negative (or the window holds fewer than two reports), the rate from older reports is used as a provisional fallback. **3.** When no period shows positive productivity, no rate is selected and the completion estimate is withheld with an explanation.
- **Remaining work** = 100% − Actual %.
- **Estimated completion** = reporting date + (remaining work ÷ selected productivity rate), rounded up. Withheld only when no positive rate (recent or historical) is available.
- **Estimated delay** = estimated completion − target completion (calendar days).
- **Workforce availability** = actual workers present ÷ expected workers. This is a *supporting indicator only*: it never changes the productivity rate or the completion date. Below 80% flags a shortage; below 60% raises the minimum risk level to Moderate.
- **Productivity trend** compares the recent half of the report history with the earlier half (needs 4+ reports). A slowing trend raises the minimum risk level. A warning is also shown when recent productivity is substantially lower than the historical rate.
- **Forecast reliability** is shown as a single situation-specific notice: reliable, provisional (fallback or limited history), requires review, or unavailable, with the reason. The risk level is always classified independently of the estimate.
- **Recovery feasibility** compares the productivity needed to finish by the deadline (**required productivity** = remaining accomplishment ÷ remaining days, counted from the latest reporting date) with the **observed productivity**. Outcomes: *Recoverable at current pace* (required ≤ observed), *Recovery required* (required up to 25% above observed), *At high risk of missing the deadline* (required far above observed, or the deadline is within 7 days with more than 10% work remaining), or *Unable to determine* (missing history or deadline).
- **Recommended corrective actions** are derived from the recovery outlook and supporting indicators. They are potential actions, not guarantees of recovery.
- **Data validation** flags any report whose cumulative accomplishment is lower than the previous report. Those projects show a warning, the forecast is marked *requires review*, and the delay forecast and recovery assessment are not treated as reliable until the discrepancy is verified or corrected.
- **Risk classification** is rule-based (high / moderate / low / on track / completed / insufficient data) with the reasons shown on the page. No probability percentages are shown.

Factors that directly affect the forecast: planned %, actual %, dated report history, remaining work, target completion date. Supporting indicators: workforce availability, productivity trend, recorded disruptions.

## Testing
Run the included scenario tests (10 required cases plus productivity fallback, recovery feasibility, data validation, duplicate/out-of-order, and zero-workforce edge cases):
```bash
node scripts/prediction.test.mjs
```
Then start the app and try the scenarios through the UI (add projects/reports on the Progress Reports page and review the Delay Predictions page).

## Important prototype limitations
- Sample projects and reports are illustrative, not real company data.
- Data is saved in the current browser using localStorage. It is not shared between devices and is not suitable for sensitive production data.
- This version does not yet have user authentication, role-based permissions, a server API, or MongoDB Atlas.
- Forecasting uses simple constant-rate assumptions over **calendar days**. It does not account for work calendars, holidays, critical-path dependencies, or approved schedule changes, and it does not infer that fewer workers always cause lower productivity.
- Forecasts have not been validated against actual project outcomes. Treat all estimates as decision support, not guarantees.

## Requirements
- Node.js 18 or later
- npm

## Run locally
```bash
npm install
npm run dev
```
Open the local URL printed by Vite (usually http://localhost:5173).

To test a production build:
```bash
npm run build
npm run preview
```

## Important prototype limitations
- Sample projects and reports are illustrative, not real company data.
- Data is saved in the current browser using localStorage. It is not shared between devices and is not suitable for sensitive production data.
- This version does not yet have user authentication, role-based permissions, a server API, or MongoDB Atlas.
- Forecasting uses simple constant-rate assumptions over **calendar days**. It does not account for work calendars, holidays, critical-path dependencies, or approved schedule changes, and it does not infer that fewer workers always cause lower productivity.
- Forecasts have not been validated against actual project outcomes. Treat all estimates as decision support, not guarantees.

## Suggested next implementation steps
1. Add Express.js API routes for projects and progress reports.
2. Add MongoDB Atlas collections for users, projects, progress reports, and prediction history.
3. Implement authentication and role-based permissions for site engineers and project managers.
4. Configure working-day calculations and the company's approved schedule baseline.
5. Test forecasts against actual outcomes once enough real progress history is available.
