import { useState, useEffect } from 'react';
import { getRecommendations, type RecommendationsData, type CourseRecommendation } from '../services/api';
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
} from 'recharts';
import './Recommendations.css';

export function Recommendations() {
  const [data, setData] = useState<RecommendationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'increase' | 'decrease' | 'maintain'>('all');
  const [sortBy, setSortBy] = useState<'enrollment' | 'growth' | 'sections'>('enrollment');

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const recommendations = await getRecommendations();
        setData(recommendations);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch recommendations');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return <div className="loading">Generating recommendations...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  if (!data) {
    return <div className="error">No data available</div>;
  }

  // Filter and sort course recommendations
  let filteredCourses = data.courseRecommendations;
  if (filter !== 'all') {
    filteredCourses = filteredCourses.filter(c => c.recommendation === filter);
  }

  filteredCourses = [...filteredCourses].sort((a, b) => {
    switch (sortBy) {
      case 'enrollment':
        return b.currentEnrollment - a.currentEnrollment;
      case 'growth':
        const growthA = a.growthRate ? parseFloat(a.growthRate) : 0;
        const growthB = b.growthRate ? parseFloat(b.growthRate) : 0;
        return growthB - growthA;
      case 'sections':
        return b.currentSections - a.currentSections;
      default:
        return 0;
    }
  });

  // Prepare chart data - top 15 courses by enrollment with projections
  const chartData = data.courseRecommendations
    .slice(0, 15)
    .map(c => ({
      course: c.course,
      current: c.currentSections,
      projected: c.projectedSections,
      change: c.projectedSections - c.currentSections,
    }));

  // Summary chart data
  const summaryChartData = [
    { name: 'Increase', value: data.summary.coursesToIncrease, fill: '#4caf50' },
    { name: 'Maintain', value: data.summary.coursesToMaintain, fill: '#094579' },
    { name: 'Decrease', value: data.summary.coursesToDecrease, fill: '#fd337d' },
  ];

  const getRecommendationBadge = (rec: CourseRecommendation) => {
    const classes = {
      increase: 'badge-increase',
      decrease: 'badge-decrease',
      maintain: 'badge-maintain',
    };
    const labels = {
      increase: 'Increase',
      decrease: 'Decrease',
      maintain: 'Maintain',
    };
    return (
      <span className={`recommendation-badge ${classes[rec.recommendation]}`}>
        {labels[rec.recommendation]}
      </span>
    );
  };

  return (
    <div className="recommendations">
      <div className="recommendations-header">
        <h2>Fall 2026 Scheduling Recommendations</h2>
        <p className="recommendations-subtitle">
          Projected course sections based on enrollment trends from Fall 2023-2025
        </p>
      </div>

      <div className="stats-grid">
        <StatCard
          title="Current Sections"
          value={data.summary.currentTotalSections}
          subtitle="Fall 2025"
        />
        <StatCard
          title="Projected Sections"
          value={data.summary.projectedTotalSections}
          subtitle="Fall 2026"
        />
        <StatCard
          title="Courses to Increase"
          value={data.summary.coursesToIncrease}
          subtitle="Growing enrollment"
        />
        <StatCard
          title="Courses to Decrease"
          value={data.summary.coursesToDecrease}
          subtitle="Declining enrollment"
        />
      </div>

      <div className="charts-section">
        <div className="chart-card">
          <h3>Section Projections - Top Courses</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="course" type="category" width={100} fontSize={12} />
              <Tooltip />
              <Legend />
              <Bar dataKey="current" fill="#094579" name="Current (Fall 2025)" />
              <Bar dataKey="projected" fill="#6894db" name="Projected (Fall 2026)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Recommendation Summary</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={summaryChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" name="Courses">
                {summaryChartData.map((entry, index) => (
                  <Bar key={`cell-${index}`} fill={entry.fill} dataKey="value" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="table-section">
        <div className="table-header">
          <h3>Course Recommendations</h3>
          <div className="table-controls">
            <div className="filter-group">
              <label>Filter:</label>
              <select value={filter} onChange={e => setFilter(e.target.value as typeof filter)}>
                <option value="all">All Courses</option>
                <option value="increase">Increase Only</option>
                <option value="decrease">Decrease Only</option>
                <option value="maintain">Maintain Only</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Sort by:</label>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}>
                <option value="enrollment">Enrollment</option>
                <option value="growth">Growth Rate</option>
                <option value="sections">Sections</option>
              </select>
            </div>
          </div>
        </div>

        <div className="table-container">
          <table className="recommendations-table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Description</th>
                <th>Recommendation</th>
                <th>Current Sections</th>
                <th>Projected Sections</th>
                <th>Enrollment (F25)</th>
                <th>Growth Rate</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {filteredCourses.map((course, index) => (
                <tr key={index} className={`row-${course.recommendation}`}>
                  <td className="course-code">{course.course}</td>
                  <td className="course-desc">{course.description}</td>
                  <td>{getRecommendationBadge(course)}</td>
                  <td className="number">{course.currentSections}</td>
                  <td className="number projected">
                    {course.projectedSections}
                    {course.projectedSections !== course.currentSections && (
                      <span className={course.projectedSections > course.currentSections ? 'change-up' : 'change-down'}>
                        {course.projectedSections > course.currentSections ? '+' : ''}
                        {course.projectedSections - course.currentSections}
                      </span>
                    )}
                  </td>
                  <td className="number">{course.currentEnrollment}</td>
                  <td className={`number ${course.growthRate && parseFloat(course.growthRate) > 0 ? 'positive' : course.growthRate && parseFloat(course.growthRate) < 0 ? 'negative' : ''}`}>
                    {course.growthRate ? `${course.growthRate}%` : 'N/A'}
                  </td>
                  <td className="reason">{course.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="room-section">
        <h3>Room Utilization Status</h3>
        <div className="room-grid">
          {data.roomRecommendations.map((room, index) => (
            <div key={index} className={`room-card room-${room.recommendation}`}>
              <div className="room-header">
                <span className="room-id">Room {room.facilityId}</span>
                <span className={`room-status status-${room.recommendation}`}>
                  {room.recommendation === 'optimal' ? 'Optimal' :
                   room.recommendation === 'underutilized' ? 'Underutilized' : 'At Capacity'}
                </span>
              </div>
              <div className="room-details">
                <p><strong>Department:</strong> {room.department}</p>
                <p><strong>Capacity:</strong> {room.capacity} seats</p>
                <p><strong>Type:</strong> {room.designation}</p>
                <p><strong>Sections:</strong> {room.sectionsScheduled}</p>
                <p><strong>Avg Enrollment:</strong> {room.avgEnrollment || 'N/A'}</p>
                <p><strong>Utilization:</strong> {room.utilizationRate ? `${room.utilizationRate}%` : 'N/A'}</p>
              </div>
              <p className="room-reason">{room.reason}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
