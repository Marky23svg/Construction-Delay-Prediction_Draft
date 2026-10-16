import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  LayoutDashboard, Building2, ClipboardList, ChartNoAxesCombined, FileText,
  Settings, Search, Bell, Plus, CalendarDays, Users, TrendingUp, AlertTriangle,
  CheckCircle2, Clock3, ArrowUpRight, Menu, X, HardHat, ChevronRight, Download,
  CircleHelp, Activity, Filter, MoreHorizontal, Trash2, Pencil, Save, RotateCcw
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from 'recharts';
import './styles.css';

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDays = (date, days) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const fmtDate = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const fmtShort = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
const initialProjects = [
  { id: 'CP-2026-001', name: 'Riverside Residences', client: 'Riverside Development Corp.', location: 'Quezon City', startDate: '2026-08-01', targetDate: '2026-12-30', planned: 60, actual: 42, plannedWorkers: 24, actualWorkers: 20, status: 'Active', notes: 'Second-floor structural works' },
  { id: 'CP-2026-002', name: 'Northgate Commercial Center', client: 'Northgate Properties', location: 'Marikina City', startDate: '2026-06-15', targetDate: '2026-11-20', planned: 72, actual: 68, plannedWorkers: 30, actualWorkers: 29, status: 'Active', notes: 'MEP installation and finishing' },
  { id: 'CP-2026-003', name: 'Greenfield Warehouse', client: 'Greenfield Logistics', location: 'Antipolo City', startDate: '2026-09-01', targetDate: '2027-02-15', planned: 25, actual: 19, plannedWorkers: 18, actualWorkers: 13, status: 'Active', notes: 'Foundation and ground preparation' },
  { id: 'CP-2026-004', name: 'Barangay Hall Renovation', client: 'Local Government Unit', location: 'Cainta, Rizal', startDate: '2026-05-01', targetDate: '2026-10-25', planned: 100, actual: 100, plannedWorkers: 12, actualWorkers: 0, status: 'Completed', notes: 'Final inspection completed' },
];
const initialReports = [
  { id: 1, projectId: 'CP-2026-001', date: '2026-10-10', planned: 57, actual: 39, workers: 19, remarks: 'Rain affected outdoor works.' },
  { id: 2, projectId: 'CP-2026-001', date: '2026-10-13', planned: 59, actual: 41, workers: 20, remarks: 'Structural work resumed.' },
  { id: 3, projectId: 'CP-2026-001', date: '2026-10-16', planned: 60, actual: 42, workers: 20, remarks: 'Materials delivered.' },
  { id: 4, projectId: 'CP-2026-002', date: '2026-10-16', planned: 72, actual: 68, workers: 29, remarks: 'Progress within expected range.' },
  { id: 5, projectId: 'CP-2026-003', date: '2026-10-16', planned: 25, actual: 19, workers: 13, remarks: 'Waiting for additional workers.' },
];

function predict(project, reports) {
  const gap = Number(project.actual) - Number(project.planned);
  const related = reports.filter(r => r.projectId === project.id).sort((a,b) => a.date.localeCompare(b.date));
  let rate = null;
  if (related.length >= 2) {
    const first = related[0], last = related[related.length - 1];
    const elapsed = Math.max(0, (new Date(`${last.date}T12:00:00`) - new Date(`${first.date}T12:00:00`)) / 86400000);
    if (elapsed > 0) {
      const daily = (Number(last.actual) - Number(first.actual)) / elapsed;
      if (daily > 0) rate = daily;
    }
  }
  // If there is not enough report history, use a provisional estimate from the project duration.
  if (rate === null) {
    const elapsed = Math.max(1, (new Date(`${todayISO()}T12:00:00`) - new Date(`${project.startDate}T12:00:00`)) / 86400000);
    const observed = Number(project.actual) / elapsed;
    if (observed > 0) rate = observed;
  }
  let daysRemaining = rate && Number(project.actual) < 100 ? Math.ceil((100 - Number(project.actual)) / rate) : 0;
  const estimatedDate = rate && Number(project.actual) < 100 ? addDays(todayISO(), daysRemaining) : project.targetDate;
  const delayDays = Math.max(0, Math.round((new Date(`${estimatedDate}T12:00:00`) - new Date(`${project.targetDate}T12:00:00`)) / 86400000));
  let risk = 'On track';
  if (Number(project.actual) >= 100 || project.status === 'Completed') risk = 'Completed';
  else if (gap <= -15 || delayDays > 30) risk = 'High risk';
  else if (gap < -5 || delayDays > 7) risk = 'Moderate';
  else if (gap < 0 || delayDays > 0) risk = 'Low risk';
  return { gap, rate, daysRemaining, estimatedDate, delayDays, risk, reportCount: related.length };
}

