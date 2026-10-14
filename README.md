# FlatStamp

FlatStamp is a **React + Vite Progressive Web App** for documenting rental move-in and move-out condition evidence.

## Product principles

- Local-first: property records and photos stay in browser IndexedDB.
- No account, backend database, analytics SDK, ads, or external AI API.
- Installable and offline-capable as a PWA.
- Existing FlatStamp / earlier RentProof local records remain compatible because the historical `rentproof-db` IndexedDB name is intentionally retained.
- PDFs are generated on-device with jsPDF.

## MVP features

- Guided room-by-room inspection checklists
- Move-in and move-out records
- Photo capture and on-device compression
- Conditions and factual notes
- Meter readings, inventory, keys/access records
- Move-in vs move-out comparison
- On-device PDF generation and share/save flow
- Native share summary
- JSON backup and restore
- Optional fictional demo property
- PWA installation and offline caching
- Responsive React UI with motion and touch-friendly controls

## Stack

- React 18
- Vite
- Framer Motion
- Lucide React
- jsPDF
- IndexedDB
- vite-plugin-pwa / Workbox
- GitHub Pages

## Development

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

The GitHub Actions workflow builds `dist/` and deploys that artifact to GitHub Pages.

## Privacy and limitations

FlatStamp creates structured condition records, not legal determinations. It does not independently prove authenticity, assign responsibility for damage, provide legal advice, or guarantee a deposit-dispute outcome.

Because records are stored locally, clearing browser/site data can remove them. Users should export backups after important inspections.
