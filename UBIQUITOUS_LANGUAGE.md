# Ubiquitous Language

## Inventory

| Term                 | Definition                                                                                            | Aliases to avoid            |
| -------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------- |
| **Food Item**        | A product stored in a household location with expiration and quantity tracking                        | Item, grocery, product      |
| **Storage Location** | The physical place a Food Item is kept: `pantry`, `fridge`, or `freezer`                              | Location, shelf, area       |
| **Tracking Type**    | How a Food Item is measured: `amount` (percentage 0–100) or `count` (whole units ≥ 1)                 | Measurement type, unit type |
| **Amount**           | A percentage (0–100) representing how much of a bulk/unpackaged Food Item remains                     | Level, fill, percentage     |
| **Quantity**         | The number of discrete units of a packaged Food Item                                                  | Count, number, units        |
| **Canonical Name**   | A normalized, lowercase version of a Food Item or Ingredient name used for matching and deduplication | Normalized name, key, slug  |

## Expiration & Restock

| Term                  | Definition                                                                              | Aliases to avoid                |
| --------------------- | --------------------------------------------------------------------------------------- | ------------------------------- |
| **Expiration Status** | A Food Item's freshness state: `fresh`, `expiring-soon`, or `expired`                   | Freshness, health, state        |
| **Expiring Soon**     | A Food Item whose expiration date is within the configurable threshold (default 3 days) | About to expire, almost expired |
| **Restock Item**      | A Food Item that is `expired` or `expiring-soon` and needs replenishment                | Low stock, alert item           |

## Recipes

| Term                 | Definition                                                                                                                        | Aliases to avoid          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| **Recipe**           | A named cooking formula composed of one or more Ingredients                                                                       | Meal, dish                |
| **Ingredient**       | A named component of a Recipe with an optional quantity and unit                                                                  | Recipe item, component    |
| **Recipe Readiness** | Whether a Recipe can be cooked given current inventory: `ready` (100% matched), `almost-ready` (≥ 50%), or `need-to-shop` (< 50%) | Availability, cookability |
| **Ingredient Match** | The result of comparing an Ingredient's Canonical Name against inventory Food Items                                               | Lookup, link              |

## Scanning

| Term                    | Definition                                                                          | Aliases to avoid              |
| ----------------------- | ----------------------------------------------------------------------------------- | ----------------------------- |
| **Receipt Scanning**    | AI-powered extraction of Food Items from a grocery receipt photo                    | OCR, parsing                  |
| **Recipe Scanning**     | AI-powered extraction of Recipes and Ingredients from a cookbook or meal plan photo | Recipe OCR, recipe import     |
| **Extracted Food Item** | A Food Item parsed from a receipt image, not yet persisted to inventory             | Scanned item, parsed item     |
| **Extracted Recipe**    | A Recipe parsed from an image, not yet persisted                                    | Scanned recipe, parsed recipe |

## Shopping (new)

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **Shopping List Item** | An entry on the shopping list, sourced from either a Restock Item or a Pinned Recipe's unmatched Ingredient | Cart item, to-buy |
| **Shopping List Source Type** | The origin of a Shopping List Item: `restock` (expired/expiring Food Item) or `recipe` (unmatched Ingredient from a Pinned Recipe) | Source, origin |
| **Canonical Key** | A lowercased, trimmed Canonical Name used to deduplicate Shopping List Items across sources | Lookup key, slug |
| **Checked** | Whether a Shopping List Item has been marked as purchased during a shopping trip | Bought, completed, toggled |
| **Shopping Trip** | A shopping session that ends when the user finalizes purchases via Complete Shopping Trip | Shopping session, run |
| **Complete Shopping Trip** | The action of finalizing a shopping session: checked restock items replace their expired originals as new Food Items, checked recipe items become new Food Items, and the shopping list is cleared | Checkout, finalize |
| **Pinned Recipe** | A Recipe selected for meal planning by setting its `pinnedAt` timestamp; its unmatched Ingredients feed the Shopping List | Favorited recipe, selected recipe |
| **Carried Storage Location** | The Storage Location preserved on a Shopping List Item so the resulting Food Item inherits the correct location | Default location |
| **Carried Tracking Type** | The Tracking Type preserved on a Shopping List Item so the resulting Food Item inherits the correct measurement | Default tracking |

## Household (new)

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **Household** | A shared inventory space where members collaboratively manage Food Items, Recipes, and Shopping Lists | Family, group, team, account |
| **Household Role** | A member's permission level within a Household: `owner` or `member` | Permission, access level |
| **Household Member** | A User belonging to a Household with an assigned Household Role | Participant, collaborator |
| **Solo Household** (new) | A Household containing exactly one Member (the Owner); auto-created on signup or when the last other Member leaves | Single-user, personal |
| **Invite Code** (new) | A time-limited UUID (valid 7 days) that grants the holder permission to join a specific Household | Token, access code |
| **Invite Link** (new) | The shareable URL containing an Invite Code for joining a Household | Share link, join URL |
| **Transfer Ownership** (new) | The action of reassigning the `owner` role to another Household Member, demoting the former Owner to `member` | Reassign, hand off |
| **Ownership Constraint** (new) | The rule that an Owner cannot leave a multi-member Household without first transferring ownership | Leave restriction |

## Lifecycle operations

| Term               | Definition                                                              | Aliases to avoid          |
| ------------------ | ----------------------------------------------------------------------- | ------------------------- |
| **Trash**          | Soft-delete a Food Item or Recipe by setting a `trashedAt` timestamp    | Delete, remove, archive   |
| **Restore**        | Recover a trashed Food Item or Recipe within the 24-hour restore window | Undelete, recover, undo   |
| **Restore Window** | The 24-hour period after trashing during which an item can be restored  | Grace period, undo window |

