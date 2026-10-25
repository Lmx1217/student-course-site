import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router"
import DualRangeSlider from "../components/DualRangeSlider"
import {
  loadStudentDirectoryData,
  type Course,
  type Person,
  type PersonCourseRelationship,
} from "../lib/studentDirectory"
import {
  buildCourseDirectoryRecords,
  type CourseDirectoryRecord,
} from "../lib/courseDirectory"

type SortField =
  | "course"
  | "subject"
  | "period"
  | "studentCount"
type SortDirection = "asc" | "desc"
type CourseDirectoryState = {
  searchTerm: string
  sortField: SortField
  sortDirection: SortDirection
  selectedSubjects: string[]
  selectedPeriods: string[]
  studentCountRange: [number, number]
  currentPage: number
}

const PAGE_SIZE = 50
const valueCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
})
const defaultSortDirectionByField: Record<SortField, SortDirection> = {
  course: "asc",
  subject: "asc",
  period: "asc",
  studentCount: "desc",
}
const validSortFields = new Set<SortField>([
  "course",
  "subject",
  "period",
  "studentCount",
])
const validSortDirections = new Set<SortDirection>(["asc", "desc"])

function compareLabels(
  left: string,
  right: string,
  direction: SortDirection
): number {
  const leftUnknown = left === "Unknown"
  const rightUnknown = right === "Unknown"

  if (leftUnknown && rightUnknown) {
    return 0
  }

  if (leftUnknown) {
    return 1
  }

  if (rightUnknown) {
    return -1
  }

  return direction === "asc"
    ? valueCollator.compare(left, right)
    : valueCollator.compare(right, left)
}

function compareNumbers(
  left: number,
  right: number,
  direction: SortDirection
): number {
  return direction === "asc" ? left - right : right - left
}

function compareCourseIdentity(
  left: CourseDirectoryRecord,
  right: CourseDirectoryRecord
): number {
  return (
    compareLabels(left.title, right.title, "asc") ||
    compareLabels(left.periodLabel, right.periodLabel, "asc") ||
    compareLabels(left.sectionLabel, right.sectionLabel, "asc") ||
    valueCollator.compare(left.id, right.id)
  )
}

function sortCourseRecords(
  left: CourseDirectoryRecord,
  right: CourseDirectoryRecord,
  sortField: SortField,
  sortDirection: SortDirection
): number {
  let comparison = 0

  switch (sortField) {
    case "subject":
      comparison = compareLabels(left.subjectLabel, right.subjectLabel, sortDirection)
      break
    case "period":
      comparison = compareLabels(left.periodLabel, right.periodLabel, sortDirection)
      break
    case "studentCount":
      comparison = compareNumbers(
        left.studentEnrollmentCount,
        right.studentEnrollmentCount,
        sortDirection
      )
      break
    case "course":
    default:
      comparison = compareLabels(left.title, right.title, sortDirection)
      break
  }

  return comparison || compareCourseIdentity(left, right)
}

function sortFilterOptions(values: string[]): string[] {
  return [...values].sort((left, right) => compareLabels(left, right, "asc"))
}

function clampNumber(value: number, minValue: number, maxValue: number): number {
  return Math.min(Math.max(value, minValue), maxValue)
}

function areSearchStatesEqual(
  left: CourseDirectoryState,
  right: CourseDirectoryState
): boolean {
  return (
    left.searchTerm === right.searchTerm &&
    left.sortField === right.sortField &&
    left.sortDirection === right.sortDirection &&
    left.currentPage === right.currentPage &&
    left.studentCountRange[0] === right.studentCountRange[0] &&
    left.studentCountRange[1] === right.studentCountRange[1] &&
    left.selectedSubjects.length === right.selectedSubjects.length &&
    left.selectedSubjects.every((subject, index) => {
      return subject === right.selectedSubjects[index]
    }) &&
    left.selectedPeriods.length === right.selectedPeriods.length &&
    left.selectedPeriods.every((period, index) => {
      return period === right.selectedPeriods[index]
    })
  )
}

function parseNonNegativeInteger(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) {
    return null
  }

  return Number(value)
}

function parsePositiveInteger(value: string | null): number | null {
  const parsedValue = parseNonNegativeInteger(value)

  if (parsedValue == null || parsedValue < 1) {
    return null
  }

  return parsedValue
}

function parseSelection(
  value: string | null,
  validOptions: Set<string>
): string[] {
  if (!value) {
    return []
  }

  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))].filter(
    (item) => validOptions.has(item)
  )
}

