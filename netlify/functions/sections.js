import sectionsData from './data/sections.json' with { type: 'json' };
import facilitiesData from './data/facilities.json' with { type: 'json' };

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
    const params = event.queryStringParameters || {};

    // Transform sections to match expected API format
    let sections = sectionsData.map(s => ({
      id: s.id,
      term: s.term,
      acadOrg: s.acad_org,
      classNbr: s.class_nbr,
      coursePrefix: s.course_prefix,
      courseNumber: s.course_number,
      classDescr: s.class_descr,
      component: s.component,
      totEnrl: s.tot_enrl,
      capEnrl: s.cap_enrl,
      sessionCode: s.session_code,
      startDate: s.start_date,
      endDate: s.end_date,
      days: s.days,
      mtgStart: s.mtg_start,
      mtgEnd: s.mtg_end,
      instrMode: s.instr_mode,
      facilityId: s.facility_id
    }));

    // Apply filters
    if (params.term) {
      sections = sections.filter(s => s.term === params.term);
    }

    if (params.facilityId) {
      sections = sections.filter(s => s.facilityId === params.facilityId);
    }

    if (params.department) {
      // Find acad_orgs for this department
      const deptAcadOrgs = facilitiesData
        .filter(f => f.department === params.department)
        .map(f => f.acad_org);
      sections = sections.filter(s => deptAcadOrgs.includes(s.acadOrg));
    }

    // Sort by term and meeting start time
    sections.sort((a, b) => {
      if (a.term !== b.term) return a.term.localeCompare(b.term);
      if (!a.mtgStart) return 1;
      if (!b.mtgStart) return -1;
      return a.mtgStart.localeCompare(b.mtgStart);
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, data: sections }),
    };
  } catch (error) {
    console.error('Error fetching sections:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};
