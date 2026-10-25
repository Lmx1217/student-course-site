import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router"
import DualRangeSlider from "../components/DualRangeSlider"
import {
  getStudentName,
  loadStudentDirectoryData,
  type Course,
  type Person,
  type PersonCourseRelationship,
  type PersonGroupRelationship,
} from "../lib/studentDirectory"

type StudentRecord = Person & {
  courseCount: number
  groupCount: number
}

type SortField = "name" | "grade" | "role" | "courseCount" | "groupCount"
type SortDirection = "asc" | "desc"
type StudentSearchState = {
  searchTerm: string
  sortField: SortField
  sortDirection: SortDirection
  selectedGrades: string[]
  courseRange: [number, number]
  groupRange: [number, number]
  currentPage: number
}

const defaultSortDirectionByField: Record<SortField, SortDirection> = {
  name: "asc",
  grade: "desc",
  role: "asc",
  courseCount: "desc",
  groupCount: "desc",
}
const validSortFields = new Set<SortField>([
  "name",
  "grade",
  "role",
  "courseCount",
  "groupCount",
])
const validSortDirections = new Set<SortDirection>(["asc", "desc"])

function formatValue(value: string | number | null | undefined): string | number {
  if (value === null || value === undefined || value === "") {
    return "Unknown"
  }

  return value
}

function buildCountMap<T extends { personId: string }>(relations: T[]): Map<string, number> {
  return relations.reduce((countMap, relation) => {
    const currentCount = countMap.get(relation.personId) ?? 0
    countMap.set(relation.personId, currentCount + 1)
    return countMap
  }, new Map<string, number>())
}

function compareNullableNumbers(
  left: number | null | undefined,
  right: number | null | undefined,
  direction: "asc" | "desc"
): number {
  if (left == null && right == null) {
    return 0
  }

  if (left == null) {
    return 1
  }

  if (right == null) {
    return -1
  }

  return direction === "asc" ? left - right : right - left
}

function compareNullableStrings(
  left: string | null | undefined,
  right: string | null | undefined,
  direction: SortDirection
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

  return direction === "asc" ? left.localeCompare(right) : right.localeCompare(left)
}

function sortStudents(
  left: StudentRecord,
  right: StudentRecord,
  sortField: SortField,
  sortDirection: SortDirection
): number {
  let comparison = 0

  switch (sortField) {
    case "grade":
      comparison = compareNullableNumbers(left.gradeLevel, right.gradeLevel, sortDirection)
      break
    case "role":
      comparison = compareNullableStrings(left.role, right.role, sortDirection)
      break
    case "courseCount":
      comparison =
        sortDirection === "asc"
          ? left.courseCount - right.courseCount
          : right.courseCount - left.courseCount
      break
    case "groupCount":
      comparison =
        sortDirection === "asc"
          ? left.groupCount - right.groupCount
          : right.groupCount - left.groupCount
      break
    case "name":
    default:
      comparison = compareNullableStrings(
        getStudentName(left),
        getStudentName(right),
        sortDirection
      )
  }

  return comparison || getStudentName(left).localeCompare(getStudentName(right))
}

function clampNumber(value: number, minValue: number, maxValue: number): number {
  return Math.min(Math.max(value, minValue), maxValue)
}

