import { useState, useEffect, useMemo } from 'react';
import {
  generateSchedule,
  reassignCourse,
  type ScheduleData,
  type ScheduleAssignment,
} from '../services/api';
import { StatCard } from '../components/StatCard';
import './Scheduler.css';

type ViewMode = 'list' | 'calendar';

// Time slots for calendar view (7 AM to 10 PM)
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7);
const DAYS = ['M', 'T', 'W', 'R', 'F', 'S'];
const DAY_NAMES: Record<string, string> = {
  M: 'Monday',
  T: 'Tuesday',
  W: 'Wednesday',
  R: 'Thursday',
  F: 'Friday',
  S: 'Saturday',
};

export function Scheduler() {
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<ScheduleAssignment | null>(null);
  const [filter, setFilter] = useState<'all' | 'conflicts' | 'changed'>('all');
  const [roomFilter, setRoomFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [pendingRoom, setPendingRoom] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showAlgorithm, setShowAlgorithm] = useState(false);
  const [calendarRoom, setCalendarRoom] = useState<string>('');
  const [showChanges, setShowChanges] = useState(false);

  useEffect(() => {
    async function fetchSchedule() {
      try {
        setLoading(true);
        const data = await generateSchedule();
        setSchedule(data);
        setError(null);
        // Set default room for calendar view
        if (data.facilities.length > 0) {
          setCalendarRoom(data.facilities[0].facility_id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate schedule');
      } finally {
        setLoading(false);
      }
    }

    fetchSchedule();
  }, []);

  // Check for conflicts when changing rooms
  const checkConflicts = (assignmentId: number, newRoomId: string) => {
    if (!schedule) return [];

    const assignment = schedule.assignments.find(a => a.id === assignmentId);
    if (!assignment) return [];

    // Find other assignments in the same room
    const roomAssignments = schedule.assignments.filter(
      a => a.id !== assignmentId && a.assignedRoom === newRoomId
    );

    // Check for time conflicts
    const conflicts = roomAssignments.filter(a => {
      // Check day overlap
      const aDays = a.days?.split('') || [];
      const bDays = assignment.days?.split('') || [];
      const dayOverlap = aDays.some(d => bDays.includes(d));
      if (!dayOverlap) return false;

      // Check time overlap
      if (!a.startTime || !a.endTime || !assignment.startTime || !assignment.endTime) {
        return false;
      }
      return a.startTime < assignment.endTime && a.endTime > assignment.startTime;
    });

    return conflicts;
  };

  const potentialConflicts = useMemo(() => {
    if (!selectedAssignment || !pendingRoom || pendingRoom === selectedAssignment.assignedRoom) {
      return [];
    }
    return checkConflicts(selectedAssignment.id, pendingRoom);
  }, [selectedAssignment, pendingRoom, schedule]);

  const handleReassign = async () => {
    if (!selectedAssignment || !schedule || !pendingRoom) return;

    try {
      const updatedSchedule = await reassignCourse(
        selectedAssignment.id,
        pendingRoom,
        null,
        null,
        null,
        schedule
      );
      setSchedule(updatedSchedule);
      setSelectedAssignment(
        updatedSchedule.assignments.find(a => a.id === selectedAssignment.id) || null
      );
      setEditMode(false);
      setPendingRoom('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reassign course');
    }
  };

  const filteredAssignments = useMemo(() => {
    if (!schedule) return [];

    let filtered = schedule.assignments;

    // Apply status filter
    if (filter === 'conflicts') {
      filtered = filtered.filter(a => a.hasConflict);
    } else if (filter === 'changed') {
      filtered = filtered.filter(a => a.previousRoom !== a.assignedRoom);
    }

    // Apply room filter
    if (roomFilter !== 'all') {
      filtered = filtered.filter(a => a.assignedRoom === roomFilter);
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        a =>
          a.course.toLowerCase().includes(query) ||
          a.description.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [schedule, filter, roomFilter, searchQuery]);

  const roomStats = useMemo(() => {
    if (!schedule) return [];
    return schedule.facilities.map(f => ({
      ...f,
      hasConflicts: schedule.assignments.some(
        a => a.assignedRoom === f.facility_id && a.hasConflict
      ),
    }));
  }, [schedule]);

  // Calendar view data
  const calendarAssignments = useMemo(() => {
    if (!schedule || !calendarRoom) return [];
    return schedule.assignments.filter(a => a.assignedRoom === calendarRoom);
  }, [schedule, calendarRoom]);

  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const getAssignmentStyle = (assignment: ScheduleAssignment, day: string) => {
    if (!assignment.startTime || !assignment.endTime) return null;
    if (!assignment.days?.includes(day)) return null;

    const startMinutes = timeToMinutes(assignment.startTime);
    const endMinutes = timeToMinutes(assignment.endTime);
    const top = ((startMinutes - 7 * 60) / 60) * 60; // 60px per hour
    const height = ((endMinutes - startMinutes) / 60) * 60;

    return {
      top: `${top}px`,
      height: `${height}px`,
    };
  };

  if (loading) {
    return <div className="loading">Generating Fall 2026 schedule...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  if (!schedule) {
    return <div className="error">No schedule data available</div>;
  }

  const formatTime = (time: string | null) => {
    if (!time) return 'TBD';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatDays = (days: string | null) => {
    if (!days) return 'TBD';
    const dayMap: Record<string, string> = {
      M: 'Mon',
      T: 'Tue',
      W: 'Wed',
      R: 'Thu',
      F: 'Fri',
      S: 'Sat',
    };
    return days
      .split('')
      .map(d => dayMap[d] || d)
      .join(', ');
  };

  return (
    <div className="scheduler">
      <div className="scheduler-header">
        <div className="header-content">
          <h2>Fall 2026 Class Scheduler</h2>
          <p className="scheduler-subtitle">
            Interactive scheduling tool based on Fall 2025 data. Assign classes to rooms and
            times with automatic conflict detection.
          </p>
        </div>
        <div className="header-actions">
          <button
            className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
          >
            List View
          </button>
          <button
            className={`view-toggle-btn ${viewMode === 'calendar' ? 'active' : ''}`}
            onClick={() => setViewMode('calendar')}
          >
            Calendar View
          </button>
          <button
            className="algorithm-btn"
            onClick={() => setShowAlgorithm(!showAlgorithm)}
          >
            {showAlgorithm ? 'Hide' : 'How It Works'}
          </button>
          <button
            className="view-changes-btn"
            onClick={() => setShowChanges(true)}
            title="View all changes from Fall 2025"
          >
            View Changes ({schedule.roomChanges})
          </button>
          <button
            className="regenerate-btn"
            onClick={() => window.location.reload()}
            title="Regenerate schedule from scratch"
          >
            Regenerate
          </button>
        </div>
      </div>

      {/* Changes Modal */}
      {showChanges && (
        <div className="modal-overlay" onClick={() => setShowChanges(false)}>
          <div className="changes-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Schedule Changes: Fall 2025 → Fall 2026</h3>
              <button className="close-btn" onClick={() => setShowChanges(false)}>×</button>
            </div>
            <div className="modal-content">
              <div className="changes-summary">
                <div className="summary-stat">
                  <span className="stat-value">{schedule.roomChanges}</span>
                  <span className="stat-label">Room Changes</span>
                </div>
                <div className="summary-stat">
                  <span className="stat-value">{schedule.conflictCount}</span>
                  <span className="stat-label">Conflicts</span>
                </div>
                <div className="summary-stat">
                  <span className="stat-value">{schedule.totalAssignments}</span>
                  <span className="stat-label">Total Sections</span>
                </div>
              </div>

              <div className="changes-explanation">
                <h4>Why Changes Occur</h4>
                <p>
                  The Fall 2026 schedule is projected based on Fall 2025 enrollment data. Room assignments
                  may change due to:
                </p>
                <ul>
                  <li><strong>Capacity:</strong> Projected enrollment exceeds current room capacity</li>
                  <li><strong>Conflicts:</strong> Time overlap with higher-priority sections</li>
                  <li><strong>Optimization:</strong> Better utilization of available space</li>
                </ul>
              </div>

              <div className="changes-list-container">
                <h4>All Room Changes</h4>
                {schedule.assignments.filter(a => a.previousRoom !== a.assignedRoom).length === 0 ? (
                  <p className="no-changes">No room changes from Fall 2025 schedule.</p>
                ) : (
                  <table className="changes-table">
                    <thead>
                      <tr>
                        <th>Course</th>
                        <th>Description</th>
                        <th>Fall 2025</th>
                        <th></th>
                        <th>Fall 2026</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedule.assignments
                        .filter(a => a.previousRoom !== a.assignedRoom)
                        .map(change => (
                          <tr key={change.id} className={change.hasConflict ? 'conflict-row' : ''}>
                            <td className="course-cell">{change.course}</td>
                            <td className="desc-cell">{change.description}</td>
                            <td className="room-cell previous">Room {change.previousRoom || 'N/A'}</td>
                            <td className="arrow-cell">→</td>
                            <td className="room-cell new">Room {change.assignedRoom || 'Unassigned'}</td>
                            <td className="status-cell">
                              {change.hasConflict ? (
                                <span className="status-badge conflict">Conflict</span>
                              ) : (
                                <span className="status-badge ok">OK</span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
              </div>

              {schedule.conflictCount > 0 && (
                <div className="conflicts-section">
                  <h4>Conflicts Requiring Resolution</h4>
                  <p>The following sections have scheduling conflicts that need manual adjustment:</p>
                  <ul className="conflicts-list">
                    {schedule.assignments
                      .filter(a => a.hasConflict)
                      .map(conflict => (
                        <li key={conflict.id}>
                          <strong>{conflict.course}</strong> in Room {conflict.assignedRoom}
                          <br />
                          <span className="conflict-detail">
                            {formatDays(conflict.days)} {formatTime(conflict.startTime)} - {formatTime(conflict.endTime)}
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="export-btn" onClick={() => {
                const changes = schedule.assignments
                  .filter(a => a.previousRoom !== a.assignedRoom)
                  .map(a => ({
                    course: a.course,
                    description: a.description,
                    previousRoom: a.previousRoom,
                    newRoom: a.assignedRoom,
                    hasConflict: a.hasConflict,
                    days: a.days,
                    time: `${a.startTime} - ${a.endTime}`
                  }));
                const blob = new Blob([JSON.stringify(changes, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'schedule-changes-fall-2026.json';
                link.click();
                URL.revokeObjectURL(url);
              }}>
                Export Changes
              </button>
              <button className="close-modal-btn" onClick={() => setShowChanges(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showAlgorithm && (
        <div className="algorithm-panel">
          <div className="algorithm-header">
            <h3>Scheduling Algorithm</h3>
            <button className="close-algorithm" onClick={() => setShowAlgorithm(false)}>
              ×
            </button>
          </div>
          <div className="algorithm-content">
            <div className="algorithm-section">
              <h4>1. Data Analysis</h4>
              <p>
                The scheduler analyzes Fall 2025 course data to project Fall 2026 needs. It examines
                each course's enrollment patterns, time slots, and current room assignments.
              </p>
            </div>
            <div className="algorithm-section">
              <h4>2. Room Assignment Priority</h4>
              <ul>
                <li><strong>Keep Current Room:</strong> First, we try to keep each course in its Fall 2025 room if:
                  <ul>
                    <li>The room has sufficient capacity for projected enrollment</li>
                    <li>No time conflict exists with already-scheduled courses</li>
                  </ul>
                </li>
                <li><strong>Find Alternative:</strong> If the current room doesn't work, we search for an alternative:
                  <ul>
                    <li>Rooms are sorted by capacity (largest first)</li>
                    <li>We select the first room with enough capacity and no time conflicts</li>
                  </ul>
                </li>
                <li><strong>Mark Conflict:</strong> If no room without conflict is available, the course is flagged</li>
              </ul>
            </div>
            <div className="algorithm-section">
              <h4>3. Conflict Detection</h4>
              <p>
                A conflict occurs when two courses are assigned to the same room with overlapping
                day/time combinations. The system checks:
              </p>
              <ul>
                <li><strong>Day Overlap:</strong> Do the courses meet on any of the same days?</li>
                <li><strong>Time Overlap:</strong> If Course A ends after Course B starts AND starts before Course B ends</li>
              </ul>
            </div>
            <div className="algorithm-section">
              <h4>4. User Changes</h4>
              <p>
                When you reassign a course, the system immediately rechecks all affected rooms for
                conflicts and updates the schedule accordingly. Changes ripple through:
              </p>
              <ul>
                <li>The old room is freed up for that time slot</li>
                <li>The new room is checked for conflicts</li>
                <li>All affected courses' conflict status is updated</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="stats-grid">
        <StatCard
          title="Total Assignments"
          value={schedule.totalAssignments}
          subtitle="Course sections"
        />
        <StatCard
          title="Conflicts"
          value={schedule.conflictCount}
          subtitle={schedule.conflictCount > 0 ? 'Need resolution' : 'No conflicts!'}
        />
        <StatCard
          title="Room Changes"
          value={schedule.roomChanges}
          subtitle="From Fall 2025"
        />
        <StatCard
          title="Rooms Used"
          value={schedule.facilities.filter(f => f.scheduledSections > 0).length}
          subtitle={`of ${schedule.facilities.length} available`}
        />
      </div>

      {viewMode === 'calendar' ? (
        <div className="calendar-view">
          <div className="calendar-header">
            <h3>Weekly Schedule - Room {calendarRoom}</h3>
            <select
              value={calendarRoom}
              onChange={e => setCalendarRoom(e.target.value)}
              className="calendar-room-select"
            >
              {schedule.facilities.map(f => (
                <option key={f.facility_id} value={f.facility_id}>
                  Room {f.facility_id} - {f.department} ({f.scheduledSections} sections)
                </option>
              ))}
            </select>
          </div>
          <div className="calendar-grid">
            <div className="calendar-time-column">
              <div className="calendar-corner"></div>
              {HOURS.map(hour => (
                <div key={hour} className="calendar-hour">
                  {hour > 12 ? hour - 12 : hour}:00 {hour >= 12 ? 'PM' : 'AM'}
                </div>
              ))}
            </div>
            {DAYS.map(day => (
              <div key={day} className="calendar-day-column">
                <div className="calendar-day-header">{DAY_NAMES[day]}</div>
                <div className="calendar-day-slots">
                  {HOURS.map(hour => (
                    <div key={hour} className="calendar-slot"></div>
                  ))}
                  {calendarAssignments.map(assignment => {
                    const style = getAssignmentStyle(assignment, day);
                    if (!style) return null;
                    return (
                      <div
                        key={`${assignment.id}-${day}`}
                        className={`calendar-event ${assignment.hasConflict ? 'conflict' : ''} ${
                          selectedAssignment?.id === assignment.id ? 'selected' : ''
                        }`}
                        style={style}
                        onClick={() => {
                          setSelectedAssignment(assignment);
                          setEditMode(false);
                          setPendingRoom(assignment.assignedRoom || '');
                        }}
                        title={`${assignment.course}: ${formatTime(assignment.startTime)} - ${formatTime(assignment.endTime)}`}
                      >
                        <div className="event-course">{assignment.course}</div>
                        <div className="event-time">
                          {formatTime(assignment.startTime)} - {formatTime(assignment.endTime)}
                        </div>
                        <div className="event-enrollment">{assignment.projectedEnrollment} students</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="calendar-legend">
            <span className="legend-item"><span className="legend-color normal"></span> Normal</span>
            <span className="legend-item"><span className="legend-color conflict"></span> Conflict</span>
            <span className="legend-item"><span className="legend-color selected"></span> Selected</span>
          </div>
        </div>
      ) : (
        <div className="scheduler-content">
          <div className="schedule-panel">
            <div className="panel-header">
              <h3>Schedule Assignments</h3>
              <div className="panel-controls">
                <input
                  type="text"
                  placeholder="Search courses..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="search-input"
                />
                <select value={filter} onChange={e => setFilter(e.target.value as typeof filter)}>
                  <option value="all">All Sections</option>
                  <option value="conflicts">Conflicts Only</option>
                  <option value="changed">Changed Rooms</option>
                </select>
                <select value={roomFilter} onChange={e => setRoomFilter(e.target.value)}>
                  <option value="all">All Rooms</option>
                  {schedule.facilities.map(f => (
                    <option key={f.facility_id} value={f.facility_id}>
                      Room {f.facility_id} ({f.scheduledSections})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="assignments-list">
              {filteredAssignments.length === 0 ? (
                <div className="no-results">No assignments match your filters</div>
              ) : (
                filteredAssignments.map(assignment => (
                  <div
                    key={assignment.id}
                    className={`assignment-card ${assignment.hasConflict ? 'has-conflict' : ''} ${
                      selectedAssignment?.id === assignment.id ? 'selected' : ''
                    } ${assignment.previousRoom !== assignment.assignedRoom ? 'room-changed' : ''}`}
                    onClick={() => {
                      setSelectedAssignment(assignment);
                      setEditMode(false);
                      setPendingRoom(assignment.assignedRoom || '');
                    }}
                  >
                    <div className="assignment-main">
                      <div className="assignment-course">
                        <span className="course-code">{assignment.course}</span>
                        {assignment.hasConflict && (
                          <span className="conflict-badge">CONFLICT</span>
                        )}
                        {assignment.previousRoom !== assignment.assignedRoom && (
                          <span className="changed-badge">MOVED</span>
                        )}
                      </div>
                      <div className="assignment-desc">{assignment.description}</div>
                    </div>
                    <div className="assignment-details">
                      <span className="detail">
                        <strong>Room:</strong> {assignment.assignedRoom || 'Unassigned'}
                      </span>
                      <span className="detail">
                        <strong>Time:</strong> {formatDays(assignment.days)}{' '}
                        {formatTime(assignment.startTime)}
                      </span>
                      <span className="detail">
                        <strong>Enroll:</strong> {assignment.projectedEnrollment}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="list-footer">
              Showing {filteredAssignments.length} of {schedule.totalAssignments} assignments
            </div>
          </div>

          <div className="details-panel">
            {selectedAssignment ? (
              <>
                <div className="details-header">
                  <h3>Assignment Details</h3>
                  {!editMode ? (
                    <button className="edit-btn" onClick={() => setEditMode(true)}>
                      Change Room
                    </button>
                  ) : (
                    <div className="edit-actions">
                      <button className="cancel-btn" onClick={() => setEditMode(false)}>
                        Cancel
                      </button>
                      <button
                        className="save-btn"
                        onClick={handleReassign}
                        disabled={pendingRoom === selectedAssignment.assignedRoom}
                      >
                        Save
                      </button>
                    </div>
                  )}
                </div>

                <div className="details-content">
                  <div className="detail-group">
                    <label>Course</label>
                    <div className="detail-value course-title">
                      {selectedAssignment.course} - {selectedAssignment.description}
                    </div>
                  </div>

                  <div className="detail-row">
                    <div className="detail-group">
                      <label>Projected Enrollment</label>
                      <div className="detail-value">{selectedAssignment.projectedEnrollment}</div>
                    </div>
                    <div className="detail-group">
                      <label>Room Capacity</label>
                      <div className="detail-value">
                        {selectedAssignment.roomCapacity || 'N/A'}
                      </div>
                    </div>
                  </div>

                  <div className="detail-row">
                    <div className="detail-group">
                      <label>Days</label>
                      <div className="detail-value">{formatDays(selectedAssignment.days)}</div>
                    </div>
                    <div className="detail-group">
                      <label>Time</label>
                      <div className="detail-value">
                        {formatTime(selectedAssignment.startTime)} -{' '}
                        {formatTime(selectedAssignment.endTime)}
                      </div>
                    </div>
                  </div>

                  <div className="detail-group">
                    <label>Assigned Room</label>
                    {editMode ? (
                      <>
                        <select
                          value={pendingRoom}
                          onChange={e => setPendingRoom(e.target.value)}
                          className="room-select"
                        >
                          <option value="">Select a room...</option>
                          {schedule.facilities
                            .filter(f => f.capacity >= selectedAssignment.projectedEnrollment)
                            .map(f => (
                              <option key={f.facility_id} value={f.facility_id}>
                                Room {f.facility_id} - {f.department} (Cap: {f.capacity})
                              </option>
                            ))}
                        </select>
                        {potentialConflicts.length > 0 && (
                          <div className="conflict-preview">
                            <strong>Warning:</strong> This will create conflicts with:
                            <ul>
                              {potentialConflicts.map(c => (
                                <li key={c.id}>
                                  {c.course} ({formatDays(c.days)} {formatTime(c.startTime)})
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="detail-value">
                        Room {selectedAssignment.assignedRoom || 'Unassigned'}
                        {selectedAssignment.roomDepartment && (
                          <span className="room-dept">
                            {' '}
                            ({selectedAssignment.roomDepartment})
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {selectedAssignment.previousRoom &&
                    selectedAssignment.previousRoom !== selectedAssignment.assignedRoom && (
                      <div className="detail-group">
                        <label>Previous Room (Fall 2025)</label>
                        <div className="detail-value previous-room">
                          Room {selectedAssignment.previousRoom}
                        </div>
                      </div>
                    )}

                  <div className="detail-group">
                    <label>Instruction Mode</label>
                    <div className="detail-value">{selectedAssignment.instrMode}</div>
                  </div>

                  {selectedAssignment.notes && (
                    <div className="detail-group">
                      <label>Notes</label>
                      <div
                        className={`detail-value notes ${
                          selectedAssignment.hasConflict ? 'conflict-note' : ''
                        }`}
                      >
                        {selectedAssignment.notes}
                      </div>
                    </div>
                  )}

                  {selectedAssignment.hasConflict && (
                    <div className="conflict-warning">
                      <strong>Scheduling Conflict!</strong>
                      <p>
                        This section conflicts with the following class(es) in Room {selectedAssignment.assignedRoom}:
                      </p>
                      <ul className="conflict-list">
                        {selectedAssignment.conflictsWith?.map(conflictId => {
                          const conflictingCourse = schedule.assignments.find(a => a.id === conflictId);
                          if (!conflictingCourse) return null;
                          return (
                            <li key={conflictId}>
                              <strong>{conflictingCourse.course}</strong> - {conflictingCourse.description}
                              <br />
                              <span className="conflict-time">
                                {formatDays(conflictingCourse.days)} {formatTime(conflictingCourse.startTime)} - {formatTime(conflictingCourse.endTime)}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                      <p className="conflict-action">Please reassign one of these courses to a different room or time.</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="no-selection">
                <p>Select an assignment to view details</p>
                <p className="hint">
                  Click on any course in the list to see its scheduling information and make
                  changes.
                </p>
              </div>
            )}
          </div>

          <div className="rooms-panel">
            <h3>Room Overview</h3>
            <div className="rooms-list">
              {roomStats.map(room => (
                <div
                  key={room.facility_id}
                  className={`room-item ${room.hasConflicts ? 'has-conflicts' : ''} ${
                    roomFilter === room.facility_id ? 'active' : ''
                  }`}
                  onClick={() =>
                    setRoomFilter(roomFilter === room.facility_id ? 'all' : room.facility_id)
                  }
                >
                  <div className="room-header">
                    <span className="room-id">Room {room.facility_id}</span>
                    <span className="room-sections">{room.scheduledSections} sections</span>
                  </div>
                  <div className="room-info">
                    <span>{room.department}</span>
                    <span>Cap: {room.capacity}</span>
                  </div>
                  {room.hasConflicts && <span className="room-conflict-badge">Has Conflicts</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Details panel for calendar view */}
      {viewMode === 'calendar' && selectedAssignment && (
        <div className="calendar-details-panel">
          <div className="details-header">
            <h3>{selectedAssignment.course}</h3>
            <button className="close-btn" onClick={() => setSelectedAssignment(null)}>×</button>
          </div>
          <div className="details-content">
            <p><strong>Description:</strong> {selectedAssignment.description}</p>
            <p><strong>Time:</strong> {formatDays(selectedAssignment.days)} {formatTime(selectedAssignment.startTime)} - {formatTime(selectedAssignment.endTime)}</p>
            <p><strong>Enrollment:</strong> {selectedAssignment.projectedEnrollment} / {selectedAssignment.roomCapacity}</p>
            <p><strong>Mode:</strong> {selectedAssignment.instrMode}</p>
            {selectedAssignment.hasConflict && (
              <p className="conflict-note"><strong>CONFLICT:</strong> {selectedAssignment.notes}</p>
            )}
            <button
              className="edit-btn"
              onClick={() => {
                setViewMode('list');
                setEditMode(true);
                setPendingRoom(selectedAssignment.assignedRoom || '');
              }}
            >
              Change Room
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
