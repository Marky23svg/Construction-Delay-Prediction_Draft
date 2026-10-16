# BuildTrack — Construction Project Monitoring Prototype

A one-day React prototype for monitoring construction project progress and estimating schedule risk.

## Features
- Dashboard with project metrics and planned-vs-actual chart
- Add and edit construction projects
- Submit dated progress reports
- Rule-based risk classification
- Progress-rate-based completion estimate
- Estimated delay duration
- Progress history chart
- CSV report export
- Browser localStorage persistence

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
- Forecasting uses simple progress-rate assumptions. It currently uses calendar-day approximations and does not account for work calendars, holidays, critical-path dependencies, weather, material availability, or approved schedule changes.
- When there is insufficient report history, the displayed rate is provisional. Treat all estimates as decision-support information, not guarantees.

## Suggested next implementation steps
1. Add Express.js API routes for projects and progress reports.
2. Add MongoDB Atlas collections for users, projects, progress reports, and prediction history.
3. Implement authentication and role-based permissions for site engineers and project managers.
4. Configure working-day calculations and the company's approved schedule baseline.
5. Test forecasts against actual outcomes once enough real progress history is available.
