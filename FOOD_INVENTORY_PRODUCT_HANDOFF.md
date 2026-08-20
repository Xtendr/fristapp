# Food Inventory & Expiry Tracker — Product Handoff

**Status:** Product direction aligned; ready for technical planning  
**Primary market for V0.1:** Denmark  
**Primary platform:** Mobile-first web application / installable PWA  
**Primary users:** Small households  
**Initial test group:** 2–3 users across iPhone and Android  
**Operating-cost constraint for prototype:** Target €0 ongoing cost  
**Document role:** Source of truth for product intent, architecture, scope, UX principles, and implementation decisions

---

## 1. Product Summary

This product is a mobile-first household food inventory and expiry tracking application.

Its purpose is simple:

> Help people know what food they have at home, when it expires, and what they should use before it is wasted.

The product should make food inventory tracking as low-effort as possible. The central product challenge is not storing inventory data; it is making inventory entry and maintenance easy enough that normal people will actually keep using it.

The application therefore supports multiple ways of adding food:

1. Barcode scanning
2. AI-assisted batch capture
3. AI-assisted photo recognition
4. Manual entry

Once food is in the household inventory, the application prioritizes what needs attention, warns household members before products expire, and allows multiple people to maintain the same shared inventory.

AI is an underlying utility layer. It is not the identity of the product and should not be marketed or designed as an "AI app."

---

## 2. Problem

People regularly buy food, forget what is already in the refrigerator, freezer, or pantry, and discover products after they have expired.

Existing manual inventory workflows often fail because they require too much effort:

- typing product names
- entering quantities
- entering expiry dates
- repeatedly maintaining the same information
- requiring one person in a household to manage everything

The product should reduce this friction substantially.

The desired behavior is:

> Add food quickly → forget about the administration → receive useful reminders when something needs attention.

---

## 3. Product Principles

### 3.1 Effort must remain lower than the perceived value

If adding groceries feels like administrative work, users will stop doing it.

Every addition flow should therefore minimize:
- typing
- repeated navigation
- unnecessary confirmation steps
- waiting
- duplicate product lookup
- repetitive data entry

### 3.2 AI proposes; humans confirm

AI may extract or infer:
- product identity
- brand
- package size
- expiry date
- expiry type

AI must not silently create or alter household inventory without a review/confirmation step when the result is uncertain.

### 3.3 Deterministic systems before AI

Use deterministic systems where they are stronger:

- barcode scanner for GTIN/EAN recognition
- product databases for known products
- database records for previously confirmed products
- date logic for expiry calculations
- server-side scheduling for notifications

AI should only handle tasks where visual interpretation or fuzzy recognition provides clear value.

### 3.4 Learn once, reuse later

If a previously unknown product is identified and confirmed, store the useful mapping.

Future scans should prefer:
1. internal product database/cache
2. public product database
3. AI fallback
4. manual correction

The application should become faster, cheaper, and more reliable over time.

### 3.5 Household-first data model

Inventory belongs to a household, not to an individual user.

Users join households and operate on shared household inventory.

This must be reflected in the database and authorization model from the beginning.

### 3.6 Mobile-first, not desktop-first

The primary context is standing in a kitchen, unpacking groceries, checking the refrigerator, or scanning packaging with a phone.

Desktop/browser compatibility is useful but secondary.

---

## 4. Target Users

### Primary

Small households:
- individuals
- couples
- roommates
- small families

### Initial testing

The first version will be tested privately by a very small group using:
- iPhone
- Android

The product must therefore work without App Store or Google Play distribution.

---

## 5. Platform Strategy

### V0.1 platform

**Mobile-first Progressive Web App (PWA).**

The application should:
- work in modern mobile browsers
- support iPhone and Android
- be installable to the Home Screen
- access the camera
- capture/upload images
- scan supported retail barcodes
- support Web Push notifications
- remain accessible from desktop browsers where practical

### Why PWA first

The prototype must avoid:
- Apple App Store distribution
- Apple Developer Program fees
- Google Play distribution requirements
- maintaining separate native applications

If the product later proves valuable and PWA limitations become material, a native application can be considered separately.

---

