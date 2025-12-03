import { useAnalytics } from '../hooks/useAnalytics';
import { StatCard } from '../components/StatCard';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import './Dashboard.css';

const COLORS = ['#094579', '#6894db', '#fd337d', '#4caf50', '#ff9800'];

export function Dashboard() {
  const { data, loading, error } = useAnalytics();

  if (loading) {
    return <div className="loading">Loading analytics...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  if (!data) {
    return <div className="error">No data available</div>;
  }

  const totalRooms = data.departmentSummaries.reduce((sum, d) => sum + d.totalRooms, 0);
  const totalCapacity = data.departmentSummaries.reduce((sum, d) => sum + d.totalCapacity, 0);
  const latestTerm = data.termSummaries[data.termSummaries.length - 1];

  // Prepare enrollment trend data
  const enrollmentByTerm = data.termSummaries.map((t) => ({
    term: `Fall ${t.term === '2237' ? '2023' : t.term === '2247' ? '2024' : '2025'}`,
    sections: t.totalSections,
    enrollment: t.totalEnrollment,
    avgSize: t.avgClassSize,
  }));

  // Prepare instruction mode data for latest term
  const instructionModeData = [
    { name: 'In Person', value: latestTerm.inPersonPercent },
    { name: 'Blended', value: latestTerm.blendedPercent },
  ];

  // Department comparison
  const deptData = data.departmentSummaries.map((d) => ({
    department: d.department,
    rooms: d.totalRooms,
    capacity: d.totalCapacity,
    sections: d.totalSections,
    utilization: d.avgUtilization || 0,
  }));

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>Classroom Analytics Dashboard</h2>
        <p className="dashboard-subtitle">
          Overview of classroom utilization across Fall 2023, 2024, and 2025 semesters
        </p>
      </div>

      <div className="stats-grid">
        <StatCard title="Total Rooms" value={totalRooms} subtitle="Across 3 departments" />
        <StatCard title="Total Capacity" value={totalCapacity} subtitle="Available seats" />
        <StatCard
          title="Current Sections"
          value={latestTerm.totalSections}
          subtitle={`Fall 2025 (Term ${latestTerm.term})`}
        />
        <StatCard
          title="Avg Class Size"
          value={latestTerm.avgClassSize}
          subtitle="Students per section"
        />
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3>Enrollment Trends by Term</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={enrollmentByTerm}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="term" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="sections"
                stroke="#094579"
                strokeWidth={2}
                name="Sections"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="enrollment"
                stroke="#fd337d"
                strokeWidth={2}
                name="Total Enrollment"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Instruction Mode Distribution (Fall 2025)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={instructionModeData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {instructionModeData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card full-width">
          <h3>Department Comparison</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={deptData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="department" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="rooms" fill="#094579" name="Rooms" />
              <Bar yAxisId="left" dataKey="capacity" fill="#6894db" name="Capacity" />
              <Bar yAxisId="right" dataKey="sections" fill="#fd337d" name="Sections (All Terms)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="insights-section">
        <h3>Key Insights</h3>
        <div className="insights-grid">
          <div className="insight-card">
            <h4>Architecture Department</h4>
            <p>
              Using room 8217 (Technology) as overflow. Need to validate requirement for
              additional 20+ seat drafting room.
            </p>
          </div>
          <div className="insight-card">
            <h4>Technology Department</h4>
            <p>
              12 rooms with 363 total seats. Building 2 rooms planned to move to Building 6
              (floors 2-3) for Fall 2026.
            </p>
          </div>
          <div className="insight-card">
            <h4>Engineering Department</h4>
            <p>
              4 rooms with 94 seats. Review utilization to ensure room count matches enrollment
              needs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
