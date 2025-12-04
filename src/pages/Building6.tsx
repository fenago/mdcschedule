import { useState, useEffect } from 'react';
import { getBuilding6Analysis, type Building6Data, type TechnologyClass, type RoomUsageAnalysis } from '../services/api';
import { StatCard } from '../components/StatCard';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import './Building6.css';

export function Building6() {
  const [data, setData] = useState<Building6Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'candidates' | 'rooms' | 'architecture'>('overview');

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const analysisData = await getBuilding6Analysis();
        setData(analysisData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch Building 6 analysis');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return <div className="loading">Analyzing Building 6 planning data...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  if (!data) {
    return <div className="error">No data available</div>;
  }

  // Prepare instruction mode chart data
  const instrModeChartData = [
    { name: 'In-Person', value: data.instrModeBreakdown.inPerson, fill: '#094579' },
    { name: 'Blended', value: data.instrModeBreakdown.blended, fill: '#6894db' },
    { name: 'Online', value: data.instrModeBreakdown.online, fill: '#ccc' },
  ];

  // Prepare enrollment distribution chart data
  const enrollmentChartData = Object.entries(data.summary.enrollmentDistribution).map(([key, bracket]) => ({
    name: bracket.label,
    count: bracket.count,
    fill: key === 'small' ? '#4caf50' : key === 'medium' ? '#6894db' : key === 'large' ? '#ff9800' : '#fd337d',
  }));

  const formatTime = (time: string | null) => {
    if (!time) return 'N/A';
    const hour = parseInt(time.substring(0, 2));
    const minute = time.substring(2, 4);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minute} ${ampm}`;
  };

  const getInstrModeBadge = (mode: string) => {
    const labels: Record<string, string> = {
      P: 'In-Person',
      BL: 'Blended',
      OL: 'Online',
      RVS: 'Remote',
    };
    const classes: Record<string, string> = {
      P: 'badge-inperson',
      BL: 'badge-blended',
      OL: 'badge-online',
      RVS: 'badge-online',
    };
    return (
      <span className={`instr-badge ${classes[mode] || 'badge-online'}`}>
        {labels[mode] || mode}
      </span>
    );
  };

  const renderOverview = () => (
    <>
      <div className="stats-grid">
        <StatCard
          title="Building 2 Rooms"
          value={data.summary.currentTechnologyRooms.building2}
          subtitle={`${data.summary.currentCapacity.building2} seats`}
        />
        <StatCard
          title="Sections to Move"
          value={data.summary.sectionsToMove.total}
          subtitle="From Buildings 2 & 8"
        />
        <StatCard
          title="Proposed Capacity"
          value={data.summary.proposedCapacity.total}
          subtitle="Building 6 (8 rooms)"
        />
        <StatCard
          title="Fifth Room Needed?"
          value={data.summary.needsFifthRoom ? 'Yes' : 'No'}
          subtitle="Based on enrollment"
        />
      </div>

      <div className="charts-section">
        <div className="chart-card">
          <h3>Instruction Mode Breakdown</h3>
          <p className="chart-subtitle">Candidates for Building 6 by delivery mode</p>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={instrModeChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={100}
                dataKey="value"
              >
                {instrModeChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Enrollment Size Distribution</h3>
          <p className="chart-subtitle">Sections grouped by class size</p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={enrollmentChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" name="Sections">
                {enrollmentChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="proposed-layout">
        <h3>Proposed Building 6 Configuration</h3>
        <div className="floor-grid">
          <div className="floor-card floor-3">
            <h4>3rd Floor</h4>
            <div className="room-list">
              {data.proposedBuilding6.floor3.rooms.map((room) => (
                <div key={room.id} className="proposed-room">
                  <span className="room-name">{room.id}</span>
                  <span className="room-cap">{room.capacity} seats</span>
                  <span className="room-type">{room.designation}</span>
                </div>
              ))}
            </div>
            <div className="floor-total">
              Total: {data.proposedBuilding6.floor3.totalCapacity} seats
            </div>
          </div>

          <div className="floor-card floor-2">
            <h4>2nd Floor</h4>
            <div className="room-list">
              {data.proposedBuilding6.floor2.rooms.map((room) => (
                <div key={room.id} className="proposed-room">
                  <span className="room-name">{room.id}</span>
                  <span className="room-cap">{room.capacity} seats</span>
                  <span className="room-type">{room.designation}</span>
                </div>
              ))}
            </div>
            <div className="floor-total">
              Total: {data.proposedBuilding6.floor2.totalCapacity} seats
            </div>
          </div>

          <div className="floor-card floor-1">
            <h4>1st Floor - AI Commons</h4>
            <div className="room-list">
              {data.proposedBuilding6.floor1.rooms.map((room) => (
                <div key={room.id} className="proposed-room ai-commons">
                  <span className="room-name">{room.id}</span>
                  <span className="room-cap">{room.capacity} seats</span>
                  <span className="room-type">{room.designation}</span>
                </div>
              ))}
            </div>
            {data.proposedBuilding6.floor1.note && (
              <div className="floor-note">{data.proposedBuilding6.floor1.note}</div>
            )}
          </div>
        </div>
      </div>

      <div className="notes-section">
        <h3>Planning Notes</h3>
        <ul>
          {data.notes.map((note, index) => (
            <li key={index}>{note}</li>
          ))}
        </ul>
      </div>
    </>
  );

  const renderCandidates = () => (
    <div className="table-section">
      <div className="table-header">
        <h3>Technology Classes - Building 6 Candidates</h3>
        <p className="table-subtitle">
          Classes from Buildings 2 & 8 that would move to new Building 6 rooms
        </p>
      </div>

      <div className="table-container">
        <table className="building6-table">
          <thead>
            <tr>
              <th>Course</th>
              <th>Description</th>
              <th>Current Room</th>
              <th>Building</th>
              <th>Enrollment</th>
              <th>Days</th>
              <th>Time</th>
              <th>Mode</th>
            </tr>
          </thead>
          <tbody>
            {data.building6Candidates.map((section: TechnologyClass, index: number) => (
              <tr key={index} className={section.isBuilding2 ? 'row-building2' : 'row-building8'}>
                <td className="course-code">{section.course}</td>
                <td className="course-desc">{section.description}</td>
                <td className="room-id">{section.currentRoom || 'N/A'}</td>
                <td>
                  <span className={`building-badge ${section.isBuilding2 ? 'bldg-2' : 'bldg-8'}`}>
                    Bldg {section.isBuilding2 ? '2' : '8'}
                  </span>
                </td>
                <td className="number">{section.enrollment}</td>
                <td>{section.days || 'N/A'}</td>
                <td className="time">
                  {formatTime(section.startTime)} - {formatTime(section.endTime)}
                </td>
                <td>{getInstrModeBadge(section.instrMode)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderRooms = () => (
    <>
      <div className="current-rooms-section">
        <h3>Current Building 2 Technology Rooms</h3>
        <div className="room-analysis-grid">
          {data.currentRooms.building2.map((room: RoomUsageAnalysis) => (
            <div key={room.facilityId} className="room-analysis-card">
              <div className="room-analysis-header">
                <span className="room-id">Room {room.facilityId}</span>
                <span className="room-capacity">{room.capacity} seats</span>
              </div>
              <div className="room-analysis-details">
                <p><strong>Designation:</strong> {room.designation}</p>
                <p><strong>Total Sections:</strong> {room.totalSections}</p>
                <p><strong>In-Discipline:</strong> {room.inDisciplineSections}</p>
                <p><strong>Overflow:</strong> {room.overflowSections}</p>
                <p><strong>Avg Enrollment:</strong> {room.avgEnrollment}</p>
                <p><strong>Max Enrollment:</strong> {room.maxEnrollment}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="current-rooms-section">
        <h3>Current Building 8 Technology Rooms</h3>
        <div className="room-analysis-grid">
          {data.currentRooms.building8.map((room: RoomUsageAnalysis) => (
            <div key={room.facilityId} className="room-analysis-card building8">
              <div className="room-analysis-header">
                <span className="room-id">Room {room.facilityId}</span>
                <span className="room-capacity">{room.capacity} seats</span>
              </div>
              <div className="room-analysis-details">
                <p><strong>Designation:</strong> {room.designation}</p>
                <p><strong>Total Sections:</strong> {room.totalSections}</p>
                <p><strong>In-Discipline:</strong> {room.inDisciplineSections}</p>
                <p><strong>Overflow:</strong> {room.overflowSections}</p>
                <p><strong>Avg Enrollment:</strong> {room.avgEnrollment}</p>
                <p><strong>Max Enrollment:</strong> {room.maxEnrollment}</p>
              </div>
              {room.facilityId === '8216' && (
                <div className="room-note">Moving to Cybersecurity/Networking rooms</div>
              )}
              {room.facilityId === '8217' && (
                <div className="room-note">Currently used as Architecture overflow</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );

  const renderArchitecture = () => (
    <div className="table-section">
      <div className="table-header">
        <h3>Architecture Lecture Classes</h3>
        <p className="table-subtitle">
          Architecture classes NOT in drafting rooms (don't need drafting tables)
        </p>
      </div>

      <div className="table-container">
        <table className="building6-table">
          <thead>
            <tr>
              <th>Course</th>
              <th>Description</th>
              <th>Current Room</th>
              <th>Building</th>
              <th>Our Room?</th>
              <th>Enrollment</th>
              <th>Days</th>
              <th>Time</th>
              <th>Mode</th>
            </tr>
          </thead>
          <tbody>
            {data.architectureLectureClasses.map((section, index) => (
              <tr key={index} className={section.isOurRoom ? 'row-our-room' : 'row-external'}>
                <td className="course-code">{section.course}</td>
                <td className="course-desc">{section.description}</td>
                <td className="room-id">{section.currentRoom || 'N/A'}</td>
                <td>
                  <span className="building-badge">Bldg {section.building}</span>
                </td>
                <td>
                  <span className={`ownership-badge ${section.isOurRoom ? 'our-room' : 'external'}`}>
                    {section.isOurRoom ? 'Yes' : 'No'}
                  </span>
                </td>
                <td className="number">{section.enrollment}</td>
                <td>{section.days || 'N/A'}</td>
                <td className="time">
                  {formatTime(section.startTime)} - {formatTime(section.endTime)}
                </td>
                <td>{getInstrModeBadge(section.instrMode)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="building6">
      <div className="building6-header">
        <h2>Building 6 Planning</h2>
        <p className="building6-subtitle">
          Mapping current classroom usage to the new Building 6 configuration for Fall 2026
        </p>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab ${activeTab === 'candidates' ? 'active' : ''}`}
          onClick={() => setActiveTab('candidates')}
        >
          Building 6 Candidates ({data.building6Candidates.length})
        </button>
        <button
          className={`tab ${activeTab === 'rooms' ? 'active' : ''}`}
          onClick={() => setActiveTab('rooms')}
        >
          Current Rooms
        </button>
        <button
          className={`tab ${activeTab === 'architecture' ? 'active' : ''}`}
          onClick={() => setActiveTab('architecture')}
        >
          Architecture ({data.architectureLectureClasses.length})
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'candidates' && renderCandidates()}
        {activeTab === 'rooms' && renderRooms()}
        {activeTab === 'architecture' && renderArchitecture()}
      </div>
    </div>
  );
}