## 6. Critical Product Requirement: Notifications

Expiry notifications are core functionality.

If reliable notification delivery cannot be achieved, the central product proposition is weakened significantly.

The PWA must support Web Push.

On supported iOS versions, users must install/add the PWA to the Home Screen and explicitly grant notification permission.

The product onboarding should make this requirement clear.

### Notification architecture

Notifications must be generated server-side.

Do not rely on:
- the browser remaining open
- a JavaScript timer running locally
- the PWA remaining active in the background

Conceptual flow:

```text
Inventory items
      ↓
Scheduled server job
      ↓
Find items approaching expiry
      ↓
Resolve household members
      ↓
Resolve notification preferences + push subscriptions
      ↓
Send Web Push
      ↓
User receives expiry notification
```

### Early acceptance gate

Before investing heavily in barcode/AI functionality, prove that:

1. A test household exists.
2. An inventory item can be created with a future expiry date.
3. An iPhone and an Android device can both install the PWA.
4. Both devices can register for notifications.
5. Both devices can receive a scheduled notification while the app is closed.

This should be treated as an early technical milestone.

---

## 7. Core Information Architecture

The application should initially remain small.

Proposed primary areas:

### Home
Answers:

> What needs my attention right now?

Content may include:
- products expiring today
- products expiring tomorrow
- products expiring soon
- household inventory summary
- fast Add entry point

### Inventory
View and manage all household food.

Potential filtering:
- refrigerator
- freezer
- pantry
- expiry status
- category
- search

### Add
Entry hub for:
- scan barcode
- batch capture
- photo recognition
- manual entry

### Household
Manage:
- household name
- members
- invites
- roles if needed
- notification preferences
- potentially devices

Navigation should remain deliberately compact.

---

## 8. Inventory Model

A household inventory item represents a specific physical food item or grouped quantity owned by the household.

Typical fields:

- household
- linked product
- display name
- brand
- quantity
- unit
- package size
- expiry date
- expiry type
- storage location
- added by
- added at
- source of entry
- optional notes
- optional opened state

### Storage locations

Initial:
- Fridge
- Freezer
- Pantry

Do not overcomplicate V0.1 with arbitrary custom storage hierarchies unless user testing proves it necessary.

### Expiry types

Useful distinction:
- Best before
- Use by / last use date
- Unknown

The product should avoid presenting legal/safety interpretations beyond the data supplied by the user/product packaging.

---

## 9. Product Identity and Barcode Scanning

### Denmark

The first target market is Denmark.

Typical grocery products use GS1 identifiers such as EAN-13 / GTIN.

The scanning architecture should not be Denmark-specific. It should support common retail barcode formats and use GTIN/EAN values for product lookup.

### Barcode flow

```text
Open scanner
   ↓
Barcode detected locally/in browser
   ↓
Extract GTIN/EAN
   ↓
Check internal product database
   ↓
If missing: query external product source
   ↓
If product found: prefill product
   ↓
Ask for expiry information
   ↓
Review
   ↓
Add to household inventory
```

### Product lookup hierarchy

Preferred lookup order:

1. Internal confirmed product cache/database
2. Open Food Facts or another approved public product source
3. AI-assisted recognition
4. Manual entry

### Important limitation

A normal retail barcode identifies the product/SKU.

It usually does **not** identify the expiry date of the individual physical package.

Expiry date capture is therefore a separate operation.

---

## 10. Manual Entry

Manual entry must always be available.

It is the ultimate fallback when:
- a barcode cannot be read
- a product is absent from external databases
- AI recognition fails
- the user does not want to use the camera

Minimum fields:
- product name
- expiry date
- storage location

Optional:
- brand
- quantity
- size
- category
- barcode

Manual entry should be fast rather than exhaustive.

---

## 11. Single Product Barcode Flow

Suggested flow:

```text
Scan product
   ↓
Product identified
   ↓
Product confirmation
   ↓
Capture expiry
   OR
Enter expiry manually
   ↓
Choose location
   ↓
Adjust quantity if needed
   ↓
Add
```

The UX should minimize intermediate screens.

---

## 12. AI-Assisted Batch Capture

