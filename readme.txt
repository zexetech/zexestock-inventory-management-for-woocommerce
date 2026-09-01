=== ZexeStock | Inventory Management for WooCommerce ===
Contributors: aless1o
Tags: woocommerce inventory management, Woocommerce Stock Management, Inventory
Requires at least: 6.4
Tested up to: 7.1
Requires PHP: 8.0
Stable tag: 1.0.0
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Fast WooCommerce inventory management for editing stock, products, and variations from one powerful screen.

== Description ==

Stop opening hundreds of WooCommerce product pages just to adjust stock.

ZexeStock is a modern inventory management plugin for WooCommerce that lets you search, edit, and manage thousands of products from one fast, dedicated interface — instead of clicking into a separate edit screen for every single one.

Whether you're running a small online shop or a warehouse with 50,000+ products, ZexeStock makes stock updates dramatically faster with inline editing, fast server-side search, variable product support, PDF exports, and analytics — all from a single screen.

Built for busy store owners, warehouse teams, and inventory managers, ZexeStock removes the friction from everyday stock management so you spend less time clicking through product pages and more time running your business.

= A Purpose-Built Stock Workspace =

Managing inventory inside WooCommerce's default product editor gets frustrating fast as your catalogue grows — one product per page, one save per change.

ZexeStock replaces that with a purpose-built stock management workspace that is:

* Faster than editing products individually
* Built for large WooCommerce stores, with server-side pagination that keeps thousands of products fast to search and browse
* Easy enough for warehouse staff to use with no training
* Safe, with optimistic concurrency protection against conflicting edits
* Built on native WooCommerce CRUD methods, so it stays compatible with core and HPOS

Instead of jumping between dozens of product pages, your entire inventory is searchable and editable from one screen.

= Perfect For =

* WooCommerce stores of any size
* Warehouse and fulfillment teams
* Retail businesses managing their own online catalogue
* Wholesalers and manufacturers
* Inventory and operations managers
* Anyone tired of editing stock one product at a time

= Why ZexeStock? =

* **Adjust stock for one product** — Default WooCommerce: open the product, edit, save, reload. ZexeStock: inline, in the table, no page reload.
* **Search across the catalogue** — Default WooCommerce: basic list search. ZexeStock: fast server-side search over 10,000+ products.
* **Edit a variable product** — Default WooCommerce: open each variation separately. ZexeStock: expand the parent row inline and edit every variation in place.
* **Adjust many products at once** — Default WooCommerce: one at a time. ZexeStock: bulk selection and bulk bar (Pro).
* **Edit like a spreadsheet** — Default WooCommerce: not possible. ZexeStock: keyboard-driven spreadsheet mode (Pro).
* **Forecast stockouts** — Default WooCommerce: not available. ZexeStock: sales-velocity-based predictions (Pro).

= Free and Powerful Out of the Box =

ZexeStock's free version includes fast stock editing, searchable inventory, variable product support, PDF export, and more — no trial, no credit card required. When your inventory operation grows, ZexeStock Pro adds advanced tools for bulk editing, spreadsheet mode, a full audit log, advanced analytics, CSV/XLSX exports, stockout predictions, and more.

= Free Features =

**Fast Stock Management**

* **Searchable stock table** — fast, server-side search that stays responsive even with 10,000+ products
* **Inline stock adjustments** — add or remove stock directly from the table; no page reloads
* **Quick +/− buttons** — one-click increment/decrement by a configurable step
* **Inline price and product data editing** — update regular price, sale price (with scheduling), purchase price, barcode, and supplier SKU directly from the table
* **Variable product support** — expand a parent row inline to edit every variation without leaving the table
* **Server-side pagination** — only the products you're viewing are loaded, so performance holds up on large catalogues

**Better Inventory Visibility**

