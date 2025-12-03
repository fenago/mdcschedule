import { useState, useEffect } from 'react';
import { getFacilities } from '../services/api';
import { useAnalytics } from '../hooks/useAnalytics';
import type { Facility } from '../types';
import './Rooms.css';

export function Rooms() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const { data: analytics, selectedTerm, changeTerm } = useAnalytics('2257'); // Default to Fall 2025

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getFacilities();
        setFacilities(data);
      } catch (error) {
        console.error('Error fetching facilities:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredFacilities = filter === 'all'
    ? facilities
    : facilities.filter((f) => f.department === filter);

  const departments = [...new Set(facilities.map((f) => f.department))];

  const getUtilization = (facilityId: string) => {
    if (!analytics?.roomUtilization) return null;
    return analytics.roomUtilization.find((r) => r.facilityId === facilityId);
  };

  if (loading) {
    return <div className="loading">Loading rooms...</div>;
  }

  const currentTermLabel = analytics?.availableTerms?.find(t => t.code === selectedTerm)?.label || 'All Terms';

  return (
    <div className="rooms-page">
      <div className="rooms-header">
        <h2>Classroom Facilities</h2>
        <div className="term-indicator">
          Data for: <strong>{currentTermLabel}</strong>
        </div>
        <div className="filter-controls">
          <label htmlFor="term-filter">Term:</label>
          <select
            id="term-filter"
            value={selectedTerm || 'all'}
            onChange={(e) => changeTerm(e.target.value)}
          >
            <option value="all">All Terms</option>
            {analytics?.availableTerms?.map((term) => (
              <option key={term.code} value={term.code}>{term.label}</option>
            ))}
          </select>
          <label htmlFor="dept-filter">Department:</label>
          <select
            id="dept-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All Departments</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="rooms-summary">
        <div className="summary-item">
          <span className="summary-label">Showing:</span>
          <span className="summary-value">{filteredFacilities.length} rooms</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Total Capacity:</span>
          <span className="summary-value">
            {filteredFacilities.reduce((sum, f) => sum + f.capacity, 0)} seats
          </span>
        </div>
      </div>

      <div className="rooms-table-container">
        <table className="rooms-table">
          <thead>
            <tr>
              <th>Room ID</th>
              <th>Department</th>
              <th>Capacity</th>
              <th>Designation</th>
              <th>Sections ({currentTermLabel})</th>
              <th>Avg Enrollment</th>
              <th>Utilization</th>
            </tr>
          </thead>
          <tbody>
            {filteredFacilities.map((facility) => {
              const util = getUtilization(facility.facilityId);
              const utilizationRate = util?.utilizationRate || 0;
              const utilizationClass = utilizationRate > 80
                ? 'high'
                : utilizationRate > 50
                ? 'medium'
                : 'low';

              return (
                <tr key={facility.id}>
                  <td className="room-id">{facility.facilityId}</td>
                  <td>
                    <span className={`dept-badge dept-${facility.department.toLowerCase()}`}>
                      {facility.department}
                    </span>
                  </td>
                  <td>{facility.capacity}</td>
                  <td>{facility.designation}</td>
                  <td>{util?.totalSections || 0}</td>
                  <td>{util?.avgEnrollment || '-'}</td>
                  <td>
                    <div className="utilization-bar-container">
                      <div
                        className={`utilization-bar ${utilizationClass}`}
                        style={{ width: `${Math.min(utilizationRate, 100)}%` }}
                      />
                      <span className="utilization-value">{utilizationRate}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rooms-legend">
        <h4>Utilization Legend</h4>
        <div className="legend-items">
          <div className="legend-item">
            <span className="legend-color high"></span>
            <span>High (&gt;80%)</span>
          </div>
          <div className="legend-item">
            <span className="legend-color medium"></span>
            <span>Medium (50-80%)</span>
          </div>
          <div className="legend-item">
            <span className="legend-color low"></span>
            <span>Low (&lt;50%)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
