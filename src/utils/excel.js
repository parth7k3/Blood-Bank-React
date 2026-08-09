import ExcelJS from 'exceljs';
import { 
  cleanString, 
  cleanContact, 
  cleanDiseasesValue, 
  cleanBloodGroup, 
  parseExcelDate, 
  checkDiseaseCell, 
  getFinancialYear, 
  getDiseaseScreeningResults,
  filterDonationsByDateRange
} from './helpers';

export async function handleExcelImport(arrayBuffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  const worksheet = workbook.getWorksheet(1) || workbook.worksheets[0];

  // Scan headers to see if it is our double-column DONOR.xlsx format
  let isDoubleColumn = false;
  for (let r = 1; r <= 3; r++) {
    const row = worksheet.getRow(r);
    row.eachCell(cell => {
      const s = String(cell.value || '').toLowerCase();
      if (s.includes('donor list till') || s.includes('donor list (')) {
        isDoubleColumn = true;
      }
    });
    if (isDoubleColumn) break;
  }

  const parsedImport = [];

  if (isDoubleColumn) {
    const parseSide = (row, cols, defaultFY) => {
      let name = cleanString(row.getCell(cols.name).value);
      if (!name || name === 'Name' || name === 'Name ') return null;

      let relativeName = '';
      const relMatch = name.match(/\s+(s\/o|w\/o|d\/o|c\/o)\s+(.+)/i);
      if (relMatch) {
        relativeName = relMatch[2].trim();
        name = name.replace(relMatch[0], '').trim();
      }
      if (cols.relative) relativeName = relativeName || cleanString(row.getCell(cols.relative).value);

      const bg = cleanBloodGroup(cleanString(row.getCell(cols.blood).value));

      const reactiveTests = [];
      const tests = [
        { col: cols.hiv, label: 'HIV' },
        { col: cols.hcv, label: 'HCV' },
        { col: cols.hbsag, label: 'HBsAg' },
        { col: cols.vdrl, label: 'VDRL' }
      ];
      tests.forEach(t => {
        const result = checkDiseaseCell(row.getCell(t.col), t.label);
        if (result) reactiveTests.push(result);
      });

      const rawMPVal = cleanString(row.getCell(cols.mp).value);
      const tMP = checkDiseaseCell(row.getCell(cols.mp), 'MP');
      if (tMP) {
        reactiveTests.push(tMP);
      } else if (rawMPVal && rawMPVal !== 'NEG' && rawMPVal !== 'NR' && rawMPVal.toLowerCase() !== 'mp' && rawMPVal.toLowerCase() !== 'neg' && rawMPVal.toLowerCase() !== 'nr') {
        reactiveTests.push(`MP: ${rawMPVal}`);
      }

      const dateStr = parseExcelDate(row.getCell(cols.date));
      
      return {
        name,
        relativeName,
        address: cleanString(row.getCell(cols.address).value),
        age: 35,
        gender: 'Male',
        bloodGroup: bg,
        contact: cleanContact(row.getCell(cols.contact).value),
        email: '',
        lastDonationDate: dateStr,
        diseasePositive: reactiveTests.length > 0,
        diseases: reactiveTests.join(', '),
        notes: '',
        financialYear: getFinancialYear(dateStr, defaultFY)
      };
    };

    const leftCols = { sr: 1, name: 2, address: 3, contact: 4, blood: 5, hiv: 6, hcv: 7, hbsag: 8, vdrl: 9, mp: 10, date: 11 };
    const rightCols = { sr: 15, name: 16, relative: 17, address: 18, contact: 19, blood: 20, hiv: 21, hcv: 22, hbsag: 23, vdrl: 24, mp: 25, date: 26 };

    // Dynamically detect Left and Right Financial Years from spreadsheet titles/headers (rows 1-3)
    let leftFY = '2024-25';
    let rightFY = '2025-26';
    for (let r = 1; r <= 3; r++) {
      const row = worksheet.getRow(r);
      row.eachCell(cell => {
        const valStr = String(cell.value || '');
        const match = valStr.match(/\b(\d{4})\s*-\s*(\d{2})\b/);
        if (match) {
          const fyStr = `${match[1]}-${match[2]}`;
          if (cell.col <= 14) {
            leftFY = fyStr;
          } else {
            rightFY = fyStr;
          }
        }
      });
    }

    // Read entire Left Table first
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber < 4) return;
      const leftDonor = parseSide(row, leftCols, leftFY);
      if (leftDonor) parsedImport.push(leftDonor);
    });

    // Read entire Right Table second
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber < 4) return;
      const rightDonor = parseSide(row, rightCols, rightFY);
      if (rightDonor) parsedImport.push(rightDonor);
    });
  } else {
    // Single column dynamic format mapping
    let headers = [];

    let headerRowNumber = 1;
    for (let r = 1; r <= worksheet.rowCount; r++) {
      const rVal = worksheet.getRow(r);
      let hasValues = false;
      rVal.eachCell(cell => {
        if (cell.value !== null && cell.value !== undefined && String(cell.value).trim() !== '') {
          hasValues = true;
        }
      });
      if (hasValues) {
        headerRowNumber = r;
        break;
      }
    }

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === headerRowNumber) {
        row.eachCell(cell => {
          headers.push({ name: String(cell.value).toLowerCase().trim(), colIdx: cell.col });
        });
        return;
      }
      if (rowNumber < headerRowNumber) return;

      const getValueByHeader = (subString) => {
        const match = headers.find(h => h.name.includes(subString));
        return match ? row.getCell(match.colIdx) : null;
      };

      const nameCell = getValueByHeader('name');
      const bgCell = getValueByHeader('blood') || getValueByHeader('group');

      if (nameCell && bgCell && nameCell.value) {
        const ageCell = getValueByHeader('age');
        const genderCell = getValueByHeader('gender');
        const contactCell = getValueByHeader('contact') || getValueByHeader('phone');
        const emailCell = getValueByHeader('email');
        const dateCell = getValueByHeader('date') || getValueByHeader('last donation');
        const diseasesCell = getValueByHeader('diseases') || getValueByHeader('screening');
        const notesCell = getValueByHeader('notes');
        const fyCell = getValueByHeader('fy') || getValueByHeader('financial');
        const fatherCell = getValueByHeader('father') || getValueByHeader('husband') || getValueByHeader('relative') || getValueByHeader('f/h');
        const addrCell = getValueByHeader('address') || getValueByHeader('city') || getValueByHeader('location');

        const dateVal = dateCell ? parseExcelDate(dateCell) : '';
        const parsedFY = fyCell ? cleanString(fyCell.value) : getFinancialYear(dateVal);

        const reactiveTests = [];
        const testCols = [
          { cell: getValueByHeader('hiv'), label: 'HIV' },
          { cell: getValueByHeader('hcv'), label: 'HCV' },
          { cell: getValueByHeader('hbsag'), label: 'HBsAg' },
          { cell: getValueByHeader('vdrl'), label: 'VDRL' },
          { cell: getValueByHeader('mp'), label: 'MP' }
        ];

        testCols.forEach(tc => {
          if (tc.cell) {
            const res = checkDiseaseCell(tc.cell, tc.label);
            if (res) reactiveTests.push(res);
          }
        });

        let isDisPos = false;
        let diseasesVal = '';

        if (reactiveTests.length > 0) {
          isDisPos = true;
          diseasesVal = reactiveTests.join(', ');
        } else {
          diseasesVal = diseasesCell ? cleanDiseasesValue(cleanString(diseasesCell.value)) : '';
          isDisPos = diseasesVal !== '';
        }

        parsedImport.push({
          name: cleanString(nameCell.value),
          relativeName: fatherCell ? cleanString(fatherCell.value) : '',
          address: addrCell ? cleanString(addrCell.value) : '',
          age: ageCell ? parseInt(ageCell.value, 10) || 35 : 35,
          gender: genderCell ? cleanString(genderCell.value) : 'Male',
          bloodGroup: cleanBloodGroup(cleanString(bgCell.value)),
          contact: contactCell ? cleanContact(contactCell.value) : '',
          email: emailCell ? cleanString(emailCell.value) : '',
          lastDonationDate: dateVal,
          diseasePositive: isDisPos,
          diseases: diseasesVal,
          notes: notesCell ? cleanString(notesCell.value) : '',
          financialYear: parsedFY
        });
      }
    });
  }

  return parsedImport;
}