Batch capture is a major V0.1 feature.

It should optimize the workflow of unpacking several groceries without forcing the user to complete a full save flow after every product.

### Preferred V0.1 batch approach

Do **not** make multi-product scene understanding the primary batch workflow.

Instead, create explicitly associated captures per item.

Example:

```text
Start Batch

Item 1
- product photo
- expiry photo

Next

Item 2
- product photo
- expiry photo

Next

Item 3
- product photo
- expiry photo

Review Batch
```

The application now has explicit pairs:

```text
item_001
- product_image
- expiry_image

item_002
- product_image
- expiry_image
```

This dramatically reduces ambiguity for the AI.

### Batch review

After processing, present proposed inventory items.

For each item show:
- proposed product name
- brand if found
- package/size if detected
- expiry date
- expiry type if detected
- confidence/uncertainty state where useful
- Edit action

The user then confirms the batch.

AI should never silently insert uncertain entries.

---

## 13. AI-Assisted Product Photo Recognition

Photo recognition should support cases where:
- barcode lookup fails
- barcode is inconvenient to expose
- product packaging is recognizable
- the user chooses photo entry

The model may use:
- visible brand
- product name
- package size
- packaging text
- date text
- visible barcode if present

Output must be structured, not free-form prose.

---

## 14. AI Provider

### Initial provider

**Mistral API**

The prototype will use a Mistral multimodal/vision-capable model suitable for image understanding.

Important implementation principle:

**Do not hard-code the entire product architecture around a specific model name.**

The model/provider should be configured so it can be changed later without rewriting the product.

### Why Mistral initially

- multimodal image analysis capability
- structured output support
- suitable for prototype-scale use
- available free/evaluation usage may support the initial private testing phase

The prototype must target zero ongoing cost and stay within whatever free quota is available at the time.

If free usage terms change, the AI provider may need to be replaced, disabled, or rate-limited.

### AI must be server-side

Never expose the Mistral API key in the client/PWA.

Correct architecture:

```text
PWA
  ↓
Server-side endpoint / Supabase Edge Function
  ↓
Mistral API
```

Secrets live server-side.

---

## 15. AI Output Contract

The AI should return schema-validated structured data.

Conceptual result:

```json
{
  "product": {
    "name": "Arla Letmælk",
    "brand": "Arla",
    "variant": null,
    "size": "1 L"
  },
  "expiry": {
    "date": "2026-08-24",
    "type": "best_before"
  },
  "confidence": {
    "product": 0.94,
    "expiry": 0.88
  },
  "needs_review": false
}
```

Important:
- dates should use a normalized machine-readable representation
- missing/uncertain fields should remain null rather than hallucinated
- the model should distinguish expiry dates from lot/batch/production codes where possible
- validation should reject malformed output
- user review remains authoritative

---

## 16. Household Model

Household support should exist from early development.

### Basic relationship

```text
User
  ↓
Household Membership
  ↓
Household
  ↓
Inventory
```

A user may eventually belong to more than one household, so avoid assumptions that permanently restrict users to one household unless deliberately chosen for V0.1 simplicity.

### Household capabilities

Initial:
- create household
- invite another user
- join household
- view shared inventory
- add/edit/remove shared inventory
- receive relevant notifications

Potential later roles:
- Owner
- Member

Avoid unnecessary permission complexity initially.

---

## 17. Authentication

Use Supabase Auth.

For a private prototype, choose the simplest reliable onboarding method.

Possible options:
- email + password
- email magic link
- one-time code

Do not overbuild social login unless needed.

---

## 18. Authorization and Security

Inventory data is household-scoped.

Authorization must be enforced in the database using Supabase Row Level Security (RLS), not merely through client-side filtering.

The database must prevent a signed-in user from accessing another household's inventory unless that user is an authorized household member.

RLS should cover at minimum:
- households
- household members
- household invites where relevant
- inventory items
- user-specific notification subscriptions
- any household-scoped scan batches

API keys and service-role credentials must never be exposed client-side.

---

## 19. Notifications

### Initial notification types

At minimum:
- expires today
- expires tomorrow
- expiring soon

Exact timing should be configurable later.

