/**
 * Export SQLite data to JSON for Netlify Functions
 * Run: node scripts/exportData.cjs
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'mdc_scheduling.db');
const outputDir = path.join(__dirname, '..', 'netlify', 'functions', 'data');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const db = new Database(dbPath);

// Export facilities
const facilities = db.prepare('SELECT * FROM facilities').all();
fs.writeFileSync(
  path.join(outputDir, 'facilities.json'),
  JSON.stringify(facilities, null, 2)
);
console.log(`Exported ${facilities.length} facilities`);

// Export class sections
const sections = db.prepare('SELECT * FROM class_sections').all();
fs.writeFileSync(
  path.join(outputDir, 'sections.json'),
  JSON.stringify(sections, null, 2)
);
console.log(`Exported ${sections.length} class sections`);

// Pre-compute analytics data for each term
const terms = db.prepare('SELECT DISTINCT term FROM class_sections ORDER BY term DESC').all();
const termLabels = {
  '2237': 'Fall 2023',
  '2247': 'Fall 2024',
  '2257': 'Fall 2025',
  '2267': 'Fall 2026'
};

const availableTerms = terms.map(t => ({
  code: t.term,
  label: termLabels[t.term] || t.term
}));

// Compute term summaries
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

// Compute department summaries
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

// Compute room utilization for all terms combined
const roomUtilizationAll = db.prepare(`
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

// Compute room utilization per term
const roomUtilizationByTerm = {};
for (const term of terms) {
  roomUtilizationByTerm[term.term] = db.prepare(`
    SELECT
      f.facility_id as facilityId,
      f.department,
      f.capacity,
      f.designation,
      COUNT(cs.id) as totalSections,
      ROUND(AVG(cs.tot_enrl), 1) as avgEnrollment,
      ROUND(AVG(CAST(cs.tot_enrl AS FLOAT) / NULLIF(f.capacity, 0) * 100), 1) as utilizationRate
    FROM facilities f
    LEFT JOIN class_sections cs ON f.facility_id = cs.facility_id AND cs.term = ?
    GROUP BY f.facility_id
    ORDER BY f.department, f.facility_id
  `).all(term.term);
}

// Compute courses by department
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

// Compute time slot analysis
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

// Compute enrollment trends
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

// Save analytics data
const analyticsData = {
  availableTerms,
  termSummaries,
  departmentSummaries,
  roomUtilizationAll,
  roomUtilizationByTerm,
  coursesByDepartment,
  timeSlotAnalysis,
  enrollmentTrends
};

fs.writeFileSync(
  path.join(outputDir, 'analytics.json'),
  JSON.stringify(analyticsData, null, 2)
);
console.log('Exported pre-computed analytics');

db.close();
console.log('\nData export complete! Files saved to:', outputDir);