export function handleCSVImport(fileContent) {
  const rows = parseCSVContent(fileContent);
  if (rows.length < 2) {
    throw new Error("CSV file is empty or missing headers");
  }

  const headers = rows[0].map(h => h.trim().toLowerCase());
  const nameIdx = headers.findIndex(h => h.includes('name'));
  const bgIdx = headers.findIndex(h => h.includes('blood'));

  if (nameIdx === -1 || bgIdx === -1) {
    throw new Error("CSV must contain 'Name' and 'Blood Group' column headers");
  }

  const ageIdx = headers.findIndex(h => h.includes('age'));
  const genderIdx = headers.findIndex(h => h.includes('gender'));
  const contactIdx = headers.findIndex(h => h.includes('contact'));
  const emailIdx = headers.findIndex(h => h.includes('email'));
  const dateIdx = headers.findIndex(h => h.includes('last donation') || h.includes('date'));
  const diseasesIdx = headers.findIndex(h => h.includes('diseases list') || h.includes('diseases'));
  const notesIdx = headers.findIndex(h => h.includes('notes'));
  const fyIdx = headers.findIndex(h => h.includes('financial year') || h.includes('fy'));
  const fatherIdx = headers.findIndex(h => h.includes('father') || h.includes('husband') || h.includes('relative') || h.includes('f/h'));
  const idIdx = headers.findIndex(h => h === 'id' || h === 'donor id' || h === 'sr' || h === 'sr no' || h === 's.no' || h === 's/n');

  const parsedImport = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 0 || (row.length === 1 && row[0] === '')) continue;

    const name = row[nameIdx];
    const bloodGroup = row[bgIdx];
    if (!name || !bloodGroup) continue;

    const dateVal = dateIdx !== -1 ? row[dateIdx].trim() : '';
    const parsedFY = fyIdx !== -1 ? row[fyIdx].trim() : getFinancialYear(dateVal);

    let customId = '';
    if (idIdx !== -1 && row[idIdx]) {
      const val = row[idIdx].trim();
      const num = parseInt(val.replace(/\D/g, ''), 10);
      if (!isNaN(num) && num > 0) {
        customId = 'D-' + String(num).padStart(4, '0');
      } else {
        customId = val;
      }
    }

    const cleanD = diseasesIdx !== -1 ? cleanDiseasesValue(row[diseasesIdx]) : '';
    parsedImport.push({
      id: customId,
      name: name.trim(),
      age: ageIdx !== -1 ? parseInt(row[ageIdx], 10) || 35 : 35,
      gender: genderIdx !== -1 ? row[genderIdx].trim() : 'Male',
      bloodGroup: cleanBloodGroup(bloodGroup),
      contact: contactIdx !== -1 ? row[contactIdx].trim().replace(/\.0$/, '') : '',
      email: emailIdx !== -1 ? row[emailIdx].trim() : '',
      lastDonationDate: dateVal,
      diseasePositive: cleanD !== '',
      diseases: cleanD,
      notes: notesIdx !== -1 ? row[notesIdx].trim() : '',
      relativeName: fatherIdx !== -1 ? row[fatherIdx].trim() : '',
      financialYear: parsedFY
    });
  }

  return parsedImport;
}

