import FeatureCard from "../components/FeatureCard"
import { modules } from "../data/modules"

type FeatureModule = {
  title: string
  description: string
  status: "ready" | "building" | "planned"
  path: string
}

const featureModules = modules as FeatureModule[]

export default function Home() {
  return (
    <>
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
          School Data Portal
        </p>

        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          Student Course Data Platform
        </h1>

        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
          A structured data platform for student data. This version focuses on
          feature access, clear navigation, and a scalable frontend
          architecture for future upgrades.
        </p>
      </section>

      <section className="mt-10">
        <div className="mb-5">
          <h2 className="text-2xl font-semibold">Feature Modules</h2>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {featureModules.map((module) => (
            <FeatureCard key={module.title} {...module} />
          ))}
        </div>
      </section>
    </>
  )
}