Possible initial default:
- 3 days before
- 1 day before
- day of expiry

Avoid excessive notifications.

### Household behavior

Each member should be able to register their own device/browser push subscription.

Notification preference should eventually be user-specific rather than household-global.

### Server scheduling

Use a server-side scheduled process.

With Supabase this may use:
- Supabase Cron / Postgres scheduling
- Edge Functions where appropriate

The implementation should remain observable and testable.

---

## 20. Proposed Technical Stack

### Frontend

- Next.js
- TypeScript
- React
- Tailwind CSS
- shadcn/ui
- Lucide icons
- Progressive Web App configuration

### Backend / Infrastructure

- Supabase
  - PostgreSQL
  - Auth
  - Row Level Security
  - Storage
  - Edge Functions
  - Realtime where useful
  - Cron/scheduled jobs

### AI

- Mistral multimodal API
- accessed server-side only
- schema-validated structured outputs
- provider/model configuration kept replaceable

### Product data

- Internal product database/cache
- Open Food Facts initially as an external lookup source
- future product data providers may be evaluated if Danish coverage proves insufficient

### Barcode

Use a browser-compatible barcode scanning solution.

The exact library should be selected during technical planning based on:
- iOS Safari/PWA compatibility
- Android compatibility
- EAN-13 support
- performance
- maintenance status
- bundle impact

Do not lock the project to a library before validating those requirements.

### Validation

- Zod where appropriate for client/server data contracts and AI output validation

### Hosting

Prefer a free-tier-friendly deployment model.

Potential frontend host:
- Vercel or an equivalent suitable free deployment platform

The final choice should be validated against current free-tier limitations before productionizing.

---

## 21. Data Model — Initial Direction

This is a conceptual starting model, not a mandate to create every field immediately.

### profiles
- id
- display_name
- created_at

### households
- id
- name
- created_by
- created_at

### household_members
- household_id
- user_id
- role
- joined_at

### household_invites
- id
- household_id
- invited_email or invite token
- created_by
- expires_at
- accepted_at

### products
- id
- gtin
- name
- brand
- category
- package_size
- image_url
- source
- created_at
- updated_at

### inventory_items
- id
- household_id
- product_id nullable
- display_name
- quantity
- unit
- expiry_date
- expiry_type
- storage_location
- source
- added_by
- created_at
- updated_at

### scan_batches
- id
- household_id
- created_by
- status
- created_at
- completed_at

### scan_batch_items
- id
- batch_id
- product_image reference
- expiry_image reference
- extracted result
- review status

### push_subscriptions
- id
- user_id
- endpoint / subscription data
- platform metadata if needed
- created_at
- last_used_at

The implementation plan should simplify this where beneficial but preserve the underlying product relationships.

---

## 22. Privacy

The application operates in Denmark/EU and should follow reasonable privacy-by-design principles.

### AI images

Images sent for AI interpretation may contain parts of a user's kitchen/environment.

The preferred default behavior is:
- upload/process only what is necessary
- avoid permanent retention unless required
- delete temporary captures after successful processing when practical
- disclose that images are processed by an external AI provider
- do not use images for unrelated purposes

### Data minimization

Store only the information needed for product functionality.

Do not collect demographic/profile data without a product reason.

---

## 23. Design Direction

The product must not use the stereotypical visual language of:
- recipe apps
- sustainability apps
- wellness products
- meal-planning lifestyle brands

Avoid:
- beige-heavy interfaces
- sage green branding
- pastel palettes
- decorative vegetable illustrations
- oversized bubbly cards
- excessive rounded containers
- generic "healthy lifestyle" visual language

### Desired aesthetic

Modern, high-craft utility software.

Reference qualities:
- Linear
- Raycast
- Vercel
- modern fintech products
- contemporary developer-tool interfaces

Adapt those principles to mobile rather than copying desktop SaaS layouts.

### Visual principles

- clean
- minimal
- restrained
- precise
- high information clarity
- strong typography
- compact where useful
- intentional whitespace
- subtle 1px borders
- controlled radius system
- mostly neutral palette
- limited chroma
- color used primarily for state and urgency
- crisp Lucide-style iconography
- subtle motion/micro-interactions
- avoid decoration without function

