# Student Course Data Platform

A React and TypeScript portfolio project for exploring student, course, and group relationships. The public demonstration uses fictional students, example identifiers, and generated memberships. No demo record represents a real student or their actual enrollment.

## Implemented features

- Search and filter the student directory, then inspect individual student profiles.
- Browse and filter the course catalog, including enrollment counts and course details.
- Normalize JSON exports into separate people, courses, groups, and relationship collections.
- Regenerate deterministic demonstration fixtures: currently 302 fictional students in grades 9 through 12, 332 course records, and 14 groups.

The group directory, analytics, and system information pages are placeholders or works in progress. This repository contains the data-platform project; it is not yet a personal portfolio containing multiple projects.

## Stack and local development

React, TypeScript, React Router, Tailwind CSS, and Vite. Use Node.js 22.12 or newer; this revision was checked with Node.js 24.

```sh
npm ci
npm run dev
```

```sh
npm run build      # Type-check and build the static site into dist/
npm run preview    # Preview the production build locally
npm run data:demo  # Regenerate the fictional demonstration fixtures
npm audit         # Check dependencies against current security advisories
```

## Demonstration data and privacy

Student names and email addresses use `Student 001` and `student001@example.com`-style values. Student identifiers, grade levels, and course/group relationships are generated. External student, course, and group profile links are disabled. Course catalog metadata is separate from student enrollment data and does not establish real-world school use of this project.

The files in `public/data/normalized/` are downloaded by the browser and are publicly readable when the site is deployed. The site has no backend authentication or access control and must only serve demonstration data.

Do not commit private student exports, real educational records, personal contact information, credentials, or repository backups. Store private inputs outside the repository or under the ignored `private-data/` directory. Ignoring a file does not remove previously committed copies.

## Before publishing

- Review the branch and its reachable history, plus any remote tags, pull requests, workflow logs, and release files that will become public. Student fixtures in the current `main` history use demonstration values; local editor snapshots and backups are outside that claim.
- Rewriting branch history does not prove that old remote Git objects or cached views have been removed. If private records were previously pushed, keep the original repository private until remote removal is confirmed, or publish the reviewed source files in a new repository with fresh history. See [GitHub's sensitive-data removal guidance](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).
- Local Codex snapshot refs may retain earlier private data. Do not publish `.git`, repository bundles, or mirror backups. Push only the intended branch; do not use `git push --mirror`, which also publishes other refs.
- Keep screenshots free of real student names, email addresses, and school account links. Review attribution and permission for any third-party images, course descriptions, and documents you add.
- Re-run the build and dependency audit after making changes. Add a license if you want to grant others permission to reuse your code.

## Hosting

Deploy the `dist/` output to a static host. The app uses browser-history routing, so the host must serve `index.html` for application routes such as `/students` and `/courses`. Assets and data currently use paths from the domain root; hosting under a subdirectory requires corresponding Vite, router, and data-path changes.
