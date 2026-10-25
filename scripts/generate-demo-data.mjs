import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEMO_DATE = '2026-01-01T00:00:00Z';
const DEMO_IMPORT = 'import_demo_2026';
const PERSON_KEYS = ['id', 'schoologyUserId', 'name', 'displayName', 'nickName', 'email', 'emailDomain', 'profileUrl', 'role', 'gradeLevel', 'classYear', 'lastSeenAt'];
const GROUP_KEYS = ['id', 'schoologyGroupId', 'name', 'url', 'category'];
const GROUPS = [
  ['Class of 2026', 'class_year'], ['Class of 2027', 'class_year'],
  ['Class of 2028', 'class_year'], ['Class of 2029', 'class_year'],
  ['Robotics Club', 'club'], ['Coding Club', 'club'],
  ['Engineering Club', 'club'], ['Science Club', 'club'],
  ['Community Service', 'service'], ['Demo House A', 'house'],
  ['Demo House B', 'house'], ['Demo Library', 'library'],
  ['Student Council', 'other'], ['Academic Team', 'club'],
];

function pickKeys(value, keys) {
  return Object.fromEntries(keys.map(key => [key, value[key]]));
}

function randomFor(seed) {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function sample(values, count, random) {
  const pool = [...values];
  const result = [];
  while (pool.length && result.length < count) {
    const index = Math.floor(random() * pool.length);
    result.push(pool.splice(index, 1)[0]);
  }
  return result;
}

export function buildDemoBundle({ courseTemplates, personCount, groupCount = 14, personKeys = PERSON_KEYS, courseKeys, groupKeys = GROUP_KEYS, rawFiles = [], grades = [], importFilename = 'demo-students.json' }) {
  const courses = courseTemplates.map((template, index) => {
    const numericId = String(200001 + index);
    const type = template.schoologyType === 'course-template' ? 'course-template' : 'course';
    const value = { ...template, id: `${type}_${numericId}`, schoologyCourseId: numericId, schoologyType: type, url: '' };
    return pickKeys(value, courseKeys || Object.keys(template));
  });
  const groups = Array.from({ length: groupCount }, (_, index) => {
    const [name, category] = GROUPS[index] || [`Demo Group ${index + 1}`, 'other'];
    return pickKeys({ id: `group_${300001 + index}`, schoologyGroupId: String(300001 + index), name, url: '', category }, groupKeys);
  });
  const eligibleCourses = courses.filter(course => !course.isNoise);
  const cache = new Map();
  function createPerson(index) {
    if (cache.has(index)) return cache.get(index);
    const number = String(index + 1).padStart(3, '0');
    const random = randomFor(`portfolio-demo-student-${number}`);
    const gradeLevel = [9, 10, 11, 12].includes(grades[index]) ? grades[index] : 9 + Math.floor(random() * 4);
    const classYear = 2026 + 12 - gradeLevel;
    const person = pickKeys({
      id: `user_${100001 + index}`, schoologyUserId: String(100001 + index),
      name: `Student ${number}`, displayName: `Student ${number}`,
      nickName: index % 5 === 0 ? `Demo ${number}` : null,
      email: `student${number}@example.com`, emailDomain: 'example.com',
      profileUrl: '', role: 'Student', gradeLevel, classYear, lastSeenAt: DEMO_DATE,
    }, personKeys);
    const selectedCourses = sample(eligibleCourses, 6 + Math.floor(random() * 4), random);
    const classGroup = groups.find(group => group.name === `Class of ${classYear}`);
    const selectedGroups = [classGroup, ...sample(groups.filter(group => group.category !== 'class_year'), 1 + Math.floor(random() * 2), random)].filter(Boolean);
    const result = { person, courses: selectedCourses, groups: selectedGroups };
    cache.set(index, result);
    return result;
  }
  const students = Array.from({ length: personCount }, (_, index) => createPerson(index));
  const bundle = {
    people: students.map(record => record.person), courses, groups,
    personCourses: students.flatMap(record => record.courses.map(course => ({ personId: record.person.id, courseId: course.id, source: DEMO_IMPORT }))),
    personGroups: students.flatMap(record => record.groups.map(group => ({ personId: record.person.id, groupId: group.id, source: DEMO_IMPORT }))),
    imports: [{ id: DEMO_IMPORT, filename: importFilename, importedAt: DEMO_DATE, recordCount: personCount, sourceType: 'synthetic-demo', notes: 'Fictional demonstration data; no real students, identifiers, or enrollment records.' }],
  };
  const raw = {};
  for (const file of rawFiles) {
    raw[file.path] = Array.from({ length: file.count }, (_, index) => {
      const record = createPerson(index);
      const courseItems = record.courses.map(course => {
        const url = `https://example.com/${course.schoologyType}/${course.schoologyCourseId}`;
        return { name: course.name, url, idUrl: url };
      });
      const groupItems = record.groups.map(group => {
        const url = `https://example.com/group/${group.schoologyGroupId}`;
        return { name: group.name, url, idUrl: url };
      });
      const value = {
        name: record.person.name, email: record.person.email,
        profileUrl: `https://example.com/user/${100001 + index}`,
        courseCount: courseItems.length,
        courses: file.stringCourses ? courseItems.map(item => item.name) : courseItems.map(({ name, url }) => ({ name, url })),
        courseUrls: courseItems.map(item => item.url), courseIdUrls: courseItems.map(item => item.idUrl), courseItems,
        groupCount: groupItems.length,
        groups: file.stringGroups ? groupItems.map(item => item.name) : groupItems.map(({ name, url }) => ({ name, url })),
        groupUrls: groupItems.map(item => item.url), groupIdUrls: groupItems.map(item => item.idUrl), groupItems,
        error: '',
      };
      return pickKeys(value, file.keys);
    });
  }
  return { bundle, raw };
}

export function describeRawFile(filePath, rows) {
  return {
    path: filePath, count: rows.length,
    keys: [...new Set(rows.flatMap(row => Object.keys(row)))],
    stringCourses: rows.some(row => row.courses?.some(value => typeof value === 'string')),
    stringGroups: rows.some(row => row.groups?.some(value => typeof value === 'string')),
  };
}

function main() {
  const normalizedDir = path.resolve('public/data/normalized');
  const read = name => JSON.parse(fs.readFileSync(path.join(normalizedDir, `${name}.json`), 'utf8'));
  const people = read('people');
  const courseTemplates = read('courses');
  if (!people.every(person => /^Student \d{3,}$/.test(person.name) && /^student\d{3,}@example\.com$/.test(person.email)) ||
      !courseTemplates.every(course => /^(course|course-template)_2\d{5}$/.test(course.id) && !course.url)) {
    throw new Error('Demo regeneration only accepts the sanitized demo catalog and fictional student fixtures. Do not import private records.');
  }
  const rawDir = path.resolve('data/raw');
  const rawFiles = fs.readdirSync(rawDir).filter(name => name.endsWith('.json')).map(name => {
    const filePath = `data/raw/${name}`;
    return describeRawFile(filePath, JSON.parse(fs.readFileSync(filePath, 'utf8')));
  });
  const { bundle, raw } = buildDemoBundle({
    courseTemplates, personCount: people.length, groupCount: read('groups').length,
    personKeys: Object.keys(people[0]), courseKeys: Object.keys(courseTemplates[0]),
    groupKeys: Object.keys(read('groups')[0]), rawFiles, grades: people.map(person => person.gradeLevel),
    importFilename: read('imports')[0].filename,
  });
  for (const [name, rows] of Object.entries(bundle)) fs.writeFileSync(path.join(normalizedDir, `${name}.json`), JSON.stringify(rows, null, 2));
  for (const [filePath, rows] of Object.entries(raw)) fs.writeFileSync(filePath, JSON.stringify(rows, null, 2));
  console.log(`Generated ${bundle.people.length} fictional students with synthetic course and group relationships.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
