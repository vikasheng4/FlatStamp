# RentProof

RentProof is a zero-backend, mobile-first Progressive Web App for documenting rental move-in and move-out condition evidence.

## Features

- Guided room-by-room inspection checklists
- Move-in and move-out records
- Camera/photo capture with on-device compression
- Condition notes and damage descriptions
- Electricity, water and gas meter readings
- Keys/access-card inventory
- Printable evidence report for Save as PDF
- Local IndexedDB storage
- JSON backup/export and restore
- Offline PWA support
- No account, analytics, ads, backend, or external API

## Local testing

Serve the directory over HTTP (service workers do not run from `file://`):

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## GitHub Pages

A Pages workflow is included at `.github/workflows/pages.yml`.

For a new public repository, go to **Settings → Pages → Build and deployment → Source → GitHub Actions** once. After that, every push to `main` deploys automatically.

## Data model and privacy

Inspection data and photos are stored in browser IndexedDB. Users should export backups because clearing browser/site data can delete local records.

## Limitations

This app creates structured evidence; it does not provide legal advice, prove authenticity by itself, or guarantee a deposit dispute outcome. For stronger evidence, users should promptly share the generated report with the landlord/tenant through an independent channel.
