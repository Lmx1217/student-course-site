export type Person = {
  id: string
  schoologyUserId?: string | null
  name?: string | null
  displayName?: string | null
  nickName?: string | null
  email?: string | null
  emailDomain?: string | null
  profileUrl?: string | null
  role?: string | null
  gradeLevel?: number | null
  classYear?: number | null
  lastSeenAt?: string | null
}

export type Course = {
  id: string
  name?: string | null
  normalizedName?: string | null
  period?: string | null
  section?: string | null
  subject?: string | null
  prerequisite?: string | null
  description?: string | null
  estimatedHomeworkMinutesPerDay?: string | null
  summerAssignmentDocumentUrl?: string | null
  courseLength?: string | null
  isAp?: boolean | null
  isUcApproved?: boolean | null
  isUcApprovedForHonors?: boolean | null
  isNcaaApproved?: boolean | null
  url?: string | null
  isActive?: boolean | null
  isNoise?: boolean | null
}

export type PersonCourseRelationship = {
  personId: string
  courseId: string
}

export type PersonGroupRelationship = {
  personId: string
  groupId: string
}

export type StudentCourseSummary = {
  id: string
  title: string
  period: string | null
  section: string | null
}

const courseValueCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
})

export function getStudentName(person: Person): string {
  return (
    person.displayName ||
    person.name ||
    person.nickName ||
    person.schoologyUserId ||
    "Unknown student"
  )
}

function compareOptionalCourseValue(
  left: string | null | undefined,
  right: string | null | undefined
): number {
  if (!left && !right) {
    return 0
  }

  if (!left) {
    return 1
  }

  if (!right) {
    return -1
  }

  return courseValueCollator.compare(left, right)
}

export function getCourseTitle(course: Course): string {
  return course.normalizedName || course.name || course.id
}

export function getStudentCoursesForPerson(
  personId: string,
  courses: Course[],
  personCourses: PersonCourseRelationship[]
): StudentCourseSummary[] {
  const visibleCourseMap = new Map(
    courses
      .filter((course) => !course.isNoise)
      .map((course) => [course.id, course] as const)
  )
  const seenCourseIds = new Set<string>()

  return personCourses
    .filter((relationship) => relationship.personId === personId)
    .map((relationship) => visibleCourseMap.get(relationship.courseId))
    .filter((course): course is Course => {
      if (!course || seenCourseIds.has(course.id)) {
        return false
      }

      seenCourseIds.add(course.id)
      return true
    })
    .map((course) => ({
      id: course.id,
      title: getCourseTitle(course),
      period: course.period ?? null,
      section: course.section ?? null,
    }))
    .sort((left, right) => {
      return (
        compareOptionalCourseValue(left.period, right.period) ||
        compareOptionalCourseValue(left.section, right.section) ||
        courseValueCollator.compare(left.title, right.title)
      )
    })
}

export async function fetchCollection<T>(path: string): Promise<T[]> {
  const response = await fetch(path)

  if (!response.ok) {
    throw new Error(`Failed to load ${path} (${response.status})`)
  }

  const data: unknown = await response.json()

  if (!Array.isArray(data)) {
    throw new Error(`${path} is not an array`)
  }

  return data as T[]
}

export async function loadPeople(): Promise<Person[]> {
  return fetchCollection<Person>("/data/normalized/people.json")
}

export async function loadStudentDirectoryData(): Promise<{
  people: Person[]
  courses: Course[]
  personCourses: PersonCourseRelationship[]
  personGroups: PersonGroupRelationship[]
}> {
  const [people, courses, personCourses, personGroups] = await Promise.all([
    loadPeople(),
    fetchCollection<Course>("/data/normalized/courses.json"),
    fetchCollection<PersonCourseRelationship>("/data/normalized/personCourses.json"),
    fetchCollection<PersonGroupRelationship>("/data/normalized/personGroups.json"),
  ])

  return {
    people,
    courses,
    personCourses,
    personGroups,
  }
}
