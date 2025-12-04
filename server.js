import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Database connection
const dbPath = path.join(__dirname, 'data', 'mdc_scheduling.db');
let db;
try {
  db = new Database(dbPath, { readonly: true });
  console.log('Database connected:', dbPath);
} catch (err) {
  console.error('Database connection error:', err.message);
  process.exit(1);
}

// Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

console.log('Anthropic API Key loaded:', process.env.ANTHROPIC_API_KEY ? 'Yes' : 'No');

// GET /api/facilities
app.get('/api/facilities', (req, res) => {
  try {
    const facilities = db.prepare(`
      SELECT
        id,
        department,
        acad_org as acadOrg,
        facility_id as facilityId,
        capacity,
        designation
      FROM facilities
      ORDER BY department, facility_id
    `).all();

    res.json({ success: true, data: facilities });
  } catch (error) {
    console.error('Error fetching facilities:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/sections
app.get('/api/sections', (req, res) => {
  try {
    const params = req.query;

    let query = `
      SELECT
        id,
        term,
        acad_org as acadOrg,
        class_nbr as classNbr,
        course_prefix as coursePrefix,
        course_number as courseNumber,
        class_descr as classDescr,
        component,
        tot_enrl as totEnrl,
        cap_enrl as capEnrl,
        session_code as sessionCode,
        start_date as startDate,
        end_date as endDate,
        days,
        mtg_start as mtgStart,
        mtg_end as mtgEnd,
        instr_mode as instrMode,
        facility_id as facilityId
      FROM class_sections
      WHERE 1=1
    `;

    const queryParams = [];

    if (params.term) {
      query += ' AND term = ?';
      queryParams.push(params.term);
    }

    if (params.facilityId) {
      query += ' AND facility_id = ?';
      queryParams.push(params.facilityId);
    }

    if (params.department) {
      query += ' AND acad_org IN (SELECT acad_org FROM facilities WHERE department = ?)';
      queryParams.push(params.department);
    }

    query += ' ORDER BY term, mtg_start';

    const sections = db.prepare(query).all(...queryParams);

    res.json({ success: true, data: sections });
  } catch (error) {
    console.error('Error fetching sections:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/analytics
app.get('/api/analytics', (req, res) => {
  try {
    const { term } = req.query;
    const termFilter = term ? `AND term = '${term}'` : '';
    const termFilterWhere = term ? `WHERE term = '${term}'` : '';

    // Get available terms for the dropdown
    const availableTerms = db.prepare(`
      SELECT DISTINCT term FROM class_sections ORDER BY term DESC
    `).all().map(row => ({
      code: row.term,
      label: row.term === '2237' ? 'Fall 2023' :
             row.term === '2247' ? 'Fall 2024' :
             row.term === '2257' ? 'Fall 2025' :
             row.term === '2267' ? 'Fall 2026' : row.term
    }));

    const termSummaries = db.prepare(`
      SELECT
        term,
        COUNT(*) as totalSections,
        SUM(tot_enrl) as totalEnrollment,
        ROUND(AVG(tot_enrl), 1) as avgClassSize,
        ROUND(100.0 * SUM(CASE WHEN instr_mode LIKE '%In Person%' THEN 1 ELSE 0 END) / COUNT(*), 1) as inPersonPercent,
        ROUND(100.0 * SUM(CASE WHEN instr_mode LIKE '%Blended%' THEN 1 ELSE 0 END) / COUNT(*), 1) as blendedPercent
      FROM class_sections
      GROUP BY term
      ORDER BY term
    `).all();

    const departmentSummaries = db.prepare(`
      SELECT
        f.department,
        COUNT(DISTINCT f.facility_id) as totalRooms,
        SUM(DISTINCT f.capacity) as totalCapacity,
        COUNT(cs.id) as totalSections,
        ROUND(AVG(CAST(cs.tot_enrl AS FLOAT) / NULLIF(f.capacity, 0) * 100), 1) as avgUtilization
      FROM facilities f
      LEFT JOIN class_sections cs ON f.facility_id = cs.facility_id
      GROUP BY f.department
      ORDER BY f.department
    `).all();

    const roomUtilization = db.prepare(`
      SELECT
        f.facility_id as facilityId,
        f.department,
        f.capacity,
        f.designation,
        COUNT(cs.id) as totalSections,
        ROUND(AVG(cs.tot_enrl), 1) as avgEnrollment,
        ROUND(AVG(CAST(cs.tot_enrl AS FLOAT) / NULLIF(f.capacity, 0) * 100), 1) as utilizationRate
      FROM facilities f
      LEFT JOIN class_sections cs ON f.facility_id = cs.facility_id ${termFilter.replace('AND', 'AND cs.')}
      GROUP BY f.facility_id
      ORDER BY f.department, f.facility_id
    `).all();

    const coursesByDepartment = db.prepare(`
      SELECT
        f.department,
        cs.course_prefix || ' ' || cs.course_number as course,
        COUNT(*) as sectionCount,
        SUM(cs.tot_enrl) as totalEnrollment
      FROM class_sections cs
      JOIN facilities f ON cs.facility_id = f.facility_id
      GROUP BY f.department, cs.course_prefix, cs.course_number
      ORDER BY f.department, sectionCount DESC
    `).all();

    const timeSlotAnalysis = db.prepare(`
      SELECT
        mtg_start as timeSlot,
        days,
        COUNT(*) as sectionCount
      FROM class_sections
      WHERE mtg_start IS NOT NULL
      GROUP BY mtg_start, days
      ORDER BY mtg_start, days
    `).all();

    const enrollmentTrends = db.prepare(`
      SELECT
        term,
        f.department,
        SUM(cs.tot_enrl) as totalEnrollment,
        COUNT(cs.id) as sectionCount
      FROM class_sections cs
      JOIN facilities f ON cs.facility_id = f.facility_id
      GROUP BY term, f.department
      ORDER BY term, f.department
    `).all();

    res.json({
      success: true,
      data: {
        availableTerms,
        selectedTerm: term || 'all',
        termSummaries,
        departmentSummaries,
        roomUtilization,
        coursesByDepartment,
        timeSlotAnalysis,
        enrollmentTrends,
      },
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/chat
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    // Get data context
    const facilities = db.prepare(`
      SELECT department, facility_id, capacity, designation
      FROM facilities
      ORDER BY department
    `).all();

    const termStats = db.prepare(`
      SELECT
        term,
        COUNT(*) as sections,
        SUM(tot_enrl) as enrollment,
        ROUND(AVG(tot_enrl), 1) as avgSize
      FROM class_sections
      GROUP BY term
    `).all();

    const deptStats = db.prepare(`
      SELECT
        f.department,
        COUNT(DISTINCT f.facility_id) as rooms,
        SUM(DISTINCT f.capacity) as capacity,
        COUNT(cs.id) as sections,
        ROUND(AVG(cs.tot_enrl), 1) as avgEnrollment
      FROM facilities f
      LEFT JOIN class_sections cs ON f.facility_id = cs.facility_id
      GROUP BY f.department
    `).all();

    const roomUsage = db.prepare(`
      SELECT
        f.facility_id,
        f.department,
        f.capacity,
        COUNT(cs.id) as totalSections,
        ROUND(AVG(cs.tot_enrl), 1) as avgEnrollment,
        ROUND(AVG(CAST(cs.tot_enrl AS FLOAT) / f.capacity * 100), 1) as utilizationPct
      FROM facilities f
      LEFT JOIN class_sections cs ON f.facility_id = cs.facility_id
      GROUP BY f.facility_id
    `).all();

    const instrModes = db.prepare(`
      SELECT
        term,
        instr_mode,
        COUNT(*) as count
      FROM class_sections
      GROUP BY term, instr_mode
    `).all();

    const room8217Usage = db.prepare(`
      SELECT
        term,
        course_prefix || ' ' || course_number as course,
        class_descr,
        tot_enrl,
        days,
        mtg_start,
        mtg_end
      FROM class_sections
      WHERE facility_id = '8217'
      ORDER BY term
    `).all();

    const dataContext = `
## MDC Scheduling Database Context

### Facilities (${facilities.length} rooms total)
${JSON.stringify(facilities, null, 2)}

### Term Statistics
${JSON.stringify(termStats, null, 2)}

### Department Statistics
${JSON.stringify(deptStats, null, 2)}

### Room Utilization
${JSON.stringify(roomUsage, null, 2)}

### Instruction Modes by Term
${JSON.stringify(instrModes, null, 2)}

### Room 8217 Usage (Architecture overflow room)
${JSON.stringify(room8217Usage, null, 2)}

### Key Context:
- Terms: 2237 (Fall 2023), 2247 (Fall 2024), 2257 (Fall 2025)
- Departments: Architecture, Engineering, Technology
- Architecture is using room 8217 as overflow for some classes
- Building 6 first floor has new classrooms launching Fall 2026
- Technology classes in Building 2 may move to Building 6 floors 2-3
- Room 8216 classes will move to new Cybersecurity/Networking rooms
- Goal: Maintain seat count but potentially reduce room count
`;

    const systemPrompt = `You are an expert classroom scheduling analyst for Miami-Dade College (MDC). You have access to classroom facilities data and room usage data across three Fall semesters.

${dataContext}

Your role is to:
1. Answer questions about classroom utilization, enrollment trends, and scheduling patterns
2. Provide insights and recommendations for classroom allocation
3. Help analyze whether departments need more or fewer classrooms
4. Identify underutilized rooms and peak usage times
5. Support planning for the Fall 2026 classroom reorganization

Be concise, data-driven, and provide specific numbers when relevant. Format responses with markdown for clarity.`;

    const messages = [
      ...history.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: 'user', content: message },
    ];

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const assistantMessage = response.content[0].text;

    res.json({
      success: true,
      data: {
        message: assistantMessage,
      },
    });
  } catch (error) {
    console.error('Error in chat:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/recommendations - Generate scheduling recommendations for Fall 2026
app.get('/api/recommendations', (req, res) => {
  try {
    // Get the most recent term data (2257 = Fall 2025)
    const latestTerm = '2257';
    const previousTerm = '2247';

    // Get course trends across terms
    const courseTrends = db.prepare(`
      SELECT
        course_prefix || ' ' || course_number as course,
        class_descr as description,
        SUM(CASE WHEN term = '2237' THEN 1 ELSE 0 END) as sections_2237,
        SUM(CASE WHEN term = '2247' THEN 1 ELSE 0 END) as sections_2247,
        SUM(CASE WHEN term = '2257' THEN 1 ELSE 0 END) as sections_2257,
        SUM(CASE WHEN term = '2237' THEN tot_enrl ELSE 0 END) as enrl_2237,
        SUM(CASE WHEN term = '2247' THEN tot_enrl ELSE 0 END) as enrl_2247,
        SUM(CASE WHEN term = '2257' THEN tot_enrl ELSE 0 END) as enrl_2257,
        ROUND(AVG(tot_enrl), 1) as avg_class_size
      FROM class_sections
      GROUP BY course_prefix, course_number
      ORDER BY enrl_2257 DESC
    `).all();

    // Calculate growth rates and recommendations
    const recommendations = courseTrends.map(course => {
      const growth2247to2257 = course.enrl_2247 > 0
        ? ((course.enrl_2257 - course.enrl_2247) / course.enrl_2247 * 100).toFixed(1)
        : null;
      const growth2237to2257 = course.enrl_2237 > 0
        ? ((course.enrl_2257 - course.enrl_2237) / course.enrl_2237 * 100).toFixed(1)
        : null;

      // Project sections for Fall 2026
      let projectedSections = course.sections_2257;
      let recommendation = 'maintain';
      let reason = '';

      if (growth2247to2257 !== null) {
        const growthRate = parseFloat(growth2247to2257);
        if (growthRate > 15) {
          projectedSections = Math.ceil(course.sections_2257 * 1.15);
          recommendation = 'increase';
          reason = `${growth2247to2257}% enrollment growth from Fall 2024 to Fall 2025`;
        } else if (growthRate < -15) {
          projectedSections = Math.max(1, Math.floor(course.sections_2257 * 0.85));
          recommendation = 'decrease';
          reason = `${growth2247to2257}% enrollment decline from Fall 2024 to Fall 2025`;
        } else {
          reason = 'Stable enrollment trend';
        }
      } else if (course.sections_2257 > 0) {
        reason = 'New course, maintain current offering';
      }

      return {
        course: course.course,
        description: course.description,
        currentSections: course.sections_2257,
        projectedSections,
        currentEnrollment: course.enrl_2257,
        avgClassSize: course.avg_class_size,
        growthRate: growth2247to2257,
        recommendation,
        reason,
        historicalData: {
          fall2023: { sections: course.sections_2237, enrollment: course.enrl_2237 },
          fall2024: { sections: course.sections_2247, enrollment: course.enrl_2247 },
          fall2025: { sections: course.sections_2257, enrollment: course.enrl_2257 }
        }
      };
    }).filter(r => r.currentSections > 0);

    // Get room recommendations
    const roomUsage = db.prepare(`
      SELECT
        f.facility_id,
        f.department,
        f.capacity,
        f.designation,
        COUNT(cs.id) as total_sections,
        ROUND(AVG(cs.tot_enrl), 1) as avg_enrollment,
        ROUND(AVG(CAST(cs.tot_enrl AS FLOAT) / f.capacity * 100), 1) as utilization_pct
      FROM facilities f
      LEFT JOIN class_sections cs ON f.facility_id = cs.facility_id AND cs.term = '2257'
      GROUP BY f.facility_id
      ORDER BY utilization_pct DESC
    `).all();

    const roomRecommendations = roomUsage.map(room => {
      let recommendation = 'optimal';
      let reason = '';

      if (room.utilization_pct === null || room.total_sections === 0) {
        recommendation = 'underutilized';
        reason = 'No classes scheduled in Fall 2025';
      } else if (room.utilization_pct < 50) {
        recommendation = 'underutilized';
        reason = `Only ${room.utilization_pct}% average seat utilization`;
      } else if (room.utilization_pct > 90) {
        recommendation = 'at_capacity';
        reason = `${room.utilization_pct}% utilization - consider larger room`;
      } else {
        reason = `${room.utilization_pct}% utilization - good balance`;
      }

      return {
        facilityId: room.facility_id,
        department: room.department,
        capacity: room.capacity,
        designation: room.designation,
        sectionsScheduled: room.total_sections,
        avgEnrollment: room.avg_enrollment,
        utilizationRate: room.utilization_pct,
        recommendation,
        reason
      };
    });

    // Summary statistics
    const summary = {
      totalCourses: recommendations.length,
      coursesToIncrease: recommendations.filter(r => r.recommendation === 'increase').length,
      coursesToDecrease: recommendations.filter(r => r.recommendation === 'decrease').length,
      coursesToMaintain: recommendations.filter(r => r.recommendation === 'maintain').length,
      underutilizedRooms: roomRecommendations.filter(r => r.recommendation === 'underutilized').length,
      atCapacityRooms: roomRecommendations.filter(r => r.recommendation === 'at_capacity').length,
      projectedTotalSections: recommendations.reduce((sum, r) => sum + r.projectedSections, 0),
      currentTotalSections: recommendations.reduce((sum, r) => sum + r.currentSections, 0)
    };

    res.json({
      success: true,
      data: {
        summary,
        courseRecommendations: recommendations,
        roomRecommendations,
        targetTerm: '2267', // Fall 2026
        basedOnTerm: '2257' // Fall 2025
      }
    });
  } catch (error) {
    console.error('Error generating recommendations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/scheduler/generate - Generate optimal Fall 2026 schedule
app.get('/api/scheduler/generate', (req, res) => {
  try {
    // Get all facilities with their capacities
    const facilities = db.prepare(`
      SELECT facility_id, department, capacity, designation
      FROM facilities
      ORDER BY capacity DESC
    `).all();

    // Get projected courses for Fall 2026 based on Fall 2025 data
    const projectedCourses = db.prepare(`
      SELECT
        course_prefix || ' ' || course_number as course,
        class_descr as description,
        COUNT(*) as section_count,
        ROUND(AVG(tot_enrl), 0) as avg_enrollment,
        MAX(tot_enrl) as max_enrollment,
        days,
        mtg_start,
        mtg_end,
        instr_mode,
        facility_id as current_facility
      FROM class_sections
      WHERE term = '2257'
      GROUP BY course_prefix, course_number, days, mtg_start
      ORDER BY avg_enrollment DESC
    `).all();

    // Get time slots used in Fall 2025
    const timeSlots = db.prepare(`
      SELECT DISTINCT
        mtg_start as startTime,
        mtg_end as endTime,
        days
      FROM class_sections
      WHERE term = '2257' AND mtg_start IS NOT NULL
      ORDER BY days, mtg_start
    `).all();

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

    res.json({
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
    });
  } catch (error) {
    console.error('Error generating schedule:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/scheduler/reassign - Reassign a course to a different room/time
app.post('/api/scheduler/reassign', (req, res) => {
  try {
    const { assignmentId, newRoomId, newDays, newStartTime, newEndTime, currentSchedule } = req.body;

    if (!assignmentId || !currentSchedule) {
      return res.status(400).json({
        success: false,
        error: 'assignmentId and currentSchedule are required'
      });
    }

    // Find the assignment being changed
    const assignmentIndex = currentSchedule.assignments.findIndex(a => a.id === assignmentId);
    if (assignmentIndex === -1) {
      return res.status(404).json({ success: false, error: 'Assignment not found' });
    }

    const assignment = { ...currentSchedule.assignments[assignmentIndex] };
    const updatedAssignments = [...currentSchedule.assignments];

    // Update the assignment
    if (newRoomId) assignment.assignedRoom = newRoomId;
    if (newDays) assignment.days = newDays;
    if (newStartTime) assignment.startTime = newStartTime;
    if (newEndTime) assignment.endTime = newEndTime;

    // Check for conflicts with new assignment
    const conflictingAssignments = updatedAssignments.filter((a, idx) => {
      if (idx === assignmentIndex) return false;
      if (a.assignedRoom !== assignment.assignedRoom) return false;

      // Check day overlap
      const aDays = a.days ? a.days.split('') : [];
      const bDays = assignment.days ? assignment.days.split('') : [];
      const dayOverlap = aDays.some(d => bDays.includes(d));
      if (!dayOverlap) return false;

      // Check time overlap
      if (a.startTime < assignment.endTime && a.endTime > assignment.startTime) {
        return true;
      }
      return false;
    });

    assignment.hasConflict = conflictingAssignments.length > 0;
    assignment.conflictsWith = conflictingAssignments.map(a => a.id);
    assignment.notes = assignment.hasConflict
      ? `Conflict with: ${conflictingAssignments.map(a => a.course).join(', ')}`
      : assignment.previousRoom !== assignment.assignedRoom
        ? `Changed from room ${assignment.previousRoom}`
        : '';

    // Update any conflicting assignments
    conflictingAssignments.forEach(conflict => {
      const conflictIdx = updatedAssignments.findIndex(a => a.id === conflict.id);
      if (conflictIdx !== -1) {
        updatedAssignments[conflictIdx] = {
          ...updatedAssignments[conflictIdx],
          hasConflict: true,
          conflictsWith: [...(updatedAssignments[conflictIdx].conflictsWith || []), assignment.id],
          notes: `Conflict with: ${assignment.course}`
        };
      }
    });

    updatedAssignments[assignmentIndex] = assignment;

    // Recalculate statistics
    const conflictCount = updatedAssignments.filter(a => a.hasConflict).length;
    const roomChanges = updatedAssignments.filter(a =>
      a.previousRoom && a.assignedRoom !== a.previousRoom && !a.hasConflict
    ).length;

    res.json({
      success: true,
      data: {
        ...currentSchedule,
        conflictCount,
        roomChanges,
        assignments: updatedAssignments,
        lastModified: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error reassigning:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/scheduler/available-slots - Get available time slots for a room
app.get('/api/scheduler/available-slots', (req, res) => {
  try {
    const { roomId, currentSchedule } = req.query;

    if (!roomId) {
      return res.status(400).json({ success: false, error: 'roomId is required' });
    }

    // Get all unique time slots
    const allTimeSlots = db.prepare(`
      SELECT DISTINCT
        mtg_start as startTime,
        mtg_end as endTime,
        days
      FROM class_sections
      WHERE term = '2257' AND mtg_start IS NOT NULL
      ORDER BY days, mtg_start
    `).all();

    // If we have a current schedule, mark which slots are occupied
    let schedule = [];
    if (currentSchedule) {
      try {
        schedule = JSON.parse(currentSchedule).assignments || [];
      } catch (e) {
        schedule = [];
      }
    }

    const roomAssignments = schedule.filter(a => a.assignedRoom === roomId);

    const slotsWithAvailability = allTimeSlots.map(slot => {
      const isOccupied = roomAssignments.some(a => {
        const aDays = a.days ? a.days.split('') : [];
        const slotDays = slot.days ? slot.days.split('') : [];
        const dayOverlap = aDays.some(d => slotDays.includes(d));
        if (!dayOverlap) return false;
        return a.startTime < slot.endTime && a.endTime > slot.startTime;
      });

      const occupiedBy = isOccupied
        ? roomAssignments.find(a => {
            const aDays = a.days ? a.days.split('') : [];
            const slotDays = slot.days ? slot.days.split('') : [];
            const dayOverlap = aDays.some(d => slotDays.includes(d));
            if (!dayOverlap) return false;
            return a.startTime < slot.endTime && a.endTime > slot.startTime;
          })
        : null;

      return {
        ...slot,
        isAvailable: !isOccupied,
        occupiedBy: occupiedBy ? occupiedBy.course : null
      };
    });

    res.json({
      success: true,
      data: {
        roomId,
        slots: slotsWithAvailability
      }
    });
  } catch (error) {
    console.error('Error getting available slots:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/building6 - Building 6 planning analysis
app.get('/api/building6', (req, res) => {
  try {
    // Get Fall 2025 sections only
    const fall2025Sections = db.prepare(`
      SELECT * FROM class_sections WHERE term = '2257'
    `).all();

    // Get facilities
    const facilities = db.prepare(`
      SELECT * FROM facilities
    `).all();

    const ourFacilities = facilities.map(f => f.facility_id);

    // Define which rooms are Architecture drafting rooms (need special tables)
    const architectureDraftingRooms = ['4101', '4107', '4108', '6301', '6360'];

    // Define outliers - rooms that are special cases
    const outlierRooms = ['2111']; // Auditorium

    // Get Technology classes from Building 2 (candidates for Building 6)
    const building2Rooms = ['2128', '2129', '2130', '2132', '2133', '2134', '2135'];
    const building8Rooms = ['8216', '8217']; // 8216 moving to Cybersecurity rooms

    // Categorize current room usage
    const roomUsageAnalysis = {};

    facilities.forEach(f => {
      const roomSections = fall2025Sections.filter(s => s.facility_id === f.facility_id);

      // Determine if sections in this room are in-discipline or overflow
      const sectionDetails = roomSections.map(s => {
        const isOurDepartment = facilities.some(
          fac => fac.facility_id === f.facility_id && fac.acad_org === s.acad_org
        );

        return {
          course: `${s.course_prefix} ${s.course_number}`,
          description: s.class_descr,
          enrollment: s.tot_enrl || 0,
          days: s.days,
          startTime: s.mtg_start,
          endTime: s.mtg_end,
          instrMode: s.instr_mode,
          isInDiscipline: isOurDepartment,
          acadOrg: s.acad_org
        };
      });

      roomUsageAnalysis[f.facility_id] = {
        facilityId: f.facility_id,
        department: f.department,
        capacity: f.capacity,
        designation: f.designation,
        building: f.facility_id.charAt(0),
        totalSections: roomSections.length,
        inDisciplineSections: sectionDetails.filter(s => s.isInDiscipline).length,
        overflowSections: sectionDetails.filter(s => !s.isInDiscipline).length,
        avgEnrollment: sectionDetails.length > 0
          ? Math.round(sectionDetails.reduce((sum, s) => sum + s.enrollment, 0) / sectionDetails.length)
          : 0,
        maxEnrollment: sectionDetails.length > 0
          ? Math.max(...sectionDetails.map(s => s.enrollment))
          : 0,
        sections: sectionDetails,
        isOutlier: outlierRooms.includes(f.facility_id),
        isDraftingRoom: architectureDraftingRooms.includes(f.facility_id),
        isBuilding2: building2Rooms.includes(f.facility_id),
        isBuilding8: building8Rooms.includes(f.facility_id)
      };
    });

    // Identify Architecture lecture classes (non-drafting needs)
    const architectureLectureClasses = [];
    const architectureAcadOrg = 300020;

    fall2025Sections
      .filter(s => s.acad_org === architectureAcadOrg)
      .forEach(s => {
        const facility = facilities.find(f => f.facility_id === s.facility_id);
        const isInDraftingRoom = architectureDraftingRooms.includes(s.facility_id);
        const isOurRoom = ourFacilities.includes(s.facility_id);

        if (!isInDraftingRoom) {
          architectureLectureClasses.push({
            course: `${s.course_prefix} ${s.course_number}`,
            description: s.class_descr,
            currentRoom: s.facility_id,
            enrollment: s.tot_enrl || 0,
            days: s.days,
            startTime: s.mtg_start,
            endTime: s.mtg_end,
            instrMode: s.instr_mode,
            isOurRoom,
            roomDepartment: facility?.department || 'Unknown',
            roomDesignation: facility?.designation || 'Unknown',
            building: s.facility_id ? s.facility_id.charAt(0) : 'Unknown'
          });
        }
      });

    // Technology classes analysis - candidates for Building 6
    const technologyClasses = [];
    const technologyAcadOrg = 450060;

    fall2025Sections
      .filter(s => s.acad_org === technologyAcadOrg)
      .forEach(s => {
        const facility = facilities.find(f => f.facility_id === s.facility_id);
        const building = s.facility_id ? s.facility_id.charAt(0) : 'Unknown';

        technologyClasses.push({
          course: `${s.course_prefix} ${s.course_number}`,
          description: s.class_descr,
          currentRoom: s.facility_id,
          enrollment: s.tot_enrl || 0,
          days: s.days,
          startTime: s.mtg_start,
          endTime: s.mtg_end,
          instrMode: s.instr_mode,
          building,
          isBuilding2: building2Rooms.includes(s.facility_id),
          isBuilding8: building8Rooms.includes(s.facility_id),
          isBuilding6: building === '6',
          roomCapacity: facility?.capacity || 0,
          roomDesignation: facility?.designation || 'Unknown'
        });
      });

    // Count sections by enrollment size brackets
    const enrollmentBrackets = {
      small: { label: '1-20 students', min: 1, max: 20, count: 0, sections: [] },
      medium: { label: '21-30 students', min: 21, max: 30, count: 0, sections: [] },
      large: { label: '31-40 students', min: 31, max: 40, count: 0, sections: [] },
      xlarge: { label: '40+ students', min: 41, max: 999, count: 0, sections: [] }
    };

    // Analyze sections that could go to Building 6 (Technology from Building 2)
    const building6Candidates = technologyClasses.filter(s => s.isBuilding2 || s.isBuilding8);

    building6Candidates.forEach(s => {
      for (const bracket of Object.values(enrollmentBrackets)) {
        if (s.enrollment >= bracket.min && s.enrollment <= bracket.max) {
          bracket.count++;
          bracket.sections.push(s);
          break;
        }
      }
    });

    // Proposed Building 6 configuration
    const proposedBuilding6 = {
      floor3: {
        rooms: [
          { id: 'NEW-301', capacity: 40, designation: 'Computer Classroom', floor: 3 },
          { id: 'NEW-302', capacity: 40, designation: 'Computer Classroom', floor: 3 },
          { id: 'NEW-303', capacity: 40, designation: 'Computer Classroom', floor: 3 },
          { id: 'NEW-304', capacity: 40, designation: 'Computer Classroom', floor: 3 }
        ],
        totalCapacity: 160,
        totalRooms: 4
      },
      floor2: {
        rooms: [
          { id: 'NEW-201', capacity: 40, designation: 'Computer Classroom', floor: 2 },
          { id: 'NEW-202', capacity: 40, designation: 'Computer Classroom', floor: 2 },
          { id: 'NEW-203', capacity: 40, designation: 'Computer Classroom', floor: 2 },
          { id: 'NEW-204', capacity: 40, designation: 'Computer Classroom', floor: 2 }
        ],
        totalCapacity: 160,
        totalRooms: 4
      },
      floor1: {
        rooms: [
          { id: 'AI-COMMONS', capacity: 40, designation: 'AI Commons (Large Classroom)', floor: 1 }
        ],
        totalCapacity: 40,
        totalRooms: 1,
        note: 'First floor - new classrooms launching Fall 2026'
      }
    };

    // Calculate current capacity being replaced
    const currentBuilding2Capacity = building2Rooms.reduce((sum, roomId) => {
      const facility = facilities.find(f => f.facility_id === roomId);
      return sum + (facility?.capacity || 0);
    }, 0);

    const currentBuilding8Capacity = building8Rooms.reduce((sum, roomId) => {
      const facility = facilities.find(f => f.facility_id === roomId);
      return sum + (facility?.capacity || 0);
    }, 0);

    // Summary statistics
    const summary = {
      currentTechnologyRooms: {
        building2: building2Rooms.length,
        building8: building8Rooms.length,
        building6: facilities.filter(f => f.department === 'Technology' && f.facility_id.startsWith('6')).length,
        total: facilities.filter(f => f.department === 'Technology').length
      },
      currentCapacity: {
        building2: currentBuilding2Capacity,
        building8: currentBuilding8Capacity,
        total: facilities.filter(f => f.department === 'Technology').reduce((sum, f) => sum + f.capacity, 0)
      },
      proposedCapacity: {
        floors2and3: proposedBuilding6.floor2.totalCapacity + proposedBuilding6.floor3.totalCapacity,
        aiCommons: proposedBuilding6.floor1.totalCapacity,
        total: proposedBuilding6.floor2.totalCapacity + proposedBuilding6.floor3.totalCapacity + proposedBuilding6.floor1.totalCapacity
      },
      sectionsToMove: {
        fromBuilding2: technologyClasses.filter(s => s.isBuilding2).length,
        fromBuilding8: technologyClasses.filter(s => s.isBuilding8).length,
        total: building6Candidates.length
      },
      enrollmentDistribution: enrollmentBrackets,
      needsFifthRoom: enrollmentBrackets.large.count + enrollmentBrackets.xlarge.count > 32 // 4 rooms * 8 time slots rough estimate
    };

    // Instruction mode breakdown for candidates
    const instrModeBreakdown = {
      inPerson: building6Candidates.filter(s => s.instrMode === 'P').length,
      blended: building6Candidates.filter(s => s.instrMode === 'BL').length,
      online: building6Candidates.filter(s => s.instrMode === 'OL' || s.instrMode === 'RVS').length
    };

    res.json({
      success: true,
      data: {
        summary,
        proposedBuilding6,
        roomUsageAnalysis: Object.values(roomUsageAnalysis),
        architectureLectureClasses,
        technologyClasses,
        building6Candidates,
        instrModeBreakdown,
        currentRooms: {
          building2: building2Rooms.map(id => roomUsageAnalysis[id]).filter(Boolean),
          building8: building8Rooms.map(id => roomUsageAnalysis[id]).filter(Boolean)
        },
        notes: [
          '8216 classes will move to new Cybersecurity/Networking rooms in Building 6',
          '8217 is currently used as Architecture overflow',
          'Building 2 Technology classes are primary candidates for Building 6 floors 2-3',
          'Goal: Maintain seat count but potentially reduce room count',
          'Architecture needs drafting tables for most classes, except lecture-based classes',
          '2111 is an auditorium (outlier)'
        ]
      }
    });
  } catch (error) {
    console.error('Error generating Building 6 analysis:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
