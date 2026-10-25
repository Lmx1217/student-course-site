import { Link } from "react-router"

const statusMap = {
  ready: {
    text: "Available",
    className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  },
  building: {
    text: "In Progress",
    className: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  },
  planned: {
    text: "Planned",
    className: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  },
}

export default function FeatureCard({ title, description, status, path }) {
  const currentStatus = statusMap[status]

  return (
    <Link
      to={path}
      className="group block rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${currentStatus.className}`}
        >
          {currentStatus.text}
        </span>
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-600">
        {description}
      </p>

      <div className="mt-6 text-sm font-medium text-slate-900 transition group-hover:translate-x-1">
        Open Module →
      </div>
    </Link>
  )
}