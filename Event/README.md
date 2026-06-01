# Small Business Inventory and Sales Management System

## Project Description
A comprehensive, enterprise-grade, web-based software application tailored for Small Businesses (Supermarkets, Mini-marts, Boutiques, Pharmacies, Retail Stores) to effectively manage their physical inventory, track point-of-sale transactions globally, and execute accurate data analytics. 

Designed explicitly as a **Final Year Project**, it implements complex Multi-Tenant **Role-Based Access Control (RBAC)** architecture securely decoupling Administrating Owners from standard Subordinate Staff instances.

## Aim of the Project
To eliminate manual bookkeeping bottlenecks and prevent inventory shrinkage by providing a completely digital, responsive, and robust transaction terminal. It ensures strict oversight constraints, allowing Staff to record sales swiftly without compromising sensitive overhead costs or overall profit margins visibility.

## Technologies Used
- **Frontend Core:** Pure HTML5, CSS3 (Native CSS Variables & Grid/Flexbox Layouts).
- **Frontend Logic:** Vanilla JavaScript (ES6+). No heavy abstractions like React or Vue guarantee lightweight, scalable DOM mapping.
- **Backend & Database:** Supabase (Cloud PostgreSQL).
- **Authentication:** Supabase Auth (JWT, Row Level Security encapsulation).
- **Icons:** FontAwesome (via CDN).

## Core Features
1. **Multi-Tenant Architecture:** Unique Admin/Business partitions securely enforced. 
2. **Double-Entry Stock Ledger:** Inventory is mapped transactionally (In, Out, Damage, Sale) ensuring 100% auditing visibility preventing arbitrary editing.
3. **Point of Sale Terminal (POS):** Fast checkout interface calculating Tax, Custom Discounts, and rendering Native Printable Thermal Receipts natively.
4. **Automated Analytics Matrix:** Generates Net Profit, Staff Performance ledgers, Low Stock alerts natively filtering via explicit algorithms.
5. **Route-Guard Execution:** Prevents user exploitation seamlessly forcing browser-redirects intrinsically if Staff users mutate browser paths manually.

## System Interfaces
### The Admin Section `/admin/`
Acts as the central command node for the Business Owner. Features encompass total CRUD capabilities mapping Products and Categories dynamically. The Admin generates Analytics visually and provisions Staff users manually locally utilizing an embedded REST API payload mapping bypassing traditional Auth Session overlaps explicitly natively.

### The Staff Section `/user/`
A strictly stripped-down checkout view. Staff cannot add products, cannot edit stock directly, and critically—cannot view **Cost Price** or **Gross Profit**. The application exclusively permits POS rendering implicitly restricting transactions dynamically preventing Negative Stock evaluations natively.

## Supabase Database Setup Steps
1. Navigate to your Supabase Project.
2. Under "SQL Editor", inject the `supabase_schema.sql` completely seamlessly. This generates 8 distinct tables (`profiles`, `categories`, `products`, `stock_movements`, `sales`, `sale_items`, `business_settings`).
3. The SQL code explicitly fires **Postgres Database Triggers** to automatically synchronize user profile rows securely upon user creation.
4. It attaches explicit **Row Level Security (RLS)** protocols forcing Staff to only pull records inherently attached to their `admin_id`.

## How to Run Locally
1. Clone the project directly locally.
2. Map your API limits by navigating to `js/supabase-config.js` and inputting your exact `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
3. Boot the instance navigating via VSCode `Live Server` globally, targeting `index.html`. 
4. *(Note: Because we exclusively decoupled frameworks natively, you do not require `npm install` or `Node.js` structurally natively!)*

## Default Demo Flow (Defense Preparation)
1. **Registration:** Head to `register.html`, input your Business Details. You are routed to the Admin Dashboard globally.
2. **Configuration:** Traverse to "Settings" globally verifying your Currency (e.g., FCFA) & Global Stock boundary accurately.
3. **Inventory Parsing:** Create "Categories" globally securely, then navigate to "Products" securely adding Items perfectly generating visual arrays mapping accurately.
4. **Provision Staff:** Navigate to "Staff Management", utilize the REST UI form generating a Subordinate Login securely silently locking access.
5. **Stock Allocation:** Jump into "Stock Ledger" securely bumping stock constraints dynamically upwards locally.
6. **Execution Shift:** Manually Logout. Login natively utilizing your generated Staff Email mapping globally seamlessly porting you securely to `/user/dashboard.html`.
7. **POS Execution:** Utilize the "Record Sale" node mapping array data. Print the final Thermal Slip natively rendering accurately mapped!

---
*Developed globally natively mapped perfectly for Final Year Demonstrations explicitly executing seamlessly dynamically natively!*
