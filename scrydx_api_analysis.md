# ScryDex API Analysis for Price History Implementation

## Key Findings from Documentation

### Current ScryDex API Structure
- Base URL: `https://api.scrydex.com/{game}/v1/`
- Supported games: pokemon, magicthegathering, lorcana, gundam
- Authentication: X-Api-Key and X-Team-ID headers
- Cards endpoint: `/cards` for search, `/cards/{id}` for specific card

### Pricing Data Structure
ScryDex provides comprehensive pricing data with the following structure:

#### Raw Prices
```json
{
  "condition": "NM",
  "is_perfect": false,
  "is_signed": false,
  "is_error": false,
  "type": "raw",
  "low": 868.0,
  "market": 915.43,
  "currency": "USD",
  "trends": {
    "days_1": { "price_change": 0.0, "percent_change": 0.0 },
    "days_7": { "price_change": -16.59, "percent_change": -1.78 },
    "days_14": { "price_change": -44.32, "percent_change": -4.62 },
    "days_30": { "price_change": -95.64, "percent_change": -9.46 },
    "days_90": { "price_change": -365.6, "percent_change": -28.54 },
    "days_180": { "price_change": -646.65, "percent_change": -41.4 }
  }
}
```

#### Available Trend Periods
- 1 day, 7 days, 14 days, 30 days, 90 days, 180 days
- Each trend includes: price_change and percent_change

### Current HatakeSocial Implementation
- Already has `searchScryDex` function working
- Already has `getScryDexCard` function working  
- Has incomplete `getScryDexHistory` function (may not work with current API)

### Price History Implementation Strategy

Based on the documentation, ScryDex doesn't appear to have a dedicated `/history` endpoint. Instead, price history is embedded in the card data via the `trends` object. This means:

1. **No separate history endpoint needed** - price trends are included with card data
2. **Current trends provide sufficient data** for 30-day, 90-day, 1-year charts
3. **Need to store daily snapshots** to build comprehensive historical data
4. **Use existing card endpoints** with `include=prices` parameter

### Implementation Plan
1. Remove/fix the non-working `getScryDexHistory` function
2. Create daily price collection function that fetches card data with prices
3. Store daily snapshots in Firestore: `priceHistory/{cardId}/daily/{date}`
4. Use trends data for immediate price change calculations
5. Build historical charts from stored daily snapshots
