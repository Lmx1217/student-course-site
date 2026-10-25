import { useEffect, useMemo, useState } from "react"
import { Link, useLocation, useParams } from "react-router"
import {
  loadStudentDirectoryData,
  getCourseTitle,
  getStudentName,
  type Course,
  type Person,
  type PersonCourseRelationship,
} from "../lib/studentDirectory"

type PeriodDetail = {
  course: Course
  students: Person[]
}

type AggregatedCourse = {
  title: string
  subject: string | null
  description: string | null
  prerequisite: string | null
  estimatedHomeworkMinutesPerDay: string | null
  summerAssignmentDocumentUrl: string | null
  courseLength: string | null
  isAp: boolean
  isUcApproved: boolean
  isUcApprovedForHonors: boolean
  isNcaaApproved: boolean
  isActive: boolean
  periods: PeriodDetail[]
  totalStudentCount: number
}

const textCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
})

function isStudentRole(role: string | null | undefined): boolean {
  return !role || role.toLowerCase() === "student"
}

function firstNonNull<T>(values: (T | null | undefined)[]): T | null {
  for (const value of values) {
    if (value !== null && value !== undefined) {
      return value
    }
  }
  return null
}

function buildAggregatedCourse(
  courseId: string,
  courses: Course[],
  people: Person[],
  personCourses: PersonCourseRelationship[]
): AggregatedCourse | null {
  const target = courses.find((c) => c.id === courseId)
  if (!target || target.isNoise) return null

  const title = getCourseTitle(target)
  const group = courses.filter(
    (c) => !c.isNoise && getCourseTitle(c) === title
  )

  const peopleById = new Map(people.map((p) => [p.id, p] as const))

  const courseIdToStudents = new Map<string, Person[]>()
  const groupIds = new Set(group.map((c) => c.id))

  for (const rel of personCourses) {
    if (!groupIds.has(rel.courseId)) continue
    const person = peopleById.get(rel.personId)
    if (!person || !isStudentRole(person.role)) continue

    let list = courseIdToStudents.get(rel.courseId)
    if (!list) {
      list = []
      courseIdToStudents.set(rel.courseId, list)
    }
    list.push(person)
  }

  for (const students of courseIdToStudents.values()) {
    students.sort((a, b) =>
      textCollator.compare(getStudentName(a), getStudentName(b))
    )
  }

  const periods: PeriodDetail[] = group
    .map((course) => ({
      course,
      students: courseIdToStudents.get(course.id) ?? [],
    }))
    .sort((a, b) =>
      textCollator.compare(a.course.period ?? "", b.course.period ?? "")
    )

  const totalStudentCount = periods.reduce(
    (sum, s) => sum + s.students.length,
    0
  )

  return {
    title,
    subject: firstNonNull(group.map((c) => c.subject)),
    description: firstNonNull(group.map((c) => c.description)),
    prerequisite: firstNonNull(group.map((c) => c.prerequisite)),
    estimatedHomeworkMinutesPerDay: firstNonNull(
      group.map((c) => c.estimatedHomeworkMinutesPerDay)
    ),
    summerAssignmentDocumentUrl: firstNonNull(
      group.map((c) => c.summerAssignmentDocumentUrl)
    ),
    courseLength: firstNonNull(group.map((c) => c.courseLength)),
    isUcApproved: group.some((c) => c.isUcApproved === true),
    isUcApprovedForHonors: group.some((c) => c.isUcApprovedForHonors === true),
    isNcaaApproved: group.some((c) => c.isNcaaApproved === true),
    isActive: group.some((c) => c.isActive === true),
    isAp: group.some((c) => c.isAp === true),
    periods,
    totalStudentCount,
  }
}

