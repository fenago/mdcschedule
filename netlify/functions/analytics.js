import analyticsData from './data/analytics.json' with { type: 'json' };

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
    const term = params.term;

    // Use term-specific room utilization if a term is selected, otherwise use all data
    let roomUtilization;
    if (term && analyticsData.roomUtilizationByTerm[term]) {
      roomUtilization = analyticsData.roomUtilizationByTerm[term];
    } else {
      roomUtilization = analyticsData.roomUtilizationAll;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          availableTerms: analyticsData.availableTerms,
          selectedTerm: term || 'all',
          termSummaries: analyticsData.termSummaries,
          departmentSummaries: analyticsData.departmentSummaries,
          roomUtilization,
          coursesByDepartment: analyticsData.coursesByDepartment,
          timeSlotAnalysis: analyticsData.timeSlotAnalysis,
          enrollmentTrends: analyticsData.enrollmentTrends,
        },
      }),
    };
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};
