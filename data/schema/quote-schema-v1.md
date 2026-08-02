# Mike Quote Knowledge Base — Canonical Schema v1

Every quote, regardless of source (live chat upload, Reddit, Facebook, homeowner
submission, or Mike's own house), gets stored as ONE record with two parts:

1. **`raw`** — the original document, untouched. (PDF/image blob reference, or
   pasted text if no file exists.)
2. **`structured`** — extracted fields, below. This is what Mike actually
   reasons over; the raw doc is provenance/audit trail, not something Mike
   re-reads every time.

## Record shape

```json
{
  "id": "string, e.g. metro-YYYY-MM-##",
  "raw_document": {
    "blob_url": "string | null",
    "source_type": "pdf | image | pasted_text",
    "collected_from": "live_chat_upload | reddit | facebook | homeowner_submission | own_house | other",
    "collected_by": "string | null (e.g. reddit username, or 'self')",
    "date_collected": "YYYY-MM-DD"
  },
  "structured": {
    "location": {
      "metro": "string | null",
      "zip": "string | null",
      "state": "string | null",
      "location_confidence": "confirmed | inferred | unknown"
    },
    "quote_date": "YYYY-MM-DD | null",
    "quote_expiration_date": "YYYY-MM-DD | null",
    "contractor": {
      "name": "string | null",
      "sales_rep": "string | null"
    },
    "job_type": "replacement | repair | maintenance | inspection_only",
    "equipment": {
      "system_type": "central_split | heat_pump | mini_split | packaged | furnace_only | ac_only | other",
      "fuel_type": "natural_gas | lp_propane | electric | dual_fuel | null",
      "manufacturer": "string | null",
      "outdoor_model": "string | null",
      "indoor_model": "string | null",
      "coil_model": "string | null",
      "thermostat_model": "string | null",
      "tonnage": "number | null",
      "seer2": "number | null",
      "eer2": "number | null",
      "hspf2": "number | null",
      "afue": "number | null",
      "staging": "single_stage | two_stage | variable_speed | modulating | null"
    },
    "pricing": {
      "gross_price": "number | null",
      "cash_price": "number | null",
      "financed_price": "number | null",
      "incentives": [
        {"source": "string (utility/manufacturer/promo name)", "amount": "number"}
      ],
      "net_effective_price": "number | null",
      "tax": "number | null",
      "financing": {
        "apr": "number | null",
        "term_months": "number | null",
        "monthly_payment": "number | null"
      }
    },
    "warranty": {
      "parts_years": "number | null",
      "labor_years": "number | null",
      "workmanship_years": "number | null",
      "compressor_years": "number | null",
      "heat_exchanger": "string | null",
      "registration_required": "boolean | null",
      "registration_window_days": "number | null"
    },
    "scope": {
      "included": ["string, itemized"],
      "excluded": ["string, itemized — things explicitly NOT covered or offered as paid add-ons"]
    },
    "tier_info": {
      "tier_label": "string | null (e.g. Good/Better/Best, Bronze/Gold)",
      "tier_group_id": "string | null (links sibling tiers from the same quote)"
    },
    "confidence": "high | medium | low — traceability of location/date/contractor",
    "notes": "string — anything unusual, contractor behavior patterns, red flags, good practices worth flagging"
  }
}
```

## What Mike eventually pattern-matches across these records (not per-quote, but
## aggregated once volume exists):

- Contractors who consistently include more scope items at similar price points
- Manufacturers/models that appear most often by metro
- Typical warranty structures by manufacturer and by contractor tier
- Common financing APR/term combinations, flagged if a quote is an outlier
- Common upsell patterns (what's pitched as "optional" vs bundled)
- What's usually included vs usually excluded, by job type
- Price ranges by metro + equipment tier + scope, WITH the location_confidence
  field respected — low-confidence records should never be cited as regional
  pricing evidence, only as structural/pattern evidence
