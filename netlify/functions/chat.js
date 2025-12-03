import Anthropic from '@anthropic-ai/sdk';
import facilitiesData from './data/facilities.json' with { type: 'json' };
import sectionsData from './data/sections.json' with { type: 'json' };
import analyticsData from './data/analytics.json' with { type: 'json' };

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function getDataContext() {
  // Prepare facilities data
  const facilities = facilitiesData.map(f => ({
    department: f.department,
    facility_id: f.facility_id,
    capacity: f.capacity,
    designation: f.designation
  }));

  // Compute term stats from sections
  const termStats = {};
  sectionsData.forEach(s => {
    if (!termStats[s.term]) {
      termStats[s.term] = { sections: 0, enrollment: 0, sizes: [] };
    }
    termStats[s.term].sections++;
    termStats[s.term].enrollment += s.tot_enrl || 0;
    if (s.tot_enrl) termStats[s.term].sizes.push(s.tot_enrl);
  });

  const termStatsArray = Object.entries(termStats).map(([term, data]) => ({
    term,
    sections: data.sections,
    enrollment: data.enrollment,
    avgSize: data.sizes.length > 0
      ? Math.round(data.sizes.reduce((a, b) => a + b, 0) / data.sizes.length * 10) / 10
      : 0
  }));

  // Compute department stats
  const deptStats = analyticsData.departmentSummaries;

  // Compute room usage from analytics
  const roomUsage = analyticsData.roomUtilizationAll.map(r => ({
    facility_id: r.facilityId,
    department: r.department,
    capacity: r.capacity,
    totalSections: r.totalSections,
    avgEnrollment: r.avgEnrollment,
    utilizationPct: r.utilizationRate
  }));

  // Compute instruction modes from sections
  const instrModes = {};
  sectionsData.forEach(s => {
    const key = `${s.term}-${s.instr_mode}`;
    if (!instrModes[key]) {
      instrModes[key] = { term: s.term, instr_mode: s.instr_mode, count: 0 };
    }
    instrModes[key].count++;
  });
  const instrModesArray = Object.values(instrModes);

  // Get room 8217 usage
  const room8217Usage = sectionsData
    .filter(s => s.facility_id === '8217')
    .map(s => ({
      term: s.term,
      course: `${s.course_prefix} ${s.course_number}`,
      class_descr: s.class_descr,
      tot_enrl: s.tot_enrl,
      days: s.days,
      mtg_start: s.mtg_start,
      mtg_end: s.mtg_end
    }))
    .sort((a, b) => a.term.localeCompare(b.term));

  return `
## MDC Scheduling Database Context

### Facilities (${facilities.length} rooms total)
${JSON.stringify(facilities, null, 2)}

### Term Statistics
${JSON.stringify(termStatsArray, null, 2)}

### Department Statistics
${JSON.stringify(deptStats, null, 2)}

### Room Utilization
${JSON.stringify(roomUsage, null, 2)}

### Instruction Modes by Term
${JSON.stringify(instrModesArray, null, 2)}

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
}

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
    const { message, history = [] } = JSON.parse(event.body);

    if (!message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Message is required' }),
      };
    }

    const dataContext = getDataContext();

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

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          message: assistantMessage,
        },
      }),
    };
  } catch (error) {
    console.error('Error in chat:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};