## Tasks

| Term                | Definition                                                                           | Aliases to avoid            |
| ------------------- | ------------------------------------------------------------------------------------ | --------------------------- |
| **Task**            | A prioritized to-do item with a title and optional completion timestamp              | Todo, reminder, chore       |
| **Task Completion** | Toggling a Task's `completedAt` between null (incomplete) and a timestamp (complete) | Done, finished, checked off |

## Relationships

- A **Food Item** has exactly one **Storage Location** and one **Tracking Type**
- A **Food Item** has one **Expiration Status** derived from its expiration date
- A **Restock Item** wraps a **Food Item** that is `expired` or `expiring-soon`
- A **Recipe** contains one or more **Ingredients**
- An **Ingredient** may match zero or one **Food Items** via **Canonical Name**
- **Recipe Readiness** is computed from the ratio of matched **Ingredients** to total **Ingredients**
- **Receipt Scanning** produces **Extracted Food Items** that become **Food Items** when saved
- **Recipe Scanning** produces **Extracted Recipes** that become **Recipes** when saved
- A **Shopping List Item** is sourced from either a **Restock Item** or a **Pinned Recipe**'s unmatched **Ingredients** (new)
- **Shopping List Items** are deduplicated by **Canonical Key** (new)
- **Complete Shopping Trip** trashes the original expired **Food Items** and creates fresh replacements (new)
- A **Pinned Recipe** feeds its unmatched **Ingredients** into the **Shopping List** (new)
- A **Household** has exactly one **Owner** and up to 10 **Household Members** total (new)
- A **Solo Household** is auto-created when a User signs up (new)
- An **Invite Code** belongs to one **Household** and expires after 7 days (new)
- **Transfer Ownership** swaps roles between two **Household Members** in the same **Household** (new)
- The **Ownership Constraint** prevents an **Owner** from leaving without first transferring ownership (new)

## Example dialogue (updated)

> **Dev:** "How do **Households** work when a new user signs up?"
> **Domain expert:** "Every new user gets a **Solo Household** automatically — just them as the **Owner**. To share inventory, the **Owner** generates an **Invite Code**, which creates an **Invite Link** they can send to family members."
> **Dev:** "What if the **Owner** wants to leave?"
> **Domain expert:** "The **Ownership Constraint** prevents that. They must **Transfer Ownership** to another **Household Member** first. If they're in a **Solo Household**, they can freely join another **Household** — their solo one gets cleaned up."

## Example dialogue — inventory & shopping

> **Dev:** "When a user scans a receipt, do the **Extracted Food Items** go straight into inventory?"
> **Domain expert:** "No — the user reviews the **Extracted Food Items** first and can edit names, **Storage Locations**, and **Tracking Types** before saving. Only then do they become **Food Items**."
> **Dev:** "How does the **Shopping List** get populated?"
> **Domain expert:** "Two sources. First, any **Restock Items** — **Food Items** that are `expired` or `expiring-soon`. Second, any **Pinned Recipes** whose **Ingredients** don't match current inventory via **Canonical Name**. Both are merged into **Shopping List Items**, deduplicated by **Canonical Key**."
> **Dev:** "What happens when the user **Completes a Shopping Trip**?"
> **Domain expert:** "Every **Checked** restock **Shopping List Item** trashes its original expired **Food Item** and creates a fresh replacement, inheriting the **Carried Storage Location** and **Carried Tracking Type**. **Checked** recipe items also become new **Food Items**. Then the entire list is cleared."
> **Dev:** "For **Recipe Readiness**, if I have milk in the fridge and a recipe calls for milk, how does matching work?"
> **Domain expert:** "We compare **Canonical Names**. If the **Ingredient** and **Food Item** share the same **Canonical Name** (case-insensitive, trimmed), it counts as an **Ingredient Match**. We don't check quantity — just presence."

## Flagged ambiguities

- **"Item"** is used loosely throughout the codebase to mean **Food Item**, **Restock Item**, **Extracted Food Item**, or even a generic list entry. Always qualify: a _Food Item_ is in inventory, a _Restock Item_ is on the restock list, an _Extracted Food Item_ is fresh from scanning.
- **"Amount" vs "Quantity"** — these are _not_ interchangeable. **Amount** is a percentage (0–100) for bulk items tracked by `amount` type. **Quantity** is a whole-number count for discrete items tracked by `count` type. A Food Item has one or the other, never both.
- **"Trash" vs "Delete"** — **Trash** is a soft delete with a 24-hour **Restore Window**. There is no hard delete exposed to users. Code should use "trash" (not "delete") to avoid implying permanence.
- **"Ingredient" vs "Food Item"** — An **Ingredient** exists only within a **Recipe**. A **Food Item** exists in inventory. They are linked by **Canonical Name** matching, but are distinct domain concepts with different schemas.
- **"Checked" vs "Completed"** (new) — A **Shopping List Item** is **Checked** (marked as purchased). A **Task** is **Completed**. Don't use "completed" for shopping items or "checked" for tasks.
- **"Pin" vs "Favorite"** (new) — A **Pinned Recipe** is selected for meal planning and directly affects the **Shopping List**. Avoid "favorite" — pinning has functional consequences beyond bookmarking.
- **"Invite Code" vs "Invite Link"** (new) — The **Invite Code** is the UUID token; the **Invite Link** is the shareable URL containing it. Code should distinguish between the two — validate the _code_, share the _link_.
- **"Leave" vs "Transfer"** (new) — An **Owner** cannot "leave" a multi-member **Household**. They must **Transfer Ownership** first. Only **Members** (non-owners) can leave directly.