function StatCard({
  label,
  value,
  accent,
  glass,
}: {
  label: string
  value: React.ReactNode
  accent?: "emerald" | "red" | "slate"
  glass?: boolean
}) {
  if (glass) {
    const glassStyles =
      accent === "emerald"
        ? "border-emerald-200/75 bg-white/60 shadow-[0_18px_40px_-30px_rgba(16,185,129,0.28)]"
        : accent === "red"
          ? "border-rose-200/75 bg-white/60 shadow-[0_18px_40px_-30px_rgba(244,63,94,0.12)]"
          : "border-sky-100/80 bg-white/60 shadow-[0_18px_40px_-30px_rgba(59,130,246,0.22)]"

    const labelStyles =
      accent === "emerald"
        ? "text-emerald-700/75"
        : accent === "red"
          ? "text-rose-700/75"
          : "text-sky-700/70"

    return (
      <div
        className={`rounded-2xl border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-xl ${glassStyles}`}
      >
        <dt
          className={`text-xs font-semibold uppercase tracking-[0.18em] ${labelStyles}`}
        >
          {label}
        </dt>
        <dd className="mt-2 text-lg font-semibold text-slate-900">{value}</dd>
      </div>
    )
  }

  const accentStyles =
    accent === "emerald"
      ? "border-emerald-200 bg-emerald-50"
      : accent === "red"
        ? "border-rose-200 bg-rose-50"
        : "border-slate-200 bg-white"

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${accentStyles}`}>
      <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-2 text-lg font-semibold text-slate-900">{value}</dd>
    </div>
  )
}

function ApprovalIndicator({
  approved,
  light,
}: {
  approved: boolean
  light?: boolean
}) {
  if (approved) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 ${light ? "text-emerald-600" : "text-emerald-600"}`}
      >
        <svg
          className="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
            clipRule="evenodd"
          />
        </svg>
        Yes
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${light ? "text-rose-400" : "text-rose-400"}`}
    >
      <svg
        className="h-5 w-5"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
          clipRule="evenodd"
        />
      </svg>
      No
    </span>
  )
}

function PeriodRow({ period }: { period: PeriodDetail }) {
  const { course, students } = period

  return (
    <li className="px-6 py-5 lg:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex shrink-0 items-center gap-3 md:w-36">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Period {course.period ?? "-"}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          {students.length === 0 ? (
            <p className="text-sm italic text-slate-400">
              No students enrolled
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {students.map((student) => (
                <Link
                  key={student.id}
                  to={`/students/${student.id}`}
                  className="rounded-lg bg-slate-100 px-2.5 py-1 text-sm text-slate-700 transition hover:bg-slate-200 hover:text-slate-900"
                >
                  {getStudentName(student)}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-4 md:ml-4">
          <div className="inline-flex min-w-[7rem] items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-center shadow-sm">
            <span className="text-sm font-semibold tabular-nums text-sky-950">
              {students.length} student{students.length !== 1 ? "s" : ""}
            </span>
          </div>
          {course.url ? (
            <a
              href={course.url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Schoology
            </a>
          ) : null}
        </div>
      </div>
    </li>
  )
}

export default function CourseDetail() {
  const { courseId } = useParams()
  const location = useLocation()
  const [people, setPeople] = useState<Person[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [personCourses, setPersonCourses] = useState<PersonCourseRelationship[]>(
    []
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        setError("")
        const data = await loadStudentDirectoryData()
        setPeople(data.people)
        setCourses(data.courses)
        setPersonCourses(data.personCourses)
      } catch (err) {
        console.error(err)
        setError(err instanceof Error ? err.message : "Failed to load course data.")
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [])

  const aggregated = useMemo(() => {
    if (!courseId || courses.length === 0) return null
    return buildAggregatedCourse(courseId, courses, people, personCourses)
  }, [courseId, courses, people, personCourses])

  const backTo = location.search ? `/courses${location.search}` : "/courses"
  const isApCourse = aggregated?.isAp === true
  const isHonorsCourse =
    !isApCourse && aggregated?.isUcApprovedForHonors === true
  const useThemedHeroCards = isApCourse || isHonorsCourse
  const heroSectionClassName = isApCourse
    ? "relative isolate overflow-hidden rounded-3xl border border-sky-100/80 bg-[linear-gradient(140deg,rgba(255,255,255,0.99)_0%,rgba(246,250,255,0.98)_18%,rgba(236,245,255,0.96)_42%,rgba(225,238,255,0.93)_72%,rgba(214,229,255,0.92)_100%)] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.72),0_28px_80px_-36px_rgba(59,130,246,0.34)] lg:p-8"
    : isHonorsCourse
      ? "rounded-3xl border border-violet-100/85 bg-violet-50 p-6 shadow-sm lg:p-8"
    : "rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8"
  const heroEyebrowClassName = isApCourse
    ? "text-sm font-semibold uppercase tracking-[0.18em] text-sky-700/70"
    : isHonorsCourse
      ? "text-sm font-semibold uppercase tracking-[0.18em] text-slate-500"
    : "text-sm font-semibold uppercase tracking-[0.18em] text-slate-500"
  const heroEyebrowText = isApCourse
    ? "Advance Placement"
    : "Course Detail"
  const heroTitleClassName = isApCourse
    ? "mt-3 text-3xl font-bold tracking-tight text-slate-950 lg:text-4xl"
    : isHonorsCourse
      ? "mt-3 text-3xl font-bold tracking-tight text-slate-950 lg:text-4xl"
    : "mt-3 text-3xl font-bold tracking-tight text-slate-900 lg:text-4xl"
  const heroMetaBaseClassName = isApCourse
    ? "rounded-full border border-sky-100/80 bg-white/60 px-3 py-1 text-sm font-medium text-sky-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] backdrop-blur-sm"
    : isHonorsCourse
      ? "rounded-full border border-violet-100/85 bg-white/65 px-3 py-1 text-sm font-medium text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] backdrop-blur-sm"
    : "rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700"
  const heroActiveClassName = isApCourse
    ? "rounded-full border border-emerald-200/80 bg-white/60 px-3 py-1 text-sm font-medium text-emerald-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] backdrop-blur-sm"
    : isHonorsCourse
      ? "rounded-full border border-emerald-200/80 bg-white/65 px-3 py-1 text-sm font-medium text-emerald-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] backdrop-blur-sm"
    : "rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200"
  const heroInactiveClassName = isApCourse
    ? "rounded-full border border-rose-200/80 bg-white/60 px-3 py-1 text-sm font-medium text-rose-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] backdrop-blur-sm"
    : isHonorsCourse
      ? "rounded-full border border-rose-200/80 bg-white/65 px-3 py-1 text-sm font-medium text-rose-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] backdrop-blur-sm"
    : "rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-700 ring-1 ring-red-200"
  const heroPeriodCountClassName = isApCourse
    ? "rounded-full border border-sky-100/80 bg-white/60 px-3 py-1 text-sm font-medium tabular-nums text-sky-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] backdrop-blur-sm"
    : isHonorsCourse
      ? "rounded-full border border-violet-100/85 bg-white/65 px-3 py-1 text-sm font-medium tabular-nums text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] backdrop-blur-sm"
    : "rounded-full bg-slate-100 px-3 py-1 text-sm font-medium tabular-nums text-slate-600"
  const heroDescriptionClassName = isApCourse
    ? "mt-4 max-w-3xl text-sm leading-7 text-slate-700"
    : isHonorsCourse
      ? "mt-4 max-w-3xl text-sm leading-7 text-slate-700"
    : "mt-4 max-w-3xl text-sm leading-7 text-slate-600"
  const heroEmptyDescriptionClassName = isApCourse
    ? "mt-4 max-w-3xl rounded-2xl border border-dashed border-sky-100/80 bg-white/45 p-5 text-sm text-slate-600 backdrop-blur-sm"
    : isHonorsCourse
      ? "mt-4 max-w-3xl rounded-2xl border border-dashed border-violet-100/85 bg-white/50 p-5 text-sm text-slate-600 backdrop-blur-sm"
    : "mt-4 max-w-3xl rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500"
  const summerAssignmentUrl =
    aggregated?.summerAssignmentDocumentUrl?.trim() || null

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={backTo}
          className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
        >
          Back to Course Directory
        </Link>
      </div>

      {loading ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm text-slate-600">Loading course...</p>
        </section>
      ) : null}

      {error ? (
        <section className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-red-700">
            Data Load Error
          </h1>
          <p className="mt-2 text-sm text-red-600">{error}</p>
        </section>
      ) : null}

      {!loading && !error && !aggregated ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Course not found
          </h1>
        </section>
      ) : null}

      {!loading && !error && aggregated ? (
        <>
          {/* Hero */}
          <section className={heroSectionClassName}>
            {isApCourse ? (
              <>
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0"
                >
                  <div className="absolute -left-12 -top-10 h-64 w-64 rounded-full bg-white/90 blur-3xl" />
                  <div className="absolute left-24 top-12 h-48 w-48 rounded-full bg-sky-100/80 blur-3xl" />
                  <div className="absolute right-[-2rem] top-8 h-72 w-72 rounded-full bg-blue-200/35 blur-3xl" />
                  <div className="absolute bottom-[-4rem] left-1/3 h-52 w-60 rounded-full bg-cyan-100/45 blur-3xl" />
                </div>
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-[1px] rounded-[23px] bg-[linear-gradient(135deg,rgba(255,255,255,0.82)_0%,rgba(255,255,255,0.22)_20%,rgba(255,255,255,0)_42%,rgba(191,219,254,0.18)_78%,rgba(255,255,255,0.28)_100%)]"
                />
              </>
            ) : null}

            <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <p className={heroEyebrowClassName}>
                  {heroEyebrowText}
                </p>
                <h1 className={heroTitleClassName}>
                  {aggregated.title}
                </h1>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {aggregated.isActive ? (
                    <span className={heroActiveClassName}>
                      Active
                    </span>
                  ) : (
                    <span className={heroInactiveClassName}>
                      Inactive
                    </span>
                  )}
                  {aggregated.subject ? (
                    <span className={heroMetaBaseClassName}>
                      {aggregated.subject}
                    </span>
                  ) : null}
                  <span className={heroPeriodCountClassName}>
                    {aggregated.periods.length}{" "}
                    {aggregated.periods.length === 1 ? "period" : "periods"}
                  </span>
                </div>
                {aggregated.description ? (
                  <p className={heroDescriptionClassName}>
                    {aggregated.description}
                  </p>
                ) : (
                  <div className={heroEmptyDescriptionClassName}>
                    No description available.
                  </div>
                )}
              </div>

              <dl className="grid gap-4 sm:grid-cols-3 lg:w-72 lg:grid-cols-1">
                <StatCard
                  label="UC Approved"
                  value={
                    <ApprovalIndicator
                      approved={aggregated.isUcApproved}
                      light={useThemedHeroCards}
                    />
                  }
                  accent={aggregated.isUcApproved ? "emerald" : "red"}
                  glass={useThemedHeroCards}
                />
                <StatCard
                  label="UC Honors"
                  value={
                    <ApprovalIndicator
                      approved={aggregated.isUcApprovedForHonors}
                      light={useThemedHeroCards}
                    />
                  }
                  accent={aggregated.isUcApprovedForHonors ? "emerald" : "red"}
                  glass={useThemedHeroCards}
                />
                <StatCard
                  label="NCAA Approved"
                  value={
                    <ApprovalIndicator
                      approved={aggregated.isNcaaApproved}
                      light={useThemedHeroCards}
                    />
                  }
                  accent={aggregated.isNcaaApproved ? "emerald" : "red"}
                  glass={useThemedHeroCards}
                />
              </dl>
            </div>
          </section>

          {/* Quick Stats */}
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Enrolled"
              value={aggregated.totalStudentCount}
            />
            <StatCard
              label="Duration"
              value={aggregated.courseLength ?? "-"}
            />
            <StatCard
              label="Daily HW (min)"
              value={aggregated.estimatedHomeworkMinutesPerDay ?? "-"}
            />
            <StatCard
              label="Summer Assignment"
              value={
                summerAssignmentUrl ? (
                  <a
                    href={summerAssignmentUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                  >
                    View
                  </a>
                ) : (
                  "No summer assignment"
                )
              }
            />
          </dl>

          {/* Prerequisites */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
            <h2 className="text-lg font-semibold text-slate-900">
              Prerequisites
            </h2>
            {aggregated.prerequisite ? (
              <div className="mt-4">
                <p className="text-sm leading-7 text-slate-600">
                  {aggregated.prerequisite}
                </p>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                No prerequisites listed.
              </div>
            )}
          </section>

          {/* Periods & Enrollment */}
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="p-6 lg:p-8">
              <h2 className="text-xl font-semibold text-slate-900">
                Periods & Enrollment
              </h2>
            </div>

            {aggregated.periods.length === 0 ? (
              <div className="px-6 pb-8 lg:px-8">
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                  No class periods found for this course.
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-slate-200 border-t border-slate-200">
                {aggregated.periods.map((period) => (
                  <PeriodRow key={period.course.id} period={period} />
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}
