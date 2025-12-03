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
    // Transform to match expected API format
    const facilities = facilitiesData.map(f => ({
      id: f.id,
      department: f.department,
      acadOrg: f.acad_org,
      facilityId: f.facility_id,
      capacity: f.capacity,
      designation: f.designation
    })).sort((a, b) => {
      if (a.department !== b.department) return a.department.localeCompare(b.department);
      return a.facilityId.localeCompare(b.facilityId);
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, data: facilities }),
    };
  } catch (error) {
    console.error('Error fetching facilities:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};