function parseSortField(value: string | null): SortField {
  return validSortFields.has(value as SortField) ? (value as SortField) : "course"
}

function parseSortDirection(
  value: string | null,
  sortField: SortField
): SortDirection {
  return validSortDirections.has(value as SortDirection)
    ? (value as SortDirection)
    : defaultSortDirectionByField[sortField]
}

function parseRange(
  searchParams: URLSearchParams,
  minKey: string,
  maxKey: string,
  maxValue: number
): [number, number] {
  const parsedMin = parseNonNegativeInteger(searchParams.get(minKey))
  const parsedMax = parseNonNegativeInteger(searchParams.get(maxKey))
  const minValue = parsedMin == null ? 0 : clampNumber(parsedMin, 0, maxValue)
  const resolvedMaxValue =
    parsedMax == null ? maxValue : clampNumber(parsedMax, 0, maxValue)

  if (minValue <= resolvedMaxValue) {
    return [minValue, resolvedMaxValue]
  }

  return [resolvedMaxValue, minValue]
}

function parseCourseDirectoryState(
  searchParams: URLSearchParams,
  subjectOptions: string[],
  periodOptions: string[],
  maxStudentCount: number
): CourseDirectoryState {
  const sortField = parseSortField(searchParams.get("sortField"))
  const validSubjectOptions = new Set(subjectOptions)
  const validPeriodOptions = new Set(periodOptions)

  return {
    searchTerm: searchParams.get("q") ?? "",
    sortField,
    sortDirection: parseSortDirection(searchParams.get("sortDir"), sortField),
    selectedSubjects: parseSelection(searchParams.get("subjects"), validSubjectOptions),
    selectedPeriods: parseSelection(searchParams.get("periods"), validPeriodOptions),
    studentCountRange: parseRange(
      searchParams,
      "studentMin",
      "studentMax",
      maxStudentCount
    ),
    currentPage: parsePositiveInteger(searchParams.get("page")) ?? 1,
  }
}

function buildCourseSearchParams(
  searchState: CourseDirectoryState,
  maxStudentCount: number
): URLSearchParams {
  const params = new URLSearchParams()
  const trimmedSearchTerm = searchState.searchTerm.trim()

  if (trimmedSearchTerm) {
    params.set("q", trimmedSearchTerm)
  }

  if (searchState.selectedSubjects.length > 0) {
    params.set("subjects", searchState.selectedSubjects.join(","))
  }

  if (searchState.selectedPeriods.length > 0) {
    params.set("periods", searchState.selectedPeriods.join(","))
  }

  if (searchState.studentCountRange[0] > 0) {
    params.set("studentMin", String(searchState.studentCountRange[0]))
  }

  if (searchState.studentCountRange[1] < maxStudentCount) {
    params.set("studentMax", String(searchState.studentCountRange[1]))
  }

  if (searchState.sortField !== "course") {
    params.set("sortField", searchState.sortField)
  }

  if (
    searchState.sortDirection !==
    defaultSortDirectionByField[searchState.sortField]
  ) {
    params.set("sortDir", searchState.sortDirection)
  }

  if (searchState.currentPage > 1) {
    params.set("page", String(searchState.currentPage))
  }

  return params
}

