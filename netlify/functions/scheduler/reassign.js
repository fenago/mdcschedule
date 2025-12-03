export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' }),
    };
  }

  try {
    const { assignmentId, newRoomId, newDays, newStartTime, newEndTime, currentSchedule } = JSON.parse(event.body);

    if (!assignmentId || !currentSchedule) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'assignmentId and currentSchedule are required'
        }),
      };
    }

    // Find the assignment being changed
    const assignmentIndex = currentSchedule.assignments.findIndex(a => a.id === assignmentId);
    if (assignmentIndex === -1) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'Assignment not found' }),
      };
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
      const assignmentDays = assignment.days ? assignment.days.split('') : [];
      const daysOverlap = aDays.some(d => assignmentDays.includes(d));
      if (!daysOverlap) return false;

      // Check time overlap
      if (a.startTime < assignment.endTime && a.endTime > assignment.startTime) {
        return true;
      }
      return false;
    });

    // Update conflict status
    assignment.hasConflict = conflictingAssignments.length > 0;
    assignment.notes = assignment.hasConflict
      ? `Conflicts with: ${conflictingAssignments.map(c => c.course).join(', ')}`
      : (assignment.assignedRoom !== assignment.previousRoom
          ? `Moved from room ${assignment.previousRoom}`
          : '');

    // Update the assignments array
    updatedAssignments[assignmentIndex] = assignment;

    // Recalculate statistics
    const conflictCount = updatedAssignments.filter(a => a.hasConflict).length;
    const roomChanges = updatedAssignments.filter(a =>
      a.previousRoom && a.assignedRoom !== a.previousRoom && !a.hasConflict
    ).length;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          ...currentSchedule,
          conflictCount,
          roomChanges,
          assignments: updatedAssignments,
          lastModified: new Date().toISOString()
        }
      }),
    };
  } catch (error) {
    console.error('Error reassigning course:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};
