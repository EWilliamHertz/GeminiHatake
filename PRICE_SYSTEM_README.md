# HatakeSocial Real-Time Price History Analytics System

## Overview

This document describes the comprehensive real-time price history analytics system implemented for the HatakeSocial platform. The system provides accurate, real-time market data for both individual cards and collection analytics using ScryDx data.

## System Architecture

### Core Components

1. **Firebase Functions** (`functions/index.js`)
   - `collectCardPriceSnapshot`: Fetches and stores daily price data
   - `getCardPriceHistory`: Retrieves historical price data with fallback
   - `dailyPriceCollection`: Automated daily price collection (scheduled)
   - `getCollectionPriceAnalytics`: Portfolio analytics for users
   - `addCardToTracking`/`removeCardToTracking`: Manage tracked cards

2. **Frontend Components**
   - `card-view.js`: Enhanced price charts with real data
   - `collection-analytics.js`: Portfolio dashboard and analytics
   - `price-alerts.js`: Price change notifications and alerts
   - `price-cache.js`: Performance optimization and caching

3. **Data Storage**
   - `priceHistory/{cardId}/daily/{date}_{variant}_{condition}`: Daily snapshots
   - `trackedCards/{cardId}`: Cards monitored for daily collection
   - `priceCollectionLogs/{date}`: Collection run summaries

## Features Implemented

### 1. Real-Time Price Charts (card-view.html)

**Enhanced Features:**
- Real ScryDx price data integration
- Interactive period selection (30D, 90D, 1Y)
- Price change indicators with percentages
- Smart fallback system: Historical data → ScryDx trends → Minimal fallback
- Automatic card tracking for daily collection
- Loading states and error handling
- Currency symbol support (USD, EUR, JPY, etc.)

**Technical Implementation:**
```javascript
// Example usage
await displayPriceChart(card);
// Automatically uses real price data with fallbacks
```

### 2. Collection Analytics Dashboard (my_collection.html)

**Portfolio Metrics:**
- Current portfolio value with currency formatting
- 30-day value change with percentage indicators
- All-time high calculations
- Top gainers/losers identification

**Interactive Charts:**
- 30-day portfolio value history
- Responsive design for different screen sizes
- Real-time data updates every 5 minutes

**Technical Implementation:**
```javascript
// Analytics dashboard updates
const analytics = await getCollectionPriceAnalytics({ days: 30 });
// Returns comprehensive portfolio analysis
```

### 3. Price Alerts System

**Alert Types:**
- Price goes above target
- Price goes below target
- Price changes by percentage threshold

**Features:**
- Browser notifications with permission handling
- Persistent alert storage (localStorage)
- 5-minute monitoring intervals
- Smart alert management with UI integration
- Toast notifications for immediate feedback

**Usage:**
```javascript
// Set a price alert
priceAlerts.addAlert(cardId, cardName, targetPrice, 'above', currentPrice);

// Alerts automatically trigger when conditions are met
```

### 4. Performance Optimization

**Caching System:**
- Intelligent price data caching (5-minute expiry)
- Request queue with rate limiting (1 second between API calls)
- LRU cache implementation (1000-entry limit)
- localStorage persistence for offline capability

**Background Processing:**
- Background sync for stale data updates
- Batch processing for multiple card updates
- Automatic cleanup of expired cache entries
- Page visibility API integration for resource management

**Usage:**
```javascript
// Cached price data retrieval
const priceData = await priceCache.getPriceData(cardId, days, game);
// Automatically handles caching, rate limiting, and background updates
```

## Data Flow

### 1. Daily Price Collection
```
Cloud Scheduler (6 AM UTC) → dailyPriceCollection → 
ScryDx API → Firestore (priceHistory) → Collection Logs
```

### 2. Real-Time Price Display
```
User Request → priceCache.getPriceData → 
Cache Check → Firebase Function → ScryDx API → 
Cache Storage → UI Update
```

### 3. Collection Analytics
```
User Collection → getCollectionPriceAnalytics → 
Price History Lookup → Portfolio Calculations → 
Dashboard Update
```

## Configuration

### Firebase Functions Environment
- Deployed to Firebase Functions
- Scheduled execution via Cloud Scheduler
- Rate limiting: 10 requests per batch with 2-second delays
- Error handling with retry logic

