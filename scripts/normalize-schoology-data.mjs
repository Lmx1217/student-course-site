import fs from 'node:fs';
import path from 'node:path';

const INPUT_FILE = path.resolve(
  'data/raw/2026-Q4-G11.json'
);

const OUTPUT_DIR = path.resolve('public/data/normalized');

const IMPORT_ID = 'import_20260326_190331';
const IMPORTED_AT = '2026-03-26T19:03:31Z';
const DEFAULT_ROLE = 'Student';

const NOISE_COURSE_NAMES = new Set(['course profile', 'profile']);
const NOISE_SUBJECTS = new Set(['advisory', 'den', 'free period', 'ocia', 'online course placeholder']);

function slugify(value) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'unknown'
  );
}

function uniqueBy(items, getKey) {
  const map = new Map();
  for (const item of items) {
    map.set(getKey(item), item);
  }
  return Array.from(map.values());
}

function getEmailDomain(email) {
  const trimmed = String(email || '').trim().toLowerCase();
  const atIndex = trimmed.indexOf('@');
  return atIndex > -1 ? trimmed.slice(atIndex + 1) : null;
}

function extractSchoologyUserId(profileUrl) {
  const match = String(profileUrl || '').match(/\/user\/(\d+)(?:\/|$)/i);
  return match?.[1] ?? null;
}

function extractSchoologyEntity(url) {
  const normalized = String(url || '').trim();

  let match = normalized.match(/\/(course)\/(\d+)/i);
  if (match) {
    return { type: 'course', externalId: match[2] };
  }

  match = normalized.match(/\/(course-template)\/(\d+)/i);
  if (match) {
    return { type: 'course-template', externalId: match[2] };
  }

  match = normalized.match(/\/(group)\/(\d+)/i);
  if (match) {
    return { type: 'group', externalId: match[2] };
  }

  return { type: 'unknown', externalId: null };
}

function splitDisplayName(fullName) {
  const cleaned = String(fullName || '').trim().replace(/\s+/g, ' ');
  const nicknameMatch = cleaned.match(/^(.*?)\s*\(([^)]+)\)\s*(.*)$/);

  if (!nicknameMatch) {
    return {
      displayName: cleaned,
      nickName: null
    };
  }

  const before = nicknameMatch[1].trim();
  const nickName = nicknameMatch[2].trim() || null;
  const after = nicknameMatch[3].trim();

  const displayName = [before, after].filter(Boolean).join(' ').replace(/\s+/g, ' ');

  return {
    displayName: displayName || cleaned,
    nickName
  };
}

function inferGroupCategory(groupName) {
  const value = String(groupName || '').trim().toLowerCase();

  if (!value) return 'unknown';
  if (/^class of \d{4}$/.test(value)) return 'class_year';
  if (value.includes('house')) return 'house';
  if (value.includes('library')) return 'library';
  if (value.includes('faculty') || value.includes('staff')) return 'faculty_staff';
  if (value.includes('department')) return 'department';
  if (value.includes('service')) return 'service';
  if (value.includes('club')) return 'club';

  return 'other';
}

function parseClassYear(groupNames) {
  for (const name of groupNames) {
    const match = String(name || '').match(/Class of (\d{4})/i);
    if (match) return Number(match[1]);
  }
  return null;
}

function inferGradeLevel(classYear, importedAt) {
  if (!classYear) return null;

  const now = new Date(importedAt);
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;

  const seniorClassYear = currentMonth >= 7 ? currentYear + 1 : currentYear;
  const diff = classYear - seniorClassYear;
  const grade = 12 - diff;

  return grade >= 9 && grade <= 12 ? grade : null;
}

function inferSubject(normalizedName) {
  if (!normalizedName) return null;

  const value = normalizedName.toLowerCase();

  if (value.includes('ocia: ocia')) return 'OCIA';
  if (value.includes('den')) return 'Den';
  if (value.includes('advisory')) return 'Advisory';
  if (value.includes('english')) return 'English';
  if (value.includes('demo school online class period')) return 'Online Course Placeholder';
  if (
    value.includes('calculus') ||
    value.includes('algebra') ||
    value.includes('geometry') ||
    value.includes('math')
  ) {
    return 'Math';
  }
  if (
    value.includes('government') ||
    value.includes('history') ||
    value.includes('social justice') ||
    value.includes('economics')
  ) {
    return 'Social Studies';
  }
  if (
    value.includes('biology') ||
    value.includes('chemistry') ||
    value.includes('physics') ||
    value.includes('environmental science') ||
    value.includes('science')
  ) {
    return 'Science';
  }
  if (value.includes('business')) return 'Business';
  if (value.includes('theology') || value.includes('religion')) return 'Religious Studies';
  if (value.includes('spanish') || value.includes('french') || value.includes('latin')) {
    return 'World Language';
  }
  if (value.includes('free')) return 'Free Period';

  return null;
}

