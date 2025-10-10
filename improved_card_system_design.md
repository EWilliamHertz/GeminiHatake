# Improved Card Tagging System Design

## Overview

This document outlines the design for a rebuilt card tagging system that addresses the critical issues identified in the current implementation. The new system will provide accurate card matching, complete metadata storage, and consistent behavior across all 4 supported games.

## Core Design Principles

### 1. **Standardized Card Data Structure**
All cards will be normalized to a consistent internal format regardless of source API:

```javascript
interface StandardizedCard {
  // Core identification
  id: string;                    // Unique identifier from source API
  name: string;                  // Exact card name
  game: 'lorcana' | 'pokemon' | 'gundam' | 'mtg';
  
  // Set information
  setName: string;               // Full set name
  setCode?: string;              // Set abbreviation/code
  setId?: string;                // Set identifier
  
  // Visual assets
  imageUrl: string;              // Primary card image
  imageUrls?: {                  // Alternative image sizes
    small?: string;
    normal?: string;
    large?: string;
  };
  
  // Metadata
  type?: string;                 // Card type (creature, spell, etc.)
  rarity?: string;               // Card rarity
  collectorNumber?: string;      // Collector number within set
  
  // Search optimization
  searchTerms: string[];         // Normalized search terms
  exactMatch: boolean;           // Whether this was an exact name match
  
  // Source tracking
  sourceApi: 'scrydx';           // Source API used
  lastUpdated: Date;             // When data was fetched
}
```

### 2. **Enhanced Matching Algorithm**

The new matching system will use a multi-tier approach:

#### Tier 1: Exact Match
- Direct string comparison (case-insensitive)
- Highest priority in results

#### Tier 2: Fuzzy Match with High Confidence
- Levenshtein distance ≤ 2 characters
- Handles minor typos and variations

#### Tier 3: Partial Match with Validation
- Contains search term but requires minimum 70% similarity
- Prevents "Sol Ring" → "Ring the Bell" issues

#### Tier 4: Filtered Out
- Low similarity matches are excluded entirely

```javascript
interface MatchResult {
  card: StandardizedCard;
  matchType: 'exact' | 'fuzzy' | 'partial';
  confidence: number;           // 0-100 confidence score
  matchedTerms: string[];       // Which search terms matched
}
```

### 3. **Game-Specific Data Mappers**

Each game will have a dedicated mapper to convert API responses to the standardized format:

```javascript
interface GameDataMapper {
  mapCard(apiResponse: any): StandardizedCard;
  extractSetName(apiResponse: any): string;
  extractImageUrl(apiResponse: any): string;
  extractImageUrls(apiResponse: any): object;
  validateCard(card: StandardizedCard): boolean;
}
```

#### MTG Mapper
- Handles `image_uris` object structure
- Maps set names from `set_name` field
- Extracts collector numbers and rarities

#### Pokemon Mapper  
- Processes `images` array structure
- Maps set information from nested objects
- Handles Pokemon-specific card types

#### Lorcana Mapper
- Uses direct `image_url` field
- Maps Disney-specific set naming conventions
- Handles character and song card types

#### Gundam Mapper
- Processes Gundam-specific data structures
- Maps pilot/mobile suit information
- Handles series-based set organization

### 4. **Enhanced Post Data Structure**

Posts will store complete card metadata for reliable tooltips and links:

```javascript
interface PostCardData {
  // Required fields
  cardName: string;
  cardSet: string;
  cardGame: string;
  cardImageUrl: string;
  
  // Optional enrichment
  cardId?: string;
  cardType?: string;
  cardRarity?: string;
  setCode?: string;
  
  // Validation
  dataComplete: boolean;        // All required fields present
  lastValidated: Date;          // When card data was last verified
}
```

### 5. **Improved Search and Autocomplete Flow**

#### Search Process
1. **Input Validation**: Minimum 2 characters, sanitize input
2. **Multi-Game Search**: Query all games in parallel for better performance
3. **Result Normalization**: Convert all responses to StandardizedCard format
4. **Intelligent Ranking**: Sort by match confidence and game priority
5. **Result Filtering**: Remove low-confidence matches

#### Autocomplete Process
1. **Real-time Search**: Trigger after 300ms delay to reduce API calls
2. **Rich Suggestions**: Display card name, set, game badge, and thumbnail
3. **Selection Validation**: Ensure complete metadata before allowing selection
4. **Data Persistence**: Store full card object for post creation

### 6. **Tooltip System Redesign**

#### Data Source Priority
1. **Stored Post Metadata**: Use card data from post if available
2. **Cache Lookup**: Check local cache for recently fetched cards
3. **API Fallback**: Search APIs only if no stored data exists

