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
      inPerson: building6Candidates.filter(s => s.instrMode && s.instrMode.startsWith('P')).length,
      blended: building6Candidates.filter(s => s.instrMode && s.instrMode.startsWith('BL')).length,
      online: building6Candidates.filter(s => s.instrMode && (s.instrMode.startsWith('OL') || s.instrMode.startsWith('RVS'))).length
    };

    // Room 8217 Analysis - Architecture Overflow
    const room8217 = roomUsageAnalysis['8217'];
    const room8217ArchSections = room8217 ? room8217.sections.filter(s => s.acadOrg === architectureAcadOrg) : [];

    // Room 8216 Analysis - Cybersecurity/Networking
    const room8216 = roomUsageAnalysis['8216'];
    const room8216Sections = room8216 ? room8216.sections : [];

    // Engineering Rooms Analysis - Goal 3
    const engineeringRooms = ['6302', '6315', '6317', '6359'];
    const engineeringAnalysis = engineeringRooms.map(roomId => {
      const room = roomUsageAnalysis[roomId];
      if (!room) return null;
      const avgEnroll = room.avgEnrollment || 0;
      const utilizationRate = room.capacity > 0 ? Math.round((avgEnroll / room.capacity) * 100) : 0;
      return {
        roomId,
        capacity: room.capacity,
        sections: room.totalSections,
        avgEnrollment: avgEnroll,
        maxEnrollment: room.maxEnrollment,
        utilizationRate,
        isOverCapacity: avgEnroll > room.capacity,
        courses: [...new Set(room.sections.map(s => s.course))]
      };
    }).filter(Boolean);

    const overCapacityRooms = engineeringAnalysis.filter(r => r.isOverCapacity);
    const highUtilRooms = engineeringAnalysis.filter(r => r.utilizationRate >= 90);
    const totalEngSections = engineeringAnalysis.reduce((sum, r) => sum + r.sections, 0);
    const totalEngCapacity = engineeringAnalysis.reduce((sum, r) => sum + r.capacity, 0);

    // Drafting room utilization
    const draftingRoomStats = architectureDraftingRooms.map(roomId => {
      const room = roomUsageAnalysis[roomId];
      return room ? { roomId, sections: room.totalSections, capacity: room.capacity } : null;
    }).filter(Boolean);
    const totalDraftingSections = draftingRoomStats.reduce((sum, r) => sum + r.sections, 0);

    // Key Findings - structured analysis with verdicts
    const keyFindings = {
      // Goal 1: Maintain seat count, reduce room count
      seatCapacity: {
        goal: 'Maintain seat count while reducing room count',
        currentSeats: summary.currentCapacity.total,
        proposedSeats: summary.proposedCapacity.total,
        seatDifference: summary.proposedCapacity.total - summary.currentCapacity.total,
        currentRooms: building2Rooms.length + building8Rooms.length,
        proposedRooms: 9, // 8 classrooms + 1 AI Commons
        status: Math.abs(summary.proposedCapacity.total - summary.currentCapacity.total) <= 10 ? 'success' : 'warning',
        verdict: summary.proposedCapacity.total >= summary.currentCapacity.total - 10
          ? `Seat count maintained (${summary.proposedCapacity.total} vs ${summary.currentCapacity.total} current)`
          : `Seat shortage: need ${summary.currentCapacity.total - summary.proposedCapacity.total} more seats`
      },

      // Goal 2: Architecture - validate need for additional drafting room
      architectureOverflow: {
        goal: 'Validate need for additional drafting room (8217 overflow)',
        room8217Sections: room8217ArchSections.length,
        room8217Courses: room8217ArchSections.map(s => s.course),
        currentDraftingRooms: architectureDraftingRooms.length,
        totalDraftingSections: totalDraftingSections,
        draftingRoomUtilization: draftingRoomStats,
        status: room8217ArchSections.length > 0 ? 'validated' : 'not_needed',
        verdict: room8217ArchSections.length > 0
          ? `VALIDATED: 8217 has ${room8217ArchSections.length} Architecture overflow sections - additional drafting room needed`
          : 'Current drafting rooms are sufficient'
      },

      // Goal 3: Engineering classrooms meet enrollment needs
      engineeringCapacity: {
        goal: 'Check Engineering classrooms meet enrollment needs',
        totalRooms: engineeringRooms.length,
        totalCapacity: totalEngCapacity,
        totalSections: totalEngSections,
        overCapacityRooms: overCapacityRooms.length,
        highUtilizationRooms: highUtilRooms.length,
        roomAnalysis: engineeringAnalysis,
        status: overCapacityRooms.length === 0 ? 'success' : 'warning',
        verdict: overCapacityRooms.length === 0
          ? `Engineering rooms are right-sized (${engineeringRooms.length} rooms, ${totalEngCapacity} seats, ${highUtilRooms.length} at high utilization)`
          : `WARNING: ${overCapacityRooms.length} Engineering room(s) over capacity - rooms ${overCapacityRooms.map(r => r.roomId).join(', ')} need larger capacity`
      },

      // Goal 4: Technology - Building 2 to Building 6 migration
      technologyMigration: {
        goal: 'Move Building 2 Technology classes to Building 6 floors 2-3',
        sectionsFromBuilding2: summary.sectionsToMove.fromBuilding2,
        sectionsFromBuilding8: summary.sectionsToMove.fromBuilding8,
        totalSectionsToMove: summary.sectionsToMove.total,
        proposedRooms: 8,
        roomCapacity: 40,
        fitAnalysis: {
          under40: enrollmentBrackets.small.count + enrollmentBrackets.medium.count + enrollmentBrackets.large.count,
          over40: enrollmentBrackets.xlarge.count,
          allFitIn40Seat: enrollmentBrackets.xlarge.count <= 1
        },
        status: enrollmentBrackets.xlarge.count <= 2 ? 'success' : 'warning',
        verdict: `${summary.sectionsToMove.total} sections can migrate to 8 × 40-seat rooms (${enrollmentBrackets.xlarge.count} section(s) slightly over capacity)`
      },

      // Goal 5: Room 8216 to Cybersecurity/Networking on Floor 1
      cybersecurityMigration: {
        goal: 'Move 8216 classes to Cybersecurity/Networking rooms on Building 6 Floor 1',
        currentRoom: '8216',
        currentCapacity: room8216?.capacity || 0,
        sectionsToMove: room8216Sections.length,
        courses: [...new Set(room8216Sections.map(s => s.course))],
        proposedLocation: 'Building 6, Floor 1 - Cybersecurity/Networking Labs',
        status: 'ready',
        verdict: `${room8216Sections.length} Cybersecurity/Networking sections ready to move to Building 6 Floor 1`
      }
    };

    // Actionable Options for Decision Makers (matching TypeScript interface)
    const actionableOptions = [
      {
        id: 'A',
        name: 'Full Migration',
        description: 'Complete Building 6 buildout with all proposed rooms. Maximum investment for maximum flexibility and modernization.',
        pros: [
          `${summary.proposedCapacity.total} total seats in modern facilities`,
          `${summary.sectionsToMove.total} Technology sections relocated from Building 2`,
          `${room8216Sections.length} Cybersecurity sections in dedicated Floor 1 labs`,
          room8217ArchSections.length > 0 ? 'Additional drafting room addresses Architecture overflow' : 'Architecture needs met',
          'AI Commons provides flexible collaboration space',
          'All departments benefit simultaneously'
        ],
        cons: [
          'Highest capital investment required',
          'Construction timeline dependencies',
          'Disruption during transition period'
        ],
        impact: {
          capacityGoal: 'fully_met',
          architectureGoal: 'fully_met',
          engineeringGoal: 'fully_met',
          technologyGoal: 'fully_met',
          cybersecurityGoal: 'fully_met'
        },
        estimatedCost: 'high',
        implementationTime: 'long_term',
        recommendation: 'recommended'
      },
      {
        id: 'B',
        name: 'Technology Focus Only',
        description: 'Prioritize Building 2 Technology migration to Building 6 floors 2-3, defer other changes.',
        pros: [
          `${summary.sectionsToMove.fromBuilding2} Building 2 sections moved to Building 6`,
          'Building 2 rooms freed for other departments',
          '8 new 40-seat computer classrooms',
          'Lower initial investment than full migration'
        ],
        cons: [
          '8216 Cybersecurity remains in Building 8',
          'Architecture overflow unaddressed',
          'AI Commons delayed',
          'May require future construction for remaining goals'
        ],
        impact: {
          capacityGoal: 'fully_met',
          architectureGoal: 'not_addressed',
          engineeringGoal: 'not_addressed',
          technologyGoal: 'fully_met',
          cybersecurityGoal: 'not_addressed'
        },
        estimatedCost: 'medium',
        implementationTime: 'long_term',
        recommendation: 'alternative'
      },
      {
        id: 'C',
        name: 'Phased Approach',
        description: 'Phase 1: Floors 2-3 (Fall 2026), Phase 2: Floor 1 (Fall 2027). Spreads investment over two years.',
        pros: [
          'Phase 1: Technology migration complete',
          'Phase 2: Cybersecurity labs + AI Commons',
          'Lower annual budget impact',
          'Allows adjustment between phases'
        ],
        cons: [
          'Delayed Cybersecurity relocation',
          'Two construction disruptions',
          'Potential inflation on Phase 2 costs',
          'Extended timeline for full benefits'
        ],
        impact: {
          capacityGoal: 'fully_met',
          architectureGoal: 'partially_met',
          engineeringGoal: 'partially_met',
          technologyGoal: 'fully_met',
          cybersecurityGoal: 'partially_met'
        },
        estimatedCost: 'medium',
        implementationTime: 'long_term',
        recommendation: 'alternative'
      },
      {
        id: 'D',
        name: 'Minimal Intervention',
        description: 'Only address critical capacity issues in current buildings. Equipment and furniture upgrades only.',
        pros: [
          'Lowest cost option',
          'Immediate implementation possible',
          `Address ${overCapacityRooms.length} over-capacity Engineering rooms`,
          'No construction required',
          'Minimal disruption'
        ],
        cons: [
          'Building 2 aging infrastructure remains',
          'No modernization of facilities',
          'Technology growth constrained',
          'Does not address long-term needs',
          'Most goals remain unaddressed'
        ],
        impact: {
          capacityGoal: 'not_addressed',
          architectureGoal: 'not_addressed',
          engineeringGoal: 'partially_met',
          technologyGoal: 'not_addressed',
          cybersecurityGoal: 'not_addressed'
        },
        estimatedCost: 'low',
        implementationTime: 'immediate',
        recommendation: 'not_recommended'
      },
      {
        id: 'E',
        name: 'Hybrid - Larger Rooms',
        description: 'Fewer but larger classrooms (50-seat) to maximize flexibility. 6 rooms instead of 8.',
        pros: [
          'Better handles enrollment growth',
          'More flexible for larger sections',
          'All goals addressed',
          'Fewer rooms to maintain',
          'Future-proofed for growth'
        ],
        cons: [
          '20 fewer total seats than Option A',
          'Some sections may be too small for 50-seat rooms',
          'Higher per-room cost',
          'Less scheduling flexibility with fewer rooms'
        ],
        impact: {
          capacityGoal: 'partially_met',
          architectureGoal: 'fully_met',
          engineeringGoal: 'fully_met',
          technologyGoal: 'fully_met',
          cybersecurityGoal: 'fully_met'
        },
        estimatedCost: 'high',
        implementationTime: 'long_term',
        recommendation: 'alternative'
      }
    ];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          summary,
          keyFindings,
          actionableOptions,
          proposedBuilding6,
          roomUsageAnalysis: Object.values(roomUsageAnalysis),
          architectureLectureClasses,
          technologyClasses,
          building6Candidates,
          instrModeBreakdown,
          engineeringAnalysis,
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