export default function CourseDirectory() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [people, setPeople] = useState<Person[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [personCourses, setPersonCourses] = useState<PersonCourseRelationship[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const pendingSearchStateRef = useRef<CourseDirectoryState | null>(null)
  const searchParamsSyncTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    async function loadCourseData() {
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
          setError("Failed to load course data.")
        }
      } finally {
        setLoading(false)
      }
    }

    void loadCourseData()
  }, [])

  const courseRecords = useMemo(() => {
    return buildCourseDirectoryRecords(people, courses, personCourses)
  }, [courses, people, personCourses])

  const subjectOptions = useMemo(() => {
    return sortFilterOptions([...new Set(courseRecords.map((course) => course.subjectLabel))])
  }, [courseRecords])

  const periodOptions = useMemo(() => {
    return sortFilterOptions([...new Set(courseRecords.map((course) => course.periodLabel))])
  }, [courseRecords])

  const maxStudentCount = useMemo(() => {
    return courseRecords.reduce((maxCount, course) => {
      return Math.max(maxCount, course.studentEnrollmentCount)
    }, 0)
  }, [courseRecords])

  const parsedSearchState = useMemo(() => {
    return parseCourseDirectoryState(
      searchParams,
      subjectOptions,
      periodOptions,
      maxStudentCount
    )
  }, [maxStudentCount, periodOptions, searchParams, subjectOptions])
  const [pendingSearchState, setPendingSearchState] =
    useState<CourseDirectoryState | null>(null)
  const searchState = pendingSearchState ?? parsedSearchState

  useEffect(() => {
    if (
      pendingSearchState &&
      areSearchStatesEqual(pendingSearchState, parsedSearchState)
    ) {
      pendingSearchStateRef.current = null
      setPendingSearchState(null)
    }
  }, [parsedSearchState, pendingSearchState])

  useEffect(() => {
    return () => {
      if (searchParamsSyncTimeoutRef.current != null) {
        window.clearTimeout(searchParamsSyncTimeoutRef.current)
      }
    }
  }, [])

  const filteredCourses = useMemo(() => {
    const keyword = searchState.searchTerm.trim().toLowerCase()

    return [...courseRecords]
      .filter((course) => {
        const matchesSearch =
          keyword === "" ||
          [
            course.title,
            course.rawName,
            course.subjectLabel,
            course.periodLabel,
            course.sectionLabel,
          ].some((value) => value.toLowerCase().includes(keyword))

        const matchesSubjects =
          searchState.selectedSubjects.length === 0 ||
          searchState.selectedSubjects.includes(course.subjectLabel)

        const matchesPeriods =
          searchState.selectedPeriods.length === 0 ||
          searchState.selectedPeriods.includes(course.periodLabel)

        const matchesStudentCount =
          course.studentEnrollmentCount >= searchState.studentCountRange[0] &&
          course.studentEnrollmentCount <= searchState.studentCountRange[1]

        return (
          matchesSearch &&
          matchesSubjects &&
          matchesPeriods &&
          matchesStudentCount
        )
      })
      .sort((left, right) =>
        sortCourseRecords(left, right, searchState.sortField, searchState.sortDirection)
      )
  }, [
    courseRecords,
    searchState.searchTerm,
    searchState.selectedPeriods,
    searchState.selectedSubjects,
    searchState.sortDirection,
    searchState.sortField,
    searchState.studentCountRange,
  ])

  const totalPages = Math.max(1, Math.ceil(filteredCourses.length / PAGE_SIZE))
  const currentPage = Math.min(searchState.currentPage, totalPages)
  const currentListState = useMemo<CourseDirectoryState>(() => {
    return {
      ...searchState,
      currentPage,
    }
  }, [currentPage, searchState])
  const currentSearchString = useMemo(() => {
    const nextSearchParams = buildCourseSearchParams(
      currentListState,
      maxStudentCount
    ).toString()

    return nextSearchParams ? `?${nextSearchParams}` : ""
  }, [currentListState, maxStudentCount])

  const paginatedCourses = useMemo(() => {
    const pageStart = (currentPage - 1) * PAGE_SIZE
    return filteredCourses.slice(pageStart, pageStart + PAGE_SIZE)
  }, [currentPage, filteredCourses])

  function syncSearchParams(nextState: CourseDirectoryState) {
    setSearchParams(buildCourseSearchParams(nextState, maxStudentCount), {
      replace: true,
    })
  }

  function clearScheduledSearchParamsSync() {
    if (searchParamsSyncTimeoutRef.current != null) {
      window.clearTimeout(searchParamsSyncTimeoutRef.current)
      searchParamsSyncTimeoutRef.current = null
    }
  }

  function scheduleSearchParamsSync(nextState: CourseDirectoryState) {
    clearScheduledSearchParamsSync()
    searchParamsSyncTimeoutRef.current = window.setTimeout(() => {
      searchParamsSyncTimeoutRef.current = null
      syncSearchParams(nextState)
    }, 120)
  }

  function replaceSearchState(
    nextState: CourseDirectoryState,
    options?: { deferSearchParamsSync?: boolean }
  ) {
    pendingSearchStateRef.current = nextState
    setPendingSearchState(nextState)

    if (options?.deferSearchParamsSync) {
      scheduleSearchParamsSync(nextState)
      return
    }

    clearScheduledSearchParamsSync()
    syncSearchParams(nextState)
  }

  function commitPendingSearchState() {
    const nextState = pendingSearchStateRef.current

    if (!nextState) {
      return
    }

    clearScheduledSearchParamsSync()
    syncSearchParams(nextState)
  }

  function toggleSubjectFilter(subjectValue: string) {
    const nextSelectedSubjects = currentListState.selectedSubjects.includes(subjectValue)
      ? currentListState.selectedSubjects.filter((value) => value !== subjectValue)
      : [...currentListState.selectedSubjects, subjectValue]

    replaceSearchState({
      ...currentListState,
      selectedSubjects: nextSelectedSubjects,
      currentPage: 1,
    })
  }

  function togglePeriodFilter(periodValue: string) {
    const nextSelectedPeriods = currentListState.selectedPeriods.includes(periodValue)
      ? currentListState.selectedPeriods.filter((value) => value !== periodValue)
      : [...currentListState.selectedPeriods, periodValue]

    replaceSearchState({
      ...currentListState,
      selectedPeriods: nextSelectedPeriods,
      currentPage: 1,
    })
  }

  function handleSort(nextSortField: SortField) {
    if (currentListState.sortField === nextSortField) {
      replaceSearchState({
        ...currentListState,
        sortDirection:
          currentListState.sortDirection === "asc" ? "desc" : "asc",
        currentPage: 1,
      })
      return
    }

    replaceSearchState({
      ...currentListState,
      sortField: nextSortField,
      sortDirection: defaultSortDirectionByField[nextSortField],
      currentPage: 1,
    })
  }

  function clearFilters() {
    replaceSearchState({
      searchTerm: "",
      sortField: "course",
      sortDirection: "asc",
      selectedSubjects: [],
      selectedPeriods: [],
      studentCountRange: [0, maxStudentCount],
      currentPage: 1,
    })
  }

  function renderSortIndicator(field: SortField) {
    const isActive = currentListState.sortField === field

    return (
      <span aria-hidden="true" className="inline-flex flex-col items-center gap-[2px]">
        <svg
          viewBox="0 0 8 5"
          className={`h-[5px] w-[8px] ${
            isActive && currentListState.sortDirection === "asc"
              ? "text-slate-900"
              : "text-slate-300"
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M1 4L4 1L7 4" />
        </svg>
        <svg
          viewBox="0 0 8 5"
          className={`h-[5px] w-[8px] ${
            isActive && currentListState.sortDirection === "desc"
              ? "text-slate-900"
              : "text-slate-300"
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M1 1L4 4L7 1" />
        </svg>
      </span>
    )
  }

  function renderSortableHeader(label: string, field: SortField) {
    return (
      <button
        type="button"
        onClick={() => handleSort(field)}
        className="inline-flex items-center gap-2 text-left transition hover:text-slate-700"
      >
        <span>{label}</span>
        {renderSortIndicator(field)}
      </button>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            Course Directory
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 lg:text-4xl">
            Course Catalog
          </h1>
        </div>

        <div className="mx-auto mt-6 w-full max-w-2xl">
          <input
            id="course-search-input"
            type="text"
            value={currentListState.searchTerm}
            onChange={(event) =>
              replaceSearchState({
                ...currentListState,
                searchTerm: event.target.value,
                currentPage: 1,
              })
            }
            placeholder="Search by course name, subject, period, or section"
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          />
        </div>
      </section>

      {loading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">Loading course data...</p>
        </section>
      ) : null}

      {error ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-red-700">Data Load Error</h2>
          <p className="mt-2 text-sm text-red-600">{error}</p>
          <p className="mt-3 text-sm text-red-600">
            Check that the normalized files exist under{" "}
            <code>/public/data/normalized</code> and that the Vite dev server is
            running normally.
          </p>
        </section>
      ) : null}

      {!loading && !error ? (
        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-6 shadow-sm xl:sticky xl:top-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Filters</h2>
              </div>

              <button
                type="button"
                onClick={clearFilters}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              >
                Clear
              </button>
            </div>

            <div className="mt-6 space-y-6">
              <div>
                <div className="mb-3 text-sm font-medium text-slate-700">Subject</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      replaceSearchState({
                        ...currentListState,
                        selectedSubjects: [],
                        currentPage: 1,
                      })
                    }
                    className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                      currentListState.selectedSubjects.length === 0
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    All
                  </button>

                  {subjectOptions.map((subjectValue) => {
                    const isActive =
                      currentListState.selectedSubjects.includes(subjectValue)

                    return (
                      <button
                        key={subjectValue}
                        type="button"
                        onClick={() => toggleSubjectFilter(subjectValue)}
                        className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                          isActive
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {subjectValue}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <div className="mb-3 text-sm font-medium text-slate-700">Period</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      replaceSearchState({
                        ...currentListState,
                        selectedPeriods: [],
                        currentPage: 1,
                      })
                    }
                    className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                      currentListState.selectedPeriods.length === 0
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    All
                  </button>

                  {periodOptions.map((periodValue) => {
                    const isActive =
                      currentListState.selectedPeriods.includes(periodValue)

                    return (
                      <button
                        key={periodValue}
                        type="button"
                        onClick={() => togglePeriodFilter(periodValue)}
                        className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                          isActive
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {periodValue}
                      </button>
                    )
                  })}
                </div>
              </div>

              <DualRangeSlider
                label="Student count range"
                range={currentListState.studentCountRange}
                maxValue={maxStudentCount}
                onCommit={commitPendingSearchState}
                onMinChange={(nextValue) => {
                  replaceSearchState(
                    {
                      ...currentListState,
                      studentCountRange: [
                        Math.min(nextValue, currentListState.studentCountRange[1]),
                        currentListState.studentCountRange[1],
                      ],
                      currentPage: 1,
                    },
                    { deferSearchParamsSync: true }
                  )
                }}
                onMaxChange={(nextValue) => {
                  replaceSearchState(
                    {
                      ...currentListState,
                      studentCountRange: [
                        currentListState.studentCountRange[0],
                        Math.max(nextValue, currentListState.studentCountRange[0]),
                      ],
                      currentPage: 1,
                    },
                    { deferSearchParamsSync: true }
                  )
                }}
              />
            </div>
          </aside>

          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    {filteredCourses.length} courses
                  </h2>
                </div>

                {filteredCourses.length > 0 ? (
                  <div className="text-sm text-slate-500">
                    Page {currentPage} of {totalPages}
                  </div>
                ) : null}
              </div>
            </div>

            {filteredCourses.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <h3 className="text-lg font-semibold text-slate-900">
                  No matching courses
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  Try broadening the search term or clearing some filters.
                </p>
              </div>
            ) : (
              <div>
                <div className="hidden grid-cols-[minmax(0,2.9fr)_140px_90px_90px_160px] gap-4 border-b border-slate-200 bg-slate-50 px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 md:grid">
                  <div>{renderSortableHeader("Course", "course")}</div>
                  <div>{renderSortableHeader("Subject", "subject")}</div>
                  <div>{renderSortableHeader("Period", "period")}</div>
                  <div>{renderSortableHeader("Students", "studentCount")}</div>
                  <div className="text-right">Actions</div>
                </div>

                <ul className="divide-y divide-slate-200">
                  {paginatedCourses.map((course) => {
                    return (
                      <li key={course.id} className="px-6 py-5">
                        <div className="grid gap-4 md:grid-cols-[minmax(0,2.9fr)_140px_90px_90px_160px] md:items-center">
                          <div className="min-w-0">
                            <div className="truncate text-base font-semibold text-slate-900">
                              {course.title}
                            </div>
                          </div>

                          <div className="text-sm text-slate-700">
                            <span className="font-medium text-slate-500 md:hidden">
                              Subject:{" "}
                            </span>
                            {course.subjectLabel}
                          </div>

                          <div className="text-sm text-slate-700">
                            <span className="font-medium text-slate-500 md:hidden">
                              Period:{" "}
                            </span>
                            {course.periodLabel}
                          </div>

                          <div className="text-sm text-slate-700">
                            <span className="font-medium text-slate-500 md:hidden">
                              Students:{" "}
                            </span>
                            {course.studentEnrollmentCount}
                          </div>

                          <div className="md:text-right">
                            <Link
                              to={{
                                pathname: `/courses/${course.id}`,
                                search: currentSearchString,
                              }}
                              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                            >
                              View details
                            </Link>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>

                {totalPages > 1 ? (
                  <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-4 md:flex-row md:items-center md:justify-between">
                    <div className="text-sm text-slate-500" />

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          replaceSearchState({
                            ...currentListState,
                            currentPage: Math.max(1, currentPage - 1),
                          })
                        }
                        disabled={currentPage === 1}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Previous
                      </button>

                      {Array.from({ length: totalPages }, (_, index) => index + 1).map(
                        (pageNumber) => (
                          <button
                            key={pageNumber}
                            type="button"
                            onClick={() =>
                              replaceSearchState({
                                ...currentListState,
                                currentPage: pageNumber,
                              })
                            }
                            className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                              currentPage === pageNumber
                                ? "bg-slate-900 text-white"
                                : "border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900"
                            }`}
                          >
                            {pageNumber}
                          </button>
                        )
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          replaceSearchState({
                            ...currentListState,
                            currentPage: Math.min(totalPages, currentPage + 1),
                          })
                        }
                        disabled={currentPage === totalPages}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  )
}
