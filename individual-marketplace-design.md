# Individual Card Marketplace UI Design

## Overview
This document outlines the design for individual card marketplace actions that will be integrated into the existing HatakeSocial collection system.

## Current System Analysis
- **Bulk Edit Mode**: Currently users must enter bulk edit mode to list/remove cards
- **Existing Components**: Bulk review modal with pricing options (percentage/fixed price)
- **Data Structure**: Cards have `for_sale`, `sale_price`, and `sale_currency` properties
- **Visual Indicators**: Green sale price badges shown on cards that are for sale
- **Currency Support**: Multi-currency system with conversion capabilities

## New Individual Card Components

### 1. Individual Sale Modal (`individual-sale-modal`)
**Purpose**: Allow users to list a single card for sale with pricing options

**Location**: New modal component, similar to existing `bulk-review-modal`

**Features**:
- Card preview with image and details
- Pricing options:
  - Percentage of market value (90%, 100%, 110%, custom)
  - Fixed price input in user's currency
- Condition selector (if different from current)
- Quantity selector (for cards with multiple copies)
- Currency display and conversion
- Real-time price calculation

**HTML Structure**:
```html
<div id="individual-sale-modal" class="fixed inset-0 bg-black bg-opacity-75 hidden items-center justify-center z-[1003]">
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl">
    <!-- Modal header -->
    <!-- Card preview section -->
    <!-- Pricing options section -->
    <!-- Action buttons -->
  </div>
</div>
```

### 2. Enhanced Card Actions
**Purpose**: Add marketplace actions to individual cards

**Integration Points**:
- Card hover actions (grid view)
- Card action buttons (list view)
- Edit card modal

**New Actions**:
- "List for Sale" button/icon
- "Remove from Sale" button/icon (for cards already listed)
- "Update Price" button/icon (for cards already listed)

### 3. Enhanced Card Indicators
**Purpose**: Better visual feedback for marketplace status

**Enhancements**:
- Sale status badges with better positioning
- Price comparison indicators (above/below market)
- Quick action tooltips
- Status icons in list view

## Integration Strategy

### 1. Card Rendering Updates
- Modify `renderGridView()` and `renderListView()` in UI module
- Add individual marketplace action buttons
- Enhance sale price indicators
- Add conditional rendering based on card sale status

### 2. Event Handling
- Add click handlers for individual marketplace actions
- Integrate with existing modal system
- Maintain consistency with bulk edit patterns

### 3. Data Flow
- Reuse existing API functions (`batchUpdateSaleStatus`, `batchCreateMarketplaceListings`)
- Adapt for single card operations
- Maintain currency handling consistency

## User Experience Flow

### Listing a Card for Sale
1. User hovers over card → sees "List for Sale" action
2. Clicks action → opens individual sale modal
3. Sets price (percentage or fixed) → sees real-time calculation
4. Confirms → card is listed, UI updates immediately

### Removing from Sale
1. User sees "Remove from Sale" action on listed card
2. Clicks action → confirmation dialog
3. Confirms → card removed from marketplace, UI updates

### Updating Price
1. User sees "Update Price" action on listed card
2. Clicks action → opens sale modal with current price
3. Updates price → confirms → marketplace listing updated

## Technical Implementation Plan

### Phase 1: Modal Component
- Create individual sale modal HTML
- Add modal open/close functionality
- Implement pricing calculation logic

### Phase 2: Card Action Integration
- Add action buttons to card rendering
- Implement click handlers
- Add conditional rendering for sale status

### Phase 3: API Integration
- Create single-card marketplace functions
- Integrate with existing batch operations
- Add error handling and user feedback

### Phase 4: UI Polish
- Enhance visual indicators
- Add animations and transitions
- Improve accessibility

## Code Structure

### New Files
- No new files needed - integrate into existing modules

### Modified Files
- `collection-app.js`: Add individual marketplace functions
- `ui.js`: Update card rendering with new actions
- `collection.js`: Add single-card marketplace operations
- `my_collection.html`: Add individual sale modal HTML

### New Functions
- `openIndividualSaleModal(cardId)`
- `handleIndividualSale(cardId, priceData)`
- `removeCardFromSale(cardId)`
- `updateCardSalePrice(cardId, newPrice)`

## Consistency with Existing System
- Use same pricing logic as bulk operations
- Maintain currency handling patterns
- Follow existing modal design patterns
- Reuse existing API endpoints where possible
- Keep same visual design language

## Accessibility Considerations
- Keyboard navigation support
- Screen reader compatibility
- Clear action labels and tooltips
- Proper focus management in modals

## Performance Considerations
- Lazy load modal content
- Debounce price calculations
- Minimize DOM updates
- Cache market price data

This design ensures seamless integration with the existing system while providing the requested individual card marketplace functionality.