* **Color-coded stock status indicators** — in-stock, low-stock, out-of-stock at a glance
* **Per-product low-stock threshold override** — set a custom threshold per product
* **Analytics dashboard (basic)** — stock-tier counts (in-stock/low-stock/out-of-stock) on the WordPress dashboard summary widget
* **PDF export** — generate a stock report in one click

**Safe & Reliable**

* **Negative stock prevention** — configurable guard that blocks adjustments below zero
* **Optimistic concurrency control** — prevents silent overwrites when two users edit the same product at the same time
* **Role-based access** — grant or revoke stock adjustment and settings permissions per WordPress role
* **HPOS compatible** — built on native WooCommerce CRUD methods (`wc_update_product_stock()`, `get_stock_quantity()`), fully compatible with High-Performance Order Storage
* **Translation ready** — ships with a `.pot` file; RTL languages supported

= Ready to Manage Inventory at Scale? =

ZexeStock Pro turns the same fast stock management interface into a complete inventory workspace for stores that need bulk editing, spreadsheet workflows, advanced reporting, and deeper inventory insights:

**Save Hours Every Week**

* **Bulk stock adjustments** — select multiple products and apply a change to all of them at once
* **Spreadsheet mode** — keyboard-driven, Excel-style cell navigation for fast bulk editing
* **Delta stock changes** — adjust by +/− amount instead of retyping an exact value
* **Advanced filter panel** — build multi-condition filters across stock, price, and product fields
* **Custom saved views** — save and reload named filter and column presets
* **Undo** — revert a single adjustment, or an entire bulk batch, with one click

**Complete Inventory History**

* **Full audit log** — every stock, price, SKU, and meta change, with who made it and when
* **Search and filter** — by product, date range, user, and adjustment type

**Better Business Insights**

* **Advanced analytics dashboard** — KPIs, sales summary, fast movers, top products, sales by category
* **Current stock value** — know what your inventory is worth right now
* **Stockout predictions** — estimated days-to-stockout per product, based on sales velocity
* **Low-stock dashboard widget** — see at-risk products at a glance from the WordPress dashboard

**Professional Exporting**

* **CSV and XLSX export** — export the stock table or audit log for spreadsheets and reporting

= Source Code & Build Tools =

The admin interface (`admin/build/`) is compiled from TypeScript/React source with webpack. The full uncompiled source and build tools are publicly available at:
https://github.com/zexetech/zexestock-inventory-management-for-woocommerce

To build from source: `npm install && npm run build`.

== Installation ==

1. Upload the `zexestock` folder to `/wp-content/plugins/`.
2. Activate the plugin through the **Plugins** menu in WordPress.
3. WooCommerce must be installed and active.
4. Navigate to **ZexeStock → Dashboard** to start adjusting stock.

== Frequently Asked Questions ==

= What are the minimum requirements to run ZexeStock? =

WordPress 6.4+, WooCommerce 6.4+, and PHP 8.0+.

= What can I do with the free version? =

A lot. You get a searchable, paginated stock table for 10,000+ products, inline stock adjustments, quick +/− buttons, inline price and product data editing (regular price, sale price, purchase price, barcode, supplier SKU), full variable product support, color-coded stock status, per-product low-stock thresholds, a basic analytics widget, PDF export, negative stock prevention, optimistic concurrency control, role-based access, and HPOS compatibility — no trial, no credit card required. When you need more, Pro adds bulk editing, a full audit log, spreadsheet mode, advanced analytics, and more.

= Can I quickly adjust stock for individual products? =

Yes. Use the quick +/− buttons for one-click increments, or type a value directly into a product's stock cell and click Apply — no separate edit screen needed.

= Can I manage thousands of WooCommerce products? =

Yes. ZexeStock was designed for large product catalogues. Server-side pagination means only the products you're currently viewing are loaded, keeping the interface fast even with 10,000+ products.

= I have a problem, who do I contact and how? =

Post in this plugin's Support forum here on WordPress.org, or visit https://zexelabs.com for other contact options.

= Is ZexeStock available in different languages? =