### Expiry color use

Color may communicate urgency:

- long-dated: neutral
- approaching expiry: restrained warning
- tomorrow/today: stronger warning
- expired: destructive

Do not turn the entire product green because it is about food.

---

## 24. UX Principles

### Home is not a SaaS dashboard

Do not create meaningless KPI cards.

The home screen should answer:

> What should I care about right now?

### Add flow must be extremely fast

Do not require users to complete long forms after scanning.

### Review uncertainty explicitly

If AI is uncertain:
- show the uncertainty
- allow fast correction
- do not pretend confidence

### Progressive disclosure

Keep default screens simple.

Advanced fields should not slow down everyday entry.

### Household visibility

Users should always understand which household they are viewing/editing.

---

## 25. V0.1 Scope

V0.1 should include enough functionality to test the real product loop.

### Required

- installable mobile-first PWA
- responsive iPhone/Android UX
- Supabase authentication
- household creation
- household membership/invitation
- shared household inventory
- inventory list
- expiry dates
- storage locations
- manual product entry
- product editing/removal
- expiry prioritization
- Web Push registration
- scheduled expiry notifications
- barcode scan flow
- product lookup
- internal product cache
- AI server integration
- single-product AI recognition
- paired-image batch capture
- batch review
- AI result validation
- useful empty/error/loading states
- baseline testing and validation

### Strong preference

Build notification proof early, before investing heavily in advanced capture.

---

## 26. Explicit Non-Goals for V0.1

Do not build unless needed to support the core architecture:

- native iOS app
- native Android app
- App Store release
- Google Play release
- meal planning
- recipes
- automatic grocery ordering
- retailer integrations
- receipt scanning
- multi-product scene recognition as the primary batch workflow
- whole-fridge computer vision
- nutritional coaching
- calorie tracking
- sustainability scores
- elaborate household roles/permissions
- social features
- gamification
- payment/subscription infrastructure
- analytics platform beyond minimal development diagnostics
- elaborate offline-first synchronization
- Redux or similarly heavy global state architecture without demonstrated need
- custom backend framework when Supabase already handles the requirement
- premature abstraction layers
- microservices
- enterprise-grade infrastructure for three testers

---

## 27. Possible Future Features

These are deliberately outside the initial build but the architecture should not make them unnecessarily difficult.

### Food-use suggestions

Once inventory is reliable:
- suggest what should be eaten first
- suggest meals based on expiring ingredients
- prioritize waste reduction

### Recipe assistance

Use inventory as structured context rather than asking users to manually list ingredients.

### Receipt scanning

Potential method for adding multiple purchased products.

### Whole-fridge recognition

Experimental future flow:
- photograph refrigerator/pantry
- identify visible products
- compare against recorded inventory
- surface potential discrepancies

This should not be treated as reliable enough for V0.1.

### Native application

Consider only if:
- PWA limitations become material
- product usage justifies distribution cost
- camera/notification/background capabilities require native behavior

---

## 28. Product Success Criteria for Early Testing

The prototype succeeds if the initial testers can reliably:

1. Install/open the product on iPhone and Android.
2. Create or join a household.
3. Add food without excessive friction.
4. Share the same inventory across household members.
5. See what expires next.
6. Receive expiry notifications with the app closed.
7. Scan common Danish grocery barcodes successfully often enough to be useful.
8. Use AI-assisted capture when barcode/manual entry is inconvenient.
9. Correct wrong AI/product results quickly.
10. Continue using the product because maintaining inventory does not feel like work.

---

## 29. Early Technical Risk Register

### Risk: PWA push reliability
**Mitigation:** Prove real iPhone + Android scheduled push delivery early.

### Risk: Danish product database coverage
**Mitigation:** Test real products from Danish supermarkets; use internal cache + AI/manual fallback.

### Risk: AI misreads expiry date
**Mitigation:** Explicit paired images, schema validation, user confirmation, null on uncertainty.

### Risk: Inventory maintenance becomes tedious
**Mitigation:** Optimize scan/batch flows continuously; minimize required fields.

