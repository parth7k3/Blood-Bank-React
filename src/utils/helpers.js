export function cleanString(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    if (val.result !== undefined) return String(val.result).trim();
    if (val.richText !== undefined) return val.richText.map(t => t.text).join('').trim();
    if (val.text !== undefined) return String(val.text).trim();
    return '';
  }
  return String(val).trim();
}

export function cleanContact(val) {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  if (str.endsWith('.0')) {
    str = str.substring(0, str.length - 2);
  }
  return str;
}

export function cleanDiseasesValue(val) {
  if (!val) return '';
  const str = String(val).trim();
  const clean = str.toLowerCase();
  const negativeWords = ['neg', 'negative', 'nil', 'none', 'no', 'n/a', 'nr', 'non-reactive', 'non reactive', 'safe', 'ok', 'normal', 'clear', 'neg.', 'negative.'];
  if (negativeWords.includes(clean)) {
    return '';
  }
  return str;
}

export function cleanBloodGroup(bg) {
  if (!bg) return 'Other';
  let s = String(bg).toLowerCase().trim();

  // Replace zero with letter 'o' if it represents blood type
  s = s.replace(/0/g, 'o');

  if (s.includes('other')) return 'Other';

  // Check if it represents a negative blood group
  const isNeg = s.includes('neg') || 
                s.includes('negative') || 
                s.includes('negtive') || 
                s.includes('negitive') || 
                s.includes('minus') || 
                /[-–—−‐‒–—―⁃⁻₋−－]/.test(s);

  // Strip suffixes
  const clean = s.replace(/negative|negtive|negitive|negtve|positive|neg|pos|ve|\+|[-–—−‐‒–—―⁃⁻₋−－]|\s/g, '');

  if (clean.includes('ab')) {
    return isNeg ? 'AB-' : 'AB+';
  }
  if (clean.includes('a')) {
    return isNeg ? 'A-' : 'A+';
  }
  if (clean.includes('b')) {
    return isNeg ? 'B-' : 'B+';
  }
  if (clean.includes('o')) {
    return isNeg ? 'O-' : 'O+';
  }

  return 'Other';
}

export function parseExcelDate(cell) {
  if (!cell || cell.value === null || cell.value === undefined) return '';
  let val = cell.value;

  // Handle ExcelJS formula cells
  if (val && typeof val === 'object' && 'result' in val) {
    val = val.result;
  }
  
  // Handle ExcelJS rich text
  if (val && typeof val === 'object' && Array.isArray(val.richText)) {
    val = val.richText.map(t => t.text).join('');
  }

  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // If numeric (Excel serial date)
  if (typeof val === 'number') {
    const date = new Date(Math.round((val - 25569) * 864e5));
    if (!isNaN(date)) {
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, '0');
      const d = String(date.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  const str = String(val || '').trim();
  if (!str || str.toLowerCase() === 'prev.' || str.toLowerCase() === 'current' || str.toLowerCase() === 'date' || str.toLowerCase() === 'never') return '';

  // 1. Handle YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const isoMatch = str.match(/^(\d{4})[-/.](\d{2})[-/.](\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // 2. Handle DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  // 3. Handle DD-MM-YY or DD/MM/YY or DD.MM.YY (2-digit year)
  const dmy2Match = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})(?:\s|$|\D)/);
  if (dmy2Match) {
    const d = dmy2Match[1].padStart(2, '0');
    const m = dmy2Match[2].padStart(2, '0');
    let y = dmy2Match[3];
    y = '20' + y;
    return `${y}-${m}-${d}`;
  }

  // 4. Handle text month names like "15-Jun-2024" or "15 Jun 2024" or "15-June-24"
  const monthsMap = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };
  const textMatch = str.match(/^(\d{1,2})[- ]([A-Za-z]{3,9})[- ](\d{2,4})$/);
  if (textMatch) {
    const d = textMatch[1].padStart(2, '0');
    const mStr = textMatch[2].toLowerCase().substring(0, 3);
    const m = monthsMap[mStr];
    if (m) {
      let y = textMatch[3];
      if (y.length === 2) {
        y = '20' + y;
      }
      return `${y}-${m}-${d}`;
    }
  }

  return str;
}

export function checkDiseaseCell(cell, testLabel) {
  if (!cell) return null;
  const val = cleanString(cell.value);

  if (val === 'R' || val.toLowerCase() === 'reactive' || val.toLowerCase() === 'pos' || val.toLowerCase() === 'positive') {
    return testLabel;
  }
  return null;
}

export function computeFY(year, month) {
  if (month >= 4) {
    return `${year}-${String(year + 1).substring(2)}`;
  }
  return `${year - 1}-${String(year).substring(2)}`;
}

