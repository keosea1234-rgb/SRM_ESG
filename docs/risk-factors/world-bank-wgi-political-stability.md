# Supplier Risk Factor Example: World Bank WGI Political Stability

This is the first real-data supplier risk factor we can use for manual upload.

## Risk factor

- Factor name: Country political stability
- Risk category: Geopolitical Risk
- Source: World Bank Worldwide Governance Indicators (WGI)
- Indicator: Political Stability and Absence of Violence/Terrorism: Percentile Rank
- Indicator code: `PV.PER.RNK`
- Download URL: https://api.worldbank.org/v2/country/all/indicator/PV.PER.RNK?downloadformat=csv

## Why this factor

The supplier already has a `country` field. WGI is country-level, downloadable, and updated annually. That makes it a good first risk factor because the matching key is simple: supplier country or ISO3 country code.

## Upload criteria

Use the latest non-empty year in the CSV for the supplier country.

| WGI percentile rank | SRM geopolitical_risk |
| --- | --- |
| 80-100 | 1 |
| 60-79.999 | 2 |
| 40-59.999 | 3 |
| 20-39.999 | 4 |
| 0-19.999 | 5 |

Higher WGI percentile means more political stability, so supplier risk is lower.

## Manual workflow

1. Open Risk Management.
2. Click New Assessment.
3. Select a supplier with a populated `country`.
4. Download the WGI CSV zip from the link above.
5. Extract the data CSV from the zip.
6. Upload the extracted CSV in the "Real data factor: country stability" panel.
7. The app fills `geopolitical_risk` and appends source details to notes.
8. Complete the other risk scores and save the assessment.

## Data quality notes

- If matching fails, align supplier country values with World Bank country names or ISO3 codes.
- The first production version should store the source metadata in a dedicated table, not only in notes.
- This factor is country-level, so it should be treated as one element of risk scoring, not the full supplier risk score.