### Risk: Free AI quota changes
**Mitigation:** Provider abstraction; deterministic lookup first; cache confirmed products.

### Risk: Cursor overengineers the project
**Mitigation:** Implement in vertical slices, keep architecture proportional to a three-user prototype, require planning and justification before new infrastructure.

---

## 30. Recommended Implementation Sequence

This sequence is directional. Cursor should inspect current platform/library constraints before implementing.

### Phase 0 — Project foundation
- initialize application
- TypeScript strictness
- Tailwind/shadcn foundation
- environment variable structure
- PWA manifest/service worker strategy
- Supabase project integration structure
- baseline lint/typecheck/test scripts
- clean folder conventions
- design tokens
- reusable mobile primitives

### Phase 1 — Auth + household + manual inventory
- Supabase Auth
- profiles
- households
- household membership
- RLS
- create/join/invite household
- manual inventory CRUD
- expiry sorting/status
- Home/Inventory/Add/Household shell

### Phase 2 — Notification proof
- PWA installation behavior
- push subscription registration
- permission UX
- server-side Web Push
- scheduled job
- test notification
- expiry-driven notification
- validate on real iPhone + Android

**Acceptance gate:** do not treat the product architecture as proven until this works.

### Phase 3 — Barcode scanning
- camera permission
- barcode scanning
- GTIN extraction
- internal product lookup
- external product lookup
- expiry capture/manual date entry
- review/add

### Phase 4 — AI foundation
- secure Mistral server-side integration
- image upload strategy
- schema validation
- product recognition
- expiry-date extraction
- confidence/uncertainty behavior
- cleanup of temporary images

### Phase 5 — Batch capture
- batch state
- paired product/expiry photos
- repeated fast capture
- server processing
- review list
- edit/correct
- commit confirmed batch to inventory

### Phase 6 — Usability hardening
- real Danish product test set
- error cases
- camera edge cases
- notification preferences
- household conflict behavior
- loading/empty/offline-ish states where needed
- performance
- accessibility
- mobile polish

---

## 31. Engineering Principles

### Keep the project proportionate

This is an early prototype for a tiny test group.

Use production-sensible fundamentals, but do not create enterprise architecture.

### Prefer vertical slices

Build complete, testable behavior incrementally rather than generating the entire app at once.

### Plan before implementing large changes

For meaningful features:
1. inspect existing code
2. understand current architecture
3. propose implementation
4. identify risks
5. implement
6. validate

### Do not change architecture casually

When an implementation conflicts with this document, the agent should:
- identify the conflict
- explain why a change may be necessary
- propose the change
- avoid silently redefining the product

### Quality gates

At minimum, relevant work should pass:
- lint
- TypeScript typecheck
- tests where meaningful
- build
- mobile viewport review
- security/RLS review when touching data access
- regression checks for existing flows

---

## 32. Source-of-Truth Rule

This handoff document represents the current agreed product direction.

It is not intended to freeze every implementation detail.

Engineering agents may recommend changes when:
- a library is unsuitable
- a web-platform limitation invalidates an assumption
- a security issue is discovered
- a simpler implementation provides the same behavior
- current platform/API constraints have changed

However, agents must not silently alter:
- the product purpose
- mobile-first PWA strategy
- household-first model
- expiry notifications as a core requirement
- zero-cost prototype goal
- server-side AI key protection
- confirmation-based AI UX
- restrained non-cliché design direction

Any material deviation should be explicitly surfaced before implementation.

---

## 33. End-State Vision

The long-term product should feel like a quiet household utility.

The user should not think:

> I need to maintain a food database.

They should think:

> The app knows roughly what we have and tells us what we should use before it goes bad.

The desired loop is:

```text
ADD
↓
KNOW WHAT YOU HAVE
↓
KNOW WHAT EXPIRES NEXT
↓
GET REMINDED
↓
USE IT IN TIME
```

Future intelligence may add:

```text
WHAT CAN WE MAKE?
↓
WHAT SHOULD WE USE FIRST?
```

But those features only become valuable once the inventory foundation is trustworthy and low-friction.

The product should earn usefulness through reliability, speed, and clarity rather than through visible AI branding or feature quantity.