export function getFinancialYear(dateStr, fallbackYear) {
  if (!dateStr || dateStr.toLowerCase() === 'never') {
    if (fallbackYear) return fallbackYear;
    const today = new Date();
    return computeFY(today.getFullYear(), today.getMonth() + 1);
  }

  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return computeFY(parseInt(match[1], 10), parseInt(match[2], 10));
  }
  
  if (fallbackYear) return fallbackYear;
  const today = new Date();
  return computeFY(today.getFullYear(), today.getMonth() + 1);
}

export function getNormalizedRelativeName(name) {
  if (!name) return '';
  return name.toLowerCase()
    .trim()
    .replace(/^(sh\.?|shri|mr\.?|late)\s+/i, '')
    .trim();
}

const _normalizedNameCache = new Map();
export function getNormalizedDonorName(name) {
  if (!name) return '';
  if (_normalizedNameCache.has(name)) return _normalizedNameCache.get(name);

  let clean = name.toLowerCase().trim();

  const regexes = [
    /\s+(s\/o|w\/o|d\/o|c\/o|s\.o\.|w\.o\.|d\.o\.|c\.o\.|s\/o\.|w\/o\.|d\/o\.|c\/o\.)\s+(.+)/i,
    /\s+(s\/o|w\/o|d\/o|c\/o|s\.o\.|w\.o\.|d\.o\.|c\.o\.|s\/o\.|w\/o\.|d\/o\.|c\/o\.)\s*sh\.?\s+(.+)/i,
    /\s+(s\/o|w\/o|d\/o|c\/o|s\.o\.|w\.o\.|d\.o\.|c\.o\.|s\/o\.|w\/o\.|d\/o\.|c\/o\.)\s*shri\.?\s+(.+)/i
  ];

  for (const regex of regexes) {
    const match = clean.match(regex);
    if (match) {
      clean = clean.replace(match[0], '').trim();
      break;
    }
  }

  clean = clean.split(/\s+s\/o\s+/i)[0];
  clean = clean.split(/\s+w\/o\s+/i)[0];
  clean = clean.split(/\s+d\/o\s+/i)[0];
  clean = clean.split(/\s+c\/o\s+/i)[0];

  clean = clean.trim();
  _normalizedNameCache.set(name, clean);
  return clean;
}

export function isSamePerson(d1, d2) {
  if (!d1 || !d2) return false;
  if (d1 === d2) return true;
  if (d1.id && d2.id && d1.id === d2.id) return true;

  const name1 = getNormalizedDonorName(d1.name);
  const name2 = getNormalizedDonorName(d2.name);
  if (name1 !== name2) return false;

  const bg1 = String(d1.bloodGroup || '').trim().toUpperCase();
  const bg2 = String(d2.bloodGroup || '').trim().toUpperCase();
  if (bg1 !== bg2) return false;

  const rel1 = getNormalizedRelativeName(d1.relativeName);
  const rel2 = getNormalizedRelativeName(d2.relativeName);

  if (rel1 && rel2) {
    return rel1 === rel2;
  }

  const contact1 = d1.contact ? String(d1.contact).replace(/\D/g, '').slice(-10) : '';
  const contact2 = d2.contact ? String(d2.contact).replace(/\D/g, '').slice(-10) : '';
  if (contact1 && contact2) {
    return contact1 === contact2;
  }

  return false;
}

export function createHistoryEntry(data) {
  return {
    date: data.lastDonationDate || 'Never',
    financialYear: data.financialYear || getFinancialYear(data.lastDonationDate),
    diseasePositive: data.diseasePositive,
    diseases: data.diseases,
    notes: data.notes
  };
}

export function sortHistoryDesc(history) {
  history.sort((a, b) => {
    if (!a.date || a.date === 'Never') return 1;
    if (!b.date || b.date === 'Never') return -1;
    return new Date(b.date) - new Date(a.date);
  });
  return history;
}

