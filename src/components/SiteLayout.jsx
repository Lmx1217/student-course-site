import { Link, NavLink, Outlet } from "react-router"

const navItems = [
  { label: "Home", to: "/" },
  { label: "Students", to: "/students" },
  { label: "Courses", to: "/courses" },
  { label: "Groups", to: "/groups" },
  { label: "Analytics", to: "/analytics" },
  { label: "About", to: "/about" },
]

export default function SiteLayout() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-5">
          <div>
            <Link to="/" className="text-xl font-bold tracking-tight">
              Student Course Data Platform
            </Link>
            <p className="mt-1 text-sm text-slate-500">
              Internal academic data portal
            </p>
          </div>

          <nav className="hidden gap-2 xl:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `rounded-lg px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-8 py-10">
        <Outlet />
      </main>
    </div>
  )
}
