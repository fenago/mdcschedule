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
    // Get course trends across terms
    const courseMap = {};
    sectionsData.forEach(s => {
      const key = `${s.course_prefix}-${s.course_number}`;
      if (!courseMap[key]) {
        courseMap[key] = {
          course: `${s.course_prefix} ${s.course_number}`,
          description: s.class_descr,
          sections_2237: 0, sections_2247: 0, sections_2257: 0,
          enrl_2237: 0, enrl_2247: 0, enrl_2257: 0,
          sizes: []
        };
      }
      const cm = courseMap[key];
      if (s.term === '2237') {
        cm.sections_2237++;
        cm.enrl_2237 += s.tot_enrl || 0;
      } else if (s.term === '2247') {
        cm.sections_2247++;
        cm.enrl_2247 += s.tot_enrl || 0;
      } else if (s.term === '2257') {
        cm.sections_2257++;
        cm.enrl_2257 += s.tot_enrl || 0;
      }
      if (s.tot_enrl) cm.sizes.push(s.tot_enrl);
    });

    const courseTrends = Object.values(courseMap).map(c => ({
      ...c,
      avg_class_size: c.sizes.length > 0
        ? Math.round(c.sizes.reduce((a, b) => a + b, 0) / c.sizes.length * 10) / 10
        : 0
    })).sort((a, b) => b.enrl_2257 - a.enrl_2257);

    // Calculate growth rates and recommendations
    const recommendations = courseTrends.map(course => {
      const growth2247to2257 = course.enrl_2247 > 0
        ? ((course.enrl_2257 - course.enrl_2247) / course.enrl_2247 * 100).toFixed(1)
        : null;

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

    // Get room recommendations - compute utilization for Fall 2025
    const roomUsageMap = {};
    facilitiesData.forEach(f => {
      roomUsageMap[f.facility_id] = {
        facility_id: f.facility_id,
        department: f.department,
        capacity: f.capacity,
        designation: f.designation,
        total_sections: 0,
        enrollments: []
      };
    });

    sectionsData
      .filter(s => s.term === '2257')
      .forEach(s => {
        if (roomUsageMap[s.facility_id]) {
          roomUsageMap[s.facility_id].total_sections++;
          if (s.tot_enrl) roomUsageMap[s.facility_id].enrollments.push(s.tot_enrl);
        }
      });

    const roomUsage = Object.values(roomUsageMap).map(r => ({
      ...r,
      avg_enrollment: r.enrollments.length > 0
        ? Math.round(r.enrollments.reduce((a, b) => a + b, 0) / r.enrollments.length * 10) / 10
        : null,
      utilization_pct: r.enrollments.length > 0 && r.capacity > 0
        ? Math.round(r.enrollments.reduce((a, b) => a + b, 0) / r.enrollments.length / r.capacity * 1000) / 10
        : null
    })).sort((a, b) => (b.utilization_pct || 0) - (a.utilization_pct || 0));

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

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          summary,
          courseRecommendations: recommendations,
          roomRecommendations,
          targetTerm: '2267',
          basedOnTerm: '2257'
        }
      }),
    };
  } catch (error) {
    console.error('Error generating recommendations:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};