export function mergeDonor(existing, newDonor) {
  existing.name = newDonor.name || existing.name;
  existing.relativeName = newDonor.relativeName || existing.relativeName;
  existing.address = newDonor.address || existing.address;
  existing.age = newDonor.age || existing.age;
  existing.gender = newDonor.gender || existing.gender;
  existing.bloodGroup = newDonor.bloodGroup || existing.bloodGroup;
  existing.contact = newDonor.contact || existing.contact;
  existing.email = newDonor.email || existing.email;

  if (newDonor.diseasePositive) {
    existing.diseasePositive = true;
    const diseaseSet = new Set(
      [existing.diseases, newDonor.diseases]
        .map(s => s ? s.split(',').map(x => x.trim()) : [])
        .flat()
        .filter(Boolean)
    );
    existing.diseases = Array.from(diseaseSet).join(', ');
  }

  const existingNotes = existing.notes || '';
  const newNotes = newDonor.notes || '';
  if (newNotes && !existingNotes.toLowerCase().includes(newNotes.toLowerCase())) {
    existing.notes = existingNotes ? `${existingNotes} | ${newNotes}` : newNotes;
  }

  let history = existing.donationHistory || [];
  if (history.length === 0) {
    history = [createHistoryEntry(existing)];
  }

  const newHistory = newDonor.donationHistory || [createHistoryEntry(newDonor)];
  newHistory.forEach(h => {
    if (!history.some(item => item.date === h.date)) {
      history.push(h);
    }
  });

  sortHistoryDesc(history);
  existing.donationHistory = history;

  if (history.length > 0 && history[0].date !== 'Never') {
    existing.lastDonationDate = history[0].date;
    existing.financialYear = history[0].financialYear;
  } else {
    existing.lastDonationDate = newDonor.lastDonationDate || existing.lastDonationDate;
    existing.financialYear = newDonor.financialYear || existing.financialYear;
  }
}

export function getDiseaseScreeningResults(diseasesStr) {
  const upper = (diseasesStr || '').toUpperCase();
  const hivVal = upper.includes('HIV') ? 'Reactive' : 'Non-Reactive';
  const hcvVal = upper.includes('HCV') ? 'Reactive' : 'Non-Reactive';
  const hbsagVal = upper.includes('HBSAG') ? 'Reactive' : 'Non-Reactive';
  const vdrlVal = upper.includes('VDRL') ? 'Reactive' : 'Non-Reactive';

  let mpVal = 'NEG';
  if (upper.includes('MP')) {
    const mpMatch = (diseasesStr || '').match(/MP:\s*([^,]+)/i);
    mpVal = mpMatch ? mpMatch[1].trim() : 'POS';
  }

  return { hiv: hivVal, hcv: hcvVal, hbsag: hbsagVal, vdrl: vdrlVal, mp: mpVal };
}

let lastDonorsListRef = null;
const personGroupCache = new Map();
const eligibilityCache = new Map();

export function checkEligibility(donor, donorsList) {
  // Reset cache if database reference changes
  if (lastDonorsListRef !== donorsList) {
    lastDonorsListRef = donorsList;
    personGroupCache.clear();
    eligibilityCache.clear();

    donorsList.forEach(d => {
      const normName = getNormalizedDonorName(d.name);
      if (!personGroupCache.has(normName)) {
        personGroupCache.set(normName, []);
      }
      personGroupCache.get(normName).push(d);
    });
  }

  // O(1) Cache hit check
  if (eligibilityCache.has(donor.id)) {
    return eligibilityCache.get(donor.id);
  }

  const normName = getNormalizedDonorName(donor.name);
  const candidates = personGroupCache.get(normName) || [];
  const matches = candidates.filter(d => isSamePerson(d, donor));

  let result;
  const hasDisease = matches.some(d => d.diseasePositive);
  if (hasDisease) {
    const diseasedRecord = matches.find(d => d.diseasePositive && d.diseases);
    result = {
      eligible: false,
      status: "deferred",
      reason: `Permanently Deferred (${diseasedRecord ? diseasedRecord.diseases : 'Disease Positive'})`
    };
  } else {
    let latestDateStr = 'Never';
    let latestDateObj = null;
    matches.forEach(d => {
      if (d.lastDonationDate && d.lastDonationDate !== 'Never') {
        const dDate = new Date(d.lastDonationDate);
        if (!latestDateObj || dDate > latestDateObj) {
          latestDateObj = dDate;
          latestDateStr = d.lastDonationDate;
        }
      }
    });

    if (latestDateStr === 'Never') {
      result = {
        eligible: true,
        status: "safe",
        reason: "Eligible (No donation history)"
      };
    } else {
      const lastDate = new Date(latestDateStr);
      const today = new Date();
      lastDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);

      const diffTime = Math.abs(today - lastDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const cooldownDays = 56;

      if (diffDays >= cooldownDays) {
        result = {
          eligible: true,
          status: "safe",
          reason: `Eligible (Last donation: ${diffDays} days ago)`
        };
      } else {
        const daysRemaining = cooldownDays - diffDays;
        result = {
          eligible: false,
          status: "pending",
          reason: `Ineligible (Wait ${daysRemaining} more days)`
        };
      }
    }
  }

  eligibilityCache.set(donor.id, result);
  return result;
}

export function filterDonationsByDateRange(history, startDate, endDate) {
  if (!history || history.length === 0) return [];
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  if (end) end.setHours(23, 59, 59, 999);

  return history.filter(h => {
    if (!h.date || h.date === 'Never') return false;
    const dDate = new Date(h.date);
    if (start && dDate < start) return false;
    if (end && dDate > end) return false;
    return true;
  });
}