export function handleJSONImport(fileContent) {
  const list = JSON.parse(fileContent);
  if (!Array.isArray(list)) {
    throw new Error("Imported file must contain a list of donors");
  }

  const validatedDonors = [];
  list.forEach(item => {
    if (item.name && item.bloodGroup) {
      const dateVal = item.lastDonationDate || '';
      const parsedFY = item.financialYear || getFinancialYear(dateVal);
      const cleanD = item.diseases ? cleanDiseasesValue(item.diseases) : '';
      
      validatedDonors.push({
        id: item.id || `D-${1000 + validatedDonors.length + Date.now() % 1000}`,
        name: String(item.name).trim(),
        age: parseInt(item.age, 10) || 35,
        gender: item.gender || 'Male',
        bloodGroup: cleanBloodGroup(item.bloodGroup),
        contact: item.contact ? String(item.contact).trim().replace(/\.0$/, '') : '',
        email: item.email ? String(item.email).trim() : '',
        lastDonationDate: dateVal,
        diseasePositive: cleanD !== '',
        diseases: cleanD,
        notes: item.notes ? String(item.notes).trim() : '',
        financialYear: parsedFY
      });
    }
  });

  return validatedDonors;
}

export async function exportToExcel(filteredList, startDate, endDate) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Donor Database');

  worksheet.columns = [
    { header: 'S.No', key: 'sno', width: 10 },
    { header: 'Financial Year', key: 'financialYear', width: 15 },
    { header: 'Name', key: 'name', width: 25 },
    { header: 'Father/Husband Name', key: 'relativeName', width: 25 },
    { header: 'Age', key: 'age', width: 8 },
    { header: 'Gender', key: 'gender', width: 10 },
    { header: 'Blood Group', key: 'bloodGroup', width: 12 },
    { header: 'Contact No', key: 'contact', width: 15 },
    { header: 'Email Address', key: 'email', width: 25 },
    { header: 'Address', key: 'address', width: 35 },
    { header: 'Donation Date', key: 'donationDate', width: 18 },
    { header: 'Disease Screening Status', key: 'diseaseStatus', width: 25 },
    { header: 'HIV', key: 'hiv', width: 15 },
    { header: 'HCV', key: 'hcv', width: 15 },
    { header: 'HBsAg', key: 'hbsag', width: 15 },
    { header: 'VDRL', key: 'vdrl', width: 15 },
    { header: 'MP', key: 'mp', width: 15 },
    { header: 'Screened Diseases', key: 'diseases', width: 30 },
    { header: 'Administrative Notes', key: 'notes', width: 30 }
  ];

  worksheet.insertRow(1, ['VARDAAN BLOOD BANK']);
  worksheet.insertRow(2, ['A Unit of Jansiksha Foundation | Donor Database Report']);
  worksheet.insertRow(3, []);

  worksheet.mergeCells('A1:S1');
  const titleRow = worksheet.getRow(1);
  titleRow.getCell(1).font = { name: 'Outfit', bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  titleRow.getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF991B1B' } // Red Theme Brand Color
  };
  titleRow.height = 35;

  worksheet.mergeCells('A2:S2');
  const subtitleRow = worksheet.getRow(2);
  subtitleRow.getCell(1).font = { name: 'Inter', italic: true, size: 11, color: { argb: 'FF475569' } };
  subtitleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  subtitleRow.height = 20;

  filteredList.forEach((d, index) => {
    let exportDate = d.lastDonationDate || 'Never';
    if (startDate || endDate) {
      const matchingDonations = filterDonationsByDateRange(d.donationHistory, startDate, endDate);
      if (matchingDonations.length > 0) {
        exportDate = matchingDonations[0].date;
      }
    }

    const sRes = getDiseaseScreeningResults(d.diseases);

    worksheet.addRow({
      sno: index + 1,
      financialYear: getFinancialYear(exportDate, d.financialYear),
      name: d.name,
      relativeName: d.relativeName || '',
      age: d.age,
      gender: d.gender,
      bloodGroup: d.bloodGroup,
      contact: d.contact,
      email: d.email,
      address: d.address || '',
      donationDate: exportDate,
      diseaseStatus: d.diseasePositive ? 'Screen Positive' : 'Negative/NR',
      hiv: sRes.hiv === 'Reactive' ? 'Positive' : 'Negative',
      hcv: sRes.hcv === 'Reactive' ? 'Positive' : 'Negative',
      hbsag: sRes.hbsag === 'Reactive' ? 'Positive' : 'Negative',
      vdrl: sRes.vdrl === 'Reactive' ? 'Positive' : 'Negative',
      mp: (sRes.mp && sRes.mp !== 'NEG') ? 'Positive' : 'Negative',
      diseases: d.diseases || 'None',
      notes: d.notes || ''
    });
  });

  // Style header row 4
  const headerRow = worksheet.getRow(4);
  headerRow.height = 26;
  for (let c = 1; c <= 19; c++) {
    const cell = headerRow.getCell(c);
    cell.font = { name: 'Inter', bold: true, size: 10, color: { argb: 'FF334155' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' }
    };
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FFE2E8F0' } }
    };
  }

  // Style data rows ONLY if dataset is small enough (under 10,000 rows)
  // For massive datasets (up to 500k), we skip cell-by-cell styling to prevent memory crashes!
  if (filteredList.length <= 10000) {
    for (let r = 5; r <= worksheet.rowCount; r++) {
      const rVal = worksheet.getRow(r);
      rVal.height = 20;

      const isPos = rVal.getCell(12).value === 'Screen Positive';
      const cellColor = isPos ? 'FFFEE2E2' : 'FFFFFFFF'; // Light Red background for disease positive entries
      const textColor = isPos ? 'FF991B1B' : 'FF334155';

      for (let c = 1; c <= 19; c++) {
        const cell = rVal.getCell(c);
        cell.font = { name: 'Inter', size: 10, color: { argb: textColor } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: cellColor }
        };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFF1F5F9' } }
        };
      }
    }
  } else {
    // For large datasets, just set default fonts on columns to save GBs of RAM
    worksheet.columns.forEach(column => {
      if (!column.font) {
        column.font = { name: 'Inter', size: 10, color: { argb: 'FF334155' } };
      }
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function downloadCSVTemplate() {
  const headers = ['Name', 'Age', 'Gender', 'Blood Group', 'Contact', 'Email', 'Last Donation Date', 'Disease Positive (TRUE/FALSE)', 'Diseases List', 'Notes', 'Financial Year'];
  const sampleRow = ['John Doe', '30', 'Male', 'O+', '9876543210', 'john@example.com', '2026-05-10', 'FALSE', '', 'Regular donor', '2026-27'];

  const csvContent = [headers.join(','), sampleRow.join(',')].join('\n');
  return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
}

export function exportToJSON(filteredList, startDate, endDate) {
  const exportedData = filteredList.map(donor => {
    const sRes = getDiseaseScreeningResults(donor.diseases);
    return {
      ...donor,
      hiv: sRes.hiv === 'Reactive' ? 'Positive' : 'Negative',
      hcv: sRes.hcv === 'Reactive' ? 'Positive' : 'Negative',
      hbsag: sRes.hbsag === 'Reactive' ? 'Positive' : 'Negative',
      vdrl: sRes.vdrl === 'Reactive' ? 'Positive' : 'Negative',
      mp: (sRes.mp && sRes.mp !== 'NEG') ? 'Positive' : 'Negative'
    };
  });

  return new Blob([JSON.stringify(exportedData, null, 2)], { type: 'application/json' });
}

export function exportToCSV(filteredList, startDate, endDate) {
  const headers = ['ID', 'Financial Year', 'Name', 'Father/Husband Name', 'Address', 'Age', 'Gender', 'Blood Group', 'Blood Camp', 'Contact', 'Email', 'Last Donation Date', 'Disease Positive', 'HIV', 'HCV', 'HBsAg', 'VDRL', 'MP', 'Diseases', 'Notes'];
  const csvRows = [headers.join(',')];

  filteredList.forEach(donor => {
    const sRes = getDiseaseScreeningResults(donor.diseases);
    const values = [
      donor.id,
      donor.financialYear,
      escapeCSVValue(donor.name),
      escapeCSVValue(donor.relativeName || ''),
      escapeCSVValue(donor.address || ''),
      donor.age,
      donor.gender,
      donor.bloodGroup,
      escapeCSVValue(donor.camp || ''),
      escapeCSVValue(donor.contact),
      escapeCSVValue(donor.email),
      donor.lastDonationDate || '',
      donor.diseasePositive ? 'TRUE' : 'FALSE',
      escapeCSVValue(sRes.hiv === 'Reactive' ? 'Positive' : 'Negative'),
      escapeCSVValue(sRes.hcv === 'Reactive' ? 'Positive' : 'Negative'),
      escapeCSVValue(sRes.hbsag === 'Reactive' ? 'Positive' : 'Negative'),
      escapeCSVValue(sRes.vdrl === 'Reactive' ? 'Positive' : 'Negative'),
      escapeCSVValue((sRes.mp && sRes.mp !== 'NEG') ? 'Positive' : 'Negative'),
      escapeCSVValue(donor.diseases || ''),
      escapeCSVValue(donor.notes || '')
    ];
    csvRows.push(values.join(','));
  });

  return new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
}

function escapeCSVValue(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function parseCSVContent(text) {
  const result = [];
  let row = [''];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (c === '"') {
        if (next === '"') {
          row[row.length - 1] += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        row[row.length - 1] += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push('');
      } else if (c === '\r' || c === '\n') {
        if (c === '\r' && next === '\n') {
          i++;
        }
        result.push(row);
        row = [''];
      } else {
        row[row.length - 1] += c;
      }
    }
  }
  if (row.length > 1 || row[0] !== '') {
    result.push(row);
  }
  return result;
}
