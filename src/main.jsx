import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  LayoutDashboard, Building2, ClipboardList, ChartNoAxesCombined, FileText,
  Settings, Search, Bell, Plus, CalendarDays, Users, TrendingUp, AlertTriangle,
  CheckCircle2, Clock3, ArrowUpRight, Menu, X, HardHat, ChevronRight, Download,
  CircleHelp, Activity, Filter, MoreHorizontal, Trash2, Pencil, Save, RotateCcw
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from 'recharts';
import { predict, DISRUPTION_CATEGORIES, isValidDate, PREDICTION_RULES, todayISO, addDays } from './prediction.js';
import './styles.css';

const fmtDate = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const fmtShort = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
const initialProjects = [
  { id: 'CP-2026-001', name: 'Riverside Residences', client: 'Riverside Development Corp.', location: 'Quezon City', startDate: '2026-08-01', targetDate: '2026-12-30', planned: 60, actual: 42, plannedWorkers: 24, actualWorkers: 20, status: 'Active', notes: 'Second-floor structural works' },
  { id: 'CP-2026-002', name: 'Northgate Commercial Center', client: 'Northgate Properties', location: 'Marikina City', startDate: '2026-06-15', targetDate: '2026-11-20', planned: 72, actual: 68, plannedWorkers: 30, actualWorkers: 29, status: 'Active', notes: 'MEP installation and finishing' },
  { id: 'CP-2026-003', name: 'Greenfield Warehouse', client: 'Greenfield Logistics', location: 'Antipolo City', startDate: '2026-09-01', targetDate: '2027-02-15', planned: 25, actual: 19, plannedWorkers: 18, actualWorkers: 13, status: 'Active', notes: 'Foundation and ground preparation' },
  { id: 'CP-2026-004', name: 'Barangay Hall Renovation', client: 'Local Government Unit', location: 'Cainta, Rizal', startDate: '2026-05-01', targetDate: '2026-10-25', planned: 100, actual: 100, plannedWorkers: 12, actualWorkers: 0, status: 'Completed', notes: 'Final inspection completed' },
];
const initialReports = [
  { id: 1, projectId: 'CP-2026-001', date: '2026-10-06', planned: 55, actual: 36, workers: 17, expectedWorkers: 24, disruption: 'Material shortage', remarks: 'Concrete delivery delayed.' },
  { id: 2, projectId: 'CP-2026-001', date: '2026-10-10', planned: 57, actual: 39, workers: 19, expectedWorkers: 24, disruption: 'Adverse weather', remarks: 'Rain affected outdoor works.' },
  { id: 3, projectId: 'CP-2026-001', date: '2026-10-13', planned: 59, actual: 41, workers: 20, expectedWorkers: 24, disruption: '', remarks: 'Structural work resumed.' },
  { id: 4, projectId: 'CP-2026-001', date: '2026-10-16', planned: 60, actual: 42, workers: 20, expectedWorkers: 24, disruption: '', remarks: 'Materials delivered.' },
  { id: 5, projectId: 'CP-2026-002', date: '2026-10-16', planned: 72, actual: 68, workers: 29, expectedWorkers: 30, disruption: '', remarks: 'Progress within expected range.' },
  { id: 6, projectId: 'CP-2026-003', date: '2026-10-16', planned: 25, actual: 19, workers: 13, expectedWorkers: 18, disruption: 'Labor shortage', remarks: 'Waiting for additional workers.' },
];
const normalizeReports = (list) => (Array.isArray(list) ? list : []).map(r => ({ ...r, expectedWorkers: r.expectedWorkers ?? null, disruption: r.disruption ?? '' }));

