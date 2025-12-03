import { useAnalytics } from '../hooks/useAnalytics';
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
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts';
import './Analysis.css';

export function Analysis() {
  const { data, loading, error } = useAnalytics();

  if (loading) {
    return <div className="loading">Loading analysis...</div>;
  }

  if (error || !data) {
    return <div className="error">Error loading data</div>;
  }

  // Room utilization scatter data
  const scatterData = data.roomUtilization.map((r) => ({
    x: r.capacity,
    y: r.avgEnrollment || 0,
    z: r.totalSections,
    name: r.facilityId,
    department: r.department,
  }));

  // Time slot heatmap data
  const timeSlotData = data.timeSlotAnalysis.reduce((acc, item) => {
    const existing = acc.find((a) => a.time === item.timeSlot);
    if (existing) {
      existing.count += item.sectionCount;
    } else {
      acc.push({ time: item.timeSlot, count: item.sectionCount });
    }
    return acc;
  }, [] as Array<{ time: string; count: number }>);

  // Enrollment trends by department
  const termDeptData: Record<string, Record<string, number>> = {};
  data.enrollmentTrends.forEach((t) => {
    if (!termDeptData[t.term]) {
      termDeptData[t.term] = {};
    }
    termDeptData[t.term][t.department] = t.totalEnrollment;
  });

  const enrollmentTrendData = Object.entries(termDeptData).map(([term, depts]) => ({
    term: `Fall ${term === '2237' ? '2023' : term === '2247' ? '2024' : '2025'}`,
    Architecture: depts['Architecture'] || 0,
    Engineering: depts['Engineering'] || 0,
    Technology: depts['Technology'] || 0,
  }));

  // Architecture overflow analysis (Room 8217)
  const room8217 = data.roomUtilization.find((r) => r.facilityId === '8217');

  // Calculate recommendations
  const underutilizedRooms = data.roomUtilization
    .filter((r) => r.utilizationRate && r.utilizationRate < 50)
    .sort((a, b) => (a.utilizationRate || 0) - (b.utilizationRate || 0));

  const highUtilizationRooms = data.roomUtilization
    .filter((r) => r.utilizationRate && r.utilizationRate > 80)
    .sort((a, b) => (b.utilizationRate || 0) - (a.utilizationRate || 0));

  return (
    <div className="analysis-page">
      <div className="analysis-header">
        <h2>Utilization Analysis</h2>
        <p className="analysis-subtitle">
          Deep dive into classroom usage patterns and recommendations
        </p>
      </div>

      <div className="analysis-section">
        <h3>Enrollment Trends by Department</h3>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={enrollmentTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="term" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="Architecture"
                stroke="#1565c0"
                strokeWidth={2}
                dot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="Engineering"
                stroke="#e65100"
                strokeWidth={2}
                dot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="Technology"
                stroke="#2e7d32"
                strokeWidth={2}
                dot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="analysis-section">
        <h3>Room Capacity vs Average Enrollment</h3>
        <p className="chart-description">
          Each bubble represents a room. Size indicates total sections scheduled.
        </p>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" name="Capacity" unit=" seats" />
              <YAxis dataKey="y" name="Avg Enrollment" unit=" students" />
              <ZAxis dataKey="z" range={[50, 400]} name="Sections" />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ payload }) => {
                  if (payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="custom-tooltip">
                        <p><strong>Room {data.name}</strong></p>
                        <p>Department: {data.department}</p>
                        <p>Capacity: {data.x} seats</p>
                        <p>Avg Enrollment: {data.y?.toFixed(1)}</p>
                        <p>Total Sections: {data.z}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter name="Rooms" data={scatterData} fill="#094579" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="analysis-section">
        <h3>Peak Usage Times</h3>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={timeSlotData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#094579" name="Sections" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="recommendations-section">
        <h3>Recommendations</h3>

        <div className="recommendation-card architecture">
          <h4>Architecture Department</h4>
          <div className="recommendation-content">
            <p><strong>Issue:</strong> Using Technology room 8217 as overflow</p>
            {room8217 && (
              <p>
                Room 8217 has hosted {room8217.totalSections} Architecture sections
                with avg enrollment of {room8217.avgEnrollment?.toFixed(1)} students.
              </p>
            )}
            <p><strong>Recommendation:</strong></p>
            <ul>
              <li>Data supports the need for an additional 20+ seat drafting room</li>
              <li>Consider converting one Technology classroom or building new space</li>
              <li>Prioritize drafting table configuration for Architecture needs</li>
            </ul>
          </div>
        </div>

        <div className="recommendation-card technology">
          <h4>Technology Department - Building 2 Migration</h4>
          <div className="recommendation-content">
            <p><strong>Current State:</strong> 12 rooms with 363 total seats in Building 2</p>
            <p><strong>Plan:</strong> Move to Building 6 (floors 2-3) with 4 classrooms holding 40 seats each</p>
            <p><strong>Analysis:</strong></p>
            <ul>
              <li>New capacity: 160 seats (4 × 40) - significant reduction from 363</li>
              <li>Need to identify which courses can consolidate or use other facilities</li>
              <li>Room 8216 (Networking) will move to dedicated Cybersecurity labs</li>
            </ul>
          </div>
        </div>

        <div className="recommendation-card efficiency">
          <h4>Underutilized Rooms</h4>
          <div className="recommendation-content">
            {underutilizedRooms.length > 0 ? (
              <ul>
                {underutilizedRooms.slice(0, 5).map((room) => (
                  <li key={room.facilityId}>
                    Room {room.facilityId} ({room.department}): {room.utilizationRate}% utilization
                    - {room.totalSections} sections, avg {room.avgEnrollment?.toFixed(1)} students
                  </li>
                ))}
              </ul>
            ) : (
              <p>No significantly underutilized rooms identified.</p>
            )}
          </div>
        </div>

        <div className="recommendation-card capacity">
          <h4>High Demand Rooms</h4>
          <div className="recommendation-content">
            {highUtilizationRooms.length > 0 ? (
              <ul>
                {highUtilizationRooms.slice(0, 5).map((room) => (
                  <li key={room.facilityId}>
                    Room {room.facilityId} ({room.department}): {room.utilizationRate}% utilization
                    - capacity {room.capacity}, avg {room.avgEnrollment?.toFixed(1)} students
                  </li>
                ))}
              </ul>
            ) : (
              <p>No rooms at critical capacity.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
