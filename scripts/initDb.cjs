const Database = require('better-sqlite3');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'mdc_scheduling.db');

// Remove existing database
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('Removed existing database');
}

const db = new Database(dbPath);

console.log('Creating database schema...');

// Create tables
db.exec(`
  CREATE TABLE facilities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    department TEXT NOT NULL,
    acad_org INTEGER NOT NULL,
    facility_id TEXT NOT NULL UNIQUE,
    capacity INTEGER NOT NULL,
    designation TEXT
  );

  CREATE TABLE class_sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    term TEXT NOT NULL,
    acad_org INTEGER NOT NULL,
    class_nbr INTEGER NOT NULL,
    course_prefix TEXT NOT NULL,
    course_number TEXT NOT NULL,
    class_descr TEXT,
    component TEXT,
    tot_enrl INTEGER,
    cap_enrl INTEGER,
    session_code TEXT,
    start_date TEXT,
    end_date TEXT,
    days TEXT,
    mtg_start TEXT,
    mtg_end TEXT,
    instr_mode TEXT,
    facility_id TEXT,
    UNIQUE(term, class_nbr)
  );

  CREATE INDEX idx_sections_term ON class_sections(term);
  CREATE INDEX idx_sections_facility ON class_sections(facility_id);
  CREATE INDEX idx_sections_acad_org ON class_sections(acad_org);
  CREATE INDEX idx_facilities_department ON facilities(department);
`);

console.log('Schema created successfully');

// Helper to convert Excel time (decimal) to HH:MM format
function excelTimeToString(decimal) {
  if (!decimal || typeof decimal !== 'number') return null;
  const totalMinutes = Math.round(decimal * 24 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Helper to convert Excel date to YYYY-MM-DD
function excelDateToString(serial) {
  if (!serial || typeof serial !== 'number') return null;
  const date = new Date((serial - 25569) * 86400 * 1000);
  return date.toISOString().split('T')[0];
}

// Helper to parse facility ID from "2000 XXXX-00" format
function parseFacilityId(raw) {
  if (!raw) return null;
  const match = String(raw).match(/(\d{4})-?\d*/);
  return match ? match[1] : String(raw);
}

// Load facilities
console.log('Loading facilities...');
const facilitiesPath = path.join(__dirname, '..', 'research', 'Facilities.xlsx');
const facilitiesWb = XLSX.readFile(facilitiesPath);
const facilitiesData = XLSX.utils.sheet_to_json(facilitiesWb.Sheets['Facility']);

const insertFacility = db.prepare(`
  INSERT INTO facilities (department, acad_org, facility_id, capacity, designation)
  VALUES (?, ?, ?, ?, ?)
`);

let facilityCount = 0;
for (const row of facilitiesData) {
  if (row.Department === 'Total') continue; // Skip total row
  if (!row['Facility ID']) continue;

  insertFacility.run(
    row.Department,
    row['Acad Org'],
    String(row['Facility ID']),
    row.Capacity,
    row.Designation
  );
  facilityCount++;
}
console.log(`Loaded ${facilityCount} facilities`);

// Load room usage data
console.log('Loading room usage data...');
const roomUsagePath = path.join(__dirname, '..', 'research', 'Room usage_2237-2247-2257.xlsx');
const roomUsageWb = XLSX.readFile(roomUsagePath);

const insertSection = db.prepare(`
  INSERT OR IGNORE INTO class_sections
  (term, acad_org, class_nbr, course_prefix, course_number, class_descr, component,
   tot_enrl, cap_enrl, session_code, start_date, end_date, days, mtg_start, mtg_end,
   instr_mode, facility_id)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let sectionCount = 0;
for (const term of roomUsageWb.SheetNames) {
  const data = XLSX.utils.sheet_to_json(roomUsageWb.Sheets[term]);

  for (const row of data) {
    const facilityId = parseFacilityId(row['Facility ID']);

    insertSection.run(
      term,
      row['Acad Org'],
      row['Class Nbr'],
      row['Course Prefix (Subject)'],
      row['Course Number (Catalog Nbr)'],
      row['Class Descr'],
      row['Comp'],
      row['Tot Enrl'],
      row['Cap Enrl'],
      row['Session Code'],
      excelDateToString(row['Start Date']),
      excelDateToString(row['End Date']),
      row['Concat Days'],
      excelTimeToString(row['Mtg Start']),
      excelTimeToString(row['Mtg End']),
      row['Instr Mode'],
      facilityId
    );
    sectionCount++;
  }
  console.log(`  Term ${term}: loaded ${data.length} sections`);
}

console.log(`Total sections loaded: ${sectionCount}`);

// Verify data
const facilityCheck = db.prepare('SELECT COUNT(*) as count FROM facilities').get();
const sectionCheck = db.prepare('SELECT COUNT(*) as count FROM class_sections').get();

console.log('\nDatabase verification:');
console.log(`  Facilities: ${facilityCheck.count}`);
console.log(`  Class sections: ${sectionCheck.count}`);

db.close();
console.log('\nDatabase initialized successfully!');