function isNoiseSubject(subject) {
  return NOISE_SUBJECTS.has(String(subject || '').trim().toLowerCase());
}

function shouldDeleteCourseByName(courseName) {
  return NOISE_COURSE_NAMES.has(String(courseName || '').trim().toLowerCase());
}

function isApCourse(courseName) {
  return /^ap\b/i.test(String(courseName || '').trim());
}

function parseCourseName(courseName) {
  const raw = String(courseName || '').trim();
  const lower = raw.toLowerCase();

  const match = raw.match(/^(.*?)\s*:\s*([^()]+)\(([^)]+)\)\s*$/);

  const normalizedName = match?.[1]?.trim() || raw || null;
  const subject = inferSubject(normalizedName);
  const isNoise = NOISE_COURSE_NAMES.has(lower) || isNoiseSubject(subject);
  const period = match?.[2]?.trim() || null;
  const section = match?.[3]?.trim() || null;

  return {
    normalizedName,
    subject,
    period,
    section,
    isNoise
  };
}

function buildFallbackItems(names = [], urls = []) {
  const max = Math.max(names.length, urls.length);
  const items = [];

  for (let i = 0; i < max; i += 1) {
    const candidate = names[i];
    const fallbackUrl = typeof urls[i] === 'string' ? urls[i].trim() : '';

    let name = '';
    let url = '';
    let idUrl = '';

    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      name = String(candidate.name || '').trim();
      url = String(candidate.url || fallbackUrl).trim();
      idUrl = String(candidate.idUrl || candidate.url || fallbackUrl).trim();
    } else if (typeof candidate === 'string') {
      name = candidate.trim();
      url = fallbackUrl;
      idUrl = fallbackUrl;
    }

    if (!name || !url) continue;

    items.push({
      name,
      url,
      idUrl: idUrl || url
    });
  }

  return items;
}

function collectCourseItems(rawPerson) {
  const items = Array.isArray(rawPerson.courseItems) && rawPerson.courseItems.length > 0
    ? rawPerson.courseItems
    : buildFallbackItems(rawPerson.courses || [], rawPerson.courseUrls || []);

  return uniqueBy(items, (item) => `${item.name}__${item.url}`);
}

function collectGroupItems(rawPerson) {
  const items = Array.isArray(rawPerson.groupItems) && rawPerson.groupItems.length > 0
    ? rawPerson.groupItems
    : buildFallbackItems(rawPerson.groups || [], rawPerson.groupUrls || []);

  return uniqueBy(items, (item) => `${item.name}__${item.url}`);
}

function normalizeRawPerson(rawPerson) {
  const { displayName, nickName } = splitDisplayName(rawPerson.name);
  const schoologyUserId = extractSchoologyUserId(rawPerson.profileUrl);
  const personId = schoologyUserId
    ? `user_${schoologyUserId}`
    : `user_${slugify(rawPerson.email || rawPerson.name || 'unknown')}`;

  const groupItems = collectGroupItems(rawPerson);
  const groupNames = groupItems.map((item) => item.name);
  const classYear = parseClassYear(groupNames);
  const gradeLevel = inferGradeLevel(classYear, IMPORTED_AT);

  const person = {
    id: personId,
    schoologyUserId,
    name: String(rawPerson.name || '').trim(),
    displayName,
    nickName,
    email: String(rawPerson.email || '').trim().toLowerCase(),
    emailDomain: getEmailDomain(rawPerson.email),
    profileUrl: '', // Demo records never link to external student profiles.
    role: DEFAULT_ROLE,
    gradeLevel,
    classYear,
    lastSeenAt: IMPORTED_AT
  };

  const courses = collectCourseItems(rawPerson).map((item) => {
    const entity = extractSchoologyEntity(item.url);
    const parsed = parseCourseName(item.name);
    const apCourse = isApCourse(parsed.normalizedName || item.name);

    const courseId = entity.externalId
      ? `${entity.type}_${entity.externalId}`
      : `course_${slugify(item.name)}`;

    return {
      id: courseId,
      schoologyCourseId: entity.externalId,
      schoologyType:
        entity.type === 'course' || entity.type === 'course-template'
          ? entity.type
          : 'unknown',
      name: String(item.name || '').trim(),
      normalizedName: parsed.normalizedName,
      subject: parsed.subject,
      period: parsed.period,
      section: parsed.section,
      prerequisite: null,
      description: null,
      estimatedHomeworkMinutesPerDay: null,
      summerAssignmentDocumentUrl: null,
      courseLength: null,
      isAp: apCourse,
      isUcApproved: apCourse,
      isUcApprovedForHonors: apCourse,
      isNcaaApproved: false,
      url: '',
      isActive: true,
      isNoise: parsed.isNoise
    };
  });

  const groups = groupItems.map((item) => {
    const entity = extractSchoologyEntity(item.url);

    const groupId = entity.externalId
      ? `group_${entity.externalId}`
      : `group_${slugify(item.name)}`;

    return {
      id: groupId,
      schoologyGroupId: entity.externalId,
      name: String(item.name || '').trim(),
      url: '',
      category: inferGroupCategory(item.name)
    };
  });

  const visibleCourses = courses.filter((course) => !shouldDeleteCourseByName(course.name));

  const personCourses = visibleCourses.map((course) => ({
    personId,
    courseId: course.id,
    source: IMPORT_ID
  }));

  const personGroups = groups.map((group) => ({
    personId,
    groupId: group.id,
    source: IMPORT_ID
  }));

  return {
    person,
    courses: visibleCourses,
    groups,
    personCourses,
    personGroups
  };
}

