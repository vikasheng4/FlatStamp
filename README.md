# FlatStamp

FlatStamp is a zero-backend, mobile-first Progressive Web App for documenting rental move-in and move-out condition evidence.

## MVP features

- Guided room-by-room inspection checklists
- Separate move-in and move-out records
- Move-in vs move-out comparison report
- Camera/photo capture with on-device compression
- Condition notes and damage descriptions
- Separate meter readings, inventory, and keys/access notes for each inspection
- Printable reports for Save as PDF
- Native share-sheet summary with clipboard fallback
- Local IndexedDB storage and JSON backup/restore
- Optional realistic demo property
- Offline PWA support and install guidance
- No account, analytics, ads, backend, or external API

## Data compatibility

The IndexedDB database intentionally retains the historical `rentproof-db` key so existing users keep their locally stored records after the FlatStamp rename. Records are normalized in-app to the current schema.

## Local testing

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## GitHub Pages

The included Pages workflow deploys every push to `main`. Repository Pages should use **GitHub Actions** as the source.

## Privacy and limitations

Inspection data and photos are stored locally in the browser. Users should export backups because clearing browser/site data can delete local records.

FlatStamp creates structured condition records; it does not provide legal advice, independently prove authenticity, or guarantee a deposit-dispute outcome. For stronger practical documentation, share the report with the other party promptly through an independent channel.
