import {
  getCourseTitle,
  type Course,
  type Person,
  type PersonCourseRelationship,
} from "./studentDirectory"

export type CourseDirectoryRecord = {
  id: string
  title: string
  rawName: string
  subjectLabel: string
  periodLabel: string
  sectionLabel: string
  studentEnrollmentCount: number
  url: string | null
}

function isStudentRole(role: string | null | undefined): boolean {
  return !role || role.toLowerCase() === "student"
}

export function buildCourseDirectoryRecords(
  people: Person[],
  courses: Course[],
  personCourses: PersonCourseRelationship[]
): CourseDirectoryRecord[] {
  const visibleCourses = courses.filter((course) => !course.isNoise)
  const visibleCourseIds = new Set(visibleCourses.map((course) => course.id))
  const peopleById = new Map(people.map((person) => [person.id, person] as const))
  const studentEnrollmentCountMap = new Map<string, number>()

  personCourses.forEach((relationship) => {
    if (!visibleCourseIds.has(relationship.courseId)) {
      return
    }

    const person = peopleById.get(relationship.personId)

    if (person && isStudentRole(person.role)) {
      studentEnrollmentCountMap.set(
        relationship.courseId,
        (studentEnrollmentCountMap.get(relationship.courseId) ?? 0) + 1
      )
    }
  })

  return visibleCourses.map((course) => ({
    id: course.id,
    title: getCourseTitle(course),
    rawName: course.name || course.id,
    subjectLabel: course.subject || "Unknown",
    periodLabel: course.period || "Unknown",
    sectionLabel: course.section || "Unknown",
    studentEnrollmentCount: studentEnrollmentCountMap.get(course.id) ?? 0,
    url: course.url ?? null,
  }))
}
