import { Routes, Route } from "react-router"
import SiteLayout from "./components/SiteLayout"
import Home from "./pages/Home"
import StudentSearch from "./pages/StudentSearch"
import StudentDetail from "./pages/StudentDetail"
import CourseDirectory from "./pages/CourseDirectory"
import CourseDetail from "./pages/CourseDetail"
import GroupDirectory from "./pages/GroupDirectory"
import Analytics from "./pages/Analytics"
import AboutSystem from "./pages/AboutSystem"

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<SiteLayout />}>
        <Route index element={<Home />} />
        <Route path="students" element={<StudentSearch />} />
        <Route path="students/:studentId" element={<StudentDetail />} />
        <Route path="courses" element={<CourseDirectory />} />
        <Route path="courses/:courseId" element={<CourseDetail />} />
        <Route path="groups" element={<GroupDirectory />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="about" element={<AboutSystem />} />
      </Route>
    </Routes>
  )
}