#### Tooltip Content
- Card image (if available)
- Card name and set information
- Game badge with consistent styling
- Card type and rarity (if available)
- "Click to view details" prompt

### 7. **Error Handling and Fallbacks**

#### Search Errors
- Individual game API failures don't block other games
- Graceful degradation with cached results
- User-friendly error messages

#### Data Validation
- Validate required fields before storing
- Provide feedback for incomplete selections
- Fallback to basic card name if metadata missing

#### Network Issues
- Implement retry logic with exponential backoff
- Cache successful results for offline access
- Show loading states during API calls

## Implementation Architecture

### Frontend Components

#### 1. CardSearchService
```javascript
class CardSearchService {
  async searchCards(query: string, options?: SearchOptions): Promise<MatchResult[]>
  async searchSpecificGame(query: string, game: string): Promise<MatchResult[]>
  normalizeCard(apiResponse: any, game: string): StandardizedCard
  calculateMatchConfidence(card: StandardizedCard, query: string): number
}
```

#### 2. CardAutocompleteComponent
```javascript
class CardAutocompleteComponent {
  async showSuggestions(query: string): Promise<void>
  handleCardSelection(card: StandardizedCard): void
  validateSelection(card: StandardizedCard): boolean
  clearSuggestions(): void
}
```

#### 3. CardTooltipService
```javascript
class CardTooltipService {
  async showTooltip(element: HTMLElement, cardData: PostCardData): Promise<void>
  hideTooltip(): void
  fetchCardData(cardName: string, preferredGame?: string): Promise<StandardizedCard>
}
```

### Backend Enhancements

#### 1. Enhanced ScryDx Function
- Add response validation and error handling
- Implement result caching with TTL
- Add request rate limiting and retry logic

#### 2. Card Data Validation
- Validate API responses before returning
- Ensure required fields are present
- Log data quality metrics

### Data Flow Diagram

```
User Input → CardSearchService → Multi-Game APIs → Data Mappers → StandardizedCard[]
     ↓
Confidence Scoring → Result Ranking → Autocomplete Display
     ↓
User Selection → Validation → Post Creation → Firestore Storage
     ↓
Post Display → Tooltip Service → Cached/Stored Data → Rich Tooltip
```

## Performance Optimizations

### 1. **Caching Strategy**
- **Search Results**: Cache for 1 hour per query/game combination
- **Card Details**: Cache for 24 hours per card ID
- **Image URLs**: Cache indefinitely with validation

### 2. **API Efficiency**
- **Parallel Requests**: Query all games simultaneously
- **Request Deduplication**: Avoid duplicate API calls
- **Batch Processing**: Group similar requests when possible

### 3. **Frontend Optimization**
- **Debounced Search**: 300ms delay for autocomplete
- **Virtual Scrolling**: For large result sets
- **Lazy Loading**: Load images on demand

## Testing Strategy

### 1. **Unit Tests**
- Data mapper functions for each game
- Match confidence calculations
- Card validation logic

### 2. **Integration Tests**
- End-to-end autocomplete flow
- Post creation with card data
- Tooltip display accuracy

### 3. **Game-Specific Tests**
- Test representative cards from each game
- Verify set name extraction accuracy
- Validate image URL handling

### 4. **Edge Case Testing**
- Cards with special characters
- Very long card names
- Cards with missing metadata
- API timeout scenarios

## Migration Plan

### Phase 1: Backend Improvements
1. Update Firebase functions with enhanced validation
2. Implement new data mappers
3. Add comprehensive error handling

### Phase 2: Frontend Rebuild
1. Replace card-search.js with new CardSearchService
2. Update autocomplete component
3. Implement new tooltip system

### Phase 3: Data Migration
1. Update existing posts with missing card metadata
2. Validate and clean existing card data
3. Implement data quality monitoring

### Phase 4: Testing and Deployment
1. Comprehensive testing across all games
2. Performance monitoring and optimization
3. Gradual rollout with feature flags

## Success Metrics

### 1. **Accuracy Improvements**
- Reduce incorrect card matches by 95%
- Achieve 90%+ exact match rate for common cards
- Eliminate "Unknown Set" displays

### 2. **User Experience**
- Reduce autocomplete response time to <500ms
- Achieve 95%+ tooltip accuracy
- Improve card selection completion rate

### 3. **System Reliability**
- 99.9% uptime for card search functionality
- <1% API error rate
- Graceful handling of all edge cases

This design provides a robust foundation for accurate card tagging while maintaining excellent performance and user experience across all supported games.
