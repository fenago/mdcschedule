import { useState, useEffect } from 'react';
import { getSections, getFacilities } from '../services/api';
import type { ClassSection, Facility } from '../types';
import './Schedule.css';

const DAYS = ['M', 'T', 'W', 'R', 'F'];
const DAY_NAMES: Record<string, string> = {
  M: 'Monday',
  T: 'Tuesday',
  W: 'Wednesday',
  R: 'Thursday',
  F: 'Friday',
};

const TIME_SLOTS = [
  '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00',
  '18:00', '19:00', '20:00', '21:00',
];

export function Schedule() {
  const [sections, setSections] = useState<ClassSection[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTerm, setSelectedTerm] = useState('2257');
  const [selectedRoom, setSelectedRoom] = useState<string>('');

  useEffect(() => {
    async function fetchData() {
      try {
        const [sectionsData, facilitiesData] = await Promise.all([
          getSections({ term: selectedTerm }),
          getFacilities(),
        ]);
        setSections(sectionsData);
        setFacilities(facilitiesData);
        if (!selectedRoom && facilitiesData.length > 0) {
          setSelectedRoom(facilitiesData[0].facilityId);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [selectedTerm]);

  const roomSections = sections.filter((s) => s.facilityId === selectedRoom);

  const getTimeSlotIndex = (time: string | null): number => {
    if (!time) return -1;
    const hour = parseInt(time.split(':')[0]);
    return TIME_SLOTS.findIndex((t) => parseInt(t.split(':')[0]) === hour);
  };

  const getSectionForSlot = (day: string, timeSlot: string): ClassSection | null => {
    return roomSections.find((section) => {
      if (!section.days || !section.mtgStart) return false;
      if (!section.days.includes(day)) return false;

      const slotHour = parseInt(timeSlot.split(':')[0]);
      const startHour = parseInt(section.mtgStart.split(':')[0]);
      const endHour = section.mtgEnd ? parseInt(section.mtgEnd.split(':')[0]) : startHour + 1;

      return slotHour >= startHour && slotHour < endHour;
    }) || null;
  };

  const selectedFacility = facilities.find((f) => f.facilityId === selectedRoom);

  if (loading) {
    return <div className="loading">Loading schedule...</div>;
  }

  return (
    <div className="schedule-page">
      <div className="schedule-header">
        <h2>Weekly Schedule</h2>
        <div className="schedule-controls">
          <div className="control-group">
            <label htmlFor="term-select">Term:</label>
            <select
              id="term-select"
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
            >
              <option value="2237">Fall 2023</option>
              <option value="2247">Fall 2024</option>
              <option value="2257">Fall 2025</option>
            </select>
          </div>
          <div className="control-group">
            <label htmlFor="room-select">Room:</label>
            <select
              id="room-select"
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
            >
              {facilities.map((f) => (
                <option key={f.facilityId} value={f.facilityId}>
                  {f.facilityId} - {f.department} ({f.capacity} seats)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {selectedFacility && (
        <div className="room-info">
          <h3>Room {selectedFacility.facilityId}</h3>
          <p>
            <strong>Department:</strong> {selectedFacility.department} |
            <strong> Capacity:</strong> {selectedFacility.capacity} |
            <strong> Type:</strong> {selectedFacility.designation}
          </p>
          <p className="section-count">
            {roomSections.length} sections scheduled this term
          </p>
        </div>
      )}

      <div className="schedule-grid-container">
        <table className="schedule-grid">
          <thead>
            <tr>
              <th className="time-header">Time</th>
              {DAYS.map((day) => (
                <th key={day}>{DAY_NAMES[day]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIME_SLOTS.map((timeSlot) => (
              <tr key={timeSlot}>
                <td className="time-cell">{timeSlot}</td>
                {DAYS.map((day) => {
                  const section = getSectionForSlot(day, timeSlot);
                  if (section) {
                    const startIdx = getTimeSlotIndex(section.mtgStart);
                    const currentIdx = getTimeSlotIndex(timeSlot);
                    const isFirstSlot = startIdx === currentIdx;

                    if (!isFirstSlot) {
                      return <td key={day} className="occupied-continuation"></td>;
                    }

                    return (
                      <td key={day} className="schedule-cell occupied">
                        <div className="class-block">
                          <div className="class-name">
                            {section.coursePrefix} {section.courseNumber}
                          </div>
                          <div className="class-component">{section.component}</div>
                          <div className="class-enrollment">
                            {section.totEnrl}/{section.capEnrl} enrolled
                          </div>
                          <div className="class-time">
                            {section.mtgStart} - {section.mtgEnd}
                          </div>
                        </div>
                      </td>
                    );
                  }
                  return <td key={day} className="schedule-cell empty"></td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="schedule-legend">
        <div className="legend-item">
          <span className="legend-block occupied"></span>
          <span>Scheduled Class</span>
        </div>
        <div className="legend-item">
          <span className="legend-block empty"></span>
          <span>Available</span>
        </div>
      </div>
    </div>
  );
}