function loadState(key, fallback) {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}
function App() {
  const [projects, setProjects] = useState(() => loadState('buildtrack-projects', initialProjects));
  const [reports, setReports] = useState(() => loadState('buildtrack-reports', initialReports));
  const [page, setPage] = useState('Dashboard');
  const [query, setQuery] = useState('');
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedProject, setSelectedProject] = useState('CP-2026-001');
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState('');
  const [projectForm, setProjectForm] = useState({ name: '', client: '', location: '', startDate: todayISO(), targetDate: addDays(todayISO(), 90), planned: 0, actual: 0, plannedWorkers: 10, actualWorkers: 10, notes: '' });
  const [reportForm, setReportForm] = useState({ projectId: 'CP-2026-001', date: todayISO(), planned: 0, actual: 0, workers: 0, remarks: '' });

  React.useEffect(() => { localStorage.setItem('buildtrack-projects', JSON.stringify(projects)); }, [projects]);
  React.useEffect(() => { localStorage.setItem('buildtrack-reports', JSON.stringify(reports)); }, [reports]);
  React.useEffect(() => {
    if (toast) { const id = setTimeout(() => setToast(''), 2800); return () => clearTimeout(id); }
  }, [toast]);

  const predictions = useMemo(() => Object.fromEntries(projects.map(p => [p.id, predict(p, reports)])), [projects, reports]);
  const active = projects.filter(p => p.status !== 'Completed');
  const highRisk = active.filter(p => ['High risk', 'Moderate'].includes(predictions[p.id]?.risk));
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
    const report = { ...reportForm, id: Date.now(), planned: Number(reportForm.planned), actual: Number(reportForm.actual), workers: Number(reportForm.workers) };
    setReports(prev => [...prev, report]);
    setProjects(prev => prev.map(item => item.id === p.id ? { ...item, planned: report.planned, actual: report.actual, actualWorkers: report.workers, status: report.actual >= 100 ? 'Completed' : 'Active' } : item));
    setSelectedProject(p.id);
    setShowReportForm(false);
    notify('Progress report saved and prediction refreshed.');
  };
  const exportCSV = () => {
    const rows = [['Project ID','Project','Planned %','Actual %','Gap (pp)','Risk','Estimated completion','Estimated delay days'], ...projects.map(p => {
      const pr = predictions[p.id]; return [p.id,p.name,p.planned,p.actual,pr.gap,pr.risk,pr.estimatedDate,pr.delayDays];
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
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={18}/></div><strong>Need a hand?</strong><p>Review the prototype guide to understand how forecasts are calculated.</p><button onClick={() => notify('Forecasts are estimates based on progress history and simple assumptions.')}>View guide <ChevronRight size={14}/></button></div><div className="profile"><div className="avatar">MC</div><div className="profile-info"><strong>Mark Canuel</strong><small>Project Administrator</small></div><MoreHorizontal size={18} className="muted"/></div></div>
    </aside>
    {mobileNav && <div className="scrim" onClick={() => setMobileNav(false)} />}
    <main className="main">
      <header className="topbar"><button className="icon-btn menu-btn" onClick={() => setMobileNav(true)}><Menu size={20}/></button><div className="breadcrumb">Workspace <ChevronRight size={14}/> <strong>{page}</strong></div><div className="top-actions"><div className="search-box"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search projects..." /></div><button className="icon-btn notification" onClick={() => {setPage('Delay Predictions');notify(`${highRisk.length} active project(s) flagged moderate or high risk.`)}}><Bell size={18}/>{highRisk.length>0&&<i/>}</button><div className="top-avatar">MC</div></div></header>
      <div className="page-content">
        {page==='Dashboard' && <Dashboard projects={projects} active={active} predictions={predictions} avgProgress={avgProgress} highRisk={highRisk} chartData={dashboardChart} onAdd={openNewProject} onPage={setPage} onSelect={(id)=>{setSelectedProject(id);setPage('Delay Predictions')}} />}
        {page==='Projects' && <ProjectsPage projects={filtered} predictions={predictions} onAdd={openNewProject} onEdit={editProject} onSelect={(id)=>{setSelectedProject(id);setPage('Delay Predictions')}} />}
        {page==='Progress Reports' && <ReportsPage reports={reports} projects={projects} onAdd={() => {setReportForm({ projectId: projects[0]?.id || '', date: todayISO(), planned: projects[0]?.planned || 0, actual: projects[0]?.actual || 0, workers: projects[0]?.actualWorkers || 0, remarks: '' });setShowReportForm(true)}} />}
        {page==='Delay Predictions' && <PredictionsPage projects={projects} predictions={predictions} selected={selected} selectedProject={selectedProject} setSelectedProject={setSelectedProject} selectedReports={selectedReports} chartData={chartData} onReport={() => {setReportForm({projectId:selected?.id || '',date:todayISO(),planned:selected?.planned||0,actual:selected?.actual||0,workers:selected?.actualWorkers||0,remarks:''});setShowReportForm(true)}} />}
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
      <Field label="Construction project *" wide><select required value={reportForm.projectId} onChange={e=>{const p=projects.find(x=>x.id===e.target.value);setReportForm({...reportForm,projectId:e.target.value,planned:p?.planned||0,actual:p?.actual||0,workers:p?.actualWorkers||0})}}>{projects.filter(p=>p.status!=='Completed').map(p=><option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}</select></Field>
      <Field label="Reporting date *"><input type="date" required value={reportForm.date} onChange={e=>setReportForm({...reportForm,date:e.target.value})}/></Field>
      <Field label="Planned accomplishment (%)"><input type="number" min="0" max="100" required value={reportForm.planned} onChange={e=>setReportForm({...reportForm,planned:e.target.value})}/></Field>
      <Field label="Actual accomplishment (%)"><input type="number" min="0" max="100" required value={reportForm.actual} onChange={e=>setReportForm({...reportForm,actual:e.target.value})}/></Field>
      <Field label="Workers present"><input type="number" min="0" required value={reportForm.workers} onChange={e=>setReportForm({...reportForm,workers:e.target.value})}/></Field>
      <Field label="Site observations / issues" wide><textarea rows="3" value={reportForm.remarks} onChange={e=>setReportForm({...reportForm,remarks:e.target.value})} placeholder="Weather, materials, labor, work completed..."/></Field>
      <div className="form-actions"><button type="button" className="btn btn-light" onClick={()=>setShowReportForm(false)}>Cancel</button><button className="btn btn-primary" type="submit"><Save size={16}/> Save progress report</button></div>
    </form></Modal>}
    {toast && <div className="toast"><CheckCircle2 size={18}/>{toast}</div>}
  </div>;
}

function Field({label, children, wide}) { return <label className={`field ${wide?'field-wide':''}`}><span>{label}</span>{children}</label>; }
function SectionTitle({eyebrow, title, description, action}) { return <div className="section-title"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description&&<p>{description}</p>}</div>{action}</div>; }
function Metric({label,value,sub,icon:Icon,tone='blue',trend}) { return <div className="metric-card"><div className={`metric-icon ${tone}`}><Icon size={19}/></div><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-sub">{trend&&<span className="trend"><ArrowUpRight size={13}/>{trend}</span>}{sub}</div></div>; }
function RiskPill({risk}) { const cls = risk==='Completed'?'completed':risk==='On track'?'on-track':risk==='Low risk'?'low':risk==='Moderate'?'moderate':'high'; return <span className={`risk-pill ${cls}`}><i/>{risk}</span>; }
function Progress({value}) { return <div className="progress-wrap"><div className="progress-track"><div className={`progress-fill ${value<30?'orange':''}`} style={{width:`${Math.max(0,Math.min(100,value))}%`}}/></div><span>{value}%</span></div>; }
function Dashboard({projects,active,predictions,avgProgress,highRisk,chartData,onAdd,onPage,onSelect}) {
  return <><SectionTitle eyebrow="OVERVIEW" title="Project dashboard" description="Monitor construction progress and identify schedule risks across your projects." action={<button className="btn btn-primary" onClick={onAdd}><Plus size={17}/> New project</button>}/>
    <div className="metric-grid"><Metric label="Active projects" value={active.length} sub={`${projects.length} total projects`} icon={Building2} tone="blue"/><Metric label="Average completion" value={`${avgProgress}%`} sub="Across active projects" icon={TrendingUp} tone="green"/><Metric label="Projects at risk" value={highRisk.length} sub="Moderate or high risk" icon={AlertTriangle} tone="orange"/><Metric label="Completed projects" value={projects.filter(p=>p.status==='Completed').length} sub="Successfully completed" icon={CheckCircle2} tone="purple"/></div>
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
  return <><SectionTitle eyebrow="SITE UPDATES" title="Progress reports" description="Record and review periodic accomplishment updates submitted by site engineers." action={<button className="btn btn-primary" onClick={onAdd}><Plus size={17}/> New report</button>}/><div className="metric-grid compact"><Metric label="Total reports" value={reports.length} sub="Saved in this prototype" icon={ClipboardList}/><Metric label="Reporting projects" value={new Set(reports.map(r=>r.projectId)).size} sub="With progress history" icon={Building2} tone="green"/><Metric label="Latest update" value={list[0]?fmtShort(list[0].date):'—'} sub="Most recent report date" icon={CalendarDays} tone="purple"/></div><div className="panel table-panel"><div className="panel-heading"><div><h3>Report history</h3><p>Progress updates by project and reporting date</p></div></div><div className="table-scroll"><table><thead><tr><th>REPORT DATE</th><th>PROJECT</th><th>PLANNED</th><th>ACTUAL</th><th>WORKERS</th><th>SITE REMARKS</th></tr></thead><tbody>{list.map(r=><tr key={r.id}><td>{fmtDate(r.date)}</td><td><strong>{projects.find(p=>p.id===r.projectId)?.name||r.projectId}</strong></td><td>{r.planned}%</td><td><Progress value={r.actual}/></td><td>{r.workers}</td><td className="remarks-cell">{r.remarks||'—'}</td></tr>)}</tbody></table>{!list.length&&<div className="empty-state">No reports yet. Submit a progress report to begin tracking project history.</div>}</div></div></>;
}
function PredictionsPage({projects,predictions,selected,selectedProject,setSelectedProject,selectedReports,chartData,onReport}) {
  if (!selected) return <><SectionTitle eyebrow="FORECASTING" title="Delay predictions" description="Add a project to generate an initial schedule risk assessment."/></>;
  const pr=predictions[selected.id];
  return <><SectionTitle eyebrow="FORECASTING" title="Delay predictions" description="Transparent, rule-based forecasts based on the latest progress information." action={<button className="btn btn-primary" onClick={onReport}><Plus size={17}/> Add progress report</button>}/>
    <div className="prediction-toolbar"><label className="select-project"><span>Selected project</span><select value={selectedProject} onChange={e=>setSelectedProject(e.target.value)}>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><RiskPill risk={pr.risk}/></div>
    <div className="prediction-hero"><div className="prediction-hero-copy"><div className="eyebrow light">CURRENT FORECAST</div><h2>{pr.risk==='Completed'?'Project completed':pr.delayDays>0?`${pr.delayDays} calendar days projected late`:'No delay currently projected'}</h2><p>Based on the current reported progress and a simple constant-rate assumption.</p><div className="hero-meta"><span><CalendarDays size={15}/> Target: {fmtDate(selected.targetDate)}</span><span><Clock3 size={15}/> Estimate: {fmtDate(pr.estimatedDate)}</span></div></div><div className="hero-progress"><div className="hero-ring"><strong>{selected.actual}%</strong><span>complete</span></div></div></div>
    <div className="metric-grid"><Metric label="Planned accomplishment" value={`${selected.planned}%`} sub="At latest reporting point" icon={CalendarDays} tone="blue"/><Metric label="Actual accomplishment" value={`${selected.actual}%`} sub="Latest submitted progress" icon={Activity} tone="green"/><Metric label="Progress gap" value={`${pr.gap>0?'+':''}${pr.gap} pp`} sub="Actual minus planned" icon={TrendingUp} tone={pr.gap<0?'orange':'green'}/><Metric label="Estimated remaining" value={selected.actual>=100?'0 days':`${pr.daysRemaining} days`} sub={pr.rate?`${pr.rate.toFixed(2)} pp/day observed`:'Rate unavailable'} icon={Clock3} tone="purple"/></div>
    <div className="dashboard-grid"><div className="panel chart-panel"><div className="panel-heading"><div><h3>Progress history</h3><p>Planned and actual accomplishment by report</p></div></div>{chartData.length>=1?<div className="chart-area tall"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{top:10,right:15,left:-20,bottom:0}}><defs><linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2d65d5" stopOpacity={0.2}/><stop offset="100%" stopColor="#2d65d5" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f5"/><XAxis dataKey="date" tick={{fontSize:11,fill:'#7b8497'}} axisLine={false} tickLine={false}/><YAxis domain={[0,100]} tick={{fontSize:11,fill:'#7b8497'}} axisLine={false} tickLine={false}/><Tooltip/><Area type="monotone" dataKey="Planned" stroke="#9aaed9" strokeWidth={2} fill="transparent" strokeDasharray="5 4"/><Area type="monotone" dataKey="Actual" stroke="#2d65d5" strokeWidth={2.5} fill="url(#actualFill)"/></AreaChart></ResponsiveContainer></div>:<div className="empty-state"><Activity size={28}/><strong>No progress history</strong><span>Submit more reports to establish a reliable progress trend.</span></div>}</div>
      <div className="panel"><div className="panel-heading"><div><h3>Prediction details</h3><p>How this result was calculated</p></div></div><div className="formula-list"><div><span>Progress gap</span><strong>{pr.gap} percentage points</strong><small>Actual accomplishment − planned accomplishment</small></div><div><span>Observed progress rate</span><strong>{pr.rate?`${pr.rate.toFixed(2)} pp/day`:'Not available'}</strong><small>Based on first and latest dated reports, or a provisional rate</small></div><div><span>Estimated completion</span><strong>{fmtDate(pr.estimatedDate)}</strong><small>Assumes the observed rate continues</small></div><div><span>Reports available</span><strong>{pr.reportCount}</strong><small>{pr.reportCount<2?'More dated reports are needed for trend-based forecasting.':'Forecast uses the available report history.'}</small></div></div></div></div>
    <div className="prototype-note"><AlertTriangle size={17}/><span><strong>Forecast limitation:</strong> This prototype uses calendar-day approximations and simple progress-rate assumptions. It does not account for holidays, critical-path dependencies, weather, materials, or approved schedule revisions. Treat the result as an estimate, not a guarantee.</span></div>
  </>;
}
function ExportPage({projects,predictions,onExport}) {
  return <><SectionTitle eyebrow="DOCUMENTS" title="Reports & exports" description="Export a snapshot of current progress and prediction results for review." action={<button className="btn btn-primary" onClick={onExport}><Download size={17}/> Export CSV</button>}/><div className="export-card"><div className="export-illustration"><FileText size={34}/></div><div className="export-copy"><h3>Project monitoring summary</h3><p>Includes project ID, project name, planned and actual accomplishment, progress gap, risk status, estimated completion date, and estimated delay days.</p><button className="btn btn-primary" onClick={onExport}><Download size={16}/> Download CSV report</button></div></div><div className="panel table-panel"><div className="panel-heading"><div><h3>Export preview</h3><p>{projects.length} projects included in the current snapshot</p></div></div><ProjectTable projects={projects} predictions={predictions} onSelect={()=>{}}/></div></>;
}
function Modal({title,children,onClose}) { return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="modal"><div className="modal-heading"><h2>{title}</h2><button className="icon-btn" onClick={onClose}><X size={19}/></button></div>{children}</div></div>; }

createRoot(document.getElementById('root')).render(<App/>);
