# Sauté - Restaurant Management System (Team Zenith)

Live Link: [https://saute-zenith.vercel.app/](https://saute-zenith.vercel.app/)

### 👥 Team Members
- **Nashya K A** — [@Nashya19](https://github.com/Nashya19) (S5 CSE)
- **Saniya Mansoor** — [@saniyamansoor](https://github.com/saniyamansoor) (S5 CSE)
- **Sufiyan Shiraj Mohammed** — [@Sufiyan-Shiraj](https://github.com/Sufiyan-Shiraj) (S3 CSE)
- **Surya Nandini** — [@suryanandini](https://github.com/suryanandini) (S5 CSE)

Welcome to the Sauté Restaurant Management System repository! This project is being built as part of an internship to replace manual, paper-based restaurant operations with a centralized digital platform tailored for small independent restaurants.

## 🚀 Tech Stack

- **Frontend & Backend**: Next.js 14+ (App Router)
- **Database & Auth**: Supabase (PostgreSQL, Row Level Security, Realtime)
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

## 📄 Project Documentation

For detailed functional specifications and system architecture designs, please refer to the following documents:
- [Software Requirements Specification (SRS) V3](./Others/RMS%20-%20SRS%20V3.pdf)
- [System Design Document (SDD) V2](./Others/RMS%20-%20SD%20V2.pdf)

---

## 📋 Internship Module Tasks & Progress

This checklist tracks the assignment and completion of all system modules. Please check off your assigned module (`- [x]`) and commit this `README.md` file when your work is complete and pushed.

- [x] **1. Authentication** (Must build after: *Nothing*)
- [x] **2. User Management** (Must build after: *Auth*)
- [x] **3. Dashboard** (Must build after: *Auth, most other modules*)
- [x] **4. Menu Management** (Must build after: *Auth*)
- [x] **5. Surplus Food Distribution** (Must build after: *Auth, Menu*)
- [x] **6. Feedback and Ratings** (Must build after: *Billing*)
- [x] **7. Table Management** (Must build after: *Auth*)
- [x] **8. Staff Scheduling** (Must build after: *Auth, User Management*)
- [x] **9. Order Management** (Must build after: *Table Management, Menu*)
- [x] **10. Kitchen Display** (Must build after: *Order Management*)
- [x] **11. Wait Time Estimation** (Must build after: *Order Management, Kitchen Display*)
- [x] **12. Billing** (Must build after: *Order Management*)

---

## 💻 Getting Started

First, ensure you have your `.env.local` configured with the Supabase credentials.

Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