function areSearchStatesEqual(
  left: StudentSearchState,
  right: StudentSearchState
): boolean {
  return (
    left.searchTerm === right.searchTerm &&
    left.sortField === right.sortField &&
    left.sortDirection === right.sortDirection &&
    left.currentPage === right.currentPage &&
    left.courseRange[0] === right.courseRange[0] &&
    left.courseRange[1] === right.courseRange[1] &&
    left.groupRange[0] === right.groupRange[0] &&
    left.groupRange[1] === right.groupRange[1] &&
    left.selectedGrades.length === right.selectedGrades.length &&
    left.selectedGrades.every((gradeValue, index) => {
      return gradeValue === right.selectedGrades[index]
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

function parseGrades(value: string | null): string[] {
  if (!value) {
    return []
  }

  return [...new Set(value.split(",").map((grade) => grade.trim()).filter(Boolean))]
}

function parseSortField(value: string | null): SortField {
  return validSortFields.has(value as SortField) ? (value as SortField) : "name"
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

function parseStudentSearchState(
  searchParams: URLSearchParams,
  gradeOptions: string[],
  maxCourseCount: number,
  maxGroupCount: number
): StudentSearchState {
  const sortField = parseSortField(searchParams.get("sortField"))
  const validGradeOptions = new Set(gradeOptions)

  return {
    searchTerm: searchParams.get("q") ?? "",
    sortField,
    sortDirection: parseSortDirection(searchParams.get("sortDir"), sortField),
    selectedGrades: parseGrades(searchParams.get("grades")).filter((gradeValue) =>
      validGradeOptions.has(gradeValue)
    ),
    courseRange: parseRange(searchParams, "courseMin", "courseMax", maxCourseCount),
    groupRange: parseRange(searchParams, "groupMin", "groupMax", maxGroupCount),
    currentPage: parsePositiveInteger(searchParams.get("page")) ?? 1,
  }
}

function buildStudentSearchParams(
  searchState: StudentSearchState,
  maxCourseCount: number,
  maxGroupCount: number
): URLSearchParams {
  const params = new URLSearchParams()
  const trimmedSearchTerm = searchState.searchTerm.trim()

  if (trimmedSearchTerm) {
    params.set("q", trimmedSearchTerm)
  }

  if (searchState.selectedGrades.length > 0) {
    params.set("grades", searchState.selectedGrades.join(","))
  }

  if (searchState.courseRange[0] > 0) {
    params.set("courseMin", String(searchState.courseRange[0]))
  }

  if (searchState.courseRange[1] < maxCourseCount) {
    params.set("courseMax", String(searchState.courseRange[1]))
  }

  if (searchState.groupRange[0] > 0) {
    params.set("groupMin", String(searchState.groupRange[0]))
  }

  if (searchState.groupRange[1] < maxGroupCount) {
    params.set("groupMax", String(searchState.groupRange[1]))
  }

  if (searchState.sortField !== "name") {
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

export default function StudentSearch() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [people, setPeople] = useState<Person[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [personCourses, setPersonCourses] = useState<PersonCourseRelationship[]>([])
  const [personGroups, setPersonGroups] = useState<PersonGroupRelationship[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const pendingSearchStateRef = useRef<StudentSearchState | null>(null)
  const searchParamsSyncTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    async function loadStudentData() {
      try {
        setLoading(true)
        setError("")
        const { people, courses, personCourses, personGroups } =
          await loadStudentDirectoryData()

        setPeople(people)
        setCourses(courses)
        setPersonCourses(personCourses)
        setPersonGroups(personGroups)
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

    void loadStudentData()
  }, [])

  const studentRecords = useMemo(() => {
    const noiseCourseIds = new Set(
      courses.filter((course) => course.isNoise).map((course) => course.id)
    )
    const filteredCourseLinks = personCourses.filter((relationship) => {
      return !noiseCourseIds.has(relationship.courseId)
    })
    const courseCountMap = buildCountMap(filteredCourseLinks)
    const groupCountMap = buildCountMap(personGroups)

    return people
      .filter((person) => !person.role || person.role.toLowerCase() === "student")
      .map((person) => ({
        ...person,
        courseCount: courseCountMap.get(person.id) ?? 0,
        groupCount: groupCountMap.get(person.id) ?? 0,
      }))
  }, [courses, people, personCourses, personGroups])

  const gradeOptions = useMemo(() => {
    const uniqueGrades = new Set<string>()

    studentRecords.forEach((student) => {
      if (student.gradeLevel == null) {
        uniqueGrades.add("unknown")
      } else {
        uniqueGrades.add(String(student.gradeLevel))
      }
    })

    return [...uniqueGrades].sort((left, right) => {
      if (left === "unknown") {
        return 1
      }

      if (right === "unknown") {
        return -1
      }

      return Number(left) - Number(right)
    })
  }, [studentRecords])

  const maxCourseCount = useMemo(() => {
    return studentRecords.reduce((maxCount, student) => {
      return Math.max(maxCount, student.courseCount)
    }, 0)
  }, [studentRecords])

  const maxGroupCount = useMemo(() => {
    return studentRecords.reduce((maxCount, student) => {
      return Math.max(maxCount, student.groupCount)
    }, 0)
  }, [studentRecords])

  const parsedSearchState = useMemo(() => {
    return parseStudentSearchState(
      searchParams,
      gradeOptions,
      maxCourseCount,
      maxGroupCount
    )
  }, [gradeOptions, maxCourseCount, maxGroupCount, searchParams])
  const [pendingSearchState, setPendingSearchState] = useState<StudentSearchState | null>(
    null
  )
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

  const filteredStudents = useMemo(() => {
    const keyword = searchState.searchTerm.trim().toLowerCase()

    return [...studentRecords]
      .filter((student) => {
        const gradeKey =
          student.gradeLevel == null ? "unknown" : String(student.gradeLevel)

        const matchesSearch =
          keyword === "" ||
          [
            student.displayName,
            student.name,
            student.nickName,
            student.email,
            student.schoologyUserId,
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(keyword))

        const matchesGrade =
          searchState.selectedGrades.length === 0 ||
          searchState.selectedGrades.includes(gradeKey)

        const matchesCourseRange =
          student.courseCount >= searchState.courseRange[0] &&
          student.courseCount <= searchState.courseRange[1]

        const matchesGroupRange =
          student.groupCount >= searchState.groupRange[0] &&
          student.groupCount <= searchState.groupRange[1]

        return (
          matchesSearch && matchesGrade && matchesCourseRange && matchesGroupRange
        )
      })
      .sort((left, right) =>
        sortStudents(left, right, searchState.sortField, searchState.sortDirection)
      )
  }, [
    searchState.courseRange,
    searchState.groupRange,
    searchState.searchTerm,
    searchState.selectedGrades,
    searchState.sortDirection,
    searchState.sortField,
    studentRecords,
  ])

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / 50))
  const currentPage = Math.min(searchState.currentPage, totalPages)
  const currentListState = useMemo<StudentSearchState>(() => {
    return {
      ...searchState,
      currentPage,
    }
  }, [currentPage, searchState])
  const currentSearchString = useMemo(() => {
    const nextSearchParams = buildStudentSearchParams(
      currentListState,
      maxCourseCount,
      maxGroupCount
    ).toString()

    return nextSearchParams ? `?${nextSearchParams}` : ""
  }, [currentListState, maxCourseCount, maxGroupCount])

  const paginatedStudents = useMemo(() => {
    const pageSize = 50
    const pageStart = (currentPage - 1) * pageSize
    return filteredStudents.slice(pageStart, pageStart + pageSize)
  }, [currentPage, filteredStudents])

  function syncSearchParams(nextState: StudentSearchState) {
    setSearchParams(
      buildStudentSearchParams(nextState, maxCourseCount, maxGroupCount),
      { replace: true }
    )
  }

  function clearScheduledSearchParamsSync() {
    if (searchParamsSyncTimeoutRef.current != null) {
      window.clearTimeout(searchParamsSyncTimeoutRef.current)
      searchParamsSyncTimeoutRef.current = null
    }
  }

  function scheduleSearchParamsSync(nextState: StudentSearchState) {
    clearScheduledSearchParamsSync()
    searchParamsSyncTimeoutRef.current = window.setTimeout(() => {
      searchParamsSyncTimeoutRef.current = null
      syncSearchParams(nextState)
    }, 120)
  }

  function replaceSearchState(
    nextState: StudentSearchState,
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

  function toggleGradeFilter(gradeValue: string) {
    const nextSelectedGrades = currentListState.selectedGrades.includes(gradeValue)
      ? currentListState.selectedGrades.filter(
          (currentValue) => currentValue !== gradeValue
        )
      : [...currentListState.selectedGrades, gradeValue]

    replaceSearchState({
      ...currentListState,
      selectedGrades: nextSelectedGrades,
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
      sortField: "name",
      sortDirection: "asc",
      selectedGrades: [],
      courseRange: [0, maxCourseCount],
      groupRange: [0, maxGroupCount],
      currentPage: 1,
    })
  }

  function renderSortIndicator(field: SortField) {
    const isActive = currentListState.sortField === field

    return (
      <span
        aria-hidden="true"
        className="inline-flex flex-col items-center gap-[2px]"
      >
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
            Student Directory
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 lg:text-4xl">
            Student Search
          </h1>
        </div>

        <div className="mx-auto mt-6 w-full max-w-2xl">
          <input
            id="student-search-input"
            type="text"
            value={currentListState.searchTerm}
            onChange={(event) =>
              replaceSearchState({
                ...currentListState,
                searchTerm: event.target.value,
                currentPage: 1,
              })
            }
            placeholder="Search by name, nickname, email, or Schoology ID"
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          />
        </div>
      </section>

      {loading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">Loading student data...</p>
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
                <div className="mb-3 text-sm font-medium text-slate-700">Grade</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      replaceSearchState({
                        ...currentListState,
                        selectedGrades: [],
                        currentPage: 1,
                      })
                    }
                    className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                      currentListState.selectedGrades.length === 0
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    All
                  </button>

                  {gradeOptions.map((gradeValue) => {
                    const isActive = currentListState.selectedGrades.includes(gradeValue)
                    const label = gradeValue === "unknown" ? "Unknown" : gradeValue

                    return (
                      <button
                        key={gradeValue}
                        type="button"
                        onClick={() => toggleGradeFilter(gradeValue)}
                        className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                          isActive
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <DualRangeSlider
                label="Course count range"
                range={currentListState.courseRange}
                maxValue={maxCourseCount}
                onCommit={commitPendingSearchState}
                onMinChange={(nextValue) => {
                  replaceSearchState({
                    ...currentListState,
                    courseRange: [
                      Math.min(nextValue, currentListState.courseRange[1]),
                      currentListState.courseRange[1],
                    ],
                    currentPage: 1,
                  }, { deferSearchParamsSync: true })
                }}
                onMaxChange={(nextValue) => {
                  replaceSearchState({
                    ...currentListState,
                    courseRange: [
                      currentListState.courseRange[0],
                      Math.max(nextValue, currentListState.courseRange[0]),
                    ],
                    currentPage: 1,
                  }, { deferSearchParamsSync: true })
                }}
              />

              <DualRangeSlider
                label="Group count range"
                range={currentListState.groupRange}
                maxValue={maxGroupCount}
                onCommit={commitPendingSearchState}
                onMinChange={(nextValue) => {
                  replaceSearchState({
                    ...currentListState,
                    groupRange: [
                      Math.min(nextValue, currentListState.groupRange[1]),
                      currentListState.groupRange[1],
                    ],
                    currentPage: 1,
                  }, { deferSearchParamsSync: true })
                }}
                onMaxChange={(nextValue) => {
                  replaceSearchState({
                    ...currentListState,
                    groupRange: [
                      currentListState.groupRange[0],
                      Math.max(nextValue, currentListState.groupRange[0]),
                    ],
                    currentPage: 1,
                  }, { deferSearchParamsSync: true })
                }}
              />
            </div>
          </aside>

          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    {filteredStudents.length} students
                  </h2>
                </div>

                {filteredStudents.length > 0 ? (
                  <div className="text-sm text-slate-500">
                    Page {currentPage} of {totalPages}
                  </div>
                ) : null}
              </div>
            </div>

            {filteredStudents.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <h3 className="text-lg font-semibold text-slate-900">
                  No matching students
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  Try broadening the search term or clearing some filters.
                </p>
              </div>
            ) : (
              <div>
                <div className="hidden grid-cols-[minmax(0,2.2fr)_90px_110px_120px_120px_140px] gap-4 border-b border-slate-200 bg-slate-50 px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 md:grid">
                  <div>{renderSortableHeader("Name", "name")}</div>
                  <div>{renderSortableHeader("Grade", "grade")}</div>
                  <div>{renderSortableHeader("Role", "role")}</div>
                  <div>{renderSortableHeader("Course count", "courseCount")}</div>
                  <div>{renderSortableHeader("Group count", "groupCount")}</div>
                  <div className="text-right">Details</div>
                </div>

                <ul className="divide-y divide-slate-200">
                  {paginatedStudents.map((student) => {
                    const studentName = getStudentName(student)

                    return (
                      <li key={student.id} className="px-6 py-5">
                        <div className="grid gap-4 md:grid-cols-[minmax(0,2.2fr)_90px_110px_120px_120px_140px] md:items-center">
                          <div className="min-w-0">
                            <div className="truncate text-base font-semibold text-slate-900">
                              {studentName}
                            </div>
                            <div className="mt-1 truncate text-sm text-slate-500">
                              {student.email || student.schoologyUserId || "No email"}
                            </div>
                          </div>

                          <div className="text-sm text-slate-700">
                            <span className="font-medium text-slate-500 md:hidden">
                              Grade:{" "}
                            </span>
                            {formatValue(student.gradeLevel)}
                          </div>

                          <div className="text-sm text-slate-700">
                            <span className="font-medium text-slate-500 md:hidden">
                              Role:{" "}
                            </span>
                            {formatValue(student.role)}
                          </div>

                          <div className="text-sm text-slate-700">
                            <span className="font-medium text-slate-500 md:hidden">
                              Course count:{" "}
                            </span>
                            {student.courseCount}
                          </div>

                          <div className="text-sm text-slate-700">
                            <span className="font-medium text-slate-500 md:hidden">
                              Group count:{" "}
                            </span>
                            {student.groupCount}
                          </div>

                          <div className="md:text-right">
                            <Link
                              to={{
                                pathname: `/students/${student.id}`,
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
                    <div className="text-sm text-slate-500">
                    </div>

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
