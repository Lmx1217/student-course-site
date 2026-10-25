import { useEffect, useMemo, useState } from "react"
import { Link, useLocation, useParams } from "react-router"
import {
  loadStudentDirectoryData,
  getStudentCoursesForPerson,
  getStudentName,
  type Course,
  type Person,
  type PersonCourseRelationship,
  type StudentCourseSummary,
} from "../lib/studentDirectory"

type ProfileField = {
  label: string
  value: string | number | null | undefined
}

function formatDetailValue(value: string | number | null | undefined): string | number {
  if (value === null || value === undefined || value === "") {
    return "-"
  }

  return value
}

function ProfileFieldCard({ label, value }: ProfileField) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-2 text-sm font-medium text-slate-900">
        {formatDetailValue(value)}
      </dd>
    </div>
  )
}

function CourseCard({ course }: { course: StudentCourseSummary }) {
  return (
    <Link
      to="/courses"
      className="group grid grid-cols-[56px_minmax(0,1fr)] items-center gap-5 py-4 transition first:pt-0 last:pb-0 hover:text-slate-700"
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold tabular-nums text-slate-600 transition group-hover:bg-slate-200 group-hover:text-slate-900">
        {formatDetailValue(course.period)}
      </span>

      <h3 className="truncate text-base font-semibold text-slate-900">
        {course.title}
      </h3>
    </Link>
  )
}

export default function StudentDetail() {
  const { studentId } = useParams()
  const location = useLocation()
  const [people, setPeople] = useState<Person[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [personCourses, setPersonCourses] = useState<PersonCourseRelationship[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    async function loadStudent() {
      try {
        setLoading(true)
        setError("")
        const directoryData = await loadStudentDirectoryData()
        setPeople(directoryData.people)
        setCourses(directoryData.courses)
        setPersonCourses(directoryData.personCourses)
      } catch (err) {
        console.error(err)

        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError("Failed to load student data.")
        }
      } finally {
        setLoading(false)
      }
    }

    void loadStudent()
  }, [])

  const student = useMemo(() => {
    return (
      people.find((person) => {
        return (
          person.id === studentId &&
          (!person.role || person.role.toLowerCase() === "student")
        )
      }) ?? null
    )
  }, [people, studentId])

  const studentCourses = useMemo(() => {
    if (!student) {
      return []
    }

    return getStudentCoursesForPerson(student.id, courses, personCourses)
  }, [courses, personCourses, student])

  const backTo = location.search ? `/students${location.search}` : "/students"

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={backTo}
          className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
        >
          Back to Student Search
        </Link>
      </div>

      {loading ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm text-slate-600">Loading student...</p>
        </section>
      ) : null}

      {error ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-red-700">Data Load Error</h1>
          <p className="mt-2 text-sm text-red-600">{error}</p>
        </section>
      ) : null}

      {!loading && !error && !student ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Student not found
          </h1>
        </section>
      ) : null}

      {!loading && !error && student ? (
        <>
          <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Student Detail
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 lg:text-4xl">
              {getStudentName(student)}
            </h1>
          </section>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
              <h2 className="text-xl font-semibold text-slate-900">Profile</h2>

              <dl className="mt-6 space-y-4">
                <ProfileFieldCard label="Role" value={student.role} />
                <ProfileFieldCard label="Grade" value={student.gradeLevel} />

                {student.nickName ? (
                  <ProfileFieldCard label="Nickname" value={student.nickName} />
                ) : null}

                <ProfileFieldCard label="Email" value={student.email} />
              </dl>

              {student.profileUrl ? (
                <div className="mt-6">
                  <a
                    href={student.profileUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white hover:text-slate-900"
                  >
                    Open Schoology Profile
                  </a>
                </div>
              ) : null}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
              <h2 className="text-xl font-semibold text-slate-900">Courses</h2>

              {studentCourses.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                  No courses found for this student.
                </div>
              ) : (
                <div className="mt-6 divide-y divide-slate-200">
                  {studentCourses.map((course) => (
                    <CourseCard key={course.id} course={course} />
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      ) : null}
    </div>
  )
}
