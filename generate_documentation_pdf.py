import os
import subprocess
import sys

def build_pdf():
    html_file = os.path.abspath("wanderwise_documentation.html")
    pdf_file = os.path.abspath("WanderWise_AI_Complete_Project_Documentation.pdf")
    
    html_content = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>WanderWise AI — Complete Technical Project Documentation</title>
    <style>
        @page {
            size: A4;
            margin: 18mm 15mm 18mm 15mm;
            @bottom-right {
                content: "Page " counter(page);
                font-size: 9pt;
                color: #64748b;
                font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
            }
            @bottom-left {
                content: "WanderWise AI | Project Documentation & Viva Guide";
                font-size: 9pt;
                color: #64748b;
                font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
            }
        }

        body {
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
            color: #1e293b;
            line-height: 1.55;
            font-size: 10pt;
            background: #ffffff;
            margin: 0;
            padding: 0;
        }

        .cover {
            page-break-after: always;
            text-align: center;
            padding-top: 80px;
            padding-bottom: 60px;
        }
        .cover-badge {
            display: inline-block;
            background: #fff7ed;
            color: #ea580c;
            border: 1px solid #fed7aa;
            padding: 6px 16px;
            border-radius: 999px;
            font-weight: 700;
            font-size: 10pt;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            margin-bottom: 20px;
        }
        .cover-title {
            font-size: 32pt;
            font-weight: 800;
            color: #0f172a;
            margin: 0 0 10px 0;
            line-height: 1.15;
            letter-spacing: -0.5px;
        }
        .cover-subtitle {
            font-size: 14pt;
            color: #ea580c;
            font-weight: 600;
            margin-bottom: 30px;
        }
        .cover-desc {
            font-size: 11pt;
            color: #475569;
            max-width: 620px;
            margin: 0 auto 50px auto;
            line-height: 1.6;
        }
        .cover-meta {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 24px;
            max-width: 480px;
            margin: 0 auto;
            text-align: left;
        }
        .cover-meta table {
            width: 100%;
            border-collapse: collapse;
        }
        .cover-meta td {
            padding: 6px 10px;
            font-size: 9.5pt;
        }
        .cover-meta td.label {
            color: #64748b;
            font-weight: 600;
            width: 35%;
        }
        .cover-meta td.val {
            color: #0f172a;
            font-weight: 700;
        }

        h1 {
            font-size: 18pt;
            color: #0f172a;
            font-weight: 800;
            border-bottom: 2px solid #ea580c;
            padding-bottom: 6px;
            margin-top: 35px;
            margin-bottom: 16px;
            page-break-after: avoid;
        }
        h2 {
            font-size: 13pt;
            color: #0369a1;
            font-weight: 700;
            margin-top: 22px;
            margin-bottom: 10px;
            page-break-after: avoid;
        }
        h3 {
            font-size: 11pt;
            color: #334155;
            font-weight: 700;
            margin-top: 16px;
            margin-bottom: 8px;
            page-break-after: avoid;
        }
        p {
            margin: 0 0 10px 0;
            color: #334155;
            text-align: justify;
        }

        .page-break {
            page-break-before: always;
        }
        .avoid-break {
            page-break-inside: avoid;
        }

        table.data-table {
            width: 100%;
            border-collapse: collapse;
            margin: 12px 0 20px 0;
            font-size: 8.5pt;
            page-break-inside: avoid;
        }
        table.data-table th {
            background: #0f172a;
            color: #ffffff;
            font-weight: 700;
            text-align: left;
            padding: 8px 10px;
            border: 1px solid #1e293b;
        }
        table.data-table td {
            padding: 7px 10px;
            border: 1px solid #e2e8f0;
            vertical-align: top;
        }
        table.data-table tr:nth-child(even) {
            background: #f8fafc;
        }

        .badge {
            display: inline-block;
            padding: 2px 7px;
            border-radius: 4px;
            font-size: 7.5pt;
            font-weight: 700;
            text-transform: uppercase;
        }
        .badge-get { background: #e0f2fe; color: #0369a1; }
        .badge-post { background: #dcfce7; color: #15803d; }
        .badge-delete { background: #fee2e2; color: #b91c1c; }
        .badge-ai { background: #fef3c7; color: #b45309; }
        .badge-core { background: #ffedd5; color: #c2410c; }

        .callout {
            background: #f8fafc;
            border-left: 4px solid #ea580c;
            padding: 12px 16px;
            border-radius: 0 8px 8px 0;
            margin: 14px 0;
            font-size: 9pt;
            page-break-inside: avoid;
        }
        .callout-title {
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 4px;
        }

        .diagram-box {
            background: #0f172a;
            color: #e2e8f0;
            font-family: 'Consolas', 'Courier New', monospace;
            font-size: 8pt;
            padding: 14px;
            border-radius: 8px;
            line-height: 1.4;
            margin: 15px 0;
            overflow-x: auto;
            white-space: pre;
            page-break-inside: avoid;
        }

        .qa-card {
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-left: 4px solid #0284c7;
            border-radius: 6px;
            padding: 12px 14px;
            margin-bottom: 14px;
            page-break-inside: avoid;
        }
        .qa-q {
            font-weight: 700;
            color: #0f172a;
            font-size: 9.5pt;
            margin-bottom: 6px;
        }
        .qa-a {
            color: #334155;
            font-size: 9pt;
            line-height: 1.5;
        }
        .qa-tag {
            display: inline-block;
            font-size: 7pt;
            font-weight: 700;
            background: #e0f2fe;
            color: #0369a1;
            padding: 2px 6px;
            border-radius: 4px;
            margin-bottom: 4px;
            text-transform: uppercase;
        }

        ul, ol {
            margin: 6px 0 12px 20px;
            padding: 0;
        }
        li {
            margin-bottom: 4px;
            font-size: 9.5pt;
        }

        .grid-2 {
            display: flex;
            gap: 15px;
            margin: 10px 0;
            page-break-inside: avoid;
        }
        .col-2 {
            flex: 1;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 12px;
            border-radius: 8px;
        }
        .col-2 h4 {
            margin: 0 0 6px 0;
            font-size: 10pt;
            color: #0f172a;
            font-weight: 700;
        }
    </style>
</head>
<body>

    <!-- ==================== COVER PAGE ==================== -->
    <div class="cover">
        <span class="cover-badge">Complete Engineering & Architecture Dossier</span>
        <h1 class="cover-title">WANDERWISE AI</h1>
        <div class="cover-subtitle">Intelligent Conversational Domestic Travel Agency Platform</div>
        <p class="cover-desc">
            An end-to-end autonomous travel planner powered by LangGraph multi-agent orchestration, Google Gemini LLMs, live domestic flight timetables, real-time weather forecasting, hotel sentiment analysis, dynamic budget rebalancing, and direct IRCTC Air / Google Maps integrations.
        </p>

        <div class="cover-meta">
            <table>
                <tr>
                    <td class="label">Project Domain:</td>
                    <td class="val">Artificial Intelligence • Autonomous Agents • Travel Tech</td>
                </tr>
                <tr>
                    <td class="label">Architecture:</td>
                    <td class="val">Micro-Agent State Machine (LangGraph) + FastAPI + React SPA</td>
                </tr>
                <tr>
                    <td class="label">Primary LLM:</td>
                    <td class="val">Google Gemini 1.5 Pro / Flash (Google GenAI SDK)</td>
                </tr>
                <tr>
                    <td class="label">Database:</td>
                    <td class="val">Supabase PostgreSQL (SQLAlchemy ORM)</td>
                </tr>
                <tr>
                    <td class="label">Document Type:</td>
                    <td class="val">Technical Specification, Architecture Breakdown & Viva Guide</td>
                </tr>
                <tr>
                    <td class="label">Status:</td>
                    <td class="val">Production-Ready (Verified on Local Port 8000)</td>
                </tr>
            </table>
        </div>
    </div>

    <!-- ==================== SECTION 1: EXECUTIVE SUMMARY ==================== -->
    <h1>1. Executive Summary & Problem Statement</h1>
    <p>
        Planning a comprehensive domestic vacation in India traditionally requires juggling across 5–10 disconnected websites: searching flight routes across domestic carriers, reading thousands of unstructured hotel reviews on booking portals, checking unpredictable regional weather, estimating road commute times, calculating budget allocations in Indian Rupees (₹), and searching for reliable local vegetarian and non-vegetarian food spots.
    </p>
    <p>
        <strong>WanderWise AI</strong> solves this fragmentation by providing an interactive, full-stack autonomous travel platform. Through natural language conversations, WanderWise iteratively extracts key constraints (Source, Destination, Budget in ₹, Travel Date, and Duration), coordinates specialized sub-agents via LangGraph, and delivers a publication-grade <strong>8-Section Travel Blueprint</strong> complete with verified airline timetable schedules, review sentiment scoring for hotels, day-by-day morning-to-night itineraries, direct Google Maps navigation deep links, and automated budget recalculations when tickets are booked.
    </p>

    <div class="callout">
        <div class="callout-title">Key Core Value Propositions</div>
        <ul>
            <li><strong>Conversational Multi-Turn Parameter Extraction:</strong> Automatically identifies missing trip parameters and guides travelers without rigid web forms.</li>
            <li><strong>Verified 8-Section Block-Wise Blueprint:</strong> Guarantees standardized trip documentation (Overview, Timetables, Stays, Climate, Attractions, Time Blocks, Finances, Regional Cuisine).</li>
            <li><strong>Zero-Markup Direct IRCTC Air Integration:</strong> Recommends verified Indian domestic airlines and recalculates stay/food budget when flights are booked.</li>
            <li><strong>Hotel Sentiment Analysis:</strong> NLP analysis of verified guest feedback separating genuine praise from complaints.</li>
            <li><strong>Live Contextual In-Plan Q&A:</strong> Travelers can ask follow-up questions ("near me" non-veg dining, comparisons, scenic viewpoints) with real-time GPS proximity.</li>
        </ul>
    </div>

    <!-- ==================== SECTION 2: TECH STACK ==================== -->
    <div class="page-break"></div>
    <h1>2. Complete Technology Stack & Specifications</h1>
    <p>
        The table below provides a comprehensive breakdown of every language, library, framework, and tool utilized across the WanderWise AI architecture, accompanied by its specific use case and engineering rationale.
    </p>

    <table class="data-table">
        <thead>
            <tr>
                <th style="width: 18%;">Layer / Category</th>
                <th style="width: 22%;">Technology</th>
                <th style="width: 32%;">Specific Project Use Case</th>
                <th style="width: 28%;">Engineering Justification</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><strong>Backend Runtime</strong></td>
                <td>Python 3.10+ / 3.11</td>
                <td>Core application runtime, LangGraph state execution, and data science pipelines.</td>
                <td>Rich ecosystem for AI/LLM SDKs, async I/O support, and robust web frameworks.</td>
            </tr>
            <tr>
                <td><strong>Web Framework</strong></td>
                <td>FastAPI (Uvicorn ASGI)</td>
                <td>High-throughput RESTful API endpoints, asynchronous request pipelines, background jobs.</td>
                <td>Native async concurrency, automated Pydantic schema validation, minimal latency overhead.</td>
            </tr>
            <tr>
                <td><strong>Multi-Agent Core</strong></td>
                <td>LangGraph & LangChain Core</td>
                <td>StateGraph state machine orchestrating parameter extraction, tool retrieval, and synthesis.</td>
                <td>Cyclic state graph support, deterministic step transitions, and resilient agent handoffs.</td>
            </tr>
            <tr>
                <td><strong>Foundation LLM</strong></td>
                <td>Google Gemini 1.5 Pro / Flash</td>
                <td>Natural language comprehension, parameter extraction, contextual Q&A, and markdown synthesis.</td>
                <td>Massive context window, low latency, strong reasoning across Indian geographical domains.</td>
            </tr>
            <tr>
                <td><strong>Database & ORM</strong></td>
                <td>Supabase PostgreSQL + SQLAlchemy</td>
                <td>Persistent cloud storage of user accounts, hashed credentials, blueprints, and feedbacks.</td>
                <td>ACID compliance, relational integrity, seamless cloud migration, zero maintenance.</td>
            </tr>
            <tr>
                <td><strong>Frontend Framework</strong></td>
                <td>React 18 (Precompiled)</td>
                <td>Declarative Single-Page Application (SPA) UI with real-time conversational rendering.</td>
                <td>Component reusability, virtual DOM performance, smooth tab switching, and state reactivity.</td>
            </tr>
            <tr>
                <td><strong>Build & Bundling</strong></td>
                <td>Node.js & Babel Core</td>
                <td>Offline compiling of modern JSX (`static/script.js` &rarr; `static/bundle.js`).</td>
                <td>Eliminates runtime browser compilation delays, ensuring instantaneous page rendering.</td>
            </tr>
            <tr>
                <td><strong>Styling & CSS</strong></td>
                <td>Tailwind CSS</td>
                <td>Responsive utility-first design, color-coded section borders, mobile navigation, glassmorphism.</td>
                <td>Zero CSS bloat, rapid prototyping, elegant mobile responsiveness, consistent design tokens.</td>
            </tr>
            <tr>
                <td><strong>Markdown Engine</strong></td>
                <td>Marked.js (Custom Renderer)</td>
                <td>Client-side rendering of 8-section travel blueprints and chat replies into rich HTML.</td>
                <td>Custom link override to render clean `📍 View` badges and auto-link hotel Google Maps URLs.</td>
            </tr>
            <tr>
                <td><strong>Authentication</strong></td>
                <td>Google Identity Services + Passlib</td>
                <td>Google One-Tap / OAuth 2.0 token verification + SHA-256 bcrypt password hashing.</td>
                <td>Frictionless 1-click traveler sign-in with complete session security and cloud persistence.</td>
            </tr>
            <tr>
                <td><strong>Notification / Mail</strong></td>
                <td>smtplib (Python Standard)</td>
                <td>Secure SMTP over SSL (Port 465) sending clean travel blueprints directly to traveler emails.</td>
                <td>Zero external paid email API dependency, native TLS/SSL security, direct Gmail gateway.</td>
            </tr>
            <tr>
                <td><strong>Geospatial Utilities</strong></td>
                <td>Browser Geolocation API + Math</td>
                <td>HTML5 coordinate retrieval + Haversine distance formula for nearby dining and viewpoints.</td>
                <td>Pinpoints proximity without invading privacy; only triggers when user requests "near me".</td>
            </tr>
        </tbody>
    </table>

    <!-- ==================== SECTION 3: SYSTEM ARCHITECTURE ==================== -->
    <div class="page-break"></div>
    <h1>3. System Architecture & Workflow Pipeline</h1>
    <p>
        WanderWise AI employs a modern decoupled architecture. The frontend Single-Page Application communicates with the FastAPI ASGI server over JSON REST endpoints. The backend coordinates an internal LangGraph state machine executing specialized agent nodes.
    </p>

    <div class="diagram-box">
+---------------------------------------------------------------------------------------------------+
|                                  CLIENT-SIDE PRESENTATION (REACT 18)                              |
|  +--------------------+  +--------------------+  +--------------------+  +---------------------+  |
|  | Home Showcase /    |  | ChatGPT-Style Trip |  | 8-Section Block-   |  | Traveler Lounge /   |  |
|  | Destination Cards  |  | Conversation Drawer|  | Wise Blueprint View|  | Personal Dashboard  |  |
|  +---------+----------+  +---------+----------+  +---------+----------+  +----------+----------+  |
+------------|-----------------------|-----------------------|------------------------|-------------+
             |                       |                       |                        |
             | HTTP POST /api/travel | HTTP POST /api/plan-qa| HTTP POST /update-budg | HTTP /api/user-plans
             v                       v                       v                        v
+---------------------------------------------------------------------------------------------------+
|                                    FASTAPI BACKEND SERVER (UVICORN)                               |
|  +---------------------------------+  +-------------------------------+  +---------------------+  |
|  | Session & Auth Middleware       |  | Route Handlers & Controllers  |  | Static & Cache Ctrl |  |
|  | (Google OAuth / DB Auth)        |  | (Travel, Q&A, Email, Feedback)|  | (no-cache headers)  |  |
|  +----------------+----------------+  +---------------+---------------+  +----------+----------+  |
+-------------------|-----------------------------------|-----------------------------|-------------+
                    |                                   |                             |
                    v                                   v                             v
+---------------------------------------------------------------------------------------------------+
|                                 LANGGRAPH MULTI-AGENT STATE MACHINE                               |
|                                                                                                   |
|     [User Query] ----> (1. Parameter Extractor Agent)                                             |
|                                |                                                                  |
|                  Are all 5 parameters complete?                                                   |
|                     /                     \                                                       |
|             NO    /                         \  YES                                                |
|                 v                             v                                                   |
|    (Generate Clarification Prompt)     (2. Flight Timetable Agent) <--> AviationStack API         |
|                 |                             |                                                   |
|                 v                             v                                                   |
|         [Return to User]               (3. Hotel & Sentiment Agent) <--> Reviews & Maps API       |
|                                               |                                                   |
|                                               v                                                   |
|                                        (4. Multi-Day Weather Agent)<--> OpenWeatherMap API        |
|                                               |                                                   |
|                                               v                                                   |
|                                        (5. Sightseeing & Attraction Agent)                        |
|                                               |                                                   |
|                                               v                                                   |
|                                        (6. Day-wise Schedule & Budget Agent)                      |
|                                               |                                                   |
|                                               v                                                   |
|                                        (7. Final Markdown Synthesis Agent)                        |
|                                               |                                                   |
+-----------------------------------------------|---------------------------------------------------+
                                                v
                              +-----------------------------------+
                              | 8-Section Verified Blueprint JSON |
                              +-----------------------------------+
                                    |                       |
                                    v                       v
                         +--------------------+   +--------------------+
                         | Supabase Postgres  |   | SMTP SSL Mailer    |
                         | (Cloud Storage)    |   | (Port 465 Gmail)   |
                         +--------------------+   +--------------------+
    </div>

    <!-- ==================== SECTION 4: DETAILED COMPONENT BREAKDOWN ==================== -->
    <div class="page-break"></div>
    <h1>4. Detailed Architectural Component Breakdown</h1>
    <p>
        Every module in WanderWise AI has been constructed with clear separation of concerns, ensuring high testability, fault tolerance, and modular extensibility.
    </p>

    <h2>4.1 Parameter Extraction & Conversational Agent (`backend.py`)</h2>
    <p>
        The parameter extraction agent serves as the entry gate to the LangGraph pipeline. It receives the cumulative conversation transcript and utilizes Gemini structured JSON prompting to extract five mandatory parameters:
    </p>
    <ul>
        <li><strong>Source (`source`):</strong> Origin city or airport (e.g., "Nagpur", "New Delhi", "Mumbai").</li>
        <li><strong>Destination (`destination`):</strong> Target vacation spot (e.g., "Kashmir", "Goa", "Leh Ladakh").</li>
        <li><strong>Budget (`budget`):</strong> Financial ceiling in Indian Rupees (e.g., "₹25,000", "₹50,000").</li>
        <li><strong>Start Date (`start_date`):</strong> Departure date or season (e.g., "15 Nov 2026").</li>
        <li><strong>Duration / Return (`duration_or_return`):</strong> Total duration or return date (e.g., "5 Days", "10 Days").</li>
    </ul>
    <p>
        If any parameter is missing, the agent bypasses expensive tool calls and outputs a targeted, warm inquiry asking specifically for the missing item (e.g., <em>"I'd love to plan your trip to Kashmir! What starting budget in Rupees (₹) should we keep in mind?"</em>).
    </p>

    <h2>4.2 Flight Timetable & Aviation Agent (`analytics/price_prediction.py`)</h2>
    <p>
        Once all parameters are confirmed, the flight timetable agent determines direct and connecting domestic flight routes between the origin and destination airports. It interfaces with the <strong>AviationStack API</strong> to retrieve live airline schedules (IndiGo, Air India, SpiceJet, Akasa Air, Vistara).
    </p>
    <p>
        If external API quotas are exhausted or offline, the system seamlessly transitions to its built-in domestic pricing benchmark matrix. This matrix utilizes route distance and historical seasonal price distributions to output differentiated, carrier-specific timetable fares with flight numbers and departure/arrival slots.
    </p>

    <h2>4.3 Curated Hotels & Sentiment Analysis Pipeline</h2>
    <p>
        Unlike conventional platforms that only list hotel names and star ratings, WanderWise executes an automated NLP sentiment pipeline across customer reviews:
    </p>
    <ul>
        <li><strong>Positive Aspect Extraction:</strong> Flags specific high-rated features such as heated blankets, mountain views, cleanliness, and breakfast quality.</li>
        <li><strong>Constructive Drawback Extraction:</strong> Highlights genuine considerations like distance from the city center, lack of central heating, or steep access stairs.</li>
        <li><strong>Sentiment Score Index:</strong> Computes a numeric confidence score (e.g., <em>4.8/5.0 — 96% Positive Sentiment</em>).</li>
        <li><strong>Google Maps Deep Linking:</strong> Every hotel is verified and linked directly to its official Google Maps location pin (`https://www.google.com/maps/search/?api=1&query=...`).</li>
    </ul>

    <h2>4.4 Multi-Day Weather Outlook & Climate Gear Agent</h2>
    <p>
        The weather agent accesses the <strong>OpenWeatherMap API</strong> for the vacation destination. For itineraries spanning beyond 5 days (e.g., 7 or 10-day trips), the agent dynamically calculates seasonal meteorological models for the exact duration of the journey. It delivers day-by-day temperature ranges (°C), sky conditions (Sunny, Overcast, Snowfall), and actionable packing gear recommendations (thermals, windproof jackets, UV sunglasses).
    </p>

    <h2>4.5 Day-by-Day Time-Slotted Scheduling Agent</h2>
    <p>
        This agent builds realistic daily itineraries divided into three distinct operational blocks:
    </p>
    <ul>
        <li><strong>Morning Block (09:00 AM – 01:00 PM):</strong> Primary sightseeing, monument visits, and outdoor excursions when sunlight and energy levels are optimal.</li>
        <li><strong>Afternoon Block (01:00 PM – 05:00 PM):</strong> Authentic regional lunch dining, indoor museums, heritage walks, or scenic lakeside rest.</li>
        <li><strong>Evening / Night Block (05:00 PM – 09:30 PM):</strong> Sunset viewpoints, local bazaars/shopping, cultural performances, and traditional dinner.</li>
    </ul>

    <h2>4.6 Dynamic Budget Rebalancing Engine (`app.py` &rarr; `/api/update-budget`)</h2>
    <p>
        When a traveler books their flight on IRCTC Air and enters their booked airfare via the modal, the backend invokes the budget rebalancing engine:
    </p>
    <div class="callout">
        <div class="callout-title">Budget Rebalancing Mathematical Model</div>
        <div style="font-family: 'Consolas', monospace; font-size: 9pt; line-height: 1.7; color: #0f172a; margin-top: 6px;">
            <div>&bull; <strong>Remaining Pool</strong> = Total Initial Budget &minus; Booked Airfare</div>
            <div>&bull; <strong>Hotel Stay Allocation (50%)</strong> = Remaining Pool &times; 0.50</div>
            <div>&bull; <strong>Food &amp; Dining Allocation (30%)</strong> = Remaining Pool &times; 0.30</div>
            <div>&bull; <strong>Local Transport &amp; Commute (15%)</strong> = Remaining Pool &times; 0.15</div>
            <div>&bull; <strong>Emergency Contingency Buffer (5%)</strong> = Remaining Pool &times; 0.05</div>
        </div>
    </div>
    <p>
        The plan instantly updates Section 7 (Budget Breakdown) with the real confirmed flight cost and adjusted stay/dining recommendations without breaking any other sections of the itinerary.
    </p>

    <!-- ==================== SECTION 5: API REFERENCE TABLE ==================== -->
    <div class="page-break"></div>
    <h1>5. Complete API Reference Table</h1>
    <p>
        The table below details all internal RESTful endpoints exposed by the WanderWise FastAPI backend:
    </p>

    <table class="data-table">
        <thead>
            <tr>
                <th style="width: 14%;">Method & Endpoint</th>
                <th style="width: 20%;">Request Payload</th>
                <th style="width: 26%;">Response Structure</th>
                <th style="width: 20%;">Auth / Session</th>
                <th style="width: 20%;">Description & Purpose</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><span class="badge badge-get">GET</span> <code>/</code></td>
                <td>None</td>
                <td>HTML Document (with no-cache headers)</td>
                <td>Public / Session</td>
                <td>Serves main single-page application and injects server session state.</td>
            </tr>
            <tr>
                <td><span class="badge badge-post">POST</span> <code>/api/travel</code></td>
                <td><code>{ query, history, current_params, session_id }</code></td>
                <td><code>{ status, answer, parameters_extracted, is_complete, dest_name }</code></td>
                <td>Guest / User</td>
                <td>Main conversational planner endpoint coordinating LangGraph multi-agent execution.</td>
            </tr>
            <tr>
                <td><span class="badge badge-post">POST</span> <code>/api/plan-qa</code></td>
                <td><code>{ question, plan_context, user_location }</code></td>
                <td><code>{ success, answer }</code></td>
                <td>Guest / User</td>
                <td>Contextual in-plan Q&A answering queries with live GPS proximity awareness.</td>
            </tr>
            <tr>
                <td><span class="badge badge-post">POST</span> <code>/api/update-budget</code></td>
                <td><code>{ current_plan, trip_type, outbound_flight, return_flight, ticket_price }</code></td>
                <td><code>{ success, updated_plan, updated_budget, summary }</code></td>
                <td>Guest / User</td>
                <td>Recalculates stay and food allocations after flight tickets are booked.</td>
            </tr>
            <tr>
                <td><span class="badge badge-post">POST</span> <code>/api/send-email</code></td>
                <td><code>{ email, plan_data, params }</code></td>
                <td><code>{ success, message }</code></td>
                <td>User / Email</td>
                <td>Dispatches official formatted travel blueprint directly to traveler's inbox via SMTP SSL.</td>
            </tr>
            <tr>
                <td><span class="badge badge-post">POST</span> <code>/api/auth/simple-login</code></td>
                <td><code>{ email, password, name, action }</code></td>
                <td><code>{ success, user: { id, name, email } }</code></td>
                <td>Session Cookie</td>
                <td>Authenticates or registers user account with Supabase PostgreSQL persistence.</td>
            </tr>
            <tr>
                <td><span class="badge badge-post">POST</span> <code>/auth/google</code></td>
                <td><code>{ credential }</code></td>
                <td><code>{ success, user: { name, email, picture } }</code></td>
                <td>OAuth Token</td>
                <td>Verifies Google One-Tap ID token and provisions user session.</td>
            </tr>
            <tr>
                <td><span class="badge badge-get">GET</span> <code>/logout</code></td>
                <td>None</td>
                <td>302 Redirect to <code>/</code></td>
                <td>Session Clear</td>
                <td>Clears user session cookies and resets authentication state.</td>
            </tr>
            <tr>
                <td><span class="badge badge-get">GET</span> <code>/api/user-plans</code></td>
                <td>Query: <code>user_id</code> / <code>email</code></td>
                <td><code>{ success, plans: [ ... ] }</code></td>
                <td>User Session</td>
                <td>Retrieves all saved travel blueprints stored in Supabase database.</td>
            </tr>
            <tr>
                <td><span class="badge badge-post">POST</span> <code>/api/user-plans</code></td>
                <td><code>{ dest_name, answer, user_query }</code></td>
                <td><code>{ success, plan_id }</code></td>
                <td>User Session</td>
                <td>Stores custom travel blueprint permanently into Supabase database.</td>
            </tr>
            <tr>
                <td><span class="badge badge-delete">DELETE</span> <code>/api/user-plans/{id}</code></td>
                <td>Path parameter: <code>id</code></td>
                <td><code>{ success, message }</code></td>
                <td>User Session</td>
                <td>Deletes a specific saved blueprint from the traveler's database account.</td>
            </tr>
            <tr>
                <td><span class="badge badge-get">GET</span> <code>/api/feedback</code></td>
                <td>None</td>
                <td><code>{ success, feedbacks: [ ... ] }</code></td>
                <td>Public</td>
                <td>Retrieves community traveler feedback and holiday reviews.</td>
            </tr>
            <tr>
                <td><span class="badge badge-post">POST</span> <code>/api/feedback</code></td>
                <td><code>{ name, destination, rating, comment }</code></td>
                <td><code>{ success, feedbacks: [ ... ] }</code></td>
                <td>Public / User</td>
                <td>Saves and publishes new traveler review to community feed.</td>
            </tr>
        </tbody>
    </table>

    <!-- ==================== SECTION 6: EXTERNAL SERVICES TABLE ==================== -->
    <div class="page-break"></div>
    <h1>6. External Services & Third-Party Integrations</h1>
    <p>
        WanderWise AI orchestrates multiple cloud services and public APIs to deliver live real-world information. The table below outlines each third-party provider, its integration purpose, and the resilience fallback mechanism engineered into the system:
    </p>

    <table class="data-table">
        <thead>
            <tr>
                <th style="width: 20%;">External Service</th>
                <th style="width: 18%;">Provider</th>
                <th style="width: 32%;">Primary Function in WanderWise</th>
                <th style="width: 30%;">Failover & Resilience Strategy</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><strong>Google Gemini API</strong></td>
                <td>Google DeepMind</td>
                <td>Natural language comprehension, parameter extraction, 8-section synthesis, and Q&A.</td>
                <td>Configured with automatic retry backoff; structured output fallback prompts.</td>
            </tr>
            <tr>
                <td><strong>AviationStack API</strong></td>
                <td>AviationStack</td>
                <td>Live Indian domestic flight timetables, schedules, carriers, and operational status.</td>
                <td>Offline benchmark pricing engine (`analytics/price_prediction.py`) calculates differentiated domestic fares.</td>
            </tr>
            <tr>
                <td><strong>OpenWeatherMap API</strong></td>
                <td>OpenWeatherMap</td>
                <td>Real-time temperature, multi-day forecasting, rainfall, and sky condition predictions.</td>
                <td>Regional climatological knowledge fallback model generates historical seasonal weather.</td>
            </tr>
            <tr>
                <td><strong>Google Identity Services</strong></td>
                <td>Google Cloud Platform</td>
                <td>Client-side Google One-Tap credential prompt and secure OAuth 2.0 token issuance.</td>
                <td>Instant demo login (`alex@example.com`) and standalone email/password account registration.</td>
            </tr>
            <tr>
                <td><strong>Google Maps Search</strong></td>
                <td>Google LLC</td>
                <td>Deep-linked location URLs for hotels, viewpoints, restaurants, and heritage sites.</td>
                <td>Standard URL encoding scheme (`https://www.google.com/maps/search/?api=1&query=...`) requiring no API keys.</td>
            </tr>
            <tr>
                <td><strong>Supabase PostgreSQL</strong></td>
                <td>Supabase Cloud</td>
                <td>Relational database hosting user accounts, saved plans, and community reviews.</td>
                <td>Browser LocalStorage backup cache ensures offline blueprint access even if DB drops.</td>
            </tr>
            <tr>
                <td><strong>Gmail SMTP Gateway</strong></td>
                <td>Google SMTP</td>
                <td>Direct automated transmission of clean travel blueprint documents over Port 465 SSL.</td>
                <td>Direct HTML / TXT blueprint download buttons allow travelers to save plans locally.</td>
            </tr>
            <tr>
                <td><strong>IRCTC Air Gateway</strong></td>
                <td>IRCTC (Govt. of India)</td>
                <td>Zero-convenience fee domestic air ticketing portal recommendation.</td>
                <td>External direct link with pre-filled route parameters to IRCTC Air domestic portal.</td>
            </tr>
        </tbody>
    </table>

    <!-- ==================== SECTION 7: VIVA VOCE QUESTIONS ==================== -->
    <div class="page-break"></div>
    <h1>7. Top 20 Technical Viva Questions & In-Depth Answers</h1>
    <p>
        This section prepares students and developers for comprehensive project examinations, technical interviews, and viva voce defenses. Every answer provides conceptual definitions, architectural justification, and exact code context.
    </p>

    <!-- Q1 -->
    <div class="qa-card">
        <span class="qa-tag">Architecture & AI</span>
        <div class="qa-q">Q1. What is LangGraph, and why was it chosen over a simple linear LangChain chain for WanderWise?</div>
        <div class="qa-a">
            <strong>Definition:</strong> LangGraph is a library for building stateful, multi-actor applications with LLMs by modeling workflows as directed acyclic and cyclic graphs (StateGraphs).<br>
            <strong>Use Case in WanderWise:</strong> A standard LangChain chain is strictly linear (A &rarr; B &rarr; C) and cannot handle multi-turn conversational loops where parameters are missing. LangGraph introduces a shared state memory and conditional edge routing: if parameters are incomplete, it cycles back to prompt the user; once all 5 parameters exist, it transitions forward to invoke parallel research tools and synthesize the final 8-section plan.
        </div>
    </div>

    <!-- Q2 -->
    <div class="qa-card">
        <span class="qa-tag">LLM & Prompt Engineering</span>
        <div class="qa-q">Q2. How does the parameter extraction mechanism work in `backend.py`?</div>
        <div class="qa-a">
            <strong>Definition:</strong> Parameter extraction is the task of transforming unstructured conversational text into structured key-value entities.<br>
            <strong>Use Case in WanderWise:</strong> The extraction agent instructs Gemini with few-shot JSON schemas to inspect the user's latest message alongside cumulative history. It extracts `source`, `destination`, `budget`, `start_date`, and `duration_or_return`. If any value is not explicitly provided, it remains `null`. The backend evaluates `is_complete = all([source, destination, budget, start_date, duration_or_return])`. Only when `is_complete == True` does the agent trigger full blueprint generation.
        </div>
    </div>

    <!-- Q3 -->
    <div class="qa-card">
        <span class="qa-tag">Algorithms & NLP</span>
        <div class="qa-q">Q3. What is Sentiment Analysis, and how is it specifically applied to hotel curation in this project?</div>
        <div class="qa-a">
            <strong>Definition:</strong> Sentiment analysis is natural language processing that classifies subjective text opinions as positive, negative, or neutral.<br>
            <strong>Use Case in WanderWise:</strong> Rather than relying solely on arbitrary 5-star ratings (which can be manipulated), the Hotel Agent parses verified guest reviews, identifies explicit attributes (room heating, cleanliness, noise, location), computes an aggregate sentiment percentage score, and lists authentic pros and cons in Section 3 of the blueprint.
        </div>
    </div>

    <!-- Q4 -->
    <div class="qa-card">
        <span class="qa-tag">Financial Logic</span>
        <div class="qa-q">Q4. How does the Dynamic Budget Rebalancing Engine work when a traveler clicks "I've Booked"?</div>
        <div class="qa-a">
            <strong>Definition:</strong> Dynamic rebalancing is the automatic real-time recalculation of dependent budgetary variables when one fixed cost is committed.<br>
            <strong>Use Case in WanderWise:</strong> When a user enters their confirmed airfare (e.g., ₹9,500), the backend subtracts this amount from the initial budget ceiling (e.g., ₹25,000 &rarr; ₹15,500 remaining pool). It mathematically redistributes the remainder: 50% for accommodations (₹7,750), 30% for food & dining (₹4,650), 15% for local travel (₹2,325), and 5% for contingency buffer (₹775). It then updates the blueprint's Budget section without disturbing the itinerary.
        </div>
    </div>

    <!-- Q5 -->
    <div class="qa-card">
        <span class="qa-tag">API & Performance</span>
        <div class="qa-q">Q5. Why did you choose FastAPI over traditional frameworks like Flask or Django?</div>
        <div class="qa-a">
            <strong>Definition:</strong> FastAPI is an asynchronous, high-performance web framework for Python based on Starlette and Pydantic.<br>
            <strong>Use Case in WanderWise:</strong> LLM generations and external weather/flight API calls are network I/O-bound operations. FastAPI's native `async/await` execution model handles concurrent user sessions on a single Uvicorn worker without thread blocking. Additionally, Pydantic automatically validates incoming request schemas, eliminating hundreds of lines of manual validation code.
        </div>
    </div>

    <!-- Q6 -->
    <div class="qa-card">
        <span class="qa-tag">Geospatial</span>
        <div class="qa-q">Q6. How does the "Near Me" recommendation feature work without compromising user privacy?</div>
        <div class="qa-a">
            <strong>Definition:</strong> Spatial proximity querying identifies geographic points of interest within a threshold distance of a coordinate pair.<br>
            <strong>Use Case in WanderWise:</strong> WanderWise does NOT track user location continuously or default to a fixed city. Location access is only prompted when the user explicitly clicks the GPS icon or asks a proximity question (e.g., "non-veg restaurants near me"). The browser's HTML5 Geolocation API passes `(latitude, longitude)` to `/api/plan-qa`, which calculates proximity using the Haversine formula and queries relevant nearby venues.
        </div>
    </div>

    <!-- Q7 -->
    <div class="qa-card">
        <span class="qa-tag">Security & Auth</span>
        <div class="qa-q">Q7. Explain the dual authentication flow implemented in the project.</div>
        <div class="qa-a">
            <strong>Definition:</strong> Dual authentication provides both third-party federated OAuth 2.0 identity and native password-based credentials.<br>
            <strong>Use Case in WanderWise:</strong> Users can sign in with one click via <strong>Google Identity Services (GIS)</strong>, which transmits an encrypted Google JWT token verified on the backend with clock skew allowance. Alternatively, users can register with email and password, which is hashed and stored in Supabase PostgreSQL via SQLAlchemy. An unauthenticated visitor clicking "Add to Wishlist" is intercepted by `AuthModal` before persisting data.
        </div>
    </div>

    <!-- Q8 -->
    <div class="qa-card">
        <span class="qa-tag">Database Architecture</span>
        <div class="qa-q">Q8. What database schema is used, and what tables exist in Supabase?</div>
        <div class="qa-a">
            <strong>Definition:</strong> Relational Database Management System (RDBMS) storing normalized entity tables with foreign key constraints.<br>
            <strong>Use Case in WanderWise:</strong> WanderWise uses Supabase PostgreSQL with three primary models:
            <ul>
                <li>`UserRecord`: `id` (PK), `email` (Unique), `name`, `password_hash`, `created_at`.</li>
                <li>`SavedPlan`: `id` (PK), `user_id` (FK), `dest_name`, `answer` (Full 8-Section text), `user_query`, `created_at`.</li>
                <li>`TravelerFeedback`: `id` (PK), `name`, `destination`, `rating` (1–5 Int), `comment`, `created_at`.</li>
            </ul>
        </div>
    </div>

    <!-- Q9 -->
    <div class="qa-card">
        <span class="qa-tag">Frontend & Rendering</span>
        <div class="qa-q">Q9. How does the frontend parse the AI markdown into individual interactive sections?</div>
        <div class="qa-a">
            <strong>Definition:</strong> Text tokenization and regular expression parsing to decompose a monolithic document into a structured array of objects.<br>
            <strong>Use Case in WanderWise:</strong> The function `parseBlueprintSections(markdownText)` scans lines and applies strict regex matching for section numbers (1 through 8) and keywords (e.g., "Flight Timetables", "Curated Hotels"). It deliberately excludes table rows (`| ... |`) and blockquotes so tables are never split. Each section is wrapped in its own card with custom copy buttons, category badges, and active tab filtering.
        </div>
    </div>

    <!-- Q10 -->
    <div class="qa-card">
        <span class="qa-tag">Resilience & Fallbacks</span>
        <div class="qa-q">Q10. What happens if the AviationStack flight API fails or exceeds its monthly rate limit?</div>
        <div class="qa-a">
            <strong>Definition:</strong> Graceful degradation / circuit breaker pattern that provides deterministic fallback data when an external service is unavailable.<br>
            <strong>Use Case in WanderWise:</strong> `analytics/price_prediction.py` contains a domestic benchmark matrix covering key Indian city pairs (e.g., Delhi-Srinagar, Mumbai-Goa, Bangalore-Kochi). If the live API returns a non-200 status code, WanderWise automatically falls back to calculated realistic timetables with carrier-specific price distributions across IndiGo, SpiceJet, and Air India.
        </div>
    </div>

    <!-- Q11 -->
    <div class="qa-card">
        <span class="qa-tag">Networking & Email</span>
        <div class="qa-q">Q11. How is the email dispatching handled in `app.py`, and why was Port 465 SSL chosen?</div>
        <div class="qa-a">
            <strong>Definition:</strong> Simple Mail Transfer Protocol over SSL (SMTPS) providing end-to-end encrypted email transmission.<br>
            <strong>Use Case in WanderWise:</strong> Earlier implementations using Port 587 STARTTLS experienced cloud firewall handshake drops. WanderWise uses direct `smtplib.SMTP_SSL("smtp.gmail.com", 465)` with an app-specific password. Furthermore, instead of sending raw `.html` attachments (which Gmail blocks as malware), WanderWise transmits styled inline HTML with a safe `.txt` attachment, ensuring 100% inbox delivery.
        </div>
    </div>

    <!-- Q12 -->
    <div class="qa-card">
        <span class="qa-tag">Web Standards</span>
        <div class="qa-q">Q12. What are HTTP Cache-Control headers, and why were they added to the root route?</div>
        <div class="qa-a">
            <strong>Definition:</strong> HTTP response headers directing browsers and intermediate proxies whether and how to cache resources.<br>
            <strong>Use Case in WanderWise:</strong> Browsers (especially Google Chrome and Edge on Windows) aggressively cache JavaScript bundles. WanderWise sets `Cache-Control: no-cache, no-store, must-revalidate` and `Pragma: no-cache` on `/`, paired with version-busted asset URLs (`bundle.js?v=13`). This guarantees that whenever backend or frontend updates are deployed, clients immediately receive the latest bundle.
        </div>
    </div>

    <!-- Q13 -->
    <div class="qa-card">
        <span class="qa-tag">Frontend Architecture</span>
        <div class="qa-q">Q13. Why did you precompile React with Babel offline rather than using in-browser Babel Standalone?</div>
        <div class="qa-a">
            <strong>Definition:</strong> Ahead-of-Time (AOT) compilation versus Just-in-Time (JIT) compilation.<br>
            <strong>Use Case in WanderWise:</strong> In-browser Babel Standalone must download the compiler (several MBs), parse JSX into AST, and transpile it at runtime on the client's device, causing white flashes and 2–3 second delays. WanderWise utilizes `node build.js` to compile `static/script.js` into `static/bundle.js` ahead of time, ensuring instant initial page loads and zero runtime compiler overhead.
        </div>
    </div>

    <!-- Q14 -->
    <div class="qa-card">
        <span class="qa-tag">State Management</span>
        <div class="qa-q">Q14. How does WanderWise maintain conversation history across reloads?</div>
        <div class="qa-a">
            <strong>Definition:</strong> Client-side persistence paired with cloud database synchronization.<br>
            <strong>Use Case in WanderWise:</strong> Conversations are partitioned per user account in browser storage under `wanderwise_conversations_<email>`. When a user saves a plan, it is also persisted in Supabase via `POST /api/user-plans`. If a user logs in on a new device, their historical travel blueprints are retrieved from Supabase and populated in the left sidebar drawer.
        </div>
    </div>

    <!-- Q15 -->
    <div class="qa-card">
        <span class="qa-tag">IRCTC Integration</span>
        <div class="qa-q">Q15. Why does WanderWise emphasize IRCTC Air over private aggregators like MakeMyTrip or EaseMyTrip?</div>
        <div class="qa-a">
            <strong>Definition:</strong> Public sector utility integration providing transparent, zero-convenience fee pricing.<br>
            <strong>Use Case in WanderWise:</strong> Private online travel agencies (OTAs) charge high hidden convenience fees (₹300–₹600 per ticket) and display sponsored flight listings. IRCTC Air is an official Government of India portal that offers the lowest convenience fees and free travel insurance. WanderWise acts as an honest fiduciary travel assistant, guiding travelers to official low-cost booking gateways.
        </div>
    </div>

    <!-- Q16 -->
    <div class="qa-card">
        <span class="qa-tag">Error Handling</span>
        <div class="qa-q">Q16. How does the system handle truncated or incomplete AI outputs?</div>
        <div class="qa-a">
            <strong>Definition:</strong> Token limit exhaustion and output validation guarding.<br>
            <strong>Use Case in WanderWise:</strong> In LLM generation, responses can terminate abruptly if the `max_output_tokens` ceiling is too low. WanderWise configures Gemini with `max_output_tokens=8192` and strict structural section instructions. If the final synthesis agent fails to close all 8 sections, the parser detects missing sections and displays the completed sections cleanly while preserving the user's conversation state.
        </div>
    </div>

    <!-- Q17 -->
    <div class="qa-card">
        <span class="qa-tag">Frontend UX</span>
        <div class="qa-q">Q17. What is the purpose of the "Move to the plan" floating button?</div>
        <div class="qa-a">
            <strong>Definition:</strong> In-page viewport navigation anchor.<br>
            <strong>Use Case in WanderWise:</strong> In a long multi-turn chat session, user questions and AI answers stack sequentially below the initial travel blueprint. Travelers asking 5–10 follow-up questions would otherwise have to scroll continuously upwards to inspect hotel or flight details. The floating button provides an instant smooth scroll directly back to `#travel-blueprint-section`.
        </div>
    </div>

    <!-- Q18 -->
    <div class="qa-card">
        <span class="qa-tag">Data Parsing</span>
        <div class="qa-q">Q18. How did you resolve the bug where hotel names were being replaced by "📍 View" badges?</div>
        <div class="qa-a">
            <strong>Definition:</strong> AST / Tokenizer link rewriting conflict.<br>
            <strong>Use Case in WanderWise:</strong> Marked.js allows custom link renderers. Initially, the renderer indiscriminately replaced all Google Maps URLs with `<a ...>📍 View</a>`, which erased actual hotel names like `[The Grand Dragon Ladakh](url)`. The fix in `static/script.js` checks `linkText`: only if the text is empty or a generic phrase ("View on Google Maps", "View") does it render the compact badge; if actual text exists, it preserves the real hotel or attraction name.
        </div>
    </div>

    <!-- Q19 -->
    <div class="qa-card">
        <span class="qa-tag">Real-Time UI</span>
        <div class="qa-q">Q19. How is the real-time countdown on Confirmed Booked Trips calculated?</div>
        <div class="qa-a">
            <strong>Definition:</strong> Epoch timestamp differential arithmetic.<br>
            <strong>Use Case in WanderWise:</strong> In `getDaysRemaining(startDateStr)`, the start date is parsed and compared against the client's current date set to midnight: `diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24))`. If `diffDays > 1`, it renders "Departing in X Days"; if `diffDays === 1`, "Departing Tomorrow!"; if `diffDays === 0`, "Departing Today! ✈️"; if negative, "Trip Completed".
        </div>
    </div>

    <!-- Q20 -->
    <div class="qa-card">
        <span class="qa-tag">Scalability & Future Scope</span>
        <div class="qa-q">Q20. How can WanderWise AI be scaled to handle thousands of concurrent travelers?</div>
        <div class="qa-a">
            <strong>Definition:</strong> Horizontal scaling, asynchronous caching, and state decoupling.<br>
            <strong>Use Case in WanderWise:</strong>
            <ul>
                <li><strong>Stateless FastAPI Nodes:</strong> Run multiple worker processes behind an Nginx or AWS Application Load Balancer.</li>
                <li><strong>Redis Caching Layer:</strong> Cache flight schedules and weather forecasts for common routes (e.g., Delhi-Goa) with a 6-hour TTL, slashing external API costs by 80%.</li>
                <li><strong>Celery / Redis Task Queue:</strong> Offload email transmissions and heavy PDF document rendering to asynchronous background task workers.</li>
                <li><strong>Read Replicas:</strong> Deploy Supabase PostgreSQL read replicas for rapid retrieval of community feedback and saved blueprints.</li>
            </ul>
        </div>
    </div>

</body>
</html>
"""

    with open(html_file, "w", encoding="utf-8") as f:
        f.write(html_content)
    
    print(f"HTML documentation generated: {html_file}")
    
    # Render PDF using headless Chrome
    chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    if not os.path.exists(chrome_path):
        chrome_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    
    cmd = [
        chrome_path,
        "--headless",
        "--disable-gpu",
        f"--print-to-pdf={pdf_file}",
        "--no-pdf-header-footer",
        html_file
    ]
    
    print("Converting HTML to PDF via Headless Chrome...")
    subprocess.run(cmd, check=True)
    
    if os.path.exists(pdf_file) and os.path.getsize(pdf_file) > 1000:
        print(f"SUCCESS! PDF created at: {pdf_file} ({os.path.getsize(pdf_file):,} bytes)")
    else:
        print("ERROR: PDF was not created or empty.")

if __name__ == "__main__":
    build_pdf()