### Frontend Configuration
- Chart.js for data visualization
- Firebase SDK for function calls
- localStorage for client-side caching
- Notification API for price alerts

## API Integration

### ScryDx Integration
- Uses existing `searchScryDx` and `getScryDexCard` functions
- Leverages ScryDx trends data for historical reconstruction
- Handles rate limiting and error responses
- Supports multiple TCG games (Pokemon, MTG, etc.)

### Fallback Strategy
1. **Primary**: Historical data from Firestore
2. **Secondary**: ScryDx trends data conversion
3. **Tertiary**: Minimal realistic price simulation

## Performance Considerations

### Optimization Features
- **Caching**: 5-minute cache expiry with LRU eviction
- **Rate Limiting**: 1-second delays between API requests
- **Batch Processing**: Groups requests to minimize API calls
- **Background Sync**: Updates stale data without user interaction
- **Resource Management**: Pauses processing when page is hidden

### Scalability
- Supports up to 1000 cached entries per user
- Handles large collections with batch processing
- Automatic cleanup prevents memory bloat
- Configurable cache sizes and expiry times

## Error Handling

### Robust Error Management
- **API Failures**: Graceful fallback to cached or simulated data
- **Network Issues**: Retry logic with exponential backoff
- **Data Corruption**: Validation and sanitization
- **User Feedback**: Toast notifications and loading states

### Monitoring
- Console logging for debugging
- Error tracking in collection logs
- Performance metrics in cache statistics
- User-friendly error messages

## Deployment Instructions

### 1. Firebase Functions Deployment
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Deploy functions
firebase deploy --only functions
```

### 2. Frontend Files
All frontend files are already integrated into the existing HTML structure:
- `card-view.html` - Enhanced with real price charts
- `my_collection.html` - Enhanced with analytics dashboard
- JavaScript files added to appropriate pages

### 3. Cloud Scheduler Setup
```bash
# Create daily price collection job
gcloud scheduler jobs create pubsub daily-price-collection \
  --schedule="0 6 * * *" \
  --topic=daily-price-collection \
  --message-body="{}" \
  --time-zone="UTC"
```

## Testing

### Manual Testing Checklist
- [ ] Card price charts display real data
- [ ] Period selection (30D, 90D, 1Y) works correctly
- [ ] Price change indicators show accurate percentages
- [ ] Collection analytics dashboard loads portfolio data
- [ ] Top movers section displays gainers/losers
- [ ] Price alerts can be set and trigger correctly
- [ ] Caching system improves performance
- [ ] Error states display appropriately

### Automated Testing
- Firebase Functions can be tested locally with Firebase emulator
- Frontend components can be tested with browser developer tools
- Cache performance can be monitored via console logs

## Maintenance

### Regular Tasks
- Monitor Firebase Functions logs for errors
- Review price collection success rates
- Clean up old price history data (optional)
- Update ScryDx API integration as needed

### Performance Monitoring
- Track cache hit rates
- Monitor API request volumes
- Review user feedback on price accuracy
- Optimize cache sizes based on usage patterns

## Future Enhancements

### Potential Improvements
1. **Machine Learning**: Price prediction algorithms
2. **Advanced Analytics**: Trend analysis and market insights
3. **Social Features**: Price discussions and community insights
4. **Mobile App**: Native mobile price tracking
5. **API Expansion**: Support for additional TCG price sources

### Scalability Considerations
- Database sharding for large price history datasets
- CDN integration for faster chart loading
- WebSocket connections for real-time updates
- Microservices architecture for component separation

## Support and Troubleshooting

### Common Issues
1. **Price data not loading**: Check Firebase Functions logs
2. **Charts not displaying**: Verify Chart.js integration
3. **Alerts not triggering**: Check notification permissions
4. **Cache not working**: Clear localStorage and restart

### Debug Information
- Browser console logs provide detailed debugging info
- Firebase Functions logs show backend processing details
- Cache statistics available via `priceCache.getCacheStats()`
- Alert status available via `priceAlerts.getActiveAlerts()`

## Conclusion

This comprehensive price history system provides HatakeSocial users with accurate, real-time market data while maintaining excellent performance through intelligent caching and optimization. The system is designed to be scalable, maintainable, and user-friendly, with robust error handling and fallback mechanisms to ensure reliability.

The implementation successfully replaces mock data with real ScryDx price information, providing users with valuable insights into their card collections and market trends.