ZexeStock ships translation-ready with a `.pot` file and supports RTL languages out of the box. Use any standard WordPress translation tool (e.g. Loco Translate, Polylang) to add a language.

= Does ZexeStock support all WooCommerce product types? =

Simple, variable, and grouped products are all supported. Variable products show as an expandable parent row with each variation editable individually; grouped products show their child products the same way.

= I updated ZexeStock and can't see the new functionality =

Clear your browser cache and do a hard refresh (Ctrl/Cmd + Shift + R) — the admin screens are a compiled JavaScript app, and the browser can keep serving an old cached version right after an update. If a Pro-only feature specifically is missing, confirm your license is still active under ZexeStock → Settings.

= Will ZexeStock work with PHP versions older than 8.0? =

No. ZexeStock requires PHP 8.0 or newer and will not activate on older PHP versions.

= Which other plugins does ZexeStock work with? =

WooCommerce 6.4+ is required, and ZexeStock is fully compatible with WooCommerce's High-Performance Order Storage (HPOS). There are no other required third-party plugin integrations at this time.

= Does this work with variable products? =

Yes. Variable products appear as a grouped parent row. Click the expand button to reveal all variations, each with its own adjustment input.

= Will it work with 10,000+ products? =

Yes. The stock table uses server-side processing — only the current page of results is loaded at a time, so performance does not degrade with large catalogs.

= Is it compatible with HPOS? =

Yes. The plugin uses WooCommerce CRUD methods (`wc_update_product_stock()`, `$product->get_stock_quantity()`) exclusively for stock data and has been audited for HPOS compatibility.

= What happens if two people adjust the same product at the same time? =

The plugin uses optimistic concurrency control. If stock has changed between when you loaded the page and when you clicked Apply, the adjustment is rejected and the displayed stock is updated so you can review before retrying.

= Where are the audit log entries stored? =

The audit log is a Pro feature. When Pro is active, entries are stored in a custom database table (`{prefix}zexst_audit_log`) and are searchable and filterable by product, date range, user, and adjustment type, with CSV export.

= Does ZexeStock collect any personal data or track usage? =

ZexeStock uses the Freemius SDK to handle licensing and updates for the Pro version. On activation you may be asked to opt in to sharing basic, non-sensitive diagnostic data (such as PHP/WordPress version and plugin usage metrics) to help us improve the plugin — this is entirely optional and you can skip it. No data is collected without your consent. See the Freemius privacy policy for details: https://freemius.com/privacy/.

== Screenshots ==

1. Advanced analytics dashboard — revenue, sales, top-selling products, and sales by category (Pro)
2. Advanced analytics dashboard, full view — inventory health, low-stock breakdown, and current stock value (Pro)
3. Stock Manager — searchable, sortable product table with inline stock and price editing
4. Variable products expand inline to reveal and edit every variation
5. Bulk selection bar — select multiple products and choose a bulk action (Pro)
6. Bulk stock adjustment — apply a +/- change to every selected product at once (Pro)
7. Bulk price adjustment — update regular price, sale price, and sale schedule for selected products (Pro)
8. Confirmation dialog shown before a bulk adjustment is applied (Pro)
9. Undo last action — instantly revert a bulk stock adjustment (Pro)
10. Spreadsheet mode — edit prices and stock across multiple rows at once, Excel-style (Pro)
11. Inline purchase price editing directly from the stock table
12. Inline regular price editing directly from the stock table
13. Inline sale price editing with a scheduled start and end date
14. Inline barcode and supplier SKU editing
15. Spreadsheet mode with per-row sale scheduling while bulk-editing (Pro)
16. Full audit log with search, date range, user, and type filters (Pro)
17. Export stock data to PDF, CSV, or XLSX with custom column selection (PDF is free; CSV/XLSX export is Pro)

== Changelog ==

= 1.0.0 =
* Initial release.

== Upgrade Notice ==

= 1.0.0 =
Initial release.
