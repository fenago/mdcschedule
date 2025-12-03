const xlsx = require('xlsx');
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'mdc_scheduling.db');
const db = new Database(dbPath);

// Helper to convert Excel date serial to ISO date
function excelDateToISO(serial) {
  if (!serial || typeof serial !== 'number') return null;
  const date = new Date((serial - 25569) * 86400 * 1000);
  return date.toISOString().split('T')[0];
}

// Helper to convert Excel time fraction to HH:MM
function excelTimeToHHMM(fraction) {
  if (!fraction || typeof fraction !== 'number') return null;
  const totalMinutes = Math.round(fraction * 24 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Extract room ID from "2000 4101-00" format -> "4101"
function extractRoomId(facilityStr) {
  if (!facilityStr || facilityStr === '-') return null;
  const parts = facilityStr.toString().split(' ');
  if (parts.length < 2) return facilityStr;
  // Get the room part (e.g., "4101-00") and remove suffix
  const roomPart = parts[1].split('-')[0];
  return roomPart;
}

// Term code mapping
const termMap = {
  '2237': 'Fall 2023',
  '2247': 'Fall 2024',
  '2257': 'Fall 2025'
};

console.log('Re-importing class sections data...\n');

// Clear existing class sections
db.exec('DELETE FROM class_sections');
console.log('Cleared existing class_sections data\n');

// Read Excel file
const wb = xlsx.readFile(path.join(__dirname, '..', 'research', 'Room usage_2237-2247-2257.xlsx'));

// Prepare insert statement
const insert = db.prepare(`
  INSERT INTO class_sections (
    term, acad_org, class_nbr, course_prefix, course_number,
    class_descr, component, tot_enrl, cap_enrl, session_code,
    start_date, end_date, days, mtg_start, mtg_end,
    instr_mode, facility_id
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let totalImported = 0;
const facilityIdCounts = {};

// Process each sheet (2237, 2247, 2257)
wb.SheetNames.forEach(sheetName => {
  const term = sheetName;
  const sheet = wb.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  console.log(`Processing ${termMap[term] || term} (Term ${term}): ${rows.length - 1} rows`);

  let imported = 0;
  let skipped = 0;

  rows.slice(1).forEach((row, idx) => {
    if (!row[0]) {
      skipped++;
      return; // Skip empty rows
    }

    const facilityRaw = row[15] ? row[15].toString() : null;
    const facilityId = extractRoomId(facilityRaw);

    // Track facility IDs
    if (facilityId) {
      facilityIdCounts[facilityId] = (facilityIdCounts[facilityId] || 0) + 1;
    }

    try {
      insert.run(
        term,
        parseInt(row[0]) || 0,    // acad_org
        parseInt(row[1]) || 0,    // class_nbr
        row[2] || '',             // course_prefix
        row[3] ? row[3].toString() : '', // course_number
        row[4] || '',             // class_descr
        row[5] || '',             // component
        parseInt(row[6]) || 0,    // tot_enrl
        parseInt(row[7]) || 0,    // cap_enrl
        row[8] ? row[8].toString() : '', // session_code
        excelDateToISO(row[9]),   // start_date
        excelDateToISO(row[10]),  // end_date
        row[11] || null,          // days
        excelTimeToHHMM(row[12]), // mtg_start
        excelTimeToHHMM(row[13]), // mtg_end
        row[14] || '',            // instr_mode
        facilityId                // facility_id (extracted room number)
      );
      imported++;
    } catch (err) {
      console.error(`  Error on row ${idx + 2}:`, err.message);
      skipped++;
    }
  });

  console.log(`  Imported: ${imported}, Skipped: ${skipped}\n`);
  totalImported += imported;
});

console.log(`\nTotal imported: ${totalImported} sections`);
console.log('\nFacility ID distribution:');
Object.entries(facilityIdCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([id, count]) => {
    console.log(`  Room ${id}: ${count} sections`);
  });

// Verify the import
const verification = db.prepare(`
  SELECT
    term,
    COUNT(*) as section_count,
    COUNT(DISTINCT facility_id) as room_count
  FROM class_sections
  GROUP BY term
  ORDER BY term
`).all();

console.log('\nVerification by term:');
verification.forEach(row => {
  console.log(`  ${termMap[row.term] || row.term}: ${row.section_count} sections, ${row.room_count} rooms`);
});

// Check which facility_ids match with facilities table
const matchCheck = db.prepare(`
  SELECT
    cs.facility_id,
    COUNT(*) as section_count,
    CASE WHEN f.facility_id IS NOT NULL THEN 'Yes' ELSE 'No' END as in_facilities
  FROM class_sections cs
  LEFT JOIN facilities f ON cs.facility_id = f.facility_id
  WHERE cs.facility_id IS NOT NULL
  GROUP BY cs.facility_id
  ORDER BY section_count DESC
`).all();

console.log('\nFacility ID match check (sections -> facilities table):');
matchCheck.forEach(row => {
  console.log(`  Room ${row.facility_id}: ${row.section_count} sections, In facilities: ${row.in_facilities}`);
});

db.close();
console.log('\nDone!');