function loadState(key, fallback) {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}
function App() {
  const [projects, setProjects] = useState(() => loadState('buildtrack-projects', initialProjects));
  const [reports, setReports] = useState(() => normalizeReports(loadState('buildtrack-reports', initialReports)));
  const [page, setPage] = useState('Dashboard');
  const [query, setQuery] = useState('');
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedProject, setSelectedProject] = useState('CP-2026-001');
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState('');
  const [projectForm, setProjectForm] = useState({ name: '', client: '', location: '', startDate: todayISO(), targetDate: addDays(todayISO(), 90), planned: 0, actual: 0, plannedWorkers: 10, actualWorkers: 10, notes: '' });
  const [reportForm, setReportForm] = useState({ projectId: 'CP-2026-001', date: todayISO(), planned: 0, actual: 0, workers: 0, expectedWorkers: 10, disruption: '', remarks: '' });

  React.useEffect(() => { localStorage.setItem('buildtrack-projects', JSON.stringify(projects)); }, [projects]);
  React.useEffect(() => { localStorage.setItem('buildtrack-reports', JSON.stringify(reports)); }, [reports]);
  React.useEffect(() => {
    if (toast) { const id = setTimeout(() => setToast(''), 2800); return () => clearTimeout(id); }
  }, [toast]);

  const predictions = useMemo(() => Object.fromEntries(projects.map(p => [p.id, predict(p, reports)])), [projects, reports]);
  const active = projects.filter(p => p.status !== 'Completed');
  const highRisk = active.filter(p => ['High risk', 'Moderate'].includes(predictions[p.id]?.risk));
  const workforceShortages = active.filter(p => predictions[p.id]?.workforce?.shortage);
  const decliningProductivity = active.filter(p => predictions[p.id]?.trend === 'Slowing');
  const insufficientData = active.filter(p => (predictions[p.id]?.reportCount ?? 0) < 2);
  const recoveryRisk = active.filter(p => ['recovery', 'high'].includes(predictions[p.id]?.recovery?.status) || predictions[p.id]?.requiresReview);
  const avgProgress = active.length ? Math.round(active.reduce((s,p) => s + Number(p.actual), 0) / active.length) : 0;
  const filtered = projects.filter(p => `${p.name} ${p.id} ${p.location}`.toLowerCase().includes(query.toLowerCase()));
  const selected = projects.find(p => p.id === selectedProject) || projects[0];
  const selectedReports = reports.filter(r => r.projectId === selectedProject).sort((a,b) => a.date.localeCompare(b.date));
  const chartData = selectedReports.map(r => ({ date: fmtShort(r.date), Planned: Number(r.planned), Actual: Number(r.actual) }));
  const dashboardChart = projects.filter(p => p.status !== 'Completed').map(p => ({ name: p.name.length > 16 ? p.name.slice(0,16)+'…' : p.name, Planned: Number(p.planned), Actual: Number(p.actual) }));

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard },
    { label: 'Projects', icon: Building2 },
    { label: 'Progress Reports', icon: ClipboardList },
    { label: 'Delay Predictions', icon: ChartNoAxesCombined },
    { label: 'Reports', icon: FileText },
  ];
  const notify = (message) => setToast(message);
  const openNewProject = () => {
    setEditingId(null);
    setProjectForm({ name: '', client: '', location: '', startDate: todayISO(), targetDate: addDays(todayISO(), 90), planned: 0, actual: 0, plannedWorkers: 10, actualWorkers: 10, notes: '' });
    setShowProjectForm(true);
  };
  const editProject = (p) => {
    setEditingId(p.id);
    setProjectForm({ name: p.name, client: p.client || '', location: p.location || '', startDate: p.startDate, targetDate: p.targetDate, planned: p.planned, actual: p.actual, plannedWorkers: p.plannedWorkers, actualWorkers: p.actualWorkers, notes: p.notes || '' });
    setShowProjectForm(true);
  };
  const saveProject = (e) => {
    e.preventDefault();
    if (!projectForm.name.trim() || !projectForm.startDate || !projectForm.targetDate) return notify('Please complete the required project fields.');
    if (projectForm.targetDate < projectForm.startDate) return notify('Target completion must be after the start date.');
    const clean = { ...projectForm, planned: Number(projectForm.planned), actual: Number(projectForm.actual), plannedWorkers: Number(projectForm.plannedWorkers), actualWorkers: Number(projectForm.actualWorkers) };
    if (editingId) {
      setProjects(prev => prev.map(p => p.id === editingId ? { ...p, ...clean } : p));
      notify('Project updated.');
    } else {
      const id = `CP-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
      setProjects(prev => [...prev, { ...clean, id, status: clean.actual >= 100 ? 'Completed' : 'Active' }]);
      notify('Project added.');
    }
    setShowProjectForm(false);
  };
  const saveReport = (e) => {
    e.preventDefault();
    const p = projects.find(item => item.id === reportForm.projectId);
    if (!p) return notify('Choose a project first.');
    if (!isValidDate(reportForm.date)) return notify('Enter a valid reporting date.');
    const planned = Number(reportForm.planned);
    const actual = Number(reportForm.actual);
    const workers = Number(reportForm.workers);
    const expectedWorkers = reportForm.expectedWorkers === '' ? null : Number(reportForm.expectedWorkers);
    if (!Number.isFinite(planned) || planned < 0 || planned > 100) return notify('Planned accomplishment must be between 0 and 100.');
    if (!Number.isFinite(actual) || actual < 0 || actual > 100) return notify('Actual accomplishment must be between 0 and 100.');
    if (!Number.isInteger(workers) || workers < 0) return notify('Actual workers present must be a whole number of 0 or more.');
    if (expectedWorkers !== null && (!Number.isInteger(expectedWorkers) || expectedWorkers < 0)) return notify('Expected workers must be a whole number of 0 or more.');
    const existingSameDate = reports.find(r => r.projectId === p.id && r.date === reportForm.date);
    if (existingSameDate) return notify(`A report for this project already exists on ${fmtDate(reportForm.date)}. Duplicate dates are not allowed so productivity stays consistent.`);
    const report = { ...reportForm, id: Date.now(), planned, actual, workers, expectedWorkers };
    setReports(prev => [...prev, report]);
    const latest = reports.filter(r => r.projectId === p.id).sort((a,b) => a.date.localeCompare(b.date)).at(-1);
    const isLatest = !latest || report.date >= latest.date;
    if (isLatest) {
      setProjects(prev => prev.map(item => item.id === p.id ? { ...item, planned: report.planned, actual: report.actual, actualWorkers: report.workers, status: report.actual >= 100 ? 'Completed' : 'Active' } : item));
    }
    setSelectedProject(p.id);
    setShowReportForm(false);
    notify(isLatest ? 'Progress report saved and prediction refreshed.' : 'Older-dated report saved to history; the project summary still reflects the latest dated report.');
  };
  const exportCSV = () => {
    const header = ['Project ID','Project','Planned %','Actual %','Gap (pp)','Risk','Estimated completion','Estimated delay days',
      'Expected workers','Actual workers present','Workforce availability (%)','Recent daily productivity (pp/day)','Productivity trend',
      'Remaining work (%)','Reporting date','Valid reports','Forecast status','Recovery feasibility','Required productivity (pp/day)','Observed productivity (pp/day)','Remaining days','Requires review','Risk reasons'];
    const rows = [header, ...projects.map(p => {
      const pr = predictions[p.id];
      const w = pr.workforce;
      return [p.id, p.name, pr.planned ?? p.planned, pr.actual ?? p.actual, pr.gap ?? '', pr.risk, pr.estimatedDate ?? '', pr.delayDays ?? '',
        w.expected ?? '', w.present ?? '', w.availability != null ? Math.round(w.availability * 10) / 10 : '',
        pr.rate ?? '', pr.trend, pr.remainingWork ?? '', pr.reportingDate ?? '', pr.reportCount, pr.forecastStatus,
        pr.recovery?.label ?? '', pr.recovery?.requiredRate ?? '', pr.recovery?.observedRate ?? '', pr.recovery?.remainingDays ?? '',
        pr.requiresReview ? 'Yes' : 'No', pr.reasons.join('; ')];
    })];
    const csv = rows.map(row => row.map(v => `"${String(v ?? '').replaceAll('"','""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = 'construction-project-report.csv'; a.click(); URL.revokeObjectURL(url);
    notify('CSV report exported.');
  };

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><HardHat size={22}/></div><div><strong>BuildTrack</strong><small>CONSTRUCTION OPS</small></div><button className="icon-btn mobile-close" onClick={() => setMobileNav(false)}><X size={18}/></button></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav>{navItems.map(item => <button key={item.label} className={`nav-item ${page===item.label?'active':''}`} onClick={() => {setPage(item.label);setMobileNav(false);}}><item.icon size={18}/><span>{item.label}</span>{item.label==='Delay Predictions' && <span className="nav-count">{highRisk.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={18}/></div><strong>Need a hand?</strong><p>Review the prototype guide to understand how forecasts are calculated.</p><button onClick={() => notify('Forecasts are estimates based on progress history and simple assumptions.')}>View guide <ChevronRight size={14}/></button></div><div className="profile"><div className="avatar">SM</div><div className="profile-info"><strong>Sophia Morga</strong><small>Project Administrator</small></div><MoreHorizontal size={18} className="muted"/></div></div>
    </aside>
    {mobileNav && <div className="scrim" onClick={() => setMobileNav(false)} />}
    <main className="main">
      <header className="topbar"><button className="icon-btn menu-btn" onClick={() => setMobileNav(true)}><Menu size={20}/></button><div className="breadcrumb">Workspace <ChevronRight size={14}/> <strong>{page}</strong></div><div className="top-actions"><div className="search-box"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search projects..." /></div><button className="icon-btn notification" onClick={() => {setPage('Delay Predictions');notify(`${highRisk.length} active project(s) flagged moderate or high risk.`)}}><Bell size={18}/>{highRisk.length>0&&<i/>}</button><div className="top-avatar">SM</div></div></header>
      <div className="page-content">
        {page==='Dashboard' && <Dashboard projects={projects} active={active} predictions={predictions} avgProgress={avgProgress} highRisk={highRisk} workforceShortages={workforceShortages} decliningProductivity={decliningProductivity} insufficientData={insufficientData} recoveryRisk={recoveryRisk} chartData={dashboardChart} onAdd={openNewProject} onPage={setPage} onSelect={(id)=>{setSelectedProject(id);setPage('Delay Predictions')}} />}
        {page==='Projects' && <ProjectsPage projects={filtered} predictions={predictions} onAdd={openNewProject} onEdit={editProject} onSelect={(id)=>{setSelectedProject(id);setPage('Delay Predictions')}} />}
        {page==='Progress Reports' && <ReportsPage reports={reports} projects={projects} onAdd={() => {setReportForm({ projectId: projects[0]?.id || '', date: todayISO(), planned: projects[0]?.planned || 0, actual: projects[0]?.actual || 0, workers: projects[0]?.actualWorkers || 0, expectedWorkers: projects[0]?.plannedWorkers ?? '', disruption: '', remarks: '' });setShowReportForm(true)}} />}
        {page==='Delay Predictions' && <PredictionsPage projects={projects} predictions={predictions} selected={selected} selectedProject={selectedProject} setSelectedProject={setSelectedProject} selectedReports={selectedReports} chartData={chartData} onReport={() => {setReportForm({projectId:selected?.id || '',date:todayISO(),planned:selected?.planned||0,actual:selected?.actual||0,workers:selected?.actualWorkers||0,expectedWorkers:selected?.plannedWorkers ?? '',disruption:'',remarks:''});setShowReportForm(true)}} />}
        {page==='Reports' && <ExportPage projects={projects} predictions={predictions} onExport={exportCSV} />}
      </div>
    </main>
    {showProjectForm && <Modal title={editingId ? 'Edit project' : 'Add construction project'} onClose={() => setShowProjectForm(false)}><form className="form-grid" onSubmit={saveProject}>
      <Field label="Project name *"><input required value={projectForm.name} onChange={e=>setProjectForm({...projectForm,name:e.target.value})} placeholder="e.g. Riverside Residences"/></Field>
      <Field label="Client / owner"><input value={projectForm.client} onChange={e=>setProjectForm({...projectForm,client:e.target.value})} placeholder="Company or client"/></Field>
      <Field label="Project location"><input value={projectForm.location} onChange={e=>setProjectForm({...projectForm,location:e.target.value})} placeholder="City / site"/></Field>
      <Field label="Start date *"><input required type="date" value={projectForm.startDate} onChange={e=>setProjectForm({...projectForm,startDate:e.target.value})}/></Field>
      <Field label="Target completion *"><input required type="date" value={projectForm.targetDate} onChange={e=>setProjectForm({...projectForm,targetDate:e.target.value})}/></Field>
      <Field label="Planned accomplishment (%)"><input type="number" min="0" max="100" required value={projectForm.planned} onChange={e=>setProjectForm({...projectForm,planned:e.target.value})}/></Field>
      <Field label="Actual accomplishment (%)"><input type="number" min="0" max="100" required value={projectForm.actual} onChange={e=>setProjectForm({...projectForm,actual:e.target.value})}/></Field>
      <Field label="Planned workers"><input type="number" min="0" required value={projectForm.plannedWorkers} onChange={e=>setProjectForm({...projectForm,plannedWorkers:e.target.value})}/></Field>
      <Field label="Actual workers"><input type="number" min="0" required value={projectForm.actualWorkers} onChange={e=>setProjectForm({...projectForm,actualWorkers:e.target.value})}/></Field>
      <Field label="Latest site notes" wide><textarea rows="3" value={projectForm.notes} onChange={e=>setProjectForm({...projectForm,notes:e.target.value})} placeholder="Current phase, issues, or remarks"/></Field>
      <div className="form-actions"><button type="button" className="btn btn-light" onClick={()=>setShowProjectForm(false)}>Cancel</button><button className="btn btn-primary" type="submit"><Save size={16}/> {editingId?'Save changes':'Create project'}</button></div>
    </form></Modal>}
    {showReportForm && <Modal title="Submit progress report" onClose={()=>setShowReportForm(false)}><form className="form-grid" onSubmit={saveReport}>
      <Field label="Construction project *" wide><select required value={reportForm.projectId} onChange={e=>{const p=projects.find(x=>x.id===e.target.value);setReportForm({...reportForm,projectId:e.target.value,planned:p?.planned||0,actual:p?.actual||0,workers:p?.actualWorkers||0,expectedWorkers:p?.plannedWorkers ?? ''})}}>{projects.filter(p=>p.status!=='Completed').map(p=><option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}</select></Field>
      <Field label="Reporting date *"><input type="date" required value={reportForm.date} onChange={e=>setReportForm({...reportForm,date:e.target.value})}/></Field>
      <Field label="Planned accomplishment (%)"><input type="number" min="0" max="100" required value={reportForm.planned} onChange={e=>setReportForm({...reportForm,planned:e.target.value})}/></Field>
      <Field label="Actual accomplishment (%)"><input type="number" min="0" max="100" required value={reportForm.actual} onChange={e=>setReportForm({...reportForm,actual:e.target.value})}/></Field>
      <Field label="Expected workers"><input type="number" min="0" step="1" required value={reportForm.expectedWorkers} onChange={e=>setReportForm({...reportForm,expectedWorkers:e.target.value})}/></Field>
      <Field label="Actual workers present"><input type="number" min="0" step="1" required value={reportForm.workers} onChange={e=>setReportForm({...reportForm,workers:e.target.value})}/></Field>
      <Field label="Disruption category"><select value={reportForm.disruption} onChange={e=>setReportForm({...reportForm,disruption:e.target.value})}><option value="">None recorded</option>{DISRUPTION_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></Field>
      <Field label="Site observations / issues" wide><textarea rows="3" value={reportForm.remarks} onChange={e=>setReportForm({...reportForm,remarks:e.target.value})} placeholder="Weather, materials, labor, work completed..."/></Field>
      <div className="form-actions"><button type="button" className="btn btn-light" onClick={()=>setShowReportForm(false)}>Cancel</button><button className="btn btn-primary" type="submit"><Save size={16}/> Save progress report</button></div>
    </form></Modal>}
    {toast && <div className="toast"><CheckCircle2 size={18}/>{toast}</div>}
  </div>;
}

function Field({label, children, wide}) { return <label className={`field ${wide?'field-wide':''}`}><span>{label}</span>{children}</label>; }
function SectionTitle({eyebrow, title, description, action}) { return <div className="section-title"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description&&<p>{description}</p>}</div>{action}</div>; }
function Metric({label,value,sub,icon:Icon,tone='blue',trend}) { return <div className="metric-card"><div className={`metric-icon ${tone}`}><Icon size={19}/></div><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-sub">{trend&&<span className="trend"><ArrowUpRight size={13}/>{trend}</span>}{sub}</div></div>; }
function RiskPill({risk}) { const cls = risk==='Completed'?'completed':risk==='Insufficient data'?'insufficient':risk==='On track'?'on-track':risk==='Low risk'?'low':risk==='Moderate'?'moderate':'high'; return <span className={`risk-pill ${cls}`}><i/>{risk}</span>; }
function ForecastPill({status}) { const map = { ok:['forecast-ok','Forecast available'], provisional:['forecast-provisional','Provisional forecast'], review:['forecast-unavailable','Forecast requires review'], unavailable:['forecast-unavailable','Unable to estimate'], insufficient:['forecast-insufficient','Insufficient data'], completed:['forecast-ok','Completed'] }; const [cls,label] = map[status] || map.ok; return <span className={`forecast-pill ${cls}`}><i/>{label}</span>; }
const RECOVERY_TONE = { recoverable: 'ok', recovery: 'warn', high: 'bad', unable: 'unknown', completed: 'ok' };
function RecoveryBadge({recovery}) { const tone = RECOVERY_TONE[recovery.status] || 'unknown'; return <span className={`recovery-badge recovery-${tone}`}>{recovery.label}</span>; }
function Progress({value}) { return <div className="progress-wrap"><div className="progress-track"><div className={`progress-fill ${value<30?'orange':''}`} style={{width:`${Math.max(0,Math.min(100,value))}%`}}/></div><span>{value}%</span></div>; }
function Dashboard({projects,active,predictions,avgProgress,highRisk,workforceShortages,decliningProductivity,insufficientData,recoveryRisk,chartData,onAdd,onPage,onSelect}) {
  return <><SectionTitle eyebrow="OVERVIEW" title="Project dashboard" description="Monitor construction progress and identify schedule risks across your projects." action={<button className="btn btn-primary" onClick={onAdd}><Plus size={17}/> New project</button>}/>
    <div className="metric-grid"><Metric label="Active projects" value={active.length} sub={`${projects.length} total projects`} icon={Building2} tone="blue"/><Metric label="Average completion" value={`${avgProgress}%`} sub="Across active projects" icon={TrendingUp} tone="green"/><Metric label="Projects at risk" value={highRisk.length} sub="Moderate or high risk" icon={AlertTriangle} tone="orange"/><Metric label="Completed projects" value={projects.filter(p=>p.status==='Completed').length} sub="Successfully completed" icon={CheckCircle2} tone="purple"/></div>
    <div className="metric-grid compact"><Metric label="Workforce shortages" value={workforceShortages.length} sub={`Below ${PREDICTION_RULES.workforceShortagePct}% availability`} icon={Users} tone="orange"/><Metric label="Declining productivity" value={decliningProductivity.length} sub="Slowing recent trend" icon={Activity} tone="purple"/><Metric label="Insufficient reporting data" value={insufficientData.length} sub="Fewer than 2 dated reports" icon={ClipboardList} tone="blue"/><Metric label="Reports recorded" value={projects.reduce((s,p)=>s+(predictions[p.id]?.reportCount||0),0)} sub="Valid dated progress reports" icon={FileText} tone="green"/><Metric label="Recovery required or under review" value={recoveryRisk.length} sub="Needs corrective action or data check" icon={AlertTriangle} tone="orange"/></div>
    <div className="dashboard-grid"><div className="panel chart-panel"><div className="panel-heading"><div><h3>Planned vs. actual progress</h3><p>Current reported accomplishment by project</p></div><button className="text-btn" onClick={()=>onPage('Projects')}>View projects <ChevronRight size={15}/></button></div><div className="chart-legend"><span><i className="legend-blue"/> Planned</span><span><i className="legend-green"/> Actual</span></div><div className="chart-area"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} barGap={5} margin={{top:10,right:10,left:-20,bottom:0}}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f5"/><XAxis dataKey="name" tick={{fontSize:11,fill:'#7b8497'}} axisLine={false} tickLine={false}/><YAxis domain={[0,100]} tick={{fontSize:11,fill:'#7b8497'}} axisLine={false} tickLine={false}/><Tooltip/><Bar dataKey="Planned" fill="#b9c8ed" radius={[5,5,0,0]} maxBarSize={24}/><Bar dataKey="Actual" fill="#2d65d5" radius={[5,5,0,0]} maxBarSize={24}/></BarChart></ResponsiveContainer></div></div>
    <div className="panel risk-panel"><div className="panel-heading"><div><h3>Needs attention</h3><p>Projects with schedule gaps</p></div><span className="count-badge">{highRisk.length}</span></div>{highRisk.length===0?<div className="empty-state"><CheckCircle2 size={28}/><strong>No elevated risks</strong><span>All active projects are within the configured thresholds.</span></div>:highRisk.slice(0,4).map(p=><button className="risk-row" key={p.id} onClick={()=>onSelect(p.id)}><div className="risk-row-icon"><AlertTriangle size={17}/></div><div className="risk-row-main"><strong>{p.name}</strong><small>{Math.abs(predictions[p.id].gap)} percentage-point gap</small></div><RiskPill risk={predictions[p.id].risk}/><ChevronRight size={15} className="muted"/></button>)}</div></div>
    <div className="panel table-panel"><div className="panel-heading"><div><h3>Project overview</h3><p>Latest status across construction sites</p></div><button className="text-btn" onClick={()=>onPage('Projects')}>See all <ChevronRight size={15}/></button></div><ProjectTable projects={projects.slice(0,5)} predictions={predictions} onSelect={onSelect}/></div>
    <div className="prototype-note"><CircleHelp size={17}/><span><strong>Prototype note:</strong> Sample projects are illustrative. Forecasts use simple progress-rate assumptions and are not guaranteed completion dates.</span></div>
  </>;
}
function ProjectTable({projects,predictions,onSelect,onEdit}) {
  return <div className="table-scroll"><table><thead><tr><th>PROJECT</th><th>PLANNED</th><th>ACTUAL</th><th>PROGRESS</th><th>EST. COMPLETION</th><th>RISK STATUS</th><th></th></tr></thead><tbody>{projects.map(p=><tr key={p.id}><td><button className="project-name-btn" onClick={()=>onSelect(p.id)}><span className="project-symbol"><Building2 size={16}/></span><span><strong>{p.name}</strong><small>{p.id}</small></span></button></td><td>{p.planned}%</td><td>{p.actual}%</td><td><Progress value={p.actual}/></td><td>{fmtDate(predictions[p.id]?.estimatedDate)}</td><td><RiskPill risk={predictions[p.id]?.risk}/></td><td>{onEdit&&<button className="icon-btn" onClick={()=>onEdit(p)} title="Edit project"><Pencil size={15}/></button>}</td></tr>)}</tbody></table>{projects.length===0&&<div className="empty-state">No projects found.</div>}</div>;
}
function ProjectsPage({projects,predictions,onAdd,onEdit,onSelect}) {
  return <><SectionTitle eyebrow="PORTFOLIO" title="Construction projects" description="Manage project schedules, progress baselines, and site details." action={<button className="btn btn-primary" onClick={onAdd}><Plus size={17}/> Add project</button>}/><div className="filter-row"><div className="filter-label"><Filter size={16}/> All projects <span className="count-badge">{projects.length}</span></div><span className="helper-text">Select a project to inspect its prediction.</span></div><div className="panel table-panel"><ProjectTable projects={projects} predictions={predictions} onSelect={onSelect} onEdit={onEdit}/></div></>;
}
function ReportsPage({reports,projects,onAdd}) {
  const list=[...reports].sort((a,b)=>b.date.localeCompare(a.date));
  return <><SectionTitle eyebrow="SITE UPDATES" title="Progress reports" description="Record and review periodic accomplishment updates submitted by site engineers." action={<button className="btn btn-primary" onClick={onAdd}><Plus size={17}/> New report</button>}/><div className="metric-grid compact"><Metric label="Total reports" value={reports.length} sub="Saved in this prototype" icon={ClipboardList}/><Metric label="Reporting projects" value={new Set(reports.map(r=>r.projectId)).size} sub="With progress history" icon={Building2} tone="green"/><Metric label="Latest update" value={list[0]?fmtShort(list[0].date):'—'} sub="Most recent report date" icon={CalendarDays} tone="purple"/></div><div className="panel table-panel"><div className="panel-heading"><div><h3>Report history</h3><p>Progress updates by project and reporting date</p></div></div><div className="table-scroll"><table><thead><tr><th>REPORT DATE</th><th>PROJECT</th><th>PLANNED</th><th>ACTUAL</th><th>EXPECTED WORKERS</th><th>WORKERS PRESENT</th><th>DISRUPTION</th><th>SITE REMARKS</th></tr></thead><tbody>{list.map(r=><tr key={r.id}><td>{fmtDate(r.date)}</td><td><strong>{projects.find(p=>p.id===r.projectId)?.name||r.projectId}</strong></td><td>{r.planned}%</td><td><Progress value={r.actual}/></td><td>{r.expectedWorkers ?? '—'}</td><td>{r.workers ?? '—'}</td><td>{r.disruption||'—'}</td><td className="remarks-cell">{r.remarks||'—'}</td></tr>)}</tbody></table>{!list.length&&<div className="empty-state">No reports yet. Submit a progress report to begin tracking project history.</div>}</div></div></>;
}
const FORECAST_LABELS = { ok: 'Forecast available', provisional: 'Provisional forecast', review: 'Forecast requires review', unavailable: 'Unable to estimate', insufficient: 'Insufficient data', completed: 'Completed' };
function PredictionsPage({projects,predictions,selected,selectedProject,setSelectedProject,selectedReports,chartData,onReport}) {
  if (!selected) return <><SectionTitle eyebrow="FORECASTING" title="Delay predictions" description="Add a project to generate an initial schedule risk assessment."/></>;
  const pr=predictions[selected.id];
  const rules=PREDICTION_RULES;
  const gapText = pr.gap==null ? '—' : `${pr.gap>0?'+':''}${pr.gap} pp`;
  const availabilityText = pr.workforce.availability!=null ? `${Math.round(pr.workforce.availability)}%` : '—';
  const workforceSub = pr.workforce.availability!=null ? `${pr.workforce.present} present of ${pr.workforce.expected} expected` : pr.workforce.note;
  const round2 = (v) => (v==null ? '—' : `${v.toFixed(2)} pp/day`);
  const recentRateText = pr.recentWindowRate!=null ? round2(pr.recentWindowRate) : 'Unavailable';
  const recentRateSub = pr.recentWindowRate!=null ? `Last ${rules.recentWindowDays} days (${fmtDate(pr.windowStart)} – ${fmtDate(pr.windowEnd)})` : `Fewer than 2 reports in the last ${rules.recentWindowDays} days`;
  const historicalRateText = pr.historicalRate!=null ? round2(pr.historicalRate) : 'Not available';
  const historicalRateSub = pr.historicalRate==null ? 'Not enough older reports' : pr.fellBack ? 'Used as fallback (provisional)' : 'Older reports — not used';
  const rateUsedText = pr.rate!=null ? round2(pr.rate) : 'Not available';
  const rateUsedSub = pr.rate!=null ? `${pr.fellBack?'Fallback':'Source'}: ${pr.rateSource}` : 'Forecast withheld';
  const trendSub = pr.trend==='Insufficient data' ? `Needs ${rules.minReportsTrend}+ dated reports` : pr.trendNote;
  const rec = pr.recovery;
  const recoveryRequiredText = rec.requiredRate!=null ? `${rec.requiredRate} pp/day` : '—';
  const recoveryObservedText = rec.observedRate!=null ? `${rec.observedRate} pp/day` : '—';
  const recoveryRemainingDaysText = rec.remainingDays!=null ? `${rec.remainingDays} day${rec.remainingDays===1?'':'s'}` : '—';
  const recoveryRemainingPctText = rec.remainingPct!=null ? `${rec.remainingPct}%` : '—';
  const forecastLabel = FORECAST_LABELS[pr.forecastStatus] || FORECAST_LABELS.ok;
  const heroTitle = pr.risk==='Completed' ? 'Project completed'
    : pr.risk==='Insufficient data' || pr.forecastStatus==='insufficient' ? 'Insufficient data for a forecast'
    : pr.forecastStatus==='unavailable' ? 'Unable to estimate a completion date'
    : pr.delayDays>0 ? `${pr.delayDays} calendar days projected late`
    : 'No delay currently projected';
  const heroCopy = pr.risk==='Completed' ? 'All reported work is complete, so no delay forecast applies.'
    : pr.risk==='Insufficient data' || pr.forecastStatus==='insufficient' ? 'Not enough valid progress reports exist to calculate productivity and estimate completion.'
    : pr.forecastStatus==='unavailable' ? 'No reliable completion date can be estimated from the reported progress. The risk level is still classified from the progress gap and supporting indicators.'
    : 'Rule-based forecast using reported progress, dated report history, workforce availability, and recorded disruptions. All durations use calendar days.';
  return <><SectionTitle eyebrow="FORECASTING" title="Delay predictions" description="Transparent, rule-based forecasts based on the latest progress information." action={<button className="btn btn-primary" onClick={onReport}><Plus size={17}/> Add progress report</button>}/>
    <div className="prediction-toolbar"><label className="select-project"><span>Selected project</span><select value={selectedProject} onChange={e=>setSelectedProject(e.target.value)}>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><div className="pill-group"><ForecastPill status={pr.forecastStatus}/><RiskPill risk={pr.risk}/></div></div>
    <div className="prediction-hero"><div className="prediction-hero-copy"><div className="eyebrow light">CURRENT FORECAST</div><h2>{heroTitle}</h2><p>{heroCopy}</p><div className="hero-meta"><span><CalendarDays size={15}/> Target: {fmtDate(selected.targetDate)}</span><span><Clock3 size={15}/> Estimate: {pr.estimatedDate?fmtDate(pr.estimatedDate):'Not available'}{pr.delayDays>0?` (${pr.delayDays} days late)`:''}</span></div></div><div className="hero-progress"><div className="hero-ring"><strong>{pr.actual ?? selected.actual}%</strong><span>complete</span></div></div></div>
    {pr.reliability && pr.reliability.status!=='completed' && <div className={`data-warning ${pr.reliability.tone==='ok'?'ok':pr.reliability.tone==='amber'?'amber':''}`} role="status">{pr.reliability.tone==='ok'?<CheckCircle2 size={17}/>:<AlertTriangle size={17}/>}<div><strong>{pr.reliability.title}</strong><p className="data-warning-message">{pr.reliability.message}</p>{pr.warnings.length>0 && <ul>{pr.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul>}</div></div>}
    <div className="metric-grid"><Metric label="Planned accomplishment" value={`${pr.planned ?? '—'}%`} sub={`As of ${fmtDate(pr.reportingDate)}`} icon={CalendarDays} tone="blue"/><Metric label="Actual accomplishment" value={`${pr.actual ?? '—'}%`} sub={`${pr.reportCount} valid report${pr.reportCount===1?'':'s'} used`} icon={Activity} tone="green"/><Metric label="Progress gap" value={gapText} sub="Actual minus planned" icon={TrendingUp} tone={pr.gap!=null&&pr.gap<0?'orange':'green'}/><Metric label="Estimated remaining" value={pr.risk==='Completed'?'0 days':pr.daysRemaining!=null?`${pr.daysRemaining} days`:'—'} sub={pr.rate!=null?`${pr.rate.toFixed(2)} pp/day observed`:'Rate unavailable'} icon={Clock3} tone="purple"/></div>
    <div className="metric-grid compact"><Metric label="Workforce availability" value={availabilityText} sub={workforceSub} icon={Users} tone={pr.workforce.shortage?'orange':'green'}/><Metric label="Recent productivity" value={recentRateText} sub={recentRateSub} icon={Activity} tone="blue"/><Metric label="Historical productivity" value={historicalRateText} sub={historicalRateSub} icon={TrendingUp} tone="purple"/><Metric label="Rate used for forecast" value={rateUsedText} sub={rateUsedSub} icon={Clock3} tone={pr.fellBack?'orange':'green'}/></div>
    <div className="metric-grid compact"><Metric label="Productivity trend" value={pr.trend} sub={trendSub} icon={TrendingUp} tone={pr.trend==='Slowing'?'orange':pr.trend==='Accelerating'?'green':'purple'}/><Metric label="Remaining work" value={pr.remainingWork!=null?`${pr.remainingWork}%`:'—'} sub="Of total project work unfinished" icon={ClipboardList} tone="green"/><Metric label="Estimated completion" value={pr.estimatedDate?fmtDate(pr.estimatedDate):'Not available'} sub={pr.estimatedDate?`From ${fmtDate(pr.reportingDate)} at selected rate`:'No reliable estimate'} icon={CalendarDays} tone="blue"/><Metric label="Estimated delay" value={pr.delayDays!=null?(pr.delayDays>0?`${pr.delayDays} days`:'0 days'):'Not available'} sub={pr.delayDays!=null?`vs target ${fmtDate(selected.targetDate)}`:'Target comparison unavailable'} icon={Clock3} tone={pr.delayDays>0?'orange':'green'}/></div>
    <div className="dashboard-grid"><div className="panel chart-panel"><div className="panel-heading"><div><h3>Progress history</h3><p>Planned versus actual accomplishment by report</p></div></div>{chartData.length>=1?<div className="chart-area tall"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{top:10,right:15,left:-20,bottom:0}}><defs><linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2d65d5" stopOpacity={0.2}/><stop offset="100%" stopColor="#2d65d5" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f5"/><XAxis dataKey="date" tick={{fontSize:11,fill:'#7b8497'}} axisLine={false} tickLine={false}/><YAxis domain={[0,100]} tick={{fontSize:11,fill:'#7b8497'}} axisLine={false} tickLine={false}/><Tooltip/><Area type="monotone" dataKey="Planned" stroke="#9aaed9" strokeWidth={2} fill="transparent" strokeDasharray="5 4"/><Area type="monotone" dataKey="Actual" stroke="#2d65d5" strokeWidth={2.5} fill="url(#actualFill)"/></AreaChart></ResponsiveContainer></div>:<div className="empty-state"><Activity size={28}/><strong>No progress history</strong><span>Submit dated progress reports to establish a reliable progress trend.</span></div>}</div>
      <div className="panel"><div className="panel-heading"><div><h3>Risk classification</h3><p>Rule-based assessment and reasons</p></div><RiskPill risk={pr.risk}/></div><div className="indicator-chips"><span className={`chip ${pr.workforce.severe?'chip-bad':pr.workforce.shortage?'chip-warn':'chip-ok'}`}>Workforce: {availabilityText}</span><span className={`chip ${pr.trend==='Slowing'?'chip-warn':pr.trend==='Accelerating'?'chip-ok':''}`}>Trend: {pr.trend}</span><span className={`chip ${pr.forecastStatus==='ok'||pr.forecastStatus==='completed'?'chip-ok':pr.forecastStatus==='provisional'?'chip-warn':'chip-bad'}`}>{forecastLabel}</span></div><ul className="reason-list">{pr.reasons.map((r,i)=><li key={i}><i/>{r}</li>)}</ul><p className="panel-footnote">Risk categories are rule-based assessments, not statistically validated probabilities. No probability percentage is shown.</p></div></div>
    <div className="dashboard-grid">
      <div className="panel recovery-panel"><div className="panel-heading"><div><h3>Recovery feasibility</h3><p>Whether the project can still meet the deadline</p></div><RecoveryBadge recovery={rec}/></div><div className="recovery-stats"><div><span>Remaining accomplishment</span><strong>{recoveryRemainingPctText}</strong></div><div><span>Remaining days</span><strong>{recoveryRemainingDaysText}</strong></div><div><span>Required productivity</span><strong>{recoveryRequiredText}</strong></div><div><span>Observed productivity</span><strong>{recoveryObservedText}</strong></div></div><p className="recovery-note">{rec.note}</p>{pr.requiresReview && <p className="panel-footnote">Recovery assessment requires review because the progress history contains inconsistencies.</p>}<p className="panel-footnote">Remaining days are counted from the latest reporting date ({fmtDate(pr.reportingDate)}). Required productivity = remaining accomplishment ÷ remaining days.</p></div>
      <div className="panel actions-panel"><div className="panel-heading"><div><h3>Recommended corrective actions</h3><p>Potential actions — not guarantees of recovery</p></div></div><ul className="action-list">{pr.recommendations.map((a,i)=><li key={i}><span className="action-icon"><ChevronRight size={14}/></span>{a}</li>)}</ul></div>
    </div>
    <div className="panel detail-panel"><div className="panel-heading"><div><h3>Prediction Calculation Details</h3><p>Formulas and assumptions explained in plain language</p></div></div><div className="formula-list two-col">
      <div><span>Progress gap</span><strong>{gapText}</strong><small>Actual accomplishment minus planned accomplishment. A negative value means the project is behind the reported plan.</small></div>
      <div><span>Recent productivity</span><strong>{recentRateText}</strong><small>Change in actual accomplishment divided by elapsed calendar days across the most recent {rules.recentWindowDays}-day window. Used first (Priority 1) whenever it is positive.</small></div>
      <div><span>Historical productivity</span><strong>{historicalRateText}</strong><small>Rate from reports older than the recent window. Used as a provisional fallback (Priority 2) when recent productivity is zero or negative, or when the window holds fewer than two reports.</small></div>
      <div><span>Rate used for forecast</span><strong>{rateUsedText}</strong><small>{pr.rate!=null?`Source: ${pr.rateSource}. The completion date is calculated from this rate.`:'No positive rate is available, so the completion date is withheld.'}</small></div>
      <div><span>Remaining work</span><strong>{pr.remainingWork!=null?`${pr.remainingWork}%`:'—'}</strong><small>100% minus actual accomplishment.</small></div>
      <div><span>Estimated remaining duration</span><strong>{pr.daysRemaining!=null?`${pr.daysRemaining} calendar days`:'—'}</strong><small>Remaining work divided by current daily productivity, rounded up. Reporting date used: {fmtDate(pr.reportingDate)}.</small></div>
      <div><span>Estimated completion date</span><strong>{pr.estimatedDate?fmtDate(pr.estimatedDate):'Not available'}</strong><small>Reporting date plus estimated remaining duration. Shown only when a positive productivity rate is available; withheld when productivity is zero, negative, and no positive historical rate exists.</small></div>
      <div><span>Estimated delay</span><strong>{pr.delayDays!=null?(pr.delayDays>0?`${pr.delayDays} calendar days`:'0 days (on or ahead of target)'):'Not available'}</strong><small>Estimated completion date minus the target completion date ({fmtDate(selected.targetDate)}). All durations use calendar days; holidays, weekends, and work schedules are not tracked.</small></div>
      <div><span>Workforce availability</span><strong>{availabilityText}</strong><small>Actual workers present divided by expected workers, as a percentage. Supporting indicator only: it never changes the productivity rate or the completion date. Availability below {rules.workforceShortagePct}% flags a significant shortage; below {rules.workforceSevereShortagePct}% raises the minimum risk level to Moderate.</small></div>
      <div><span>Productivity trend</span><strong>{pr.trend}</strong><small>Compares the average rate of the recent half of dated reports with the earlier half once at least {rules.minReportsTrend} reports exist. Below {Math.round(rules.trendSlowdownRatio*100)}% of the earlier rate is Slowing, above {Math.round(rules.trendSpeedupRatio*100)}% is Accelerating, otherwise Stable. A slowing trend raises the minimum risk level.</small></div>
      <div><span>Risk classification rules</span><strong>{pr.risk}</strong><small>High risk: progress gap of {rules.gapHigh} pp or worse, or an estimated delay over {rules.delayHighDays} days. Moderate: gap worse than {rules.gapModerate} pp or delay over {rules.delayModerateDays} days. Low: gap worse than 0 or any projected delay. Workforce shortages and a slowing trend raise the minimum level, and a disruption recorded on the latest report flags at least low risk.</small></div>
      <div><span>Recovery feasibility</span><strong>{rec.label}</strong><small>Required productivity (remaining accomplishment ÷ remaining days) compared with observed productivity. Equal or lower than observed is Recoverable at current pace; up to {Math.round((rules.recoveryFeasibleMaxRatio-1)*100)}% above observed is Recovery required; higher, a passed deadline, or a deadline within {rules.recoveryImminentDays} days with more than {rules.recoveryImminentRemainingPct}% work remaining is At high risk. Missing history or deadline yields Unable to determine.</small></div>
      <div><span>Data reliability</span><strong>{pr.reliability?pr.reliability.title:forecastLabel}</strong><small>{pr.reliability?pr.reliability.message:`${rules.minReportsReliable} or more valid dated reports are required for a non-provisional estimate.`}{pr.fellBack?' The estimate uses a fallback rate and should be treated as provisional.':''}</small></div>
    </div></div>
    <div className="prototype-note"><AlertTriangle size={17}/><span><strong>Forecast limitation:</strong> This prototype uses calendar-day approximations and simple constant-rate assumptions. It does not account for holidays, critical-path dependencies, approved schedule revisions, or productivity changes caused by workforce levels. Forecasts are estimates and have not been validated against actual project outcomes. Treat them as decision support, not guarantees.</span></div>
  </>;
}
function ExportPage({projects,predictions,onExport}) {
  return <><SectionTitle eyebrow="DOCUMENTS" title="Reports & exports" description="Export a snapshot of current progress and prediction results for review." action={<button className="btn btn-primary" onClick={onExport}><Download size={17}/> Export CSV</button>}/><div className="export-card"><div className="export-illustration"><FileText size={34}/></div><div className="export-copy"><h3>Project monitoring summary</h3><p>Includes project ID, project name, planned and actual accomplishment, progress gap, workforce availability, recent daily productivity, productivity trend, remaining work, estimated completion date, estimated delay, risk status, forecast status, and risk reasons.</p><button className="btn btn-primary" onClick={onExport}><Download size={16}/> Download CSV report</button></div></div><div className="panel table-panel"><div className="panel-heading"><div><h3>Export preview</h3><p>{projects.length} projects included in the current snapshot</p></div></div><ProjectTable projects={projects} predictions={predictions} onSelect={()=>{}}/></div></>;
}
function Modal({title,children,onClose}) { return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="modal"><div className="modal-heading"><h2>{title}</h2><button className="icon-btn" onClick={onClose}><X size={19}/></button></div>{children}</div></div>; }

createRoot(document.getElementById('root')).render(<App/>);
