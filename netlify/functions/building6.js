import facilitiesData from './data/facilities.json' with { type: 'json' };
import sectionsData from './data/sections.json' with { type: 'json' };

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
    // Get Fall 2025 sections only
    const fall2025Sections = sectionsData.filter(s => s.term === '2257');

    // Our facilities only (from the facilities file)
    const ourFacilities = facilitiesData.map(f => f.facility_id);

    // Define which rooms are Architecture drafting rooms (need special tables)
    const architectureDraftingRooms = ['4101', '4107', '4108', '6301', '6360'];

    // Define outliers - rooms that are special cases
    const outlierRooms = ['2111']; // Auditorium

    // Get Technology classes from Building 2 (candidates for Building 6)
    const building2Rooms = ['2128', '2129', '2130', '2132', '2133', '2134', '2135'];
    const building8Rooms = ['8216', '8217']; // 8216 moving to Cybersecurity rooms

    // Categorize current room usage
    const roomUsageAnalysis = {};

    facilitiesData.forEach(f => {
      const roomSections = fall2025Sections.filter(s => s.facility_id === f.facility_id);

      // Determine if sections in this room are in-discipline or overflow
      const sectionDetails = roomSections.map(s => {
        const isOurDepartment = facilitiesData.some(
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
        const facility = facilitiesData.find(f => f.facility_id === s.facility_id);
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
        const facility = facilitiesData.find(f => f.facility_id === s.facility_id);
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
      const facility = facilitiesData.find(f => f.facility_id === roomId);
      return sum + (facility?.capacity || 0);
    }, 0);

    const currentBuilding8Capacity = building8Rooms.reduce((sum, roomId) => {
      const facility = facilitiesData.find(f => f.facility_id === roomId);
      return sum + (facility?.capacity || 0);
    }, 0);

    // Summary statistics
    const summary = {
      currentTechnologyRooms: {
        building2: building2Rooms.length,
        building8: building8Rooms.length,
        building6: facilitiesData.filter(f => f.department === 'Technology' && f.facility_id.startsWith('6')).length,
        total: facilitiesData.filter(f => f.department === 'Technology').length
      },
      currentCapacity: {
        building2: currentBuilding2Capacity,
        building8: currentBuilding8Capacity,
        total: facilitiesData.filter(f => f.department === 'Technology').reduce((sum, f) => sum + f.capacity, 0)
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

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
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
      }),
    };
  } catch (error) {
    console.error('Error generating Building 6 analysis:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};
