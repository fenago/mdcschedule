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
  const [activeTab, setActiveTab] = useState<'overview' | 'candidates' | 'rooms' | 'architecture' | 'insights'>('overview');

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

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'success': return 'finding-success';
      case 'validated': return 'finding-validated';
      case 'ready': return 'finding-ready';
      case 'warning': return 'finding-warning';
      case 'not_needed': return 'finding-neutral';
      default: return '';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return '\u2705';
      case 'validated': return '\u26A0\uFE0F';
      case 'ready': return '\u2705';
      case 'warning': return '\u26A0\uFE0F';
      case 'not_needed': return '\u2796';
      default: return '';
    }
  };

  const renderKeyFindings = () => {
    if (!data.keyFindings) return null;

    const findings = [
      {
        key: 'seatCapacity',
        title: 'Goal 1: Seat Capacity',
        finding: data.keyFindings.seatCapacity,
        details: `${data.keyFindings.seatCapacity.currentSeats} current → ${data.keyFindings.seatCapacity.proposedSeats} proposed (${data.keyFindings.seatCapacity.seatDifference >= 0 ? '+' : ''}${data.keyFindings.seatCapacity.seatDifference})`
      },
      {
        key: 'architectureOverflow',
        title: 'Goal 2: Architecture Overflow (8217)',
        finding: data.keyFindings.architectureOverflow,
        details: `${data.keyFindings.architectureOverflow.room8217Sections} sections in 8217 need drafting rooms`
      },
      {
        key: 'engineeringCapacity',
        title: 'Goal 3: Engineering Rooms',
        finding: data.keyFindings.engineeringCapacity,
        details: `${data.keyFindings.engineeringCapacity.totalRooms} rooms, ${data.keyFindings.engineeringCapacity.totalSections} sections (${data.keyFindings.engineeringCapacity.overCapacityRooms} over capacity)`
      },
      {
        key: 'technologyMigration',
        title: 'Goal 4: Technology Migration',
        finding: data.keyFindings.technologyMigration,
        details: `${data.keyFindings.technologyMigration.totalSectionsToMove} sections → ${data.keyFindings.technologyMigration.proposedRooms} rooms (${data.keyFindings.technologyMigration.fitAnalysis.over40} over 40 students)`
      },
      {
        key: 'cybersecurityMigration',
        title: 'Goal 5: Cybersecurity/Networking (8216)',
        finding: data.keyFindings.cybersecurityMigration,
        details: `${data.keyFindings.cybersecurityMigration.sectionsToMove} sections → Floor 1 Labs`
      }
    ];

    return (
      <div className="key-findings-section">
        <h3>Key Findings & Verdicts</h3>
        <div className="key-findings-grid">
          {findings.map(({ key, title, finding, details }) => (
            <div key={key} className={`key-finding-card ${getStatusClass(finding.status)}`}>
              <div className="finding-header">
                <span className="finding-icon">{getStatusIcon(finding.status)}</span>
                <h4>{title}</h4>
              </div>
              <div className="finding-goal">{finding.goal}</div>
              <div className="finding-details">{details}</div>
              <div className="finding-verdict">{finding.verdict}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderOverview = () => (
    <>
      {renderKeyFindings()}

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

  const getImpactBadge = (impact: 'fully_met' | 'partially_met' | 'not_addressed') => {
    const classes: Record<string, string> = {
      fully_met: 'impact-full',
      partially_met: 'impact-partial',
      not_addressed: 'impact-none',
    };
    const labels: Record<string, string> = {
      fully_met: 'Fully Met',
      partially_met: 'Partial',
      not_addressed: 'Not Addressed',
    };
    return <span className={`impact-badge ${classes[impact]}`}>{labels[impact]}</span>;
  };

  const getCostBadge = (cost: 'low' | 'medium' | 'high') => {
    const classes: Record<string, string> = {
      low: 'cost-low',
      medium: 'cost-medium',
      high: 'cost-high',
    };
    return <span className={`cost-badge ${classes[cost]}`}>{cost.charAt(0).toUpperCase() + cost.slice(1)}</span>;
  };

  const getTimeBadge = (time: 'immediate' | 'short_term' | 'long_term') => {
    const labels: Record<string, string> = {
      immediate: 'Immediate',
      short_term: 'Short Term',
      long_term: 'Long Term',
    };
    return <span className="time-badge">{labels[time]}</span>;
  };

  const renderActionableInsights = () => {
    if (!data.actionableOptions || data.actionableOptions.length === 0) {
      return <div className="loading">No actionable options available</div>;
    }

    return (
      <div className="insights-section">
        <div className="insights-header">
          <h3>Actionable Insights for Decision Makers</h3>
          <p className="insights-subtitle">
            Five strategic options for Building 6 planning, each with clear outcomes and trade-offs
          </p>
        </div>

        <div className="options-grid">
          {data.actionableOptions.map((option) => (
            <div
              key={option.id}
              className={`option-card ${option.recommendation === 'recommended' ? 'option-recommended' : option.recommendation === 'alternative' ? 'option-alternative' : 'option-not-recommended'}`}
            >
              <div className="option-header">
                <div className="option-id">{option.id}</div>
                <h4 className="option-name">{option.name}</h4>
                {option.recommendation === 'recommended' && (
                  <span className="recommendation-badge recommended">Recommended</span>
                )}
                {option.recommendation === 'alternative' && (
                  <span className="recommendation-badge alternative">Alternative</span>
                )}
                {option.recommendation === 'not_recommended' && (
                  <span className="recommendation-badge not-recommended">Not Recommended</span>
                )}
              </div>

              <p className="option-description">{option.description}</p>

              <div className="option-meta">
                <div className="meta-item">
                  <span className="meta-label">Cost:</span>
                  {getCostBadge(option.estimatedCost)}
                </div>
                <div className="meta-item">
                  <span className="meta-label">Timeline:</span>
                  {getTimeBadge(option.implementationTime)}
                </div>
              </div>

              <div className="option-impact">
                <h5>Goal Impact</h5>
                <div className="impact-grid">
                  <div className="impact-item">
                    <span className="impact-label">1. Capacity</span>
                    {getImpactBadge(option.impact.capacityGoal)}
                  </div>
                  <div className="impact-item">
                    <span className="impact-label">2. Architecture</span>
                    {getImpactBadge(option.impact.architectureGoal)}
                  </div>
                  <div className="impact-item">
                    <span className="impact-label">3. Engineering</span>
                    {getImpactBadge(option.impact.engineeringGoal)}
                  </div>
                  <div className="impact-item">
                    <span className="impact-label">4. Technology</span>
                    {getImpactBadge(option.impact.technologyGoal)}
                  </div>
                  <div className="impact-item">
                    <span className="impact-label">5. Cybersecurity</span>
                    {getImpactBadge(option.impact.cybersecurityGoal)}
                  </div>
                </div>
              </div>

              <div className="option-pros-cons">
                <div className="pros">
                  <h5>Pros</h5>
                  <ul>
                    {option.pros.map((pro, i) => (
                      <li key={i}>{pro}</li>
                    ))}
                  </ul>
                </div>
                <div className="cons">
                  <h5>Cons</h5>
                  <ul>
                    {option.cons.map((con, i) => (
                      <li key={i}>{con}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="insights-summary">
          <h4>Summary</h4>
          <p>
            Option A (Full Migration) provides the most comprehensive solution, addressing all five goals.
            Option B focuses specifically on Technology needs if Architecture/Engineering are not priorities.
            Option C offers a phased approach for budget-conscious implementation.
            Option D provides minimal intervention if Building 6 plans are uncertain.
            Option E offers a hybrid approach with larger room capacities.
          </p>
        </div>
      </div>
    );
  };

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
        <button
          className={`tab ${activeTab === 'insights' ? 'active' : ''}`}
          onClick={() => setActiveTab('insights')}
        >
          Actionable Insights
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'candidates' && renderCandidates()}
        {activeTab === 'rooms' && renderRooms()}
        {activeTab === 'architecture' && renderArchitecture()}
        {activeTab === 'insights' && renderActionableInsights()}
      </div>
    </div>
  );
}