function normalizeDataset(rawPeople, fileName) {
  const peopleMap = new Map();
  const coursesMap = new Map();
  const groupsMap = new Map();
  const personCourses = [];
  const personGroups = [];

  const personCourseKeys = new Set();
  const personGroupKeys = new Set();

  for (const rawPerson of rawPeople) {
    const normalized = normalizeRawPerson(rawPerson);

    peopleMap.set(normalized.person.id, normalized.person);

    for (const course of normalized.courses) {
      if (!coursesMap.has(course.id)) {
        coursesMap.set(course.id, course);
      }
    }

    for (const group of normalized.groups) {
      if (!groupsMap.has(group.id)) {
        groupsMap.set(group.id, group);
      }
    }

    for (const relation of normalized.personCourses) {
      const key = `${relation.personId}__${relation.courseId}`;
      if (!personCourseKeys.has(key)) {
        personCourseKeys.add(key);
        personCourses.push(relation);
      }
    }

    for (const relation of normalized.personGroups) {
      const key = `${relation.personId}__${relation.groupId}`;
      if (!personGroupKeys.has(key)) {
        personGroupKeys.add(key);
        personGroups.push(relation);
      }
    }
  }

  const imports = [
    {
      id: IMPORT_ID,
      filename: fileName,
      importedAt: IMPORTED_AT,
      recordCount: rawPeople.length,
      sourceType: 'synthetic-demo',
      notes: 'Fictional demonstration data only.'
    }
  ];

  return {
    people: Array.from(peopleMap.values()),
    courses: Array.from(coursesMap.values()),
    groups: Array.from(groupsMap.values()),
    personCourses,
    personGroups,
    imports
  };
}

function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`Cannot find input file: ${INPUT_FILE}`);
    process.exit(1);
  }

  const rawText = fs.readFileSync(INPUT_FILE, 'utf-8');
  const rawData = JSON.parse(rawText);

  if (!Array.isArray(rawData)) {
    console.error('Input JSON must be an array.');
    process.exit(1);
  }

  const isExampleUrl = (value) => {
    try {
      const url = new URL(String(value || ''));
      return url.protocol === 'https:' && url.hostname === 'example.com' && !url.username && !url.password && !url.search && !url.hash;
    } catch {
      return false;
    }
  };
  const isDemoPerson = (person) => {
    const number = String(person.name || '').match(/^Student (\d{3,})$/)?.[1];
    return number && person.email === `student${number}@example.com` &&
      isExampleUrl(person.profileUrl) &&
      [...collectCourseItems(person), ...collectGroupItems(person)].every(item => isExampleUrl(item.url));
  };
  if (!rawData.every(isDemoPerson)) {
    throw new Error('Only fictional example.com demo exports may be normalized. Do not import real student records.');
  }

  const fileName = path.basename(INPUT_FILE);
  const bundle = normalizeDataset(rawData, fileName);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'people.json'),
    JSON.stringify(bundle.people, null, 2)
  );

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'courses.json'),
    JSON.stringify(bundle.courses, null, 2)
  );

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'groups.json'),
    JSON.stringify(bundle.groups, null, 2)
  );

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'personCourses.json'),
    JSON.stringify(bundle.personCourses, null, 2)
  );

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'personGroups.json'),
    JSON.stringify(bundle.personGroups, null, 2)
  );

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'imports.json'),
    JSON.stringify(bundle.imports, null, 2)
  );

  console.log('Done.');
  console.log(`People: ${bundle.people.length}`);
  console.log(`Courses: ${bundle.courses.length}`);
  console.log(`Groups: ${bundle.groups.length}`);
  console.log(`PersonCourses: ${bundle.personCourses.length}`);
  console.log(`PersonGroups: ${bundle.personGroups.length}`);
  console.log(`Output folder: ${OUTPUT_DIR}`);
}

main();
