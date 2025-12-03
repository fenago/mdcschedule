import facilitiesData from '../data/facilities.json' with { type: 'json' };
import sectionsData from '../data/sections.json' with { type: 'json' };

export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Get all facilities sorted by capacity (largest first for assignment priority)
    const facilities = facilitiesData
      .map(f => ({
        facility_id: f.facility_id,
        department: f.department,
        capacity: f.capacity,
        designation: f.designation
      }))
      .sort((a, b) => b.capacity - a.capacity);

    // Get projected courses for Fall 2026 based on Fall 2025 data
    const fall2025Sections = sectionsData.filter(s => s.term === '2257');

    // Group sections by course and time slot
    const courseGroups = {};
    fall2025Sections.forEach(s => {
      const key = `${s.course_prefix}-${s.course_number}-${s.days}-${s.mtg_start}`;
      if (!courseGroups[key]) {
        courseGroups[key] = {
          course: `${s.course_prefix} ${s.course_number}`,
          description: s.class_descr,
          sections: [],
          days: s.days,
          mtg_start: s.mtg_start,
          mtg_end: s.mtg_end,
          instr_mode: s.instr_mode,
          current_facility: s.facility_id
        };
      }
      courseGroups[key].sections.push(s);
    });

    const projectedCourses = Object.values(courseGroups).map(group => ({
      ...group,
      section_count: group.sections.length,
      avg_enrollment: Math.round(
        group.sections.reduce((sum, s) => sum + (s.tot_enrl || 0), 0) / group.sections.length
      ),
      max_enrollment: Math.max(...group.sections.map(s => s.tot_enrl || 0))
    })).sort((a, b) => b.avg_enrollment - a.avg_enrollment);

    // Get time slots used in Fall 2025
    const timeSlotSet = new Set();
    fall2025Sections.forEach(s => {
      if (s.mtg_start) {
        timeSlotSet.add(JSON.stringify({
          startTime: s.mtg_start,
          endTime: s.mtg_end,
          days: s.days
        }));
      }
    });
    const timeSlots = Array.from(timeSlotSet).map(s => JSON.parse(s));

    // Build schedule assignments with conflict detection
    const scheduleAssignments = [];
    const roomSchedule = {}; // Track which rooms are booked at which times

    // Initialize room schedule tracking
    facilities.forEach(facility => {
      roomSchedule[facility.facility_id] = {};
    });

    // Helper function to check if a time slot conflicts
    function hasConflict(facilityId, days, startTime, endTime) {
      if (!roomSchedule[facilityId]) return false;
      const dayArray = days ? days.split('') : [];

      for (const day of dayArray) {
        const daySlots = roomSchedule[facilityId][day] || [];
        for (const slot of daySlots) {
          // Check for time overlap
          if (startTime < slot.endTime && endTime > slot.startTime) {
            return true;
          }
        }
      }
      return false;
    }

    // Helper function to book a time slot
    function bookSlot(facilityId, days, startTime, endTime, courseId) {
      if (!roomSchedule[facilityId]) roomSchedule[facilityId] = {};
      const dayArray = days ? days.split('') : [];

      for (const day of dayArray) {
        if (!roomSchedule[facilityId][day]) roomSchedule[facilityId][day] = [];
        roomSchedule[facilityId][day].push({ startTime, endTime, courseId });
      }
    }

    // Assign courses to rooms
    let assignmentId = 1;
    projectedCourses.forEach(course => {
      // Find a suitable room (capacity >= avg enrollment, no conflict)
      let assignedRoom = null;
      let conflict = false;

      // First try to keep the course in its current facility
      if (course.current_facility) {
        const currentFacility = facilities.find(f => f.facility_id === course.current_facility);
        if (currentFacility && currentFacility.capacity >= course.avg_enrollment) {
          if (!hasConflict(course.current_facility, course.days, course.mtg_start, course.mtg_end)) {
            assignedRoom = currentFacility;
          }
        }
      }

      // If current room doesn't work, find an alternative
      if (!assignedRoom) {
        for (const facility of facilities) {
          if (facility.capacity >= course.avg_enrollment) {
            if (!hasConflict(facility.facility_id, course.days, course.mtg_start, course.mtg_end)) {
              assignedRoom = facility;
              break;
            }
          }
        }
      }

      // If still no room, mark as conflict
      if (!assignedRoom) {
        conflict = true;
        // Assign to first room with sufficient capacity (will show as conflict)
        assignedRoom = facilities.find(f => f.capacity >= course.avg_enrollment) || facilities[0];
      }

      // Book the slot if we found a room without conflict
      if (assignedRoom && !conflict) {
        bookSlot(assignedRoom.facility_id, course.days, course.mtg_start, course.mtg_end, assignmentId);
      }

      scheduleAssignments.push({
        id: assignmentId++,
        course: course.course,
        description: course.description,
        projectedEnrollment: course.avg_enrollment,
        days: course.days,
        startTime: course.mtg_start,
        endTime: course.mtg_end,
        instrMode: course.instr_mode,
        assignedRoom: assignedRoom ? assignedRoom.facility_id : null,
        roomCapacity: assignedRoom ? assignedRoom.capacity : null,
        roomDepartment: assignedRoom ? assignedRoom.department : null,
        previousRoom: course.current_facility,
        hasConflict: conflict,
        isLocked: false,
        notes: conflict ? 'No available room without time conflict' :
               (assignedRoom && assignedRoom.facility_id !== course.current_facility ?
                `Moved from room ${course.current_facility}` : '')
      });
    });

    // Count conflicts and statistics
    const conflictCount = scheduleAssignments.filter(a => a.hasConflict).length;
    const roomChanges = scheduleAssignments.filter(a =>
      a.previousRoom && a.assignedRoom !== a.previousRoom && !a.hasConflict
    ).length;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          targetTerm: '2267',
          basedOnTerm: '2257',
          totalAssignments: scheduleAssignments.length,
          conflictCount,
          roomChanges,
          assignments: scheduleAssignments,
          facilities: facilities.map(f => ({
            ...f,
            scheduledSections: scheduleAssignments.filter(a => a.assignedRoom === f.facility_id).length
          })),
          timeSlots
        }
      }),
    };
  } catch (error) {
    console.error('Error generating schedule:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};
