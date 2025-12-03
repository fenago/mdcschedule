const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk').default;
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Database connection
const dbPath = path.join(__dirname, 'data', 'mdc_scheduling.db');
const db = new Database(dbPath, { readonly: true });

// Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Facilities endpoint
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

// Sections endpoint
app.get('/api/sections', (req, res) => {
  try {
    const { term, facilityId, department } = req.query;
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
    const params = [];

    if (term) {
      query += ' AND term = ?';
      params.push(term);
    }
    if (facilityId) {
      query += ' AND facility_id = ?';
      params.push(facilityId);
    }
    if (department) {
      query += ' AND acad_org IN (SELECT acad_org FROM facilities WHERE department = ?)';
      params.push(department);
    }

    query += ' ORDER BY term, mtg_start';
    const sections = db.prepare(query).all(...params);
    res.json({ success: true, data: sections });
  } catch (error) {
    console.error('Error fetching sections:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Analytics endpoint
app.get('/api/analytics', (req, res) => {
  try {
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
      LEFT JOIN class_sections cs ON f.facility_id = cs.facility_id
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

// Chat endpoint
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
      SELECT term, COUNT(*) as sections, SUM(tot_enrl) as enrollment, ROUND(AVG(tot_enrl), 1) as avgSize
      FROM class_sections
      GROUP BY term
    `).all();

    const deptStats = db.prepare(`
      SELECT f.department, COUNT(DISTINCT f.facility_id) as rooms, SUM(DISTINCT f.capacity) as capacity,
             COUNT(cs.id) as sections, ROUND(AVG(cs.tot_enrl), 1) as avgEnrollment
      FROM facilities f
      LEFT JOIN class_sections cs ON f.facility_id = cs.facility_id
      GROUP BY f.department
    `).all();

    const dataContext = `
## MDC Scheduling Database Context
### Facilities (${facilities.length} rooms): ${JSON.stringify(facilities)}
### Term Statistics: ${JSON.stringify(termStats)}
### Department Statistics: ${JSON.stringify(deptStats)}
### Key Context:
- Terms: 2237 (Fall 2023), 2247 (Fall 2024), 2257 (Fall 2025)
- Departments: Architecture, Engineering, Technology
- Building 6 first floor has new classrooms launching Fall 2026
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
      ...history.map((msg) => ({ role: msg.role, content: msg.content })),
      { role: 'user', content: message },
    ];

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    res.json({
      success: true,
      data: { message: response.content[0].text },
    });
  } catch (error) {
    console.error('Error in chat:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
