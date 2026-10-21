const { useState, useEffect, useRef, useMemo, useCallback } = React;

// Global marked renderer configuration for clean Google Maps links
if (typeof marked !== "undefined") {
    try {
        const renderer = new marked.Renderer();
        renderer.link = function(href, title, text) {
            let linkHref = href;
            let linkText = text;
            let linkTitle = title;
            if (typeof href === 'object' && href !== null) {
                linkHref = href.href;
                linkText = href.text;
                linkTitle = href.title;
            }
            if (linkHref && (linkHref.includes("google.com/maps") || linkHref.includes("maps.google.com") || linkHref.includes("goo.gl/maps"))) {
                let cleanText = (linkText || "").trim();
                // If it's a generic phrase or empty, render as compact '📍 View' badge
                if (!cleanText || /^(?:view on google maps|google maps|view on maps|view|maps link|\(?view\)?|📍\s*view)$/i.test(cleanText)) {
                    return `<a href="${linkHref}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-2 py-0.5 ml-1 bg-orange-100 hover:bg-sunset text-sunset hover:text-white rounded-md text-xs font-bold transition-all shadow-xs decoration-0 not-prose" title="Open location in Google Maps">📍 View</a>`;
                }
                // If it has actual content (like hotel name or attraction name), preserve and render the hotel name with an icon!
                return `<a href="${linkHref}" target="_blank" rel="noopener noreferrer" class="text-sunset underline hover:text-sunset-hover font-bold inline-flex items-center gap-1" title="${linkTitle || cleanText}">${cleanText}</a>`;
            }
            return `<a href="${linkHref}" target="_blank" rel="noopener noreferrer" class="text-sunset underline hover:text-sunset-hover font-semibold" title="${linkTitle || ''}">${linkText}</a>`;
        };
        marked.use({ renderer });
    } catch(e) {
        console.warn("Could not configure custom marked renderer:", e);
    }
}

// Data normalization helper functions for reliable, crash-free rendering
function normalizeWishlistItem(d) {
    if (!d) return null;
    if (typeof d === 'string') {
        const trimmed = d.trim();
        if (!trimmed) return null;
        return {
            name: trimmed,
            img: "https://images.unsplash.com/photo-1595815771614-ade9d652a65d?auto=format&fit=crop&w=400&q=80",
            tag: "Getaway"
        };
    }
    if (typeof d === 'object') {
        const name = (d.name || d.title || d.destName || "").trim();
        if (!name) return null;
        return {
            name: name,
            img: d.img || d.image || "https://images.unsplash.com/photo-1595815771614-ade9d652a65d?auto=format&fit=crop&w=400&q=80",
            tag: d.tag || d.badge || d.category || "Getaway"
        };
    }
    return null;
}

function normalizeConfirmedTrip(t) {
    if (!t || typeof t !== 'object') return null;
    const destName = (t.destName || t.destination || "").trim();
    if (!destName) return null;
    return {
        id: t.id || "trip_" + Math.random().toString(36).substring(2, 9),
        destName: destName,
        source: t.source || "Origin",
        startDate: t.startDate || null,
        duration: t.duration || "Multi-day",
        flightSummary: t.flightSummary || "Flights Confirmed",
        flightPrice: typeof t.flightPrice === 'number' ? t.flightPrice : (parseFloat(t.flightPrice) || 0),
        remainingBudget: t.remainingBudget || "Allocated",
        status: t.status || "Confirmed",
        image: t.image || t.img || "https://images.unsplash.com/photo-1595815771614-ade9d652a65d?auto=format&fit=crop&w=300&q=80",
        planData: t.planData || null
    };
}

function normalizeSavedPlan(p) {
    if (!p || typeof p !== 'object') return null;
    const destName = (p.dest_name || p.destination || p.destName || "").trim();
    if (!destName) return null;
    return {
        id: p.id || Math.random().toString(36).substring(2, 9),
        dest_name: destName,
        user_query: p.user_query || p.query || "Custom Holiday Plan",
        created_at: p.created_at || "Recent",
        answer: p.answer || p.final_answer || ""
    };
}

// Clean repetitive 'View on Google Maps' and auto-link hotels in Section 3
function formatBlueprintMarkdown(content, sectionId, destName = "India") {
    if (!content) return "";
    let formatted = content;

    // 1. Simplify repetitive markdown links to clean [📍 View](url)
    formatted = formatted.replace(/\[\s*(?:\(?View on Google Maps\)?|Google Maps|View on Maps)\s*\]\((https?:\/\/[^\s\)]+)\)/gi, "[📍 View]($1)");
    formatted = formatted.replace(/\(?\s*(?:View on Google Maps|Google Maps):\s*(https?:\/\/[^\s\)]+)\s*\)?/gi, "([📍 View]($1))");

    // 2. Curated Hotels: auto-link hotel names to Google Maps if not already linked (both bullet points and table cells)
    if (sectionId === "hotels") {
        formatted = formatted.replace(/^([ \t]*[-*]\s+\*\*)([A-Z0-9][^*\[\]\n]+)(\*\*)([^\n]*)/gm, (match, prefix, hotelName, suffix, rest) => {
            const cleanHotel = hotelName.split('(')[0].trim();
            if (cleanHotel.length < 3 || cleanHotel.includes("http")) return match;
            const query = encodeURIComponent(`${cleanHotel} hotel ${destName}`);
            const mapUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
            return `${prefix}[${hotelName} 📍](${mapUrl})${suffix}${rest}`;
        });
        // Auto-link table cell hotel names: | City | **Hotel Name** | ...
        formatted = formatted.replace(/^(\|[ \t]*[^|\n]+[ \t]*\|[ \t]*\*\*?)([A-Za-z0-9\s'.-]+?)(\*\*?[ \t]*\|)/gm, (match, prefix, hotelName, suffix) => {
            if (hotelName.includes("[") || hotelName.includes("📍") || hotelName.toLowerCase().includes("hotel &") || hotelName.toLowerCase().includes("hotel name")) return match;
            const clean = hotelName.trim();
            if (clean.length < 3) return match;
            const query = encodeURIComponent(`${clean} hotel ${destName}`);
            const mapUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
            return `${prefix}[${clean} 📍](${mapUrl})${suffix}`;
        });
    }

    return formatted;
}

// ============================================================
// UNSPLASH CURATED TRAVEL ASSETS
// ============================================================

const HERO_SLIDES = [
    {
        image: "https://images.unsplash.com/photo-1595815771614-ade9d652a65d?auto=format&fit=crop&w=1920&q=85",
        tag: "Himalayan Paradise",
        headline: "Snow Peaks & Dal Lake Shikhara Glides",
        location: "Kashmir Valley & Gulmarg"
    },
    {
        image: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1920&q=85",
        tag: "Coastal Bliss",
        headline: "Golden Sands & Arabian Sea Sunsets",
        location: "Goa Beaches & Palm Groves"
    },
    {
        image: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=1920&q=85",
        tag: "God's Own Country",
        headline: "Emerald Backwaters & Misty Tea Hills",
        location: "Alleppey & Munnar, Kerala"
    },
    {
        image: "https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=1920&q=85",
        tag: "Royal Heritage",
        headline: "Grand Forts, Lake Palaces & Living History",
        location: "Jaipur & Udaipur, Rajasthan"
    }
];

const DESTINATIONS = [
    {
        name: "Gulmarg & Dal Lake, Kashmir",
        category: "Snow Peaks & Valleys",
        image: "https://images.unsplash.com/photo-1595815771614-ade9d652a65d?auto=format&fit=crop&w=800&q=80",
        description: "Snow-dusted Gulmarg ski slopes, iconic Dal Lake houseboats, fragrant apple orchards, and Gondola rides.",
        badge: "Top Domestic Pick",
        flightTime: "Direct to Srinagar (SXR)",
        rating: "4.96"
    },
    {
        name: "Goa Shores & Calangute",
        category: "Beaches & Night Markets",
        image: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=800&q=80",
        description: "Sun-drenched beaches, Portuguese colonial villas, fresh seafood shacks, and vibrant coastal nightlife.",
        badge: "Most Popular",
        flightTime: "Direct to Goa (GOI/GOX)",
        rating: "4.92"
    },
    {
        name: "Alleppey & Munnar, Kerala",
        category: "Backwaters & Tea Hills",
        image: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=800&q=80",
        description: "Serene private houseboat cruises through tranquil canals, lush misty tea estates, and spice gardens.",
        badge: "Nature Sanctuary",
        flightTime: "Direct to Cochin (COK)",
        rating: "4.94"
    },
    {
        name: "Jaipur & Udaipur, Rajasthan",
        category: "Palaces & Fortresses",
        image: "https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=800&q=80",
        description: "Regal Amber Fort, romantic Pichola Lake palaces, puppet folk dances, and vibrant handicraft bazaars.",
        badge: "Royal Heritage",
        flightTime: "Direct to Jaipur / Udaipur",
        rating: "4.91"
    },
    {
        name: "Manali & Solang Valley, Himachal",
        category: "Snow & Adventure",
        image: "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=800&q=80",
        description: "Snowcapped Solang valley, Rohtang Pass, cedar pine forests, river rafting in Beas, and cozy wooden chalets.",
        badge: "Mountain Escape",
        flightTime: "Via Chandigarh / Bhuntar",
        rating: "4.93"
    },
    {
        name: "Havelock Island, Andaman",
        category: "Islands & Coral Reefs",
        image: "https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?auto=format&fit=crop&w=800&q=80",
        description: "Award-winning Radhanagar Beach, turquoise tropical waters, mangrove boat rides, and snorkeling.",
        badge: "Exotic Island",
        flightTime: "Direct to Port Blair (IXZ)",
        rating: "4.97"
    }
];

const TRAVELER_QUOTES = [
    {
        quote: "WanderWise planned our family trip to Kashmir flawlessly! The Shikara ride on Dal Lake and Gondola at Gulmarg were unforgettable.",
        author: "Vikram & Ananya Sharma",
        location: "Visited Gulmarg & Srinagar, Kashmir",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
        stars: 5
    },
    {
        quote: "Direct IRCTC Air flight booking advice and day-wise time blocks saved us hours. We had the most relaxing vacation in South Goa.",
        author: "Rajesh Patel",
        location: "Visited South Goa & Palolem",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80",
        stars: 5
    },
    {
        quote: "The private houseboat stay in Alleppey and tea plantations in Munnar were breathtaking. Exact Google Maps links made getting around so easy.",
        author: "Priya Nair",
        location: "Visited Alleppey & Munnar, Kerala",
        avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80",
        stars: 5
    },
    {
        quote: "Everything in Indian Rupees with zero hidden costs. Solang Valley snow adventure was perfectly timed with clear morning slots.",
        author: "Arjun & Neha Mehta",
        location: "Visited Manali, Himachal Pradesh",
        avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80",
        stars: 5
    }
];

// ============================================================
// MAIN APPLICATION COMPONENT
// ============================================================

// ============================================================
// GOOGLE OAUTH ONE-TAP & BUTTON COMPONENT
// ============================================================

function GoogleSignInButton({ onAuthSuccess }) {
    const googleRef = useRef(null);

    useEffect(() => {
        const clientId = window.GOOGLE_CLIENT_ID;
        if (!clientId) return;

        const handleCredential = async (response) => {
            if (!response.credential) return;
            try {
                const res = await fetch("/auth/google", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ credential: response.credential })
                });
                const data = await res.json().catch(() => null);
                if (res.ok && data && data.success) {
                    if (onAuthSuccess) {
                        onAuthSuccess(data.user);
                    } else {
                        window.USER_DATA = data.user;
                        try { localStorage.setItem("wanderwise_user", JSON.stringify(data.user)); } catch(e){}
                        window.location.reload();
                    }
                } else {
                    const errorMsg = (data && data.error) ? data.error : "Google Sign-In failed. Please try again or sign in with your email.";
                    console.error("Google authentication error:", errorMsg);
                    if (window.showAuthError) {
                        window.showAuthError(errorMsg);
                    } else {
                        alert(errorMsg);
                    }
                }
            } catch (e) {
                console.error("Google authentication fetch error:", e);
                if (window.showAuthError) {
                    window.showAuthError("Connection error during Google Sign-In. Please try again.");
                } else {
                    alert("Connection error during Google Sign-In. Please try again.");
                }
            }
        };

        const checkAndRender = () => {
            if (window.google?.accounts?.id && googleRef.current) {
                try {
                    window.google.accounts.id.initialize({
                        client_id: clientId,
                        callback: handleCredential,
                        auto_select: false
                    });
                    googleRef.current.innerHTML = "";
                    window.google.accounts.id.renderButton(
                        googleRef.current,
                        {
                            type: "standard",
                            theme: "outline",
                            size: "large",
                            text: "continue_with",
                            shape: "rectangular",
                            width: 320
                        }
                    );
                } catch (e) {
                    console.warn("Google button render:", e);
                }
            }
        };

        checkAndRender();
        const timer = setInterval(checkAndRender, 300);
        const killer = setTimeout(() => clearInterval(timer), 3500);
        return () => { clearInterval(timer); clearTimeout(killer); };
    }, [onAuthSuccess]);

    if (!window.GOOGLE_CLIENT_ID) return null;

    return (
        <div className="flex flex-col items-center justify-center my-2 w-full overflow-hidden">
            <div ref={googleRef} className="min-h-[44px] flex items-center justify-center"></div>
        </div>
    );
}

// ============================================================
// POP-UP AUTHENTICATION MODAL (SIGN IN / SIGN UP PLEASE)
// ============================================================

function AuthModal({ isOpen, onClose, initialTab = "signin", message, onAuthSuccess }) {
    if (!isOpen) return null;
    const [tab, setTab] = useState(initialTab);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);
    const [notice, setNotice] = useState("");

    useEffect(() => {
        setTab(initialTab);
        setNotice("");
    }, [initialTab, isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setNotice("");
        try {
            const res = await fetch("/api/auth/simple-login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, name, action: tab })
            });
            const data = await res.json();
            if (res.ok && data.success && data.user) {
                onAuthSuccess(data.user);
                onClose();
            } else {
                setNotice(data.error || "Authentication failed. Please verify your details.");
            }
        } catch(err) {
            setNotice("Connection error. Please try again in a moment.");
        } finally {
            setLoading(false);
        }
    };

    const handleDemoLogin = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/auth/simple-login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: "alex@example.com", name: "Alex Rivers", action: "signin" })
            });
            const data = await res.json();
            if (res.ok && data.success && data.user) {
                onAuthSuccess(data.user);
                onClose();
            }
        } catch(e){}
        finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-4 animate-fade-in relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 text-sm font-bold"
                >
                    ✕
                </button>

                <div className="text-center space-y-1.5 pt-1">
                    <div className="w-12 h-12 bg-orange-100 text-sunset rounded-2xl flex items-center justify-center text-2xl mx-auto shadow-xs">
                        ✈️
                    </div>
                    <h3 className="font-heading font-extrabold text-xl text-slate-900">
                        {tab === "signin" ? "Sign In Please" : "Sign Up Please"}
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        {message || (tab === "signin"
                            ? "Sign in to save plans, track confirmed upcoming trips, and access your traveler lounge."
                            : "Create your free traveler profile to save custom itineraries and track your getaways.")}
                    </p>
                </div>

                <div className="flex border-b border-slate-100 gap-6 justify-center">
                    <button
                        onClick={() => { setTab("signin"); setNotice(""); }}
                        className={`pb-2.5 text-xs font-bold transition border-b-2 ${tab === "signin" ? "border-sunset text-sunset" : "border-transparent text-slate-400 hover:text-slate-700"}`}
                    >
                        Sign In
                    </button>
                    <button
                        onClick={() => { setTab("signup"); setNotice(""); }}
                        className={`pb-2.5 text-xs font-bold transition border-b-2 ${tab === "signup" ? "border-sunset text-sunset" : "border-transparent text-slate-400 hover:text-slate-700"}`}
                    >
                        Create Account
                    </button>
                </div>

                {notice && (
                    <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-semibold">
                        {notice}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3.5 text-left text-xs">
                    {tab === "signup" && (
                        <div>
                            <label className="block font-bold text-slate-700 mb-1">Your Full Name</label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Alex Rivers"
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sunset/30"
                            />
                        </div>
                    )}

                    <div>
                        <label className="block font-bold text-slate-700 mb-1">Email Address</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sunset/30"
                        />
                    </div>

                    <div>
                        <label className="block font-bold text-slate-700 mb-1">Password</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Your password"
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sunset/30"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-gradient-to-r from-sunset to-sunset-hover text-white rounded-xl font-bold shadow-md hover:shadow-lg transition flex items-center justify-center gap-1.5 disabled:opacity-40"
                    >
                        {loading ? "Processing..." : (tab === "signin" ? "Sign In ➔" : "Create Travel Account ➔")}
                    </button>
                </form>

                <div className="relative my-2 text-center">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                    <span className="relative px-2 bg-white text-[11px] text-slate-400 font-semibold uppercase">Or</span>
                </div>

                <GoogleSignInButton onAuthSuccess={(u) => { onAuthSuccess(u); onClose(); }} />

                <button
                    type="button"
                    onClick={handleDemoLogin}
                    disabled={loading}
                    className="w-full py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl text-xs font-bold border border-amber-200 transition flex items-center justify-center gap-1.5"
                >
                    <span>✨</span>
                    <span>1-Click Demo Traveler Login</span>
                </button>
            </div>
        </div>
    );
}


// ============================================================
// SECTION-WISE / BLOCK-WISE BLUEPRINT PARSER & RENDERER
// ============================================================

function parseBlueprintSections(markdownText) {
    if (!markdownText) return [];

    const sectionDefs = [
        { id: "summary", num: "1", title: "Trip Summary & Overview", icon: "🌟", badge: "Overview", borderClass: "border-amber-300", headerBg: "bg-amber-50/80", keys: ["trip summary", "summary & overview", "overview"] },
        { id: "flights", num: "2", title: "Flight Timetables & IRCTC Air Booking", icon: "✈️", badge: "Official Air", borderClass: "border-sky-300", headerBg: "bg-sky-50/80", keys: ["flight timetable", "flight timetables", "irctc air", "flight booking"] },
        { id: "hotels", num: "3", title: "Curated Hotels & Sentiment Analysis", icon: "🏨", badge: "Verified Reviews", borderClass: "border-emerald-300", headerBg: "bg-emerald-50/80", keys: ["curated hotel", "curated hotels", "hotel & sentiment", "sentiment analysis"] },
        { id: "weather", num: "4", title: "Weather Outlook & Packing Guide", icon: "☀️", badge: "Climate & Gear", borderClass: "border-yellow-300", headerBg: "bg-yellow-50/80", keys: ["weather outlook", "weather forecast", "packing guide"] },
        { id: "attractions", num: "5", title: "Must-Visit Attractions & Sightseeing", icon: "📍", badge: "Google Maps Ready", borderClass: "border-rose-300", headerBg: "bg-rose-50/80", keys: ["must-visit attraction", "must-visit attractions", "attractions & sightseeing", "sightseeing & attractions", "must-visit", "sightseeing", "attractions"] },
        { id: "itinerary", num: "6", title: "Day-by-Day Time-Slotted Schedule", icon: "📅", badge: "Morning to Night Plan", borderClass: "border-indigo-300", headerBg: "bg-indigo-50/80", keys: ["itinerary", "day-by-day", "day to day", "day-to-day", "day wise", "day-wise", "daily itinerary", "time-slotted schedule", "time slotted schedule", "schedule", "daily plan", "day plans", "day-by-day schedule"] },
        { id: "budget", num: "7", title: "Estimated Budget Breakdown (₹)", icon: "💰", badge: "Rupee Estimates", borderClass: "border-teal-300", headerBg: "bg-teal-50/80", keys: ["estimated budget", "budget breakdown", "estimated budget breakdown", "budget"] },
        { id: "tips", num: "8", title: "Regional Cuisine Highlights & Tips", icon: "💡", badge: "Culture & Dining", borderClass: "border-purple-300", headerBg: "bg-purple-50/80", keys: ["regional cuisine", "cuisine highlights", "regional cuisine highlights", "local tips", "travel tips"] }
    ];

    const lines = markdownText.split("\n");
    const foundSections = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Table rows, code blocks, and blockquotes can NEVER be section headers!
        if (line.startsWith("|") || line.startsWith("```") || line.startsWith(">")) continue;
        // Bullet list lines (unless bold numbered section) are not section headers
        if (/^[\*\-]\s+(?!\*\*?[1-8])/.test(line)) continue;

        const lower = line.toLowerCase();

        for (const def of sectionDefs) {
            if (foundSections.some(s => s.def.id === def.id)) continue;

            // Strict Section Header matching:
            // 1. Matches section number: e.g. "1.", "1 -", "section 1", "### 1.", "**1."
            const numRegex = new RegExp(`(?:^|[#*\\s(])(?:section\\s+)?0?${def.num}[.:)\\s-]`, 'i');
            const hasNum = numRegex.test(lower);
            const hasKey = def.keys.some(k => lower.includes(k));
            const hasIcon = line.includes(def.icon);
            const isMarkdownHeader = /^#{1,4}\s+/.test(line) || /^\*\*[^*]+\*\*$/.test(line);

            // A valid section header must have (Section Number + (Key OR Icon)) OR (Markdown Header + Key)
            if ((hasNum && (hasKey || hasIcon)) || (isMarkdownHeader && hasKey)) {
                foundSections.push({
                    def,
                    lineIndex: i
                });
                break;
            }
        }
    }

    let sections = [];
    if (foundSections.length >= 2) {
        foundSections.sort((a, b) => a.lineIndex - b.lineIndex);

        for (let j = 0; j < foundSections.length; j++) {
            const cur = foundSections[j];
            const startLine = cur.lineIndex + 1;
            const endLine = (j + 1 < foundSections.length) ? foundSections[j + 1].lineIndex : lines.length;
            const content = lines.slice(startLine, endLine).join("\n").trim();
            sections.push({
                ...cur.def,
                content: content
            });
        }
    } else {
        // Fallback default full plan
        sections = [{
            id: "full",
            num: "1",
            title: "Complete Travel Blueprint",
            icon: "🌟",
            badge: "Complete Guide",
            borderClass: "border-amber-300",
            headerBg: "bg-amber-50",
            content: markdownText
        }];
    }

    // STRICT GUARANTEE: Never leak Day-by-Day itinerary into Section 5 (Attractions)
    // and ensure Section 6 (Itinerary) is never blank!
    const attrSec = sections.find(s => s.id === "attractions");
    const itinSec = sections.find(s => s.id === "itinerary");

    if (attrSec && attrSec.content) {
        const attrLines = attrSec.content.split("\n");
        let splitIdx = -1;

        for (let k = 0; k < attrLines.length; k++) {
            const rawL = attrLines[k].trim();
            const cleanL = rawL.replace(/^[#*\s\-]+/, '').replace(/^[*_]+/, '').trim();
            // Look for where Day 1 or Section 6 starts
            if (
                /^(?:6[.:\s-]|Day\s*0?1\b|Daily\s+Itinerary|Time-Slotted)/i.test(cleanL) ||
                /^#{1,4}\s*(?:6[.:\s-]|Day\s*0?1\b|Itinerary)/i.test(rawL) ||
                /^\*\*(?:6[.:\s-]|Day\s*0?1\b)/i.test(rawL)
            ) {
                splitIdx = k;
                break;
            }
        }

        if (splitIdx >= 0) {
            const pureAttractions = attrLines.slice(0, splitIdx).join("\n").trim();
            const leakedItinerary = attrLines.slice(splitIdx).join("\n").trim();
            attrSec.content = pureAttractions;

            if (itinSec) {
                if (!itinSec.content || itinSec.content.trim().length < 50) {
                    itinSec.content = leakedItinerary;
                }
            } else if (leakedItinerary.length > 0) {
                const def6 = sectionDefs.find(s => s.id === "itinerary");
                const newItinSec = {
                    ...def6,
                    content: leakedItinerary
                };
                const attrPos = sections.findIndex(s => s.id === "attractions");
                sections.splice(attrPos + 1, 0, newItinSec);
            }
        }
    }

    return sections;
}

function InteractiveDayItineraryView({ content, destName }) {
    const [selectedDay, setSelectedDay] = useState("all");

    // Extract day blocks
    const days = useMemo(() => {
        if (!content) return [];
        const lines = content.split('\n');
        const parsed = [];
        let cur = null;

        const isDayHeader = (line) => {
            const clean = line.replace(/^[#*\s\-]+/, '').replace(/^[*_]+/, '').trim();
            return /^Day\s*0?(\d+)[:\s\-\–\s]/i.test(clean);
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (isDayHeader(line)) {
                if (cur) {
                    cur.content = cur.lines.join('\n').trim();
                    parsed.push(cur);
                }
                const clean = line.replace(/^[#*\s\-]+/, '').replace(/^[*_]+/, '').trim();
                const m = clean.match(/^Day\s*0?(\d+)[:\s\-\–\s]*(.*)/i);
                const num = m ? m[1] : `${parsed.length + 1}`;
                const rawTitle = m && m[2] ? m[2].replace(/[*#_]+$/, '').trim() : `Day ${num} Plan`;
                cur = {
                    num: num,
                    label: `Day ${num}`,
                    fullTitle: clean,
                    subtitle: rawTitle || `Day ${num}`,
                    lines: [line]
                };
            } else if (cur) {
                cur.lines.push(line);
            }
        }
        if (cur) {
            cur.content = cur.lines.join('\n').trim();
            parsed.push(cur);
        }
        return parsed;
    }, [content]);

    if (!days || days.length === 0) {
        return (
            <div
                className="markdown-content text-slate-700 leading-relaxed text-xs sm:text-sm"
                dangerouslySetInnerHTML={{ __html: marked.parse(formatBlueprintMarkdown(content || '', 'itinerary', destName)) }}
            />
        );
    }

    const curIndex = days.findIndex(d => d.num === selectedDay);

    return (
        <div className="space-y-5">
            {/* Day Selector Pills Bar */}
            <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar shadow-xs">
                <button
                    onClick={() => setSelectedDay("all")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                        selectedDay === "all"
                            ? "bg-indigo-600 text-white shadow-xs"
                            : "bg-white hover:bg-indigo-100 text-indigo-900 border border-indigo-200"
                    }`}
                >
                    <span>📅</span>
                    <span>All Days ({days.length} Days)</span>
                </button>
                {days.map(d => (
                    <button
                        key={d.num}
                        onClick={() => setSelectedDay(d.num)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                            selectedDay === d.num
                                ? "bg-gradient-to-r from-sunset to-sunset-hover text-white shadow-xs"
                                : "bg-white hover:bg-orange-50 hover:text-sunset text-slate-700 border border-slate-200"
                        }`}
                        title={d.fullTitle}
                    >
                        <span>☀️</span>
                        <span>{d.label}</span>
                    </button>
                ))}
            </div>

            {/* If Single Day Selected: Focused Day Card with Prev / Next */}
            {selectedDay !== "all" && (
                <div className="bg-slate-50/70 border border-slate-200 rounded-3xl p-5 sm:p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                        <div className="space-y-0.5">
                            <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded-full uppercase tracking-wider">
                                Active Day Focus
                            </span>
                            <h4 className="font-heading font-extrabold text-base sm:text-lg text-slate-900">
                                {days[curIndex]?.fullTitle}
                            </h4>
                        </div>
                        <div className="flex items-center gap-2">
                            {curIndex > 0 && (
                                <button
                                    onClick={() => setSelectedDay(days[curIndex - 1].num)}
                                    className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition flex items-center gap-1 shadow-xs"
                                >
                                    <span>⬅️</span>
                                    <span>Day {days[curIndex - 1].num}</span>
                                </button>
                            )}
                            {curIndex < days.length - 1 && (
                                <button
                                    onClick={() => setSelectedDay(days[curIndex + 1].num)}
                                    className="px-3 py-1.5 bg-gradient-to-r from-sunset to-sunset-hover text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs"
                                >
                                    <span>Day {days[curIndex + 1].num}</span>
                                    <span>➡️</span>
                                </button>
                            )}
                            <button
                                onClick={() => setSelectedDay("all")}
                                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-semibold transition"
                            >
                                View All Days
                            </button>
                        </div>
                    </div>

                    <div
                        className="markdown-content text-slate-700 leading-relaxed text-xs sm:text-sm"
                        dangerouslySetInnerHTML={{ __html: marked.parse(formatBlueprintMarkdown(days[curIndex]?.content || '', 'itinerary', destName)) }}
                    />
                </div>
            )}

            {/* If All Days Selected: Clean Structured Day Cards */}
            {selectedDay === "all" && (
                <div className="space-y-4">
                    {days.map((d) => (
                        <div key={d.num} className="bg-slate-50/50 hover:bg-slate-50 border border-slate-200/90 rounded-2xl p-5 space-y-3 transition">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                                <div className="flex items-center gap-2">
                                    <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                                        {d.num}
                                    </span>
                                    <h5 className="font-heading font-extrabold text-sm sm:text-base text-slate-900">
                                        {d.fullTitle}
                                    </h5>
                                </div>
                                <button
                                    onClick={() => setSelectedDay(d.num)}
                                    className="text-xs text-sunset hover:underline font-semibold"
                                >
                                    Focus this day ➔
                                </button>
                            </div>
                            <div
                                className="markdown-content text-slate-700 leading-relaxed text-xs sm:text-sm"
                                dangerouslySetInnerHTML={{ __html: marked.parse(formatBlueprintMarkdown(d.content || '', 'itinerary', destName)) }}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function InteractivePackingChecklist({ content, destName }) {
    // Parse weather table vs packing checklist
    const { weatherMarkdown, initialItems } = useMemo(() => {
        if (!content) return { weatherMarkdown: "", initialItems: [] };
        const lines = content.split('\n');
        const weatherLines = [];
        const items = [];
        let inPacking = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lower = line.toLowerCase();
            if (lower.includes("packing essential") || lower.includes("packing guide") || lower.includes("packing checklist")) {
                inPacking = true;
            }

            if (inPacking) {
                // Task box or bullet point
                const taskMatch = line.match(/^[\*\s\-]*\[([ xX])\]\s*(.*)/);
                if (taskMatch) {
                    items.push({
                        id: `item-${items.length}`,
                        text: taskMatch[2].trim(),
                        checked: taskMatch[1].toLowerCase() === 'x'
                    });
                } else if (/^[\*\-]\s+/.test(line.trim())) {
                    const clean = line.trim().replace(/^[\*\-]\s+/, '').trim();
                    if (clean && !clean.toLowerCase().includes("packing essential")) {
                        items.push({
                            id: `item-${items.length}`,
                            text: clean,
                            checked: false
                        });
                    }
                }
            } else {
                weatherLines.push(line);
            }
        }

        // If no explicit packing items were parsed, provide standard default essentials for domestic travel
        if (items.length === 0) {
            [
                "🧥 Heavy woolens / thermal layers & windproof jacket",
                "🥾 Waterproof trekking boots / sturdy walking sneakers",
                "💊 Personal medical kit (AMS tablets, pain relievers, band-aids)",
                "🧴 High-SPF sunscreen, lip balm & UV sunglasses",
                "🔌 High-capacity power bank & universal charger",
                "🪪 Government ID proofs (Aadhaar / Voter ID / Passport) & travel permits"
            ].forEach((it, idx) => {
                items.push({ id: `def-${idx}`, text: it, checked: false });
            });
        }

        return {
            weatherMarkdown: weatherLines.join('\n').trim(),
            initialItems: items
        };
    }, [content]);

    const [checkedState, setCheckedState] = useState({});

    const toggleItem = (id) => {
        setCheckedState(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const totalCount = initialItems.length;
    const completedCount = initialItems.filter(it => checkedState[it.id]).length;
    const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return (
        <div className="space-y-6">
            {/* 1. Weather Table */}
            {weatherMarkdown && (
                <div
                    className="markdown-content text-slate-700 leading-relaxed text-xs sm:text-sm"
                    dangerouslySetInnerHTML={{ __html: marked.parse(formatBlueprintMarkdown(weatherMarkdown, 'weather', destName)) }}
                />
            )}

            {/* 2. Interactive Packing Essentials Checklist */}
            <div className="bg-amber-50/60 border-2 border-amber-200/90 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-200/70">
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                            <span className="text-base">🎒</span>
                            <h4 className="font-heading font-extrabold text-sm sm:text-base text-slate-900">
                                Interactive Packing Essentials Checklist
                            </h4>
                        </div>
                        <p className="text-[11px] text-slate-500">
                            Check items off as you pack your bags for {destName}.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <span className="text-xs font-bold text-amber-950">
                                {completedCount} of {totalCount} Packed
                            </span>
                            <div className="w-28 sm:w-36 h-2 bg-amber-200/70 rounded-full overflow-hidden mt-1">
                                <div
                                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-300"
                                    style={{ width: `${progressPct}%` }}
                                ></div>
                            </div>
                        </div>
                        {completedCount === totalCount && totalCount > 0 && (
                            <span className="px-2 py-1 bg-emerald-100 border border-emerald-300 text-emerald-800 text-[10px] font-bold rounded-lg animate-bounce">
                                Ready to Travel! ✈️
                            </span>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {initialItems.map((item) => {
                        const isChecked = !!checkedState[item.id];
                        return (
                            <label
                                key={item.id}
                                onClick={() => toggleItem(item.id)}
                                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                                    isChecked
                                        ? "bg-emerald-50/80 border-emerald-300 text-slate-500 line-through"
                                        : "bg-white border-slate-200 hover:border-amber-300 text-slate-800 hover:shadow-xs"
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {}}
                                    className="mt-0.5 w-4 h-4 rounded text-sunset focus:ring-sunset accent-sunset cursor-pointer"
                                />
                                <span className={`text-xs font-medium leading-snug ${isChecked ? "opacity-75" : ""}`}>
                                    {item.text}
                                </span>
                            </label>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function EmergencyHospitalModal({ isOpen, onClose, emergencyData, isLoading, openEmergencyModal, userLocation }) {
    if (!isOpen) return null;
    const hospitals = emergencyData?.hospitals || [];
    const city = emergencyData?.city || userLocation?.city || "Your Location";
    const mapsNearby = emergencyData?.maps_nearby_url || `https://www.google.com/maps/search/emergency+hospitals+near+me`;

    return (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-red-200 space-y-5 max-h-[92vh] overflow-y-auto custom-scrollbar">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-red-600 text-white flex items-center justify-center text-2xl font-bold shadow-md shadow-red-500/20">
                            🩺
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-extrabold text-red-600 uppercase tracking-wider">Emergency Medical Assistance</span>
                                <span className="px-2 py-0.5 bg-red-100 text-red-800 text-[10px] font-bold rounded-full animate-pulse">24/7 Live</span>
                            </div>
                            <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 font-heading">
                                First Aid & Nearby Hospitals
                            </h3>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 text-lg font-bold transition"
                    >
                        ✕
                    </button>
                </div>

                {/* Instant Emergency Call Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <a
                        href="tel:108"
                        className="p-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl shadow-sm text-center font-bold text-xs flex flex-col items-center justify-center gap-1 transition hover:scale-105"
                    >
                        <span className="text-xl">🚑</span>
                        <span>Call 108</span>
                        <span className="text-[10px] font-normal text-red-100">Ambulance (Free)</span>
                    </a>
                    <a
                        href="tel:112"
                        className="p-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl shadow-sm text-center font-bold text-xs flex flex-col items-center justify-center gap-1 transition hover:scale-105"
                    >
                        <span className="text-xl">🚨</span>
                        <span>Call 112</span>
                        <span className="text-[10px] font-normal text-slate-300">All Emergency</span>
                    </a>
                    <a
                        href="tel:102"
                        className="p-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl shadow-sm text-center font-bold text-xs flex flex-col items-center justify-center gap-1 transition hover:scale-105 col-span-2 sm:col-span-1"
                    >
                        <span className="text-xl">🏥</span>
                        <span>Call 102</span>
                        <span className="text-[10px] font-normal text-emerald-100">Maternity & Child</span>
                    </a>
                </div>

                {/* Location Detection Badge */}
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-amber-950">
                        <span className="text-lg">📍</span>
                        <div>
                            <span>Current Location: <strong>{city}</strong></span>
                            {userLocation?.lat && (
                                <span className="text-[10px] text-amber-700 ml-1.5">
                                    ({userLocation.lat.toFixed(3)}°N, {userLocation.lng.toFixed(3)}°E)
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                            onClick={openEmergencyModal}
                            disabled={isLoading}
                            className="px-3 py-1.5 bg-white hover:bg-amber-100 border border-amber-300 rounded-xl text-xs font-bold text-sunset transition shadow-xs flex items-center gap-1 flex-1 sm:flex-initial justify-center"
                        >
                            <span>🔄</span>
                            <span>{isLoading ? "Locating..." : "Refresh Location"}</span>
                        </button>
                        <a
                            href={mapsNearby}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1 flex-1 sm:flex-initial justify-center"
                        >
                            <span>🗺️</span>
                            <span>Live Google Maps</span>
                        </a>
                    </div>
                </div>

                {/* Nearby Hospitals List */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="font-heading font-extrabold text-sm text-slate-800 flex items-center gap-1.5">
                            <span>🏥</span>
                            <span>Nearest 24/7 Trauma Centers & Hospitals in {city}</span>
                        </h4>
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                            {hospitals.length} Verified Facilities
                        </span>
                    </div>

                    {isLoading ? (
                        <div className="p-8 text-center space-y-2">
                            <div className="loader-spinner w-6 h-6 mx-auto"></div>
                            <p className="text-xs text-slate-500 font-medium">Detecting GPS and fetching nearest emergency trauma centers...</p>
                        </div>
                    ) : (
                        <div className="space-y-2.5 max-h-[260px] overflow-y-auto custom-scrollbar pr-1">
                            {hospitals.map((h, i) => (
                                <div key={i} className="p-4 bg-slate-50 hover:bg-orange-50/40 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <h5 className="font-extrabold text-xs sm:text-sm text-slate-900">{h.name}</h5>
                                            <span className="px-2 py-0.5 bg-red-100 text-red-800 text-[10px] font-bold rounded-full">24/7 Trauma</span>
                                            {h.distance && <span className="text-[11px] font-bold text-slate-500">📍 {h.distance}</span>}
                                        </div>
                                        <p className="text-[11px] text-slate-500">{h.address}</p>
                                        <div className="text-[10px] text-slate-600 flex items-center gap-2 font-medium">
                                            <span>📞 Ph: {h.phone}</span>
                                            <span>•</span>
                                            <span className="text-emerald-700 font-bold">{h.emergency || "24/7 Casualty & Ambulance"}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <a
                                            href={h.directions_url || h.maps_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1 hover:scale-105"
                                        >
                                            <span>🧭</span>
                                            <span>Get Directions</span>
                                        </a>
                                        <a
                                            href={h.maps_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                                        >
                                            📍 View
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* First Aid Quick Essentials */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-xs">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>🩹</span>
                        <span>Traveler First Aid Quick Protocol</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600">
                        <div className="p-2 bg-white rounded-xl border border-slate-200">
                            <strong className="text-slate-800">🏔️ High Altitude (AMS):</strong> Rest immediately, drink 3-4L electrolyte water, do not ascend further. Descend if severe headache/nausea persists.
                        </div>
                        <div className="p-2 bg-white rounded-xl border border-slate-200">
                            <strong className="text-slate-800">☀️ Heat Exhaustion:</strong> Move to shaded air, loosen tight clothing, sip oral rehydration salts (ORS), and apply cool wet cloths to neck.
                        </div>
                        <div className="p-2 bg-white rounded-xl border border-slate-200">
                            <strong className="text-slate-800">🦵 Sprain / Trek Injury:</strong> R.I.C.E. — Rest the joint, Ice for 15 mins, Compress with crepe bandage, Elevate above heart level.
                        </div>
                        <div className="p-2 bg-white rounded-xl border border-slate-200">
                            <strong className="text-slate-800">💧 Dehydration / Gastro:</strong> Sip ORS solutions gradually. Avoid raw unpeeled fruits and street water. Take prescribed probiotics.
                        </div>
                    </div>
                </div>

                <div className="text-center pt-1">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-sm"
                    >
                        Close Emergency Guide
                    </button>
                </div>
            </div>
        </div>
    );
}

function TravelBlueprintBlockView({
    travelPlan,
    currentParams,
    budgetUpdateSummary,
    setIsBookingModalOpen,
    onDownloadPlan,
    onEmailPlan,
    onShareWhatsApp,
    onSavePlan,
    isPlanSaved,
    activeSection,
    setActiveSection,
    openChatAssistant,
    openEmergencyModal
}) {
    const sections = parseBlueprintSections(travelPlan?.answer || "");
    const destName = travelPlan?.destName || currentParams?.destination || "Indian Domestic Trip";
    const [isBlockShareOpen, setIsBlockShareOpen] = useState(false);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Blueprint Header */}
            <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-sunset uppercase tracking-wider">
                            Interactive Section Blueprint
                        </span>
                        <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full border border-emerald-200">
                            Verified AI Plan
                        </span>
                        {isPlanSaved && (
                            <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full border border-amber-200 flex items-center gap-1">
                                <span>⭐</span>
                                <span>Saved in Library</span>
                            </span>
                        )}
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-heading mt-1">
                        {destName} Travel Blueprint
                    </h3>
                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                        <span>🚀 Route: <strong className="text-slate-800">{currentParams.source || "Origin"} ➔ {destName}</strong></span>
                        <span>•</span>
                        <span>📅 Dates: <strong className="text-slate-800">{currentParams.start_date || "Upcoming"}</strong></span>
                        <span>•</span>
                        <span>💰 Budget: <strong className="text-emerald-700">{currentParams.budget || "Custom"}</strong></span>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {/* 1. Save */}
                    <button
                        onClick={onSavePlan}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 hover:scale-105 ${
                            isPlanSaved
                                ? "bg-amber-100 text-amber-900 border border-amber-300"
                                : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
                        }`}
                        title="Save this plan to your account"
                    >
                        <span>{isPlanSaved ? "✓" : "💾"}</span>
                        <span>{isPlanSaved ? "Saved" : "Save Plan"}</span>
                    </button>

                    {/* 2. Download */}
                    <button
                        onClick={onDownloadPlan}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 hover:scale-105"
                        title="Download official HTML blueprint document"
                    >
                        <span>📥</span>
                        <span>Download Plan</span>
                    </button>

                    {/* 3. Share Dropdown (WhatsApp & Email) */}
                    <div className="relative inline-block">
                        <button
                            type="button"
                            onClick={() => setIsBlockShareOpen(prev => !prev)}
                            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 hover:scale-105 shadow-blue-500/20"
                            title="Share plan options"
                        >
                            <span>📤</span>
                            <span>Share</span>
                            <span className="text-[10px] ml-0.5">▾</span>
                        </button>
                        {isBlockShareOpen && (
                            <>
                                <div 
                                    className="fixed inset-0 z-30" 
                                    onClick={() => setIsBlockShareOpen(false)}
                                ></div>
                                <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-40 animate-fade-in text-xs font-semibold overflow-hidden">
                                    {onShareWhatsApp && (
                                        <button
                                            onClick={() => {
                                                setIsBlockShareOpen(false);
                                                onShareWhatsApp();
                                            }}
                                            className="w-full px-4 py-2.5 text-left hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 flex items-center gap-2.5 transition"
                                        >
                                            <span className="text-base text-[#25D366]">💬</span>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-800">Share through WhatsApp</span>
                                                <span className="text-[10px] text-slate-400 font-normal">Choose recipient & send</span>
                                            </div>
                                        </button>
                                    )}
                                    {onEmailPlan && (
                                        <button
                                            onClick={() => {
                                                setIsBlockShareOpen(false);
                                                onEmailPlan();
                                            }}
                                            className="w-full px-4 py-2.5 text-left hover:bg-sky-50 text-slate-700 hover:text-sky-700 flex items-center gap-2.5 transition border-t border-slate-100"
                                        >
                                            <span className="text-base text-sky-600">📧</span>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-800">Share through Email</span>
                                                <span className="text-[10px] text-slate-400 font-normal">Send blueprint to inbox</span>
                                            </div>
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* 4. Medical Emergency */}
                    <button
                        onClick={openEmergencyModal}
                        className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 hover:scale-105 shadow-rose-500/20"
                        title="Emergency First Aid & Hospital Finder"
                    >
                        <span>🩺</span>
                        <span>Medical Emergency</span>
                    </button>

                    {/* Ask AI */}
                    <button
                        onClick={openChatAssistant}
                        className="px-3.5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition shadow-sm flex items-center gap-1.5"
                    >
                        <span>💬</span>
                        <span>Ask AI</span>
                    </button>
                </div>
            </div>

            {/* Recalculated Budget Summary Banner (if updated) */}
            {budgetUpdateSummary && (
                <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-5 shadow-sm space-y-2">
                    <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                        <span>✅</span>
                        <span>Plan Recalculated with IRCTC Air Booking</span>
                    </div>
                    <div className="markdown-content text-xs text-emerald-950" dangerouslySetInnerHTML={{ __html: marked.parse(budgetUpdateSummary) }}></div>
                </div>
            )}

            {/* Section Filter Pills */}
            <div className="bg-white rounded-2xl p-2.5 border border-slate-200 shadow-sm flex items-center gap-2 overflow-x-auto no-scrollbar">
                <button
                    onClick={() => setActiveSection("all")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                        activeSection === "all"
                            ? "bg-slate-900 text-white shadow-sm"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                >
                    <span>✨</span>
                    <span>All Sections</span>
                </button>
                {sections.map((sec) => (
                    <button
                        key={sec.id}
                        onClick={() => setActiveSection(sec.id)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                            activeSection === sec.id
                                ? "bg-gradient-to-r from-sunset to-sunset-hover text-white shadow-sm"
                                : "bg-slate-100 hover:bg-orange-50 hover:text-sunset text-slate-700"
                        }`}
                    >
                        <span>{sec.icon}</span>
                        <span>{sec.title.split("&")[0].trim()}</span>
                    </button>
                ))}
            </div>

            {/* Block-wise Section Cards */}
            <div className="space-y-6">
                {sections
                    .filter(sec => activeSection === "all" || activeSection === sec.id)
                    .map((sec, idx) => (
                        <div
                            key={sec.id || idx}
                            className={`bg-white rounded-3xl p-6 md:p-8 border-2 ${sec.borderClass || "border-slate-200"} shadow-card space-y-5 transition-all`}
                        >
                            {/* Card Header */}
                            <div className={`p-4 rounded-2xl ${sec.headerBg || "bg-slate-50"} flex items-center justify-between`}>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-white shadow-sm text-slate-900 flex items-center justify-center text-xl font-bold">
                                        {sec.icon}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                Section {sec.num}
                                            </span>
                                            <span className="px-2 py-0.5 bg-white/80 border border-slate-200 text-slate-700 rounded-full text-[10px] font-bold">
                                                {sec.badge}
                                            </span>
                                        </div>
                                        <h4 className="text-lg sm:text-xl font-extrabold text-slate-900 font-heading">
                                            {sec.title}
                                        </h4>
                                    </div>
                                </div>

                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(`${sec.title}\n\n${sec.content}`);
                                        alert(`Section "${sec.title}" copied!`);
                                    }}
                                    className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-white text-xs font-semibold transition"
                                    title="Copy Section"
                                >
                                    📋
                                </button>
                            </div>

                            {/* Custom Action for Flights Block */}
                            {sec.id === "flights" && (
                                <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white rounded-2xl p-5 shadow-sm border border-sky-800/60 flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">✈️</span>
                                            <span className="font-heading font-extrabold text-sm text-amber-300">
                                                Official Indian Flight Booking
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-300">
                                            Prices shown are live timetable estimations. Book on IRCTC Air with zero convenience markups, then use <strong>"I've Booked"</strong> to recalculate your stay & dining pool.
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 w-full sm:w-auto flex-shrink-0">
                                        <a
                                            href="https://www.air.irctc.co.in/"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex-1 sm:flex-none text-center px-4 py-2 bg-gradient-to-r from-sunset to-sunset-hover text-white rounded-xl text-xs font-bold transition shadow-sm hover:scale-105"
                                        >
                                            Book on IRCTC Air ➔
                                        </a>
                                        <button
                                            onClick={() => setIsBookingModalOpen(true)}
                                            className="flex-1 sm:flex-none px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center justify-center gap-1"
                                        >
                                            <span>🎫</span>
                                            <span>I've Booked</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Section Content: Day-by-Day View for Itinerary, Interactive Checklist for Weather, Markdown for others */}
                            {sec.id === "itinerary" ? (
                                <InteractiveDayItineraryView content={sec.content} destName={destName} />
                            ) : sec.id === "weather" ? (
                                <InteractivePackingChecklist content={sec.content} destName={destName} />
                            ) : (
                                <div className="markdown-content text-slate-700 leading-relaxed text-xs sm:text-sm" dangerouslySetInnerHTML={{ __html: marked.parse(formatBlueprintMarkdown(sec.content || '', sec.id, destName)) }}></div>
                            )}
                        </div>
                    ))}
            </div>
        </div>
    );
}

function FloatingChatbot({
    isChatDrawerOpen,
    setIsChatDrawerOpen,
    userLocation,
    detectLiveLocation,
    isLocating,
    qaMessages,
    qaInput,
    setQaInput,
    isQALoading,
    handleSendQAMessage
}) {
    return (
        <div className="fixed bottom-6 right-6 z-40 print:hidden flex flex-col items-end">
            {/* Pulsing Tooltip when drawer is closed */}
            {!isChatDrawerOpen && (
                <div
                    onClick={() => setIsChatDrawerOpen(true)}
                    className="mb-2 bg-slate-900 text-white text-xs px-3.5 py-2 rounded-2xl shadow-xl flex items-center gap-2 cursor-pointer hover:bg-slate-800 transition animate-bounce border border-slate-700"
                >
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="font-semibold">Chat with WanderWise AI</span>
                </div>
            )}

            {/* Circular Floating Trigger Button */}
            <button
                onClick={() => setIsChatDrawerOpen(!isChatDrawerOpen)}
                className="w-14 h-14 rounded-full bg-gradient-to-r from-sunset to-amber-500 text-white flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-transform text-2xl border-2 border-white focus:outline-none"
                title="WanderWise Assistant"
            >
                {isChatDrawerOpen ? "✕" : "💬"}
            </button>

            {/* Sliding Chat Drawer */}
            {isChatDrawerOpen && (
                <div className="fixed bottom-24 right-4 sm:right-6 w-[360px] sm:w-[420px] max-w-[calc(100vw-2rem)] h-[580px] max-h-[calc(100vh-8rem)] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-slide-up z-50">
                    {/* Drawer Header */}
                    <div className="p-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-sunset text-white flex items-center justify-center text-sm font-bold shadow-sm">
                                ✈️
                            </div>
                            <div>
                                <h4 className="font-heading font-extrabold text-sm leading-tight">WanderWise Assistant</h4>
                                <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-semibold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                    <span>Plan Q&A & Live Dining Guide</span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsChatDrawerOpen(false)}
                            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-bold transition"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Live Location Indicator */}
                    <div className="px-4 py-2 bg-amber-50/90 border-b border-amber-200/80 flex items-center justify-between text-[11px] text-amber-950 font-medium">
                        <div className="flex items-center gap-1.5 truncate">
                            <span>📍</span>
                            <span className="truncate">Near Me: <strong>{userLocation.city}</strong> ({userLocation.lat.toFixed(2)}°N, {userLocation.lng.toFixed(2)}°E)</span>
                        </div>
                        <button
                            onClick={detectLiveLocation}
                            disabled={isLocating}
                            className="ml-2 px-2.5 py-0.5 bg-white hover:bg-amber-100 border border-amber-300 rounded-md text-[10px] font-bold text-sunset transition flex-shrink-0"
                            title="Refresh GPS Coordinates"
                        >
                            {isLocating ? "Locating..." : "📍 Detect GPS"}
                        </button>
                    </div>

                    {/* Quick Suggestion Chips */}
                    <div className="p-2.5 bg-slate-50 border-b border-slate-100 flex gap-1.5 overflow-x-auto text-[11px] no-scrollbar">
                        <button
                            onClick={() => handleSendQAMessage("Provide me some good non-veg restaurants near me")}
                            className="px-2.5 py-1 bg-white hover:bg-orange-50 hover:text-sunset border border-slate-200 rounded-lg text-slate-700 font-semibold whitespace-nowrap transition"
                        >
                            🍗 Non-Veg Near Me ({userLocation.city})
                        </button>
                        <button
                            onClick={() => handleSendQAMessage("What would you recommend me between Hotel A and Hotel B?")}
                            className="px-2.5 py-1 bg-white hover:bg-orange-50 hover:text-sunset border border-slate-200 rounded-lg text-slate-700 font-semibold whitespace-nowrap transition"
                        >
                            🏨 Hotel A vs Hotel B
                        </button>
                        <button
                            onClick={() => handleSendQAMessage("What are the best vegetarian local specialty dishes to try?")}
                            className="px-2.5 py-1 bg-white hover:bg-orange-50 hover:text-sunset border border-slate-200 rounded-lg text-slate-700 font-semibold whitespace-nowrap transition"
                        >
                            🥗 Veg Specialties
                        </button>
                    </div>

                    {/* Transcript */}
                    <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50">
                        {qaMessages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400 space-y-2">
                                <span className="text-3xl">🧭</span>
                                <p className="text-xs font-medium text-slate-500">Ask any question about your plan, hotels, or famous non-veg/veg dining near you in {userLocation.city}!</p>
                            </div>
                        ) : (
                            qaMessages.map((msg, idx) => (
                                <div key={idx} className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    {msg.sender === 'ai' && (
                                        <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] flex-shrink-0">
                                            ✈️
                                        </div>
                                    )}
                                    <div className={`p-3 rounded-2xl text-xs max-w-[85%] leading-relaxed ${
                                        msg.sender === 'user'
                                            ? 'bg-gradient-to-r from-sunset to-sunset-hover text-white rounded-br-none'
                                            : 'bg-white text-slate-800 shadow-sm border border-slate-200/80 rounded-bl-none'
                                    }`}>
                                        <div className="markdown-content" dangerouslySetInnerHTML={{ __html: marked.parse(msg.text) }}></div>
                                    </div>
                                </div>
                            ))
                        )}
                        {isQALoading && (
                            <div className="flex items-center gap-2 text-xs text-slate-500 italic p-1">
                                <div className="loader-spinner"></div>
                                <span>Searching recommendations...</span>
                            </div>
                        )}
                    </div>

                    {/* Chat Input */}
                    <form onSubmit={(e) => { e.preventDefault(); handleSendQAMessage(); }} className="p-3 bg-white border-t border-slate-100 flex gap-2">
                        <input
                            type="text"
                            value={qaInput}
                            onChange={(e) => setQaInput(e.target.value)}
                            placeholder="Ask about plan, hotels, or 'non-veg food near me'..."
                            className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sunset/30 focus:border-sunset"
                        />
                        <button
                            type="submit"
                            disabled={isQALoading || !qaInput.trim()}
                            className="px-4 py-2.5 bg-sunset hover:bg-sunset-hover text-white rounded-xl text-xs font-bold transition disabled:opacity-40"
                        >
                            Send
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}


function App() {
    const [user, setUser] = useState(() => {
        if (window.USER_DATA) return window.USER_DATA;
        try {
            const cached = localStorage.getItem("wanderwise_user");
            return cached ? JSON.parse(cached) : null;
        } catch (e) {
            return null;
        }
    });

    const handleSetUser = (u) => {
        setUser(u);
        window.USER_DATA = u;
        if (u) {
            try { localStorage.setItem("wanderwise_user", JSON.stringify(u)); } catch(e){}
        } else {
            try { localStorage.removeItem("wanderwise_user"); } catch(e){}
        }
    };

    const [pageView, setPageView] = useState(() => {
        const u = window.USER_DATA || (() => {
            try {
                const c = localStorage.getItem("wanderwise_user");
                return c ? JSON.parse(c) : null;
            } catch(e) { return null; }
        })();
        return u ? "dashboard" : "home";
    });

    const [currentHeroSlide, setCurrentHeroSlide] = useState(0);
    const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);

    // Conversational Trip Planner State
    const [chatMessages, setChatMessages] = useState([
        {
            sender: "ai",
            text: "Namaste! Where would you like to travel in India? You can tell me your dream route (e.g. 'Plan a trip from Nagpur to Jammu') or share any starting thoughts!"
        }
    ]);
    const [chatInput, setChatInput] = useState("");
    const [isChatting, setIsChatting] = useState(false);

    // Flickering / Cycling Animated Placeholder Suggestions for Input Area
    const SUGGESTED_PLACEHOLDERS = [
        "Try: 'viewpoints near me'...",
        "Try: 'restaurants near me'...",
        "Try: 'add one more day to itinerary'...",
        "Try: 'recommend between top hotels'...",
        "Try: 'make the trip cheaper'...",
        "Try: 'best sunset spots'...",
        "Try: 'Delhi to Kashmir for 5 days with ₹25,000 budget'...",
        "Try: 'budget hotel options'..."
    ];
    const [placeholderIndex, setPlaceholderIndex] = useState(0);
    const [isPlaceholderFading, setIsPlaceholderFading] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => {
            setIsPlaceholderFading(true);
            setTimeout(() => {
                setPlaceholderIndex(prev => (prev + 1) % SUGGESTED_PLACEHOLDERS.length);
                setIsPlaceholderFading(false);
            }, 300);
        }, 3200);
        return () => clearInterval(timer);
    }, []);
    const [currentParams, setCurrentParams] = useState({
        source: null,
        destination: null,
        budget: null,
        start_date: null,
        duration_or_return: null
    });

    const [isPlanning, setIsPlanning] = useState(false);
    const [travelPlan, setTravelPlan] = useState(null);
    const [planError, setPlanError] = useState("");

    // In-Plan Q&A State
    const [qaMessages, setQaMessages] = useState([]);
    const [qaInput, setQaInput] = useState("");
    const [isQALoading, setIsQALoading] = useState(false);

    // IRCTC Flight Booking Modal State (One-Way vs Round-Trip, Outbound & Return)
    const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
    const [bookingTripType, setBookingTripType] = useState("Round-Trip");
    const [outboundAirline, setOutboundAirline] = useState("IndiGo (Direct Domestic Flight)");
    const [outboundFlightNo, setOutboundFlightNo] = useState("");
    const [hasReturnFlight, setHasReturnFlight] = useState(true);
    const [returnAirline, setReturnAirline] = useState("IndiGo (Direct Domestic Flight)");
    const [returnFlightNo, setReturnFlightNo] = useState("");
    const [bookedFlightPrice, setBookedFlightPrice] = useState("");
    const [isUpdatingBudget, setIsUpdatingBudget] = useState(false);
    const [budgetUpdateSummary, setBudgetUpdateSummary] = useState(null);

    // Email Travel Blueprint Modal State
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [emailInput, setEmailInput] = useState("");
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [emailStatus, setEmailStatus] = useState(null);

    // Section-wise / Block-wise Active Tab
    const [activeSection, setActiveSection] = useState("all");

    // Floating Chatbot Drawer State
    const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);

    // Live Geolocation State (Only populated on explicit demand, not defaulted)
    const [userLocation, setUserLocation] = useState(null);
    const [isLocating, setIsLocating] = useState(false);

    // Sign In / Sign Up Pop-up Modal State
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [authModalTab, setAuthModalTab] = useState("signin");
    const [authModalMessage, setAuthModalMessage] = useState("");

    // Auto-Scroll Reference
    const chatBottomRef = useRef(null);
    const planRef = useRef(null);
    const scrollToBottom = () => {
        setTimeout(() => {
            chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 50);
    };
    const scrollToPlan = () => {
        setTimeout(() => {
            if (planRef.current) {
                planRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        }, 30);
    };

    // ChatGPT-Style Conversations State
    const [conversations, setConversations] = useState(() => {
        try {
            const key = "wanderwise_conversations_" + (user?.email || "guest");
            const stored = localStorage.getItem(key);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch(e) {}
        const defaultId = "conv-" + Date.now();
        return [{
            id: defaultId,
            title: "New Trip Plan",
            createdAt: "Today",
            messages: [{
                sender: "ai",
                text: "Namaste! Where would you like to travel in India? You can tell me your dream route (e.g. 'Plan a trip from Nagpur to Jammu') or share any starting thoughts!"
            }],
            params: { source: null, destination: null, budget: null, start_date: null, duration_or_return: null },
            travelPlan: null
        }];
    });

    const [activeConversationId, setActiveConversationId] = useState(() => {
        return conversations[0]?.id || "conv-" + Date.now();
    });

    // ChatGPT Conversation Loaded Guard (prevents race condition overwrite)
    const [conversationsLoaded, setConversationsLoaded] = useState(false);

    // Emergency Hospital & First Aid State
    const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
    const [emergencyData, setEmergencyData] = useState(null);
    const [isEmergencyLoading, setIsEmergencyLoading] = useState(false);

    // Share Dropdown Menu State
    const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);

    // Save plan success notification toast
    const [saveToast, setSaveToast] = useState("");
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // Auth loading indicator state
    const [isAuthLoading, setIsAuthLoading] = useState(false);

    // Database Saved Plans State
    const [savedPlans, setSavedPlans] = useState([]);


    // Traveler Feedback Modal State
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
    const [feedbackList, setFeedbackList] = useState(TRAVELER_QUOTES);
    const [fbName, setFbName] = useState("");
    const [fbDest, setFbDest] = useState("");
    const [fbRating, setFbRating] = useState(5);
    const [fbComment, setFbComment] = useState("");
    const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
    const [feedbackSuccess, setFeedbackSuccess] = useState(false);

    // Auth Forms State
    const [authEmail, setAuthEmail] = useState("");
    const [authPassword, setAuthPassword] = useState("");
    const [authName, setAuthName] = useState("");
    const [authNotice, setAuthNotice] = useState("");
    const [pendingWishlistDest, setPendingWishlistDest] = useState(null);

    // Saved Wishlist (Domestic Destinations) per authenticated user
    const [savedDestinations, setSavedDestinations] = useState(() => {
        try {
            const u = window.USER_DATA || (() => {
                try {
                    const c = localStorage.getItem("wanderwise_user");
                    return c ? JSON.parse(c) : null;
                } catch(e) { return null; }
            })();
            if (u && u.email) {
                const cached = localStorage.getItem("wanderwise_wishlist_" + u.email);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed)) return parsed.map(normalizeWishlistItem).filter(Boolean);
                }
            }
        } catch(e){}
        return [];
    });

    // Synchronize user wishlist when user login state changes
    useEffect(() => {
        if (user && user.email) {
            try {
                const cached = localStorage.getItem("wanderwise_wishlist_" + user.email);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed)) {
                        setSavedDestinations(parsed.map(normalizeWishlistItem).filter(Boolean));
                        return;
                    }
                }
                setSavedDestinations([]);
            } catch(e) {
                setSavedDestinations([]);
            }
        } else {
            setSavedDestinations([]);
        }
    }, [user?.email]);

    const toggleWishlist = (dest) => {
        const normalized = normalizeWishlistItem(dest);
        if (!normalized) return;

        if (!user) {
            setPendingWishlistDest(normalized);
            setAuthModalTab("signin");
            setAuthModalMessage("Sign In / Sign Up Please — Please sign in or create an account to add destinations to your travel wishlist.");
            setIsAuthModalOpen(true);
            return;
        }

        const userKey = "wanderwise_wishlist_" + user.email;
        setSavedDestinations(prev => {
            const safePrev = Array.isArray(prev) ? prev.map(normalizeWishlistItem).filter(Boolean) : [];
            const exists = safePrev.some(d => d.name.toLowerCase() === normalized.name.toLowerCase());
            let updated;
            if (exists) {
                updated = safePrev.filter(d => d.name.toLowerCase() !== normalized.name.toLowerCase());
                setSaveToast(`Removed ${normalized.name} from Wishlist`);
            } else {
                updated = [normalized, ...safePrev];
                setSaveToast(`❤️ Added ${normalized.name} to your Wishlist in Dashboard!`);
            }
            try { localStorage.setItem(userKey, JSON.stringify(updated)); } catch(e){}
            setTimeout(() => setSaveToast(""), 3500);
            return updated;
        });
    };

    // Confirmed Booked Trips with Real Dynamic Countdown (user-isolated and persisted)
    const [confirmedTrips, setConfirmedTrips] = useState(() => {
        try {
            const u = window.USER_DATA || (() => {
                try {
                    const c = localStorage.getItem("wanderwise_user");
                    return c ? JSON.parse(c) : null;
                } catch(e) { return null; }
            })();
            const userKey = "wanderwise_confirmed_trips_" + (u?.email || "guest");
            const cached = localStorage.getItem(userKey) || localStorage.getItem("wanderwise_confirmed_trips_all");
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed.map(normalizeConfirmedTrip).filter(Boolean);
                }
            }
        } catch(e){}
        return [];
    });

    // Synchronize user confirmed trips when user login state changes
    useEffect(() => {
        const userEmail = user?.email || "guest";
        const userKey = "wanderwise_confirmed_trips_" + userEmail;
        try {
            const cached = localStorage.getItem(userKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed)) {
                    setConfirmedTrips(parsed.map(normalizeConfirmedTrip).filter(Boolean));
                    return;
                }
            }
            // Check legacy global key if userKey is empty
            const legacyCached = localStorage.getItem("wanderwise_confirmed_trips_all");
            if (legacyCached) {
                const parsed = JSON.parse(legacyCached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    const normalized = parsed.map(normalizeConfirmedTrip).filter(Boolean);
                    setConfirmedTrips(normalized);
                    try { localStorage.setItem(userKey, JSON.stringify(normalized)); } catch(e){}
                    return;
                }
            }
            setConfirmedTrips([]);
        } catch(e) {
            setConfirmedTrips([]);
        }
    }, [user?.email]);

    const getDaysRemaining = (startDateStr) => {
        if (!startDateStr) return "Departing in 14 Days";
        const target = new Date(startDateStr);
        if (isNaN(target.getTime())) return "Departing in 14 Days";
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        target.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > 1) return `Departing in ${diffDays} Days`;
        if (diffDays === 1) return "Departing Tomorrow!";
        if (diffDays === 0) return "Departing Today! ✈️";
        if (diffDays < 0) return "Trip Completed";
        return "Departing Soon";
    };

    // Fetch initial traveler feedbacks
    useEffect(() => {
        fetch("/api/feedback")
            .then(res => res.json())
            .then(data => {
                if (data.success && data.feedbacks && data.feedbacks.length > 0) {
                    setFeedbackList(data.feedbacks);
                }
            })
            .catch(() => {});
    }, []);

    // Auto-scroll when messages, planning state or plan change
    useEffect(() => {
        scrollToBottom();
    }, [chatMessages, isChatting, isPlanning, travelPlan]);

    // Load saved plans from database & cache
    useEffect(() => {
        const key = "wanderwise_saved_plans_" + (user?.email || "guest");
        try {
            const cached = localStorage.getItem(key);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setSavedPlans(parsed.map(normalizeSavedPlan).filter(Boolean));
                }
            }
        } catch(e){}

        fetch("/api/user/saved-plans")
            .then(res => res.json())
            .then(data => {
                if (data.success && Array.isArray(data.plans) && data.plans.length > 0) {
                    const normalized = data.plans.map(normalizeSavedPlan).filter(Boolean);
                    setSavedPlans(normalized);
                    try { localStorage.setItem(key, JSON.stringify(normalized)); } catch(e){}
                }
            })
            .catch(() => {});
    }, [user]);

    // Auto-sync current chat messages, travel plan, and params into active conversation
    useEffect(() => {
        if (!activeConversationId) return;
        setConversations(prev => prev.map(c => {
            if (c.id === activeConversationId) {
                return {
                    ...c,
                    messages: chatMessages,
                    travelPlan: travelPlan,
                    params: currentParams
                };
            }
            return c;
        }));
    }, [chatMessages, travelPlan, currentParams, activeConversationId]);

    // Two-Way ChatGPT-Style Conversation Storage: Load on mount/user change
    useEffect(() => {
        const userEmail = user?.email || "guest";
        const key = "wanderwise_conversations_" + userEmail;

        let localCached = null;
        try {
            const stored = localStorage.getItem(key);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) localCached = parsed;
            }
        } catch(e) {}

        if (user?.email) {
            fetch("/api/user/conversations")
                .then(res => res.json())
                .then(data => {
                    if (data.success && Array.isArray(data.conversations) && data.conversations.length > 0) {
                        setConversations(data.conversations);
                        const firstConv = data.conversations[0];
                        setActiveConversationId(firstConv.id);
                        setChatMessages(firstConv.messages || []);
                        setCurrentParams(firstConv.params || { source: null, destination: null, budget: null, start_date: null, duration_or_return: null });
                        setTravelPlan(firstConv.travelPlan || null);
                        try { localStorage.setItem(key, JSON.stringify(data.conversations)); } catch(e){}
                    } else if (localCached) {
                        setConversations(localCached);
                        const firstConv = localCached[0];
                        setActiveConversationId(firstConv.id);
                        setChatMessages(firstConv.messages || []);
                        setCurrentParams(firstConv.params || { source: null, destination: null, budget: null, start_date: null, duration_or_return: null });
                        setTravelPlan(firstConv.travelPlan || null);
                    }
                    setConversationsLoaded(true);
                })
                .catch(() => {
                    if (localCached) {
                        setConversations(localCached);
                        const firstConv = localCached[0];
                        setActiveConversationId(firstConv.id);
                        setChatMessages(firstConv.messages || []);
                        setCurrentParams(firstConv.params || { source: null, destination: null, budget: null, start_date: null, duration_or_return: null });
                        setTravelPlan(firstConv.travelPlan || null);
                    }
                    setConversationsLoaded(true);
                });
        } else {
            if (localCached) {
                setConversations(localCached);
                const firstConv = localCached[0];
                setActiveConversationId(firstConv.id);
                setChatMessages(firstConv.messages || []);
                setCurrentParams(firstConv.params || { source: null, destination: null, budget: null, start_date: null, duration_or_return: null });
                setTravelPlan(firstConv.travelPlan || null);
            }
            setConversationsLoaded(true);
        }
    }, [user?.email]);

    // Persist conversations to localStorage and Database (only once loaded!)
    useEffect(() => {
        if (!conversationsLoaded) return;
        try {
            const key = "wanderwise_conversations_" + (user?.email || "guest");
            localStorage.setItem(key, JSON.stringify(conversations));
        } catch(e){}

        if (user?.email && activeConversationId) {
            const activeConv = conversations.find(c => c.id === activeConversationId);
            if (activeConv) {
                fetch("/api/user/conversations", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        id: activeConv.id,
                        title: activeConv.title,
                        messages: activeConv.messages,
                        params: activeConv.params,
                        travel_plan: activeConv.travelPlan
                    })
                }).catch(() => {});
            }
        }
    }, [conversations, conversationsLoaded, user?.email, activeConversationId]);

    // Emergency First Aid & Hospital Finder Handler
    const openEmergencyModal = async () => {
        setIsEmergencyModalOpen(true);
        setIsEmergencyLoading(true);
        let lat = userLocation?.lat;
        let lng = userLocation?.lng;
        let city = userLocation?.city;

        if (!lat || !lng || !city || city === "Your Current City" || city === "Current Location") {
            if (navigator.geolocation) {
                try {
                    const pos = await new Promise((resolve) => {
                        navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 10000, enableHighAccuracy: true });
                    });
                    if (pos && pos.coords) {
                        lat = pos.coords.latitude;
                        lng = pos.coords.longitude;
                        setUserLocation(prev => ({ ...prev, lat, lng }));
                    }
                } catch(e) {}
            }
        }

        try {
            const queryParams = new URLSearchParams();
            if (lat) queryParams.set("lat", lat);
            if (lng) queryParams.set("lng", lng);
            if (city && city !== "Your Current City" && city !== "Current Location") queryParams.set("city", city);

            const res = await fetch(`/api/emergency/hospitals?${queryParams.toString()}`);
            const data = await res.json();
            if (data.success) {
                setEmergencyData(data);
                if (data.city) {
                    setUserLocation(prev => ({ ...prev, city: data.city }));
                }
            }
        } catch (e) {
            console.error("Emergency Hospitals Fetch Error:", e);
        } finally {
            setIsEmergencyLoading(false);
        }
    };


    // Carousel Timer
    useEffect(() => {
        const heroTimer = setInterval(() => {
            setCurrentHeroSlide(prev => (prev + 1) % HERO_SLIDES.length);
        }, 5500);
        return () => clearInterval(heroTimer);
    }, []);

    // Quote Timer
    useEffect(() => {
        const quoteTimer = setInterval(() => {
            setCurrentQuoteIndex(prev => (prev + 1) % feedbackList.length);
        }, 6000);
        return () => clearInterval(quoteTimer);
    }, [feedbackList.length]);

    // Smooth Scroll Helper
    const scrollToSection = (id) => {
        if (pageView !== "home") {
            setPageView("home");
            setTimeout(() => {
                const el = document.getElementById(id);
                if (el) el.scrollIntoView({ behavior: "smooth" });
            }, 100);
        } else {
            const el = document.getElementById(id);
            if (el) el.scrollIntoView({ behavior: "smooth" });
        }
    };

    useEffect(() => {
        window.showAuthError = (msg) => {
            setAuthNotice(msg);
        };
        return () => { window.showAuthError = null; };
    }, []);

    // Helper to finalize authentication, populate user state, and save pending wishlist items
    const handleUserAuthenticated = (u) => {
        setConversationsLoaded(false);
        handleSetUser(u);
        setAuthNotice("");
        if (pendingWishlistDest) {
            const targetDest = pendingWishlistDest;
            setPendingWishlistDest(null);
            const userKey = "wanderwise_wishlist_" + u.email;
            let existingList = [];
            try {
                const cached = localStorage.getItem(userKey);
                if (cached) existingList = JSON.parse(cached) || [];
            } catch(e) {}
            const alreadyExists = existingList.some(d => d.name.toLowerCase() === targetDest.name.toLowerCase());
            const updatedList = alreadyExists ? existingList : [{
                name: targetDest.name,
                img: targetDest.image || targetDest.img || "https://images.unsplash.com/photo-1595815771614-ade9d652a65d?auto=format&fit=crop&w=400&q=80",
                tag: targetDest.badge || targetDest.tag || targetDest.category || "Getaway"
            }, ...existingList];
            try { localStorage.setItem(userKey, JSON.stringify(updatedList)); } catch(e) {}
            setSavedDestinations(updatedList);
            setSaveToast(`❤️ Added ${targetDest.name} to your Wishlist in Dashboard!`);
            setPageView("dashboard");
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            setPageView("dashboard");
            setSaveToast(`✓ Welcome, ${u.name || 'Traveler'}!`);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        setTimeout(() => setSaveToast(''), 3500);
    };

    // 1-Click Demo Login
    const handleDemoLogin = async () => {
        setAuthNotice("");
        setIsAuthLoading(true);
        try {
            const res = await fetch("/api/auth/simple-login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: "alex@example.com", name: "Alex Rivers", action: "signin" })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                handleUserAuthenticated(data.user);
            } else {
                setAuthNotice(data.error || "Demo login failed.");
            }
        } catch (e) {
            window.location.href = "/auth/mock";
        } finally {
            setIsAuthLoading(false);
        }
    };

    // Email/Password Sign In
    const handleSignInSubmit = async (e) => {
        e.preventDefault();
        const email = authEmail.trim();
        if (!email) {
            setAuthNotice("Please enter your email address.");
            return;
        }
        setAuthNotice("");
        setIsAuthLoading(true);
        try {
            const res = await fetch("/api/auth/simple-login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email, password: authPassword, action: "signin" })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                handleUserAuthenticated(data.user);
            } else {
                setAuthNotice(data.error || "Sign in failed. Please verify your email and password.");
            }
        } catch(err) {
            setAuthNotice("Connection error. Please try again.");
        } finally {
            setIsAuthLoading(false);
        }
    };

    // Sign Up
    const handleSignUpSubmit = async (e) => {
        e.preventDefault();
        const email = authEmail.trim();
        if (!email) {
            setAuthNotice("Please enter your email address.");
            return;
        }
        setAuthNotice("");
        setIsAuthLoading(true);
        try {
            const res = await fetch("/api/auth/simple-login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: authName.trim() || email.split("@")[0].replace(".", " "),
                    email: email,
                    password: authPassword,
                    action: "signup"
                })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                handleUserAuthenticated(data.user);
            } else {
                setAuthNotice(data.error || "Registration failed. Please try again.");
            }
        } catch(err) {
            setAuthNotice("Connection error. Please try again.");
        } finally {
            setIsAuthLoading(false);
        }
    };

    // Sign Out
    const handleSignOut = () => {
        setConversationsLoaded(false);
        handleSetUser(null);
        setSavedDestinations([]);
        setSavedPlans([]);
        setConfirmedTrips([]);
        setTravelPlan(null);
        setActiveConversationId(null);
        setChatMessages([
            {
                sender: "ai",
                text: "Namaste! Where would you like to travel in India? You can tell me your dream route (e.g. 'Plan a trip from Nagpur to Jammu') or share any starting thoughts!"
            }
        ]);
        setPageView("home");
        fetch("/logout");
    };

    // Helper to compute automatic conversation title
    const computeConversationTitle = (params, defaultOrText) => {
        if (params?.source && params?.destination) {
            return `${params.source} to ${params.destination} Trip`;
        }
        if (params?.destination) {
            return `${params.destination} Vacation`;
        }
        if (defaultOrText && defaultOrText !== "New Trip Plan") {
            const clean = defaultOrText.replace(/^(plan\s+(a\s+)?(trip|holiday|vacation)\s+(from|to)?\s*)/i, '').trim();
            const words = clean.split(/\s+/).slice(0, 4).join(" ");
            if (words) return words.charAt(0).toUpperCase() + words.slice(1);
        }
        return "New Trip Plan";
    };

    // Download formatted HTML plan document directly to user's computer
    const handleDownloadPlan = (planToDownload, paramsToUse) => {
        const plan = planToDownload || travelPlan;
        const p = paramsToUse || currentParams;
        if (!plan) return;
        const dest = plan.destName || p?.destination || "Indian Domestic Trip";
        const title = `WanderWise AI Travel Blueprint - ${dest}`;
        const contentHtml = marked.parse(plan.answer || "");

        const htmlDoc = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 900px; margin: 40px auto; padding: 0 20px; }
        .header { border-bottom: 3px solid #ff6b35; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
        .logo { font-size: 24px; font-weight: 800; color: #ff6b35; }
        .meta { font-size: 13px; color: #64748b; margin-top: 5px; }
        h1, h2, h3, h4 { color: #0f172a; margin-top: 1.5em; }
        h1 { font-size: 28px; }
        h2 { font-size: 20px; border-left: 4px solid #ff6b35; padding-left: 10px; }
        ul, ol { padding-left: 20px; }
        li { margin-bottom: 6px; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 14px; }
        th { background: #f8fafc; font-weight: 700; }
        a { color: #0284c7; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .badge { display: inline-block; background: #ecfdf5; color: #065f46; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 999px; margin-right: 8px; }
        .footer { margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 12px; color: #94a3b8; text-align: center; }
        @media print { body { max-width: 100%; margin: 0; } }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <div class="logo">✈️ WanderWise AI</div>
            <div class="meta">Official Indian Domestic Travel Blueprint • Created for ${user?.name || "Traveler"}</div>
        </div>
        <div>
            <span class="badge">Route: ${p?.source || "Origin"} ➔ ${dest}</span>
            <span class="badge">Budget: ${p?.budget || "Flexible"}</span>
        </div>
    </div>
    <div class="content">
        ${contentHtml}
    </div>
    <div class="footer">
        Generated by WanderWise AI Travel Assistant • Direct IRCTC Air & Google Maps verified.
    </div>
</body>
</html>`;

        const blob = new Blob([htmlDoc], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `WanderWise_${dest.replace(/[^a-zA-Z0-9]/g, '_')}_Plan.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Save travel plan to database and left sidebar library
    const handleSavePlan = async (planToSave, paramsToSave) => {
        if (!user) {
            setAuthModalTab("signin");
            setAuthModalMessage("Sign In / Sign Up Please — Please sign in or create an account to save blueprints permanently to your traveler account.");
            setIsAuthModalOpen(true);
            return;
        }

        const targetPlan = planToSave || travelPlan;
        const targetParams = paramsToSave || currentParams;
        if (!targetPlan) return;

        const dest = targetPlan.destName || targetParams?.destination || "Indian Vacation";
        const already = savedPlans.some(p => p.dest_name === dest && p.answer === targetPlan.answer);
        if (already) {
            setSaveToast(`✓ "${dest}" is already in your left sidebar library!`);
            setTimeout(() => setSaveToast(""), 4000);
            return;
        }

        try {
            const res = await fetch("/api/user/save-plan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    dest_name: dest,
                    user_query: `Vacation from ${targetParams.source || 'India'} to ${dest}`,
                    answer: targetPlan.answer,
                    itinerary: targetPlan.itinerary || targetPlan.answer,
                    flight_results: targetPlan.flight_results || "",
                    hotel_results: targetPlan.hotel_results || "",
                    weather_results: targetPlan.weather_results || "",
                    local_info_results: targetPlan.local_info_results || "",
                    price_prediction: targetPlan.price_prediction,
                    sentiment_summary: targetPlan.sentiment_summary
                })
            });
            const data = await res.json();
            const newRecord = (data && data.plan) ? data.plan : {
                id: "sp-" + Date.now(),
                dest_name: dest,
                user_query: `Trip from ${targetParams.source || 'India'} to ${dest}`,
                created_at: "Just now",
                answer: targetPlan.answer,
                params: targetParams
            };

            const updated = [newRecord, ...savedPlans.filter(p => p.id !== newRecord.id && p.dest_name !== dest)];
            setSavedPlans(updated);
            try {
                const key = "wanderwise_saved_plans_" + (user?.email || "guest");
                localStorage.setItem(key, JSON.stringify(updated));
            } catch(e){}

            setSaveToast(`✓ Saved "${dest}" to left sidebar!`);
            setTimeout(() => setSaveToast(""), 4500);
        } catch(err) {
            const fallbackRecord = {
                id: "sp-" + Date.now(),
                dest_name: dest,
                user_query: `Trip to ${dest}`,
                created_at: "Just now",
                answer: targetPlan.answer,
                params: targetParams
            };
            const updated = [fallbackRecord, ...savedPlans.filter(p => p.dest_name !== dest)];
            setSavedPlans(updated);
            setSaveToast(`✓ Saved "${dest}" to sidebar!`);
            setTimeout(() => setSaveToast(""), 4000);
        }
    };

    // Delete a saved travel plan
    const handleDeleteSavedPlan = async (planId, destName, e) => {
        if (e) e.stopPropagation();
        if (!confirm(`Are you sure you want to delete the saved blueprint for "${destName || 'this destination'}"?`)) {
            return;
        }
        try {
            if (typeof planId === 'number') {
                await fetch(`/api/user/saved-plans/${planId}`, { method: "DELETE" });
            }
        } catch(err){}

        setSavedPlans(prev => {
            const updated = prev.filter(p => p.id !== planId && p.dest_name !== destName);
            try {
                const key = "wanderwise_saved_plans_" + (user?.email || "guest");
                localStorage.setItem(key, JSON.stringify(updated));
            } catch(err){}
            return updated;
        });

        setSaveToast(`✓ Saved plan for "${destName || 'destination'}" deleted.`);
        setTimeout(() => setSaveToast(""), 3500);
    };

    // Open Confirmed Trip in Planner directly with complete blueprint
    const handleOpenConfirmedTrip = (trip) => {
        if (!trip) return;
        const tripPlan = trip.planData || {
            destName: trip.destName || "Gulmarg & Dal Lake, Kashmir",
            answer: `# 1. 🌟 Trip Summary & Overview\n\n- **Confirmed Journey**: ${trip.destName}\n- **Duration**: ${trip.duration}\n- **Route**: ${trip.source} ➔ ${trip.destName}\n- **Flight Status**: ${trip.flightSummary} (₹${typeof trip.flightPrice === 'number' ? trip.flightPrice.toLocaleString('en-IN') : trip.flightPrice} paid on IRCTC Air)\n- **Remaining Pool**: ${trip.remainingBudget} reserved for Dal Lake heritage houseboats and local tours.\n\n# 2. ✈️ Flight Timetables & IRCTC Air Booking\n\n✅ **CONFIRMED & VERIFIED FLIGHTS via IRCTC Air**:\n- **Airline**: ${trip.flightSummary}\n- **Flight Route**: Direct to Srinagar Sheikh ul-Alam International Airport (SXR)\n- **Status**: Confirmed & Verified on IRCTC Air\n\n# 3. 🏨 Curated Hotels & Sentiment Analysis\n\n| Hotel & Location | Nightly Rate (₹) | Key Amenities | Guest Sentiment |\n|---|---|---|---|\n| [**The Khyber Himalayan Resort & Spa, Gulmarg** 📍](https://www.google.com/maps/search/?api=1&query=The+Khyber+Himalayan+Resort+Gulmarg) | ₹14,500 | Heated indoor pool, pine forest vistas, luxury spa | 97% Positive |\n| [**Dal Lake Luxury Heritage Houseboat, Srinagar** 📍](https://www.google.com/maps/search/?api=1&query=Dal+Lake+Heritage+Houseboat+Srinagar) | ₹4,200 | Walnut-wood carving, private Shikara dock | 95% Positive |\n\n# 4. ☀️ Weather Outlook & Packing Guide\n\n| Day & Date | Destination City | Expected High/Low (°C) | Weather Condition | Recommended Attire |\n|---|---|---|---|---|\n| Day 1 | Srinagar | 4°C / 16°C | ☀️ Crisp Sun | Woolen thermals & fleece jacket |\n| Day 2 | Gulmarg | -2°C / 9°C | ❄️ Snow Peak | Heavy down jacket, gloves, snow cap |\n| Day 3 | Gulmarg | -1°C / 8°C | ⛅ High Altitude | Snow boots, thermal socks, UV sunglasses |\n| Day 4 | Dal Lake | 3°C / 15°C | ☀️ Clear Waters | Pashmina shawl, windcheater |\n| Day 5 | Srinagar | 5°C / 17°C | ☀️ Departure | Light woolens |\n\n# 5. 📍 Must-Visit Attractions & Sightseeing\n\n- **Gulmarg Gondola Phase 2** – Highest operational cable car in Asia reaching Apharwat Peak. [📍 View](https://www.google.com/maps/search/?api=1&query=Gulmarg+Gondola+Phase+2)\n- **Dal Lake Shikara Glides** – Sunset cruise passing floating lotus gardens and water bazaars. [📍 View](https://www.google.com/maps/search/?api=1&query=Dal+Lake+Shikara+Srinagar)\n- **Mughal Gardens (Shalimar & Nishat Bagh)** – Royal terraces with centuries-old Chinar trees. [📍 View](https://www.google.com/maps/search/?api=1&query=Shalimar+Bagh+Srinagar)\n\n# 6. 📅 Day-by-Day Time-Slotted Schedule\n\n- **Day 1**: Arrival in Srinagar, check-in to Dal Lake houseboat, sunset Shikara tour.\n- **Day 2**: Scenic transfer to Gulmarg, Gondola Phase 1 & 2 alpine excursion.\n- **Day 3**: Snow sledging, Solang/Kongdori viewpoints, dinner at Khyber.\n- **Day 4**: Return to Srinagar, Old City heritage trail, Jama Masjid & Lal Chowk saffron shopping.\n- **Day 5**: Morning stroll through Mughal Gardens, airport transfer for return flight.\n\n# 7. 💰 Estimated Budget Breakdown (₹)\n\n- **Flight Airfare (Confirmed)**: ₹${typeof trip.flightPrice === 'number' ? trip.flightPrice.toLocaleString('en-IN') : '12,500'}\n- **Houseboat & Resort Stays**: ₹12,000\n- **Sightseeing & Gondola Tickets**: ₹3,500\n- **Food & Kashmiri Wazwan Dining**: ₹3,000\n\n# 8. 💡 Regional Cuisine Highlights & Tips\n\n- Savor authentic Kashmiri Wazwan (Rogan Josh, Gushtaba, Dum Aloo) and hot saffron Kahwa tea with crushed almonds.\n- Keep physical ID cards accessible for high-altitude Gondola checkpoints.`,
            params: { destination: trip.destName, source: trip.source, budget: trip.remainingBudget, duration: trip.duration }
        };

        const existing = conversations.find(c => c.travelPlan?.answer === tripPlan.answer || (trip.destName && c.title?.toLowerCase().includes(trip.destName.toLowerCase())));
        if (existing) {
            handleSelectConversation(existing.id);
        } else {
            const newId = "conv-confirmed-" + Date.now();
            const newConv = {
                id: newId,
                title: `${trip.destName} Confirmed`,
                createdAt: "Confirmed Trip",
                messages: [
                    {
                        sender: "ai",
                        isPlan: true,
                        text: `Namaste! Here is your confirmed **${trip.destName}** travel blueprint. You can explore the itinerary below or ask me any questions about it!`
                    }
                ],
                params: tripPlan.params || { source: trip.source, destination: trip.destName, budget: trip.remainingBudget, duration_or_return: trip.duration },
                travelPlan: tripPlan
            };
            setConversations(prev => [newConv, ...prev]);
            setActiveConversationId(newId);
            setChatMessages(newConv.messages);
            setCurrentParams(newConv.params);
            setTravelPlan(newConv.travelPlan);
        }
        setPageView("planner");
        scrollToPlan();
    };

    // Switch active conversation thread
    const handleSelectConversation = (convId) => {
        const target = conversations.find(c => c.id === convId);
        if (!target) return;
        setActiveConversationId(convId);
        setChatMessages(target.messages || []);
        setCurrentParams(target.params || { source: null, destination: null, budget: null, start_date: null, duration_or_return: null });
        setTravelPlan(target.travelPlan || null);
        setChatInput("");
        setPageView("planner");
        scrollToBottom();
    };

    // Start a new conversation thread
    const handleCreateNewConversation = () => {
        const newId = "conv-" + Date.now();
        const newConv = {
            id: newId,
            title: "New Trip Plan",
            createdAt: "Just now",
            messages: [{
                sender: "ai",
                text: "Namaste! Where would you like to travel in India? You can tell me your dream route (e.g. 'Plan a trip from Nagpur to Jammu') or share any starting thoughts!"
            }],
            params: { source: null, destination: null, budget: null, start_date: null, duration_or_return: null },
            travelPlan: null
        };
        setConversations(prev => [newConv, ...prev]);
        setActiveConversationId(newId);
        setChatMessages(newConv.messages);
        setCurrentParams(newConv.params);
        setTravelPlan(null);
        setChatInput("");
        setPageView("planner");
        scrollToBottom();
    };

    // Delete a conversation thread
    const handleDeleteConversation = (convId, e) => {
        if (e) e.stopPropagation();
        if (conversations.length <= 1) {
            handleCreateNewConversation();
            return;
        }
        const filtered = conversations.filter(c => c.id !== convId);
        setConversations(filtered);
        if (user?.email) {
            fetch(`/api/user/conversations/${convId}`, { method: "DELETE" }).catch(() => {});
        }
        if (activeConversationId === convId) {
            const next = filtered[0];
            setActiveConversationId(next.id);
            setChatMessages(next.messages || []);
            setCurrentParams(next.params || { source: null, destination: null, budget: null, start_date: null, duration_or_return: null });
            setTravelPlan(next.travelPlan || null);
        }
    };

    // Select a saved plan from left sidebar to view & chat
    const handleSelectSavedPlan = (plan) => {
        const existing = conversations.find(c => c.travelPlan?.answer === plan.answer || (plan.dest_name && c.title?.toLowerCase().includes(plan.dest_name.toLowerCase())));
        if (existing) {
            handleSelectConversation(existing.id);
        } else {
            const newId = "conv-" + Date.now();
            const newConv = {
                id: newId,
                title: `${plan.dest_name} Plan`,
                createdAt: plan.created_at || "Saved Plan",
                messages: [
                    {
                        sender: "ai",
                        isPlan: true,
                        text: `Namaste! Here is your saved **${plan.dest_name}** travel blueprint. You can explore the itinerary below or ask me any questions about it!`
                    }
                ],
                params: {
                    source: null,
                    destination: plan.dest_name,
                    budget: null,
                    start_date: null,
                    duration_or_return: null
                },
                travelPlan: {
                    answer: plan.answer,
                    destName: plan.dest_name,
                    itinerary: plan.itinerary || plan.answer
                }
            };
            setConversations(prev => [newConv, ...prev]);
            setActiveConversationId(newId);
            setChatMessages(newConv.messages);
            setCurrentParams(newConv.params);
            setTravelPlan(newConv.travelPlan);
        }
        setPageView("planner");
        scrollToBottom();
    };

    // Conversational Chat - Extracts 5 parameters OR answers in-plan Q&A
    const handleSendChatMessage = async (presetText) => {
        const text = presetText || chatInput.trim();
        if (!text) return;
        setChatInput("");
        setPlanError("");

        const userMsg = { sender: "user", text: text };
        const newHistory = [...chatMessages, userMsg];
        setChatMessages(newHistory);
        setIsChatting(true);
        scrollToBottom();

        // Check for 'near me' / 'nearby'
        let userLocPayload = userLocation ? {
            lat: userLocation.lat,
            lng: userLocation.lng,
            city: userLocation.city
        } : null;

        if (/near me|nearby|around me|close to me|around here|food near|restaurant near|places near|viewpoint near|eateries near/i.test(text)) {
            if (!userLocation?.lat || !userLocation?.lng || userLocation?.city === "Your Current City") {
                try {
                    if (navigator.geolocation) {
                        const pos = await new Promise((resolve) => {
                            navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 10000, enableHighAccuracy: true });
                        });
                        if (pos && pos.coords) {
                            userLocPayload = {
                                lat: pos.coords.latitude,
                                lng: pos.coords.longitude,
                                city: userLocation?.city || "Detecting..."
                            };
                            setUserLocation(userLocPayload);
                        }
                    }
                } catch (e) {
                    console.log("GPS fetch:", e);
                }
            } else {
                userLocPayload = userLocation;
            }
        }

        // -------------------------------------------------------------
        // SCENARIO 1: Plan already generated -> Conversational In-Plan Q&A
        // -------------------------------------------------------------
        if (travelPlan) {
            try {
                const res = await fetch("/api/travel/plan-qa", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        query: text,
                        plan_context: travelPlan.answer,
                        current_params: currentParams,
                        chat_history: newHistory,
                        user_location: userLocPayload
                    })
                });
                const data = await res.json();
                if (data.success) {
                    const withAnswer = [...newHistory, { sender: "ai", text: data.answer }];
                    setChatMessages(withAnswer);
                } else {
                    setChatMessages([...newHistory, { sender: "ai", text: data.error || "I could not answer that query for your travel plan. Feel free to ask about hotels, flights, budget, or sight-seeing spots!" }]);
                }
            } catch (err) {
                setChatMessages([...newHistory, { sender: "ai", text: "Connection error. Please try asking your question again!" }]);
            } finally {
                setIsChatting(false);
                scrollToBottom();
            }
            return;
        }

        // -------------------------------------------------------------
        // SCENARIO 2: No Plan yet -> 16 Travel Intents Router & Parameter Extraction
        // -------------------------------------------------------------
        try {
            const res = await fetch("/api/travel/chat-step", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: text,
                    history: newHistory,
                    current_params: currentParams,
                    plan_context: travelPlan?.answer || null,
                    user_location: userLocPayload
                })
            });
            const data = await res.json();
            if (data.success) {
                const updatedParams = data.params || currentParams;
                setCurrentParams(updatedParams);

                // Auto-update conversation title
                const newTitle = computeConversationTitle(updatedParams, text);
                setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, title: newTitle } : c));

                const withAiReply = [...newHistory, { sender: "ai", text: data.reply }];
                setChatMessages(withAiReply);
                scrollToBottom();

                // If all parameters are confirmed:
                if (data.ready_to_plan) {
                    setIsPlanning(true);
                    const src = updatedParams.source || 'Delhi';
                    const dest = updatedParams.destination || 'Goa';
                    const dur = updatedParams.duration_or_return || '5 days';
                    const sdate = updatedParams.start_date || 'upcoming weekend';
                    const bud = updatedParams.budget || '35000';
                    const query = `Plan a complete trip from ${src} to ${dest} for ${dur} starting on ${sdate} with an approximate budget of ${bud}`;
                    
                    try {
                        const planRes = await fetch("/api/travel", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                message: query,
                                thread_id: activeConversationId
                            })
                        });
                        const planData = await planRes.json();
                        if (!planRes.ok || !planData.success) {
                            throw new Error(planData.error || "Could not generate travel blueprint.");
                        }
                        planData.destName = updatedParams.destination;
                        setTravelPlan(planData);

                        // Auto-save plan to active conversation and user library so it persists across logins
                        setConversations(prev => prev.map(c => {
                            if (c.id === activeConversationId) {
                                return {
                                    ...c,
                                    title: `${updatedParams.destination} Travel Plan`,
                                    travelPlan: planData,
                                    params: updatedParams,
                                    messages: [...withAiReply, {
                                        sender: "ai",
                                        isPlan: true,
                                        text: `🎉 Namaste! Your **${updatedParams.destination}** travel blueprint is ready below! You can now explore the day-by-day plan, compare hotels, download your official document, or ask me any questions directly here (e.g. *"what do you recommend between Hotel A and Hotel B?"* or *"suggest food places near me"*).`
                                    }]
                                };
                            }
                            return c;
                        }));

                        // Background auto-save to user library
                        fetch("/api/user/save-plan", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                dest_name: updatedParams.destination,
                                user_query: query,
                                answer: planData.answer,
                                itinerary: planData.itinerary || planData.answer,
                                flight_results: planData.flight_results || "",
                                hotel_results: planData.hotel_results || "",
                                weather_results: planData.weather_results || "",
                                local_info_results: planData.local_info_results || "",
                                price_prediction: planData.price_prediction,
                                sentiment_summary: planData.sentiment_summary
                            })
                        }).then(r => r.json()).then(d => {
                            if (d && d.plan) {
                                setSavedPlans(prev => [d.plan, ...prev.filter(p => p.dest_name !== updatedParams.destination)]);
                            }
                        }).catch(() => {});

                        const welcomeAiMsg = {
                            sender: "ai",
                            isPlan: true,
                            text: `🎉 Namaste! Your **${updatedParams.destination}** travel blueprint is ready below! You can now explore the day-by-day plan, compare hotels, download your official document, or ask me any questions directly here (e.g. *"what do you recommend between Hotel A and Hotel B?"* or *"suggest food places near me"*).`
                        };
                        setChatMessages([...withAiReply, welcomeAiMsg]);
                    } catch (planErr) {
                        console.error("Plan generation error:", planErr);
                        setChatMessages([...withAiReply, {
                            sender: "ai",
                            text: "⚠️ We encountered an issue while generating your detailed plan. Please review your parameters or try again in a moment."
                        }]);
                    } finally {
                        setIsPlanning(false);
                        scrollToBottom();
                    }
                }
            } else {
                setChatMessages([...newHistory, { sender: "ai", text: "I couldn't process that. Where in India would you like to travel, and what is your approximate budget?" }]);
            }
        } catch (err) {
            console.error(err);
            setChatMessages([...newHistory, { sender: "ai", text: "Our travel planner had a temporary hiccup. Please send your details again!" }]);
            setIsPlanning(false);
        } finally {
            setIsChatting(false);
            scrollToBottom();
        }
    };

    // Plan My Trip preset entry
    const handleStartTripPlan = (destinationPreset) => {
        setPageView("planner");
        window.scrollTo({ top: 0, behavior: "smooth" });
        if (destinationPreset) {
            setTimeout(() => {
                handleSendChatMessage(destinationPreset);
            }, 300);
        }
    };

    // Geolocation Detection Handler
    const detectLiveLocation = () => {
        setIsLocating(true);
        if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser. Defaulting to Nagpur, Maharashtra.");
            setIsLocating(false);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                setUserLocation({ lat: latitude, lng: longitude, city: "Detecting..." });
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
                    const data = await res.json();
                    const city = data?.address?.city || data?.address?.town || data?.address?.state_district || "Current Location";
                    setUserLocation({ lat: latitude, lng: longitude, city });
                } catch (err) {
                    setUserLocation({ lat: latitude, lng: longitude, city: "Current Location" });
                } finally {
                    setIsLocating(false);
                }
            },
            (error) => {
                console.warn("GPS error:", error);
                setIsLocating(false);
            },
            { enableHighAccuracy: true, timeout: 5000 }
        );
    };

    // In-Plan Q&A Assistant Handler
    const handleSendQAMessage = async (presetQuery) => {
        const query = presetQuery || qaInput.trim();
        if (!query || !travelPlan) return;
        setQaInput("");
        setIsQALoading(true);

        const newQAMessages = [...qaMessages, { sender: "user", text: query }];
        setQaMessages(newQAMessages);

        let userLocPayload = userLocation ? {
            lat: userLocation.lat,
            lng: userLocation.lng,
            city: userLocation.city
        } : null;

        if (/near me|nearby|close by|around me|food near|restaurant near|places near/i.test(query)) {
            try {
                if (navigator.geolocation) {
                    const pos = await new Promise((resolve) => {
                        navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 4000 });
                    });
                    if (pos && pos.coords) {
                        userLocPayload = {
                            lat: pos.coords.latitude,
                            lng: pos.coords.longitude,
                            city: userLocation?.city || "Current Location"
                        };
                        setUserLocation(userLocPayload);
                    }
                }
            } catch (e) {
                console.log("GPS fetch:", e);
            }
        }

        try {
            const res = await fetch("/api/travel/plan-qa", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query: query,
                    plan_context: travelPlan.answer,
                    current_params: currentParams,
                    chat_history: newQAMessages,
                    user_location: userLocPayload
                })
            });
            const data = await res.json();
            if (data.success) {
                setQaMessages([...newQAMessages, { sender: "ai", text: data.answer }]);
            } else {
                setQaMessages([...newQAMessages, { sender: "ai", text: data.error || "Unable to answer right now." }]);
            }
        } catch (err) {
            setQaMessages([...newQAMessages, { sender: "ai", text: "Connection error. Please try asking again." }]);
        } finally {
            setIsQALoading(false);
        }
    };

    // Email Plan Handler
    const handleSendEmail = async (e) => {
        e.preventDefault();
        if (!emailInput || !emailInput.includes("@")) {
            setEmailStatus({ success: false, message: "Please enter a valid email address." });
            return;
        }
        setIsSendingEmail(true);
        setEmailStatus(null);
        try {
            const res = await fetch("/api/travel/send-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: emailInput,
                    plan_answer: travelPlan?.answer || "",
                    dest_name: travelPlan?.destName || currentParams?.destination || "Indian Holiday",
                    trip_params: currentParams
                })
            });
            const data = await res.json().catch(() => null);
            if (res.ok && data && data.success) {
                setEmailStatus({ success: true, message: data.message });
            } else {
                setEmailStatus({ success: false, message: (data && data.error) || (data && data.message) || "Failed to dispatch email." });
            }
        } catch (err) {
            setEmailStatus({ success: false, message: "Could not send email. Please check your connection." });
        } finally {
            setIsSendingEmail(false);
        }
    };

    // Helper to format full plan markdown into clean WhatsApp text
    const formatPlanForWhatsApp = (planAnswer) => {
        if (!planAnswer) return "";
        let t = planAnswer;
        // Remove markdown images
        t = t.replace(/!\[[^\]]*\]\([^)]+\)/g, "");
        // Convert links: [Text](url) -> Text (url)
        t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
        // Headings: ### Title -> *▶ Title*
        t = t.replace(/^#{1,4}\s*(.*)$/gm, "\n*▶ $1*\n");
        // Markdown bold **text** -> *text* for WhatsApp
        t = t.replace(/\*\*([^*]+)\*\*/g, "*$1*");
        // Clean table divider lines |---|---|
        t = t.replace(/^\|[\s\-:|]+\|$/gm, "");
        // Clean table rows: | Col1 | Col2 | Col3 | -> • Col1 | Col2 | Col3
        t = t.replace(/^\|\s*(.*?)\s*\|$/gm, "• $1");
        // Bullet points: - item -> • item
        t = t.replace(/^[\*\-]\s+/gm, "• ");
        // Collapse excess blank lines
        t = t.replace(/\n{3,}/g, "\n\n").trim();
        return t;
    };

    // WhatsApp Plan Share Handler with Complete Plan Content
    const handleShareWhatsApp = (plan, params) => {
        const dest = plan?.destName || params?.destination || "Indian Holiday";
        const src = params?.source || "Origin";

        // Clean & format budget to guarantee no 'NaN' appears
        let budgetFormatted = "Flexible / Custom";
        if (params?.budget) {
            const rawDigits = params.budget.toString().replace(/[^0-9]/g, '');
            if (rawDigits && !isNaN(Number(rawDigits))) {
                budgetFormatted = `₹${Number(rawDigits).toLocaleString('en-IN')}`;
            } else {
                budgetFormatted = params.budget.toString();
            }
        }

        const dates = params?.start_date || "Upcoming";
        const originUrl = window.location.origin;

        const completePlanText = formatPlanForWhatsApp(plan?.answer);

        let message = 
`🌟 *WanderWise AI Complete Travel Plan: ${dest}*
━━━━━━━━━━━━━━━━━━━━━━━━━━
✈️ *Route:* ${src} ➔ ${dest}
📅 *Dates / Timing:* ${dates}
💰 *Total Planned Budget:* ${budgetFormatted}
━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

        if (completePlanText) {
            // Keep content within safe limits for WhatsApp URL redirection
            if (completePlanText.length > 6000) {
                message += completePlanText.substring(0, 5800) + "\n\n...[Full Itinerary Continues on WanderWise AI]\n";
            } else {
                message += completePlanText + "\n";
            }
        } else {
            message += 
`🗺️ *Trip Highlights:*
• Verified IRCTC Air domestic flights
• Curated hotels with sentiment rating
• Comprehensive Day-by-Day schedule with Google Maps
• Essential packing & regional food advice\n`;
        }

        message += 
`\n━━━━━━━━━━━━━━━━━━━━━━━━━━
📲 *Open & Explore Full Plan on WanderWise AI:*
${originUrl}

_Crafted by WanderWise AI Traveler Assistant_`;

        const encoded = encodeURIComponent(message);
        const whatsappUrl = `https://api.whatsapp.com/send?text=${encoded}`;
        window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    };

    // Budget Recalculation Handler after IRCTC Air booking
    const handleBudgetRecalculation = async (e) => {
        e.preventDefault();
        if (!bookedFlightPrice || isNaN(bookedFlightPrice) || Number(bookedFlightPrice) <= 0) {
            alert("Please enter a valid flight ticket price in Rupees (₹).");
            return;
        }

        setIsUpdatingBudget(true);
        let origBudget = 15000;
        if (currentParams.budget) {
            const num = currentParams.budget.toString().replace(/[^0-9]/g, '');
            if (num) origBudget = parseFloat(num);
        }

        const outboundLabel = `${outboundAirline}${outboundFlightNo ? ' (' + outboundFlightNo.trim() + ')' : ''}`;
        const returnLabel = (bookingTripType === "Round-Trip" && hasReturnFlight)
            ? `${returnAirline}${returnFlightNo ? ' (' + returnFlightNo.trim() + ')' : ''}`
            : null;
        const flightSummaryName = (bookingTripType === "Round-Trip" && returnLabel)
            ? `${outboundLabel} [Outbound] + ${returnLabel} [Return]`
            : outboundLabel;

        try {
            const res = await fetch("/api/travel/update-budget", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    initial_budget: origBudget,
                    trip_type: bookingTripType,
                    source: currentParams.source || "Origin",
                    destination: currentParams.destination || "Destination",
                    outbound_flight: outboundLabel,
                    return_flight: returnLabel,
                    flight_name: flightSummaryName,
                    ticket_price: parseFloat(bookedFlightPrice),
                    current_plan: travelPlan?.answer || ""
                })
            });
            const data = await res.json().catch(() => null);
            if (res.ok && data && data.success) {
                const newAnswer = data.updated_plan || data.summary;
                const remainingFormatted = `₹${Math.round(data.remaining_budget).toLocaleString('en-IN')}`;

                // 1. Build the updated plan object in the exact same format
                const updatedPlanObj = {
                    ...travelPlan,
                    answer: newAnswer,
                    flight_results: `Confirmed: ${flightSummaryName} (₹${parseFloat(bookedFlightPrice).toLocaleString('en-IN')})`,
                    budget: remainingFormatted,
                    flight_cost: data.flight_cost,
                    remaining_budget: data.remaining_budget
                };

                // 2. Replace travelPlan state in-place!
                setTravelPlan(updatedPlanObj);

                // 3. Update currentParams with remaining pool info
                const updatedParams = {
                    ...currentParams,
                    budget: `${remainingFormatted} (Remaining after flight)`
                };
                setCurrentParams(updatedParams);

                // 4. Update the active conversation in history
                setConversations(prev => prev.map(conv => {
                    if (conv.id === activeConversationId) {
                        return {
                            ...conv,
                            travelPlan: updatedPlanObj,
                            params: updatedParams
                        };
                    }
                    return conv;
                }));

                // 5. Update saved plans in left sidebar if previously saved
                setSavedPlans(prev => prev.map(p => {
                    if (p.dest_name === updatedPlanObj.destName) {
                        return {
                            ...p,
                            answer: newAnswer,
                            params: updatedParams
                        };
                    }
                    return p;
                }));

                // 5b. Add to Confirmed Trips with dynamic countdown for Dashboard & Sidebar
                const tripDest = currentParams.destination || updatedPlanObj.destName || "Confirmed Adventure";
                const tripStartDate = currentParams.start_date || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
                const matchImg = DESTINATIONS.find(d => tripDest.toLowerCase().includes(d.name.toLowerCase().split(' ')[0]))?.image;
                const newConfirmedTrip = {
                    id: "trip_" + Date.now(),
                    destName: tripDest,
                    source: currentParams.source || "Origin",
                    startDate: tripStartDate,
                    duration: currentParams.duration || "5 Days",
                    flightSummary: flightSummaryName,
                    flightPrice: parseFloat(bookedFlightPrice),
                    remainingBudget: remainingFormatted,
                    hotel: "Curated Hotels & Stays",
                    status: "Flight Confirmed",
                    image: matchImg || "https://images.unsplash.com/photo-1595815771614-ade9d652a65d?auto=format&fit=crop&w=400&q=80",
                    createdAt: new Date().toLocaleDateString(),
                    planData: updatedPlanObj
                };
                setConfirmedTrips(prev => {
                    const safePrev = Array.isArray(prev) ? prev.map(normalizeConfirmedTrip).filter(Boolean) : [];
                    const filtered = safePrev.filter(t => t.destName.toLowerCase() !== tripDest.toLowerCase());
                    const updated = [newConfirmedTrip, ...filtered];
                    try {
                        const userKey = "wanderwise_confirmed_trips_" + (user?.email || "guest");
                        localStorage.setItem(userKey, JSON.stringify(updated));
                        localStorage.setItem("wanderwise_confirmed_trips_all", JSON.stringify(updated));
                    } catch(e){}
                    return updated;
                });

                // 6. Clear budgetUpdateSummary so NO double summary box is stacked above the plan
                setBudgetUpdateSummary(null);

                // 7. Reset active section filter to all so the full updated blueprint is visible
                setActiveSection("all");

                // 8. Add confirmation message to chat feed
                const confirmMsg = {
                    sender: "ai",
                    text: `🎉 **Flight Booking Confirmed & Travel Blueprint Updated!**\n\n- **Trip Type**: ${bookingTripType}\n- **Outbound Flight**: ${outboundLabel} (${currentParams.source || 'Origin'} ➔ ${currentParams.destination || 'Destination'})\n${returnLabel ? `- **Return Flight**: ${returnLabel} (${currentParams.destination || 'Destination'} ➔ ${currentParams.source || 'Origin'})\n` : ''}- **Total Airfare Paid**: ₹${parseFloat(bookedFlightPrice).toLocaleString('en-IN')}\n- **Recalculated Remaining Budget**: **${remainingFormatted}** for hotel stays, authentic dining, and sightseeing.\n\n✅ Your travel blueprint below has been updated in-place across all 8 standard sections with your confirmed flights and re-tuned budget allocations!`
                };
                setChatMessages(prev => [...prev, confirmMsg]);
                setQaMessages(prev => [...prev, confirmMsg]);

                // 9. Close modal and show notification
                setIsBookingModalOpen(false);
                setSaveToast("✓ Travel Blueprint updated in-place with booked flights!");
                setTimeout(() => setSaveToast(""), 4500);
            } else {
                alert((data && data.error) || "Could not recalculate budget.");
            }
        } catch (err) {
            alert("Error updating plan with booked ticket.");
        } finally {
            setIsUpdatingBudget(false);
        }
    };

    // Submit Traveler Feedback Handler
    const handleSubmitFeedback = async (e) => {
        e.preventDefault();
        if (!fbName.trim() || !fbComment.trim()) return;

        setIsSubmittingFeedback(true);
        try {
            const res = await fetch("/api/feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: fbName,
                    destination: fbDest || "Indian Holiday",
                    rating: fbRating,
                    comment: fbComment
                })
            });
            const data = await res.json();
            if (data.success) {
                setFeedbackList(data.feedbacks);
                setFeedbackSuccess(true);
                setTimeout(() => {
                    setIsFeedbackModalOpen(false);
                    setFeedbackSuccess(false);
                    setFbName("");
                    setFbDest("");
                    setFbComment("");
                }, 1500);
            }
        } catch (err) {
            alert("Could not submit feedback. Please try again.");
        } finally {
            setIsSubmittingFeedback(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-[#FAFAF9] text-slate-800">
            
            {/* ============================================================ */}
            {/* 1. FIXED TOP NAVIGATION BAR (Home/Dashboard only)            */}
            {/* ============================================================ */}
            {pageView !== "planner" && (
                <header className="fixed top-0 left-0 right-0 z-50 glass-nav transition-all duration-300">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
                        
                        {/* Brand Logo */}
                        <div
                            onClick={() => { setPageView(user ? "dashboard" : "home"); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                            className="flex items-center gap-3 cursor-pointer group"
                        >
                            <div className="w-11 h-11 bg-gradient-to-tr from-sunset to-amber-500 text-white rounded-2xl flex items-center justify-center text-xl font-extrabold shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform">
                                ✈️
                            </div>
                            <div>
                                <span className="font-heading font-extrabold text-xl sm:text-2xl tracking-tight text-slate-900 group-hover:text-sunset transition-colors">
                                    WanderWise
                                </span>
                                <span className="block text-[11px] font-semibold text-slate-400 tracking-wider uppercase -mt-1">
                                    Travel Agency
                                </span>
                            </div>
                        </div>

                        {/* Navigation Links */}
                        <nav className="flex items-center gap-2 sm:gap-6">
                            <button
                                onClick={() => scrollToSection("home")}
                                className="px-3 py-2 text-sm font-semibold text-slate-700 hover:text-sunset transition-colors"
                            >
                                Home
                            </button>
                            <button
                                onClick={() => scrollToSection("about")}
                                className="px-3 py-2 text-sm font-semibold text-slate-700 hover:text-sunset transition-colors"
                            >
                                About
                            </button>
                            <button
                                onClick={() => scrollToSection("destinations")}
                                className="hidden md:inline-block px-3 py-2 text-sm font-semibold text-slate-700 hover:text-sunset transition-colors"
                            >
                                Destinations
                            </button>

                            {/* Auth Navigation */}
                            {user ? (
                                <div className="flex items-center gap-3 pl-2 sm:pl-4 border-l border-slate-200">
                                    <button
                                        onClick={() => {
                                            if (!user) {
                                                setAuthModalTab("signin");
                                                setAuthModalMessage("Sign In Please — Access your saved blueprints, confirmed trips, and traveler lounge.");
                                                setIsAuthModalOpen(true);
                                                return;
                                            }
                                            setPageView("dashboard");
                                        }}
                                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
                                            pageView === "dashboard"
                                                ? "bg-slate-900 text-white"
                                                : "bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200"
                                        }`}
                                    >
                                        <span>🌴</span>
                                        <span className="hidden sm:inline">My Dashboard</span>
                                    </button>
                                    <button
                                        onClick={handleSignOut}
                                        title="Sign Out"
                                        className="p-2 text-slate-400 hover:text-red-600 rounded-xl hover:bg-red-50 transition text-xs font-bold"
                                    >
                                        Sign Out
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-4 border-l border-slate-200">
                                    <button
                                        onClick={() => {
                                            setAuthModalTab("signin");
                                            setAuthModalMessage("Sign In Please — Access your saved blueprints, confirmed trips, and traveler lounge.");
                                            setIsAuthModalOpen(true);
                                        }}
                                        className="px-4 py-2 text-sm font-bold text-slate-700 hover:text-sunset hover:bg-orange-50 rounded-xl transition"
                                    >
                                        Sign In
                                    </button>
                                    <button
                                        onClick={() => {
                                            setAuthModalTab("signup");
                                            setAuthModalMessage("Sign Up Please — Join WanderWise to unlock custom holiday plans and confirmed trip alerts.");
                                            setIsAuthModalOpen(true);
                                        }}
                                        className="px-5 py-2.5 bg-gradient-to-r from-sunset to-sunset-hover text-white rounded-xl text-sm font-bold shadow-md shadow-orange-500/25 hover:shadow-lg hover:shadow-orange-500/40 hover:-translate-y-0.5 transition-all"
                                    >
                                        Sign Up
                                    </button>
                                </div>
                            )}
                        </nav>
                    </div>
                </header>
            )}

            {/* SPACER FOR FIXED NAV */}
            {pageView !== "planner" && <div className="h-20"></div>}

            {/* ============================================================ */}
            {/* VIEW ROUTING (HOME / SIGN IN / SIGN UP / DASHBOARD / PLANNER) */}
            {/* ============================================================ */}

            {/* -------------------- SIGN IN PAGE -------------------- */}
            {pageView === "signin" && (
                <main className="flex-1 flex items-center justify-center p-4 sm:p-6 py-12 animate-fade-in">
                    <div className="max-w-md w-full bg-white rounded-3xl shadow-card border border-slate-100 p-8 md:p-10 text-center relative overflow-hidden">
                        <div className="w-16 h-16 bg-orange-100 text-sunset rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 animate-bob">
                            🗝️
                        </div>
                        <h2 className="text-2xl font-extrabold text-slate-900 font-heading mb-1">Welcome Back!</h2>
                        <p className="text-xs text-slate-500 mb-6">Enter your details to view your vacations and saved destinations</p>

                        {authNotice && (
                            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-xs font-semibold">{authNotice}</div>
                        )}

                        <form onSubmit={handleSignInSubmit} className="space-y-4 text-left">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                                <input
                                    type="email"
                                    required
                                    value={authEmail}
                                    onChange={(e) => setAuthEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sunset/30 focus:border-sunset"
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-bold text-slate-700">Password</label>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            setAuthNotice("To reset or choose a new password, enter your email & new password on the Sign Up tab.");
                                            setPageView("signup");
                                        }} 
                                        className="text-xs text-sunset hover:underline font-semibold"
                                    >
                                        Forgot password?
                                    </button>
                                </div>
                                <input
                                    type="password"
                                    required
                                    value={authPassword}
                                    onChange={(e) => setAuthPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sunset/30 focus:border-sunset"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isAuthLoading}
                                className={`w-full py-3.5 bg-gradient-to-r from-sunset to-sunset-hover text-white rounded-xl text-sm font-bold shadow-md shadow-orange-500/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 ${isAuthLoading ? "opacity-75 cursor-not-allowed" : ""}`}
                            >
                                {isAuthLoading && (
                                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                                    </svg>
                                )}
                                <span>{isAuthLoading ? "Signing in..." : "Sign In"}</span>
                            </button>
                        </form>

                        <div className="relative my-6 text-center">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                            <span className="relative px-3 bg-white text-xs text-slate-400 font-semibold uppercase">Or Continue With</span>
                        </div>

                        {/* Real Google Sign-In Button */}
                        <GoogleSignInButton onAuthSuccess={(u) => handleUserAuthenticated(u)} />

                        {/* Instant Demo Sign In */}
                        <button
                            type="button"
                            onClick={handleDemoLogin}
                            disabled={isAuthLoading}
                            className="w-full py-3 bg-sky-50 hover:bg-sky-100 text-sky-800 rounded-xl text-xs font-bold border border-sky-200 transition flex items-center justify-center gap-2 mb-4"
                        >
                            <span>👤</span>
                            <span>Continue as Guest / Demo Traveler</span>
                        </button>

                        <p className="text-xs text-slate-500">
                            New traveler?{" "}
                            <button onClick={() => { setAuthNotice(""); setPageView("signup"); }} className="text-sunset font-bold hover:underline">
                                Create an account here
                            </button>
                        </p>
                    </div>
                </main>
            )}

            {/* -------------------- SIGN UP PAGE -------------------- */}
            {pageView === "signup" && (
                <main className="flex-1 flex items-center justify-center p-4 sm:p-6 py-12 animate-fade-in">
                    <div className="max-w-md w-full bg-white rounded-3xl shadow-card border border-slate-100 p-8 md:p-10 text-center relative overflow-hidden">
                        <div className="w-16 h-16 bg-blue-100 text-primary rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 animate-bob">
                            🌴
                        </div>
                        <h2 className="text-2xl font-extrabold text-slate-900 font-heading mb-1">Start Your Travel Story</h2>
                        <p className="text-xs text-slate-500 mb-6">Create a free traveler profile in under a minute</p>

                        {authNotice && (
                            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-xs font-semibold">{authNotice}</div>
                        )}

                        <form onSubmit={handleSignUpSubmit} className="space-y-4 text-left">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Your Full Name</label>
                                <input
                                    type="text"
                                    required
                                    value={authName}
                                    onChange={(e) => setAuthName(e.target.value)}
                                    placeholder="Alex Rivers"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sunset/30 focus:border-sunset"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                                <input
                                    type="email"
                                    required
                                    value={authEmail}
                                    onChange={(e) => setAuthEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sunset/30 focus:border-sunset"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Choose Password</label>
                                <input
                                    type="password"
                                    required
                                    value={authPassword}
                                    onChange={(e) => setAuthPassword(e.target.value)}
                                    placeholder="At least 6 characters"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sunset/30 focus:border-sunset"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isAuthLoading}
                                className={`w-full py-3.5 bg-gradient-to-r from-sunset to-sunset-hover text-white rounded-xl text-sm font-bold shadow-md shadow-orange-500/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 ${isAuthLoading ? "opacity-75 cursor-not-allowed" : ""}`}
                            >
                                {isAuthLoading && (
                                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                                    </svg>
                                )}
                                <span>{isAuthLoading ? "Creating account..." : "Create Free Travel Account ➔"}</span>
                            </button>
                        </form>

                        <div className="relative my-6 text-center">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                            <span className="relative px-3 bg-white text-xs text-slate-400 font-semibold uppercase">Or Continue With</span>
                        </div>

                        {/* Real Google Sign-In Button */}
                        <GoogleSignInButton onAuthSuccess={(u) => handleUserAuthenticated(u)} />

                        <button
                            type="button"
                            onClick={handleDemoLogin}
                            disabled={isAuthLoading}
                            className="w-full py-3 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl text-xs font-bold border border-amber-200 transition flex items-center justify-center gap-2 mb-4"
                        >
                            <span>✨</span>
                            <span>Quick Demo Account (1-Click)</span>
                        </button>

                        <p className="text-xs text-slate-500">
                            Already have an account?{" "}
                            <button onClick={() => { setAuthNotice(""); setPageView("signin"); }} className="text-sunset font-bold hover:underline">
                                Sign in here
                            </button>
                        </p>
                    </div>
                </main>
            )}

            {/* -------------------- WELCOME DASHBOARD -------------------- */}
            {pageView === "dashboard" && (() => {
                const travelerName = (typeof user?.name === 'string' && user.name.trim())
                    ? user.name.trim().split(' ')[0]
                    : (typeof user?.email === 'string' && user.email.includes('@') ? user.email.split('@')[0] : 'Alex');
                const safeTrips = Array.isArray(confirmedTrips) ? confirmedTrips.map(normalizeConfirmedTrip).filter(Boolean) : [];
                const safePlans = Array.isArray(savedPlans) ? savedPlans.map(normalizeSavedPlan).filter(Boolean) : [];
                const safeWishlist = Array.isArray(savedDestinations) ? savedDestinations.map(normalizeWishlistItem).filter(Boolean) : [];

                return (
                    <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full animate-fade-in space-y-10">
                        
                        {/* Welcome Banner */}
                        <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white rounded-3xl p-8 md:p-12 shadow-card relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-96 h-96 bg-sunset/20 rounded-full blur-3xl pointer-events-none"></div>
                            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="space-y-2">
                                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-xs font-semibold text-amber-300">
                                        <span>🌟</span>
                                        <span>Welcome to your traveler lounge</span>
                                    </div>
                                    <h1 className="text-3xl md:text-5xl font-extrabold font-heading tracking-tight">
                                        Hello, {travelerName}! 👋
                                    </h1>
                                    <p className="text-sm md:text-base text-slate-300 max-w-xl">
                                        Ready for your next unforgettable escape? Check your upcoming bookings or create a custom holiday plan in seconds.
                                    </p>
                                </div>

                                <button
                                    onClick={() => { setPageView("planner"); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                    className="px-8 py-4 bg-gradient-to-r from-sunset to-sunset-hover hover:scale-105 text-white rounded-2xl font-extrabold text-base shadow-glow-orange transition-all flex items-center justify-center gap-2 flex-shrink-0"
                                >
                                    <span>✈️</span>
                                    <span>Plan a New Trip</span>
                                </button>
                            </div>
                        </div>

                        {/* Upcoming Adventures Card */}
                        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 md:p-8 shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-xl font-bold font-heading text-slate-900">Upcoming Adventures</h2>
                                    <p className="text-xs text-slate-500">Your confirmed journeys and travel itineraries with live countdown</p>
                                </div>
                                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-full border border-emerald-200">
                                    {safeTrips.length} Confirmed {safeTrips.length === 1 ? 'Trip' : 'Trips'}
                                </span>
                            </div>

                            {safeTrips.length === 0 ? (
                                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                                    <span className="text-3xl">🎫</span>
                                    <h4 className="font-bold text-sm text-slate-700">No confirmed trips yet</h4>
                                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                                        When you book flights on IRCTC Air and update your plan, your confirmed holiday with real countdown will appear right here!
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {safeTrips.map((trip, idx) => {
                                        const countdown = getDaysRemaining(trip.startDate);
                                        return (
                                            <div key={trip.id || idx} className="bg-gradient-to-br from-amber-50/70 to-orange-50/40 border border-amber-200/60 rounded-2xl p-5 md:p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                                                <div className="flex items-center gap-4 w-full md:w-auto">
                                                    <img
                                                        src={trip.image || "https://images.unsplash.com/photo-1595815771614-ade9d652a65d?auto=format&fit=crop&w=300&q=80"}
                                                        alt={trip.destName || "Confirmed Adventure"}
                                                        className="w-24 h-24 rounded-2xl object-cover shadow-sm flex-shrink-0"
                                                    />
                                                    <div>
                                                        <span className="px-2.5 py-0.5 bg-sunset text-white text-[11px] font-bold rounded-full uppercase tracking-wider">
                                                            {countdown}
                                                        </span>
                                                        <h3 className="text-lg font-bold text-slate-900 mt-1 font-heading">{trip.destName}</h3>
                                                        <p className="text-xs text-slate-600 mt-0.5">{trip.duration} • Route: {trip.source} ➔ {trip.destName} • {trip.flightSummary}</p>
                                                        <div className="text-xs font-semibold text-emerald-700 mt-2 flex items-center gap-2 flex-wrap">
                                                            <span>✓ Airfare: ₹{typeof trip.flightPrice === 'number' ? trip.flightPrice.toLocaleString('en-IN') : trip.flightPrice}</span>
                                                            <span>•</span>
                                                            <span>✓ Remaining Pool: {trip.remainingBudget}</span>
                                                            <span>•</span>
                                                            <span>✓ {trip.status || 'Confirmed'}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => handleOpenConfirmedTrip(trip)}
                                                    className="px-5 py-2.5 bg-white border border-slate-300 hover:border-sunset hover:text-sunset text-slate-700 rounded-xl text-xs font-bold transition shadow-sm w-full md:w-auto flex items-center justify-center gap-1.5"
                                                >
                                                    <span>🧭</span>
                                                    <span>View Plan ➔</span>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Database Stored Travel Plans */}
                        {safePlans && safePlans.length > 0 && (
                            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 md:p-8 shadow-sm space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-xl font-bold font-heading text-slate-900">Your Saved Travel Blueprints</h2>
                                        <p className="text-xs text-slate-500">Historical itineraries stored securely in your database account</p>
                                    </div>
                                    <span className="px-3 py-1 bg-sky-50 text-sky-800 font-bold text-xs rounded-full border border-sky-200">
                                        {safePlans.length} Saved {safePlans.length === 1 ? 'Plan' : 'Plans'}
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {safePlans.map((plan, idx) => (
                                        <div key={plan.id || idx} className="p-5 rounded-2xl border border-slate-200 hover:border-sunset/50 transition bg-slate-50/60 flex flex-col justify-between gap-3">
                                            <div>
                                                <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold mb-1">
                                                    <span>{plan.created_at || "Recent"}</span>
                                                    <span className="text-emerald-600 font-bold">✓ Database Stored</span>
                                                </div>
                                                <h4 className="font-heading font-extrabold text-base text-slate-900">{plan.dest_name}</h4>
                                                <p className="text-xs text-slate-600 line-clamp-2 mt-1">{plan.user_query}</p>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleSelectSavedPlan(plan)}
                                                    className="flex-1 px-4 py-2 bg-white hover:bg-sunset hover:text-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition flex items-center justify-center gap-1.5 shadow-sm"
                                                >
                                                    <span>🧭</span>
                                                    <span>Open Interactive Blueprint</span>
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleShareWhatsApp({ destName: plan.dest_name, answer: plan.answer }, { destination: plan.dest_name });
                                                    }}
                                                    title="Share plan on WhatsApp"
                                                    className="p-2 text-emerald-600 hover:text-white hover:bg-emerald-600 border border-slate-200 rounded-xl transition text-xs font-bold"
                                                >
                                                    💬
                                                </button>
                                                <button
                                                    onClick={(e) => handleDeleteSavedPlan(plan.id, plan.dest_name, e)}
                                                    title="Delete saved plan"
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200 rounded-xl transition text-xs font-bold"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Saved Wishlist Destinations */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-xl font-bold font-heading text-slate-900">Saved Destinations Wishlist</h2>
                                    <p className="text-xs text-slate-500">Places you've pinned for future getaways</p>
                                </div>
                                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                                    {safeWishlist.length} Wishlisted
                                </span>
                            </div>

                            {safeWishlist.length === 0 ? (
                                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                                    <span className="text-3xl">🤍</span>
                                    <h4 className="font-bold text-sm text-slate-700">Your wishlist is empty</h4>
                                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                                        Browse destinations on the Home page and click "Add to Wishlist" to pin your dream getaways here.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                                    {safeWishlist.map((dest, i) => (
                                        <div key={dest.name || i} className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition group flex flex-col justify-between">
                                            <div className="zoom-container h-44 relative">
                                                <img src={dest.img || "https://images.unsplash.com/photo-1595815771614-ade9d652a65d?auto=format&fit=crop&w=400&q=80"} alt={dest.name} className="w-full h-full object-cover zoom-image" />
                                                <span className="absolute top-3 left-3 px-2.5 py-1 bg-white/90 backdrop-blur-md rounded-full text-[11px] font-bold text-slate-800">
                                                    {dest.tag}
                                                </span>
                                                <button
                                                    onClick={() => toggleWishlist(dest)}
                                                    className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/90 hover:bg-rose-50 text-rose-500 flex items-center justify-center text-xs shadow-sm transition"
                                                    title="Remove from Wishlist"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                            <div className="p-4 flex items-center justify-between gap-2">
                                                <div className="min-w-0 flex-1">
                                                    <h4 className="font-bold text-slate-900 text-xs font-heading truncate">{dest.name}</h4>
                                                    <span className="text-[10px] text-slate-400">Wishlist Item</span>
                                                </div>
                                                <button
                                                    onClick={() => handleStartTripPlan(`Plan a trip to ${dest.name}`)}
                                                    className="px-3 py-1.5 bg-orange-50 hover:bg-sunset text-sunset hover:text-white rounded-xl text-xs font-bold transition flex-shrink-0"
                                                >
                                                    Plan Trip ➔
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </main>
                );
            })()}

            {/* -------------------- FULL-SCREEN CHATGPT-STYLE TRIP PLANNER -------------------- */}
            {pageView === "planner" && (
                <div className="fixed inset-0 z-40 flex h-screen w-screen overflow-hidden bg-slate-900 font-sans animate-fade-in select-text">
                    
                    {/* ========================================== */}
                    {/* LEFT DOCKED SIDEBAR: HISTORY & SAVED PLANS */}
                    {/* ========================================== */}
                    <aside className={`${isSidebarOpen ? 'w-80 min-w-[20rem] max-w-[20rem]' : 'w-0 hidden'} bg-slate-950 text-slate-200 border-r border-slate-800 flex flex-col flex-shrink-0 transition-all duration-300 z-30 h-full overflow-hidden shadow-2xl`}>
                        {/* Sidebar Top: Branding + Collapse + New Trip Button */}
                        <div className="p-4 border-b border-slate-800 flex-shrink-0 space-y-3 bg-slate-950">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sunset to-amber-500 text-white flex items-center justify-center text-sm shadow-md">
                                        ✈️
                                    </div>
                                    <div>
                                        <div className="font-heading font-extrabold text-sm text-white tracking-tight">WanderWise AI</div>
                                        <div className="text-[10px] text-slate-400 font-medium">Trip Planner & Guide</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsSidebarOpen(false)}
                                    title="Close Sidebar"
                                    className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg text-xs transition"
                                >
                                    ◀
                                </button>
                            </div>

                            <button
                                onClick={handleCreateNewConversation}
                                className="w-full py-2.5 px-3 bg-gradient-to-r from-sunset to-sunset-hover text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-orange-500/20 hover:scale-[1.01] transition-all"
                            >
                                <span className="text-sm">➕</span>
                                <span>New Trip Chat</span>
                            </button>
                        </div>

                        {/* Sidebar Scrollable Body: Saved Plans & Recent Chats */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-5 custom-scrollbar">
                            
                            {/* SECTION 0: Confirmed Trips with Real Dynamic Countdown */}
                            {confirmedTrips && confirmedTrips.length > 0 && (
                                <div>
                                    <div className="flex items-center justify-between px-2 mb-2">
                                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                                            <span>🎫</span>
                                            <span>Confirmed Trips</span>
                                        </span>
                                        <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                            {confirmedTrips.length}
                                        </span>
                                    </div>

                                    <div className="space-y-1.5">
                                        {confirmedTrips.map((trip, idx) => {
                                            const countdown = getDaysRemaining(trip.startDate);
                                            return (
                                                <div
                                                    key={trip.id || idx}
                                                    className="group p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-emerald-500/30 hover:border-emerald-400 transition flex items-center justify-between gap-2 cursor-pointer shadow-xs"
                                                    onClick={() => handleOpenConfirmedTrip(trip)}
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <div className="font-bold text-xs text-white group-hover:text-emerald-300 truncate">
                                                            {trip.destName}
                                                        </div>
                                                        <div className="text-[10px] text-emerald-400 font-semibold truncate flex items-center gap-1">
                                                            <span>✈️</span>
                                                            <span>{countdown}</span>
                                                        </div>
                                                    </div>
                                                    <span className="text-xs text-slate-400 group-hover:text-white">➔</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* SECTION 1: Saved Travel Plans Library */}
                            <div>
                                <div className="flex items-center justify-between px-2 mb-2">
                                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                                        <span>⭐</span>
                                        <span>Saved Plans</span>
                                    </span>
                                    <span className="text-[10px] font-bold bg-amber-400/10 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/20">
                                        {savedPlans.length}
                                    </span>
                                </div>

                                {savedPlans.length === 0 ? (
                                    <div className="px-3 py-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 italic text-center leading-relaxed">
                                        No saved plans yet. Click <strong>"Save Plan"</strong> on any blueprint to keep it here!
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        {savedPlans.map((plan, idx) => (
                                            <div
                                                key={plan.id || idx}
                                                className="group p-2.5 rounded-xl bg-slate-900/70 hover:bg-slate-800 border border-slate-800 hover:border-amber-400/40 transition flex items-center justify-between gap-2 cursor-pointer shadow-xs"
                                                onClick={() => handleSelectSavedPlan(plan)}
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-bold text-xs text-slate-200 group-hover:text-amber-300 truncate">
                                                        {plan.dest_name}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 truncate">
                                                        {plan.created_at || "Saved Blueprint"}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 flex-shrink-0">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDownloadPlan(plan, plan.params); }}
                                                        title="Download Blueprint HTML"
                                                        className="p-1.5 hover:bg-slate-700 text-emerald-400 rounded-lg text-xs"
                                                    >
                                                        📥
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleSelectSavedPlan(plan); }}
                                                        title="Open in chat"
                                                        className="p-1.5 hover:bg-slate-700 text-amber-300 rounded-lg text-xs"
                                                    >
                                                        🧭
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDeleteSavedPlan(plan.id, plan.dest_name, e)}
                                                        title="Delete Saved Plan"
                                                        className="p-1.5 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg text-xs transition"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* SECTION 2: Recent Conversations History */}
                            <div>
                                <div className="flex items-center justify-between px-2 mb-2">
                                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                        <span>💬</span>
                                        <span>Recent Chats</span>
                                    </span>
                                    <span className="text-[10px] font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">
                                        {conversations.length}
                                    </span>
                                </div>

                                <div className="space-y-1">
                                    {conversations.map((conv) => {
                                        const isActive = conv.id === activeConversationId;
                                        return (
                                            <div
                                                key={conv.id}
                                                onClick={() => handleSelectConversation(conv.id)}
                                                className={`group px-3 py-2.5 rounded-xl transition flex items-center justify-between gap-2 cursor-pointer text-xs ${
                                                    isActive
                                                        ? 'bg-slate-800 text-white font-bold border-l-4 border-sunset shadow-sm'
                                                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 font-medium'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                                    <span className="text-sm flex-shrink-0">
                                                        {conv.travelPlan ? "🧭" : "💭"}
                                                    </span>
                                                    <span className="truncate">
                                                        {conv.title || "New Trip Chat"}
                                                    </span>
                                                </div>

                                                <button
                                                    onClick={(e) => handleDeleteConversation(conv.id, e)}
                                                    title="Delete Chat"
                                                    className="opacity-0 group-hover:opacity-100 hover:text-red-400 text-slate-500 p-1 rounded transition flex-shrink-0 text-xs"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Sidebar Footer: User Profile & Quick Nav */}
                        <div className="p-3 bg-slate-950 border-t border-slate-800 flex-shrink-0 space-y-2">
                            <div className="flex items-center justify-between gap-2 px-1">
                                <div className="flex items-center gap-2 min-w-0">
                                    <img
                                        src={user?.picture || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"}
                                        alt={user?.name || "User"}
                                        className="w-8 h-8 rounded-full object-cover border border-slate-700 flex-shrink-0"
                                    />
                                    <div className="min-w-0">
                                        <div className="text-xs font-bold text-slate-200 truncate">{user?.name || "Traveler"}</div>
                                        <div className="text-[10px] text-slate-400 truncate">{user?.email || "Signed in"}</div>
                                    </div>
                                </div>
                                <button
                                    onClick={handleSignOut}
                                    title="Sign Out"
                                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-900 rounded-lg text-xs transition"
                                >
                                    🚪
                                </button>
                            </div>

                            <div className="flex items-center gap-1.5 pt-1 text-[11px]">
                                <button
                                    onClick={() => setPageView("dashboard")}
                                    className="flex-1 py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg font-semibold transition text-center"
                                >
                                    📊 Dashboard
                                </button>
                                <button
                                    onClick={() => setPageView("home")}
                                    className="flex-1 py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg font-semibold transition text-center"
                                >
                                    🏠 Home
                                </button>
                            </div>
                        </div>
                    </aside>

                    {/* ========================================== */}
                    {/* CENTER WINDOW: INLINED TOP BAR + CHAT FEED */}
                    {/* ========================================== */}
                    <div className="flex-1 flex flex-col bg-[#F8FAFC] h-full overflow-hidden min-w-0 relative">
                        
                        {/* Top Inlined Bar */}
                        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 flex-shrink-0 z-20 shadow-xs">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                {!isSidebarOpen && (
                                    <button
                                        onClick={() => setIsSidebarOpen(true)}
                                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition text-sm flex-shrink-0"
                                        title="Open History & Saved Plans"
                                    >
                                        ☰
                                    </button>
                                )}
                                
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <h2 className="font-heading font-extrabold text-sm sm:text-base text-slate-900 truncate">
                                            {conversations.find(c => c.id === activeConversationId)?.title || "Domestic Trip Planner"}
                                        </h2>
                                        {travelPlan && (
                                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full border border-emerald-200 hidden sm:inline-flex items-center gap-1 flex-shrink-0">
                                                <span>✓</span>
                                                <span>Blueprint Ready</span>
                                            </span>
                                        )}
                                    </div>
                                    
                                    {/* Inlined Status Badges */}
                                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 overflow-x-auto no-scrollbar py-0.5">
                                        <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md font-medium text-slate-700 whitespace-nowrap">
                                            <span>📍</span>
                                            <span>{currentParams.source || "Start"} ➔ {currentParams.destination || "Destination"}</span>
                                        </span>
                                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-semibold whitespace-nowrap border border-emerald-100">
                                            <span>💰</span>
                                            <span>{currentParams.budget ? `₹${currentParams.budget}` : "Budget: Flexible"}</span>
                                        </span>
                                        <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md font-medium text-slate-700 whitespace-nowrap">
                                            <span>📅</span>
                                            <span>{currentParams.start_date || "Date: TBD"}</span>
                                        </span>
                                        <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md font-medium text-slate-700 whitespace-nowrap">
                                            <span>⏱️</span>
                                            <span>{currentParams.duration_or_return || "Duration: Flexible"}</span>
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Top Bar Right Actions */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                                {travelPlan && (
                                    <>
                                        {/* 1. Save */}
                                        <button
                                            onClick={() => handleSavePlan(travelPlan, currentParams)}
                                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 hover:scale-105"
                                            title="Save to left sidebar library"
                                        >
                                            <span>💾</span>
                                            <span className="hidden sm:inline">Save</span>
                                        </button>

                                        {/* 2. Download */}
                                        <button
                                            onClick={() => handleDownloadPlan(travelPlan, currentParams)}
                                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 hover:scale-105"
                                            title="Download official HTML blueprint"
                                        >
                                            <span>📥</span>
                                            <span className="hidden sm:inline">Download</span>
                                        </button>

                                        {/* 3. Share Dropdown (WhatsApp & Email) */}
                                        <div className="relative inline-block">
                                            <button
                                                type="button"
                                                onClick={() => setIsShareMenuOpen(prev => !prev)}
                                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 hover:scale-105 shadow-blue-500/20"
                                                title="Share travel plan"
                                            >
                                                <span>📤</span>
                                                <span className="hidden sm:inline">Share</span>
                                                <span className="text-[10px] ml-0.5">▾</span>
                                            </button>
                                            {isShareMenuOpen && (
                                                <>
                                                    <div 
                                                        className="fixed inset-0 z-30" 
                                                        onClick={() => setIsShareMenuOpen(false)}
                                                    ></div>
                                                    <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-40 animate-fade-in text-xs font-semibold overflow-hidden">
                                                        <button
                                                            onClick={() => {
                                                                setIsShareMenuOpen(false);
                                                                handleShareWhatsApp(travelPlan, currentParams);
                                                            }}
                                                            className="w-full px-4 py-2.5 text-left hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 flex items-center gap-2.5 transition"
                                                        >
                                                            <span className="text-base text-[#25D366]">💬</span>
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-slate-800">Share through WhatsApp</span>
                                                                <span className="text-[10px] text-slate-400 font-normal">Choose recipient & send full plan</span>
                                                            </div>
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setIsShareMenuOpen(false);
                                                                setIsEmailModalOpen(true);
                                                            }}
                                                            className="w-full px-4 py-2.5 text-left hover:bg-sky-50 text-slate-700 hover:text-sky-700 flex items-center gap-2.5 transition border-t border-slate-100"
                                                        >
                                                            <span className="text-base text-sky-600">📧</span>
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-slate-800">Share through Email</span>
                                                                <span className="text-[10px] text-slate-400 font-normal">Send blueprint to inbox</span>
                                                            </div>
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {/* 4. Medical Emergency */}
                                        <button
                                            onClick={openEmergencyModal}
                                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 shadow-rose-500/20 hover:scale-105"
                                            title="Emergency Hospitals & First Aid Finder"
                                        >
                                            <span>🩺</span>
                                            <span className="hidden sm:inline">Medical Emergency</span>
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={handleCreateNewConversation}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1"
                                    title="Start fresh trip"
                                >
                                    <span>➕</span>
                                    <span className="hidden sm:inline">New Chat</span>
                                </button>
                                <button
                                    onClick={() => setPageView("dashboard")}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition flex items-center gap-1"
                                    title="Go to Dashboard"
                                >
                                    <span>✕</span>
                                    <span className="hidden sm:inline">Exit</span>
                                </button>
                            </div>
                        </header>

                        {/* Save Plan Toast Notification */}
                        {saveToast && (
                            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 px-5 py-2.5 bg-slate-900 text-amber-300 border border-amber-400/40 rounded-2xl shadow-xl text-xs font-bold animate-bounce flex items-center gap-2">
                                <span>⭐</span>
                                <span>{saveToast}</span>
                            </div>
                        )}

                        {/* Main Chat Feed (Max Centered Width like ChatGPT for easy reading) */}
                        <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 py-6 space-y-6 custom-scrollbar relative">
                            <div className="max-w-4xl mx-auto w-full space-y-5">
                                
                                {/* Compute sequential plan injection index */}
                                {(() => {
                                    const planRenderIdx = (() => {
                                        if (!travelPlan) return -1;
                                        // 1. Explicit plan flag
                                        const explicitIdx = chatMessages.findIndex(m => m.isPlan || m.type === 'plan');
                                        if (explicitIdx !== -1) return explicitIdx;

                                        // 2. Keyword match in AI message
                                        const textIdx = chatMessages.findIndex(m => m.sender === 'ai' && m.text && (
                                            m.text.includes("travel blueprint is ready") ||
                                            (m.text.includes("saved") && m.text.includes("travel blueprint")) ||
                                            (m.text.includes("confirmed") && m.text.includes("travel blueprint")) ||
                                            m.text.includes("Crafting your complete day-by-day blueprint")
                                        ));
                                        if (textIdx !== -1) return textIdx;

                                        // 3. Fallback: Anchor right after the first AI response to user query
                                        const firstUserIdx = chatMessages.findIndex(m => m.sender === 'user');
                                        if (firstUserIdx !== -1) {
                                            const nextAiIdx = chatMessages.findIndex((m, i) => i > firstUserIdx && m.sender === 'ai');
                                            if (nextAiIdx !== -1) return nextAiIdx;
                                            return firstUserIdx;
                                        }

                                        // 4. Default: Anchor after initial welcome message
                                        return 0;
                                    })();

                                    return (
                                        <>
                                            {/* Chat Messages Stream with Inlined Sequential Blueprint */}
                                            {chatMessages.map((msg, idx) => (
                                                <React.Fragment key={idx}>
                                                    <div className={`flex gap-3 sm:gap-4 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                        {msg.sender === 'ai' && (
                                                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sunset to-amber-500 text-white flex items-center justify-center text-xs flex-shrink-0 shadow-sm mt-1">
                                                                ✈️
                                                            </div>
                                                        )}
                                                        
                                                        <div className={`p-4 sm:p-5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs ${
                                                            msg.sender === 'user'
                                                                ? 'bg-gradient-to-r from-sunset to-sunset-hover text-white rounded-tr-none font-medium max-w-xl'
                                                                : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none font-normal max-w-2xl'
                                                        }`}>
                                                            <div className="markdown-content" dangerouslySetInnerHTML={{ __html: marked.parse(msg.text) }}></div>
                                                        </div>

                                                        {msg.sender === 'user' && (
                                                            <div className="w-8 h-8 rounded-full bg-orange-100 text-sunset flex items-center justify-center text-xs flex-shrink-0 font-bold border border-orange-200 mt-1">
                                                                👤
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Sequential Blueprint Placement: Exactly where plan was generated in conversation */}
                                                    {idx === planRenderIdx && travelPlan && (
                                                        <div ref={planRef} id="travel-blueprint-section" className="pt-2 my-2 scroll-mt-20">
                                                            <TravelBlueprintBlockView
                                                                travelPlan={travelPlan}
                                                                currentParams={currentParams}
                                                                budgetUpdateSummary={budgetUpdateSummary}
                                                                setIsBookingModalOpen={setIsBookingModalOpen}
                                                                onDownloadPlan={() => handleDownloadPlan(travelPlan, currentParams)}
                                                                onEmailPlan={() => setIsEmailModalOpen(true)}
                                                                onShareWhatsApp={() => handleShareWhatsApp(travelPlan, currentParams)}
                                                                onSavePlan={() => handleSavePlan(travelPlan, currentParams)}
                                                                isPlanSaved={savedPlans.some(p => p.dest_name === travelPlan.destName && p.answer === travelPlan.answer)}
                                                                activeSection={activeSection}
                                                                setActiveSection={setActiveSection}
                                                                openChatAssistant={() => {
                                                                    const el = document.getElementById("planner-chat-input");
                                                                    if (el) el.focus();
                                                                }}
                                                                openEmergencyModal={openEmergencyModal}
                                                            />
                                                        </div>
                                                    )}
                                                </React.Fragment>
                                            ))}

                                            {/* Fallback if plan exists but no anchor message was matched */}
                                            {planRenderIdx === -1 && travelPlan && (
                                                <div ref={planRef} id="travel-blueprint-section" className="pt-2 my-2 scroll-mt-20">
                                                    <TravelBlueprintBlockView
                                                        travelPlan={travelPlan}
                                                        currentParams={currentParams}
                                                        budgetUpdateSummary={budgetUpdateSummary}
                                                        setIsBookingModalOpen={setIsBookingModalOpen}
                                                        onDownloadPlan={() => handleDownloadPlan(travelPlan, currentParams)}
                                                        onEmailPlan={() => setIsEmailModalOpen(true)}
                                                        onShareWhatsApp={() => handleShareWhatsApp(travelPlan, currentParams)}
                                                        onSavePlan={() => handleSavePlan(travelPlan, currentParams)}
                                                        isPlanSaved={savedPlans.some(p => p.dest_name === travelPlan.destName && p.answer === travelPlan.answer)}
                                                        activeSection={activeSection}
                                                        setActiveSection={setActiveSection}
                                                        openChatAssistant={() => {
                                                            const el = document.getElementById("planner-chat-input");
                                                            if (el) el.focus();
                                                        }}
                                                        openEmergencyModal={openEmergencyModal}
                                                    />
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}

                                {/* WanderWise AI Typing Loader */}
                                {isChatting && !isPlanning && (
                                    <div className="flex items-center gap-3 text-xs text-slate-500 italic p-3.5 bg-white border border-slate-200 rounded-2xl w-fit shadow-xs animate-pulse">
                                        <div className="loader-spinner w-3.5 h-3.5"></div>
                                        <span>WanderWise AI is thinking & retrieving domestic travel options...</span>
                                    </div>
                                )}

                                {/* Plan Generation Banner */}
                                {isPlanning && (
                                    <div className="p-5 sm:p-6 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-300 rounded-3xl space-y-2 animate-pulse text-xs text-amber-950 shadow-soft">
                                        <div className="flex items-center gap-2.5 font-extrabold text-sm text-sunset">
                                            <div className="loader-spinner"></div>
                                            <span>Synthesizing Your Complete Domestic Travel Blueprint...</span>
                                        </div>
                                        <p className="text-xs text-slate-700 pl-6 leading-relaxed">
                                            Fetching verified IRCTC Air flights, handpicked hotels with sentiment score, seasonal local weather, and time-blocked itineraries with Google Maps routes.
                                        </p>
                                    </div>
                                )}

                                {/* Anchor for Auto-Scroll */}
                                <div ref={chatBottomRef} className="h-6"></div>
                            </div>

                            {/* Floating "Move to the plan" Button (Visible when blueprint exists) */}
                            {travelPlan && (
                                <button
                                    type="button"
                                    onClick={scrollToPlan}
                                    className="fixed bottom-24 right-6 sm:right-8 z-30 px-4 py-2.5 bg-slate-900/95 hover:bg-slate-900 text-white rounded-full text-xs font-bold shadow-2xl border border-slate-700/60 backdrop-blur-md flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer group"
                                    title="Move directly to your Travel Blueprint"
                                >
                                    <span className="text-amber-400 text-sm group-hover:-translate-y-0.5 transition-transform">📋</span>
                                    <span>Move to the plan</span>
                                    <span className="text-xs group-hover:-translate-y-0.5 transition-transform">⬆️</span>
                                </button>
                            )}
                        </div>

                        {/* Bottom Input & Quick Prompts Area */}
                        <div className="p-3 sm:p-4 bg-white border-t border-slate-200 flex-shrink-0 shadow-lg z-10">
                            <div className="max-w-4xl mx-auto w-full space-y-2.5">
                                
                                {/* Quick Section-wise Navigation Bar below near the text area */}
                                {travelPlan && (
                                    <div className="bg-slate-100/95 border border-slate-200/90 rounded-2xl p-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar shadow-xs">
                                        <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex-shrink-0 px-1.5 flex items-center gap-1">
                                            <span>📑</span>
                                            <span>Sections:</span>
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => { setActiveSection("all"); scrollToPlan(); }}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1 ${
                                                activeSection === "all" ? "bg-slate-900 text-white shadow-xs" : "bg-white hover:bg-slate-200 text-slate-700"
                                            }`}
                                        >
                                            <span>✨</span>
                                            <span>All</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setActiveSection("flights"); scrollToPlan(); }}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1 ${
                                                activeSection === "flights" ? "bg-sky-600 text-white shadow-xs" : "bg-white hover:bg-sky-50 text-sky-800"
                                            }`}
                                        >
                                            <span>✈️</span>
                                            <span>Flights</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setActiveSection("hotels"); scrollToPlan(); }}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1 ${
                                                activeSection === "hotels" ? "bg-emerald-600 text-white shadow-xs" : "bg-white hover:bg-emerald-50 text-emerald-800"
                                            }`}
                                        >
                                            <span>🏨</span>
                                            <span>Hotels</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setActiveSection("weather"); scrollToPlan(); }}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1 ${
                                                activeSection === "weather" ? "bg-amber-600 text-white shadow-xs" : "bg-white hover:bg-amber-50 text-amber-800"
                                            }`}
                                        >
                                            <span>☀️</span>
                                            <span>Weather & Gear</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setActiveSection("attractions"); scrollToPlan(); }}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1 ${
                                                activeSection === "attractions" ? "bg-rose-600 text-white shadow-xs" : "bg-white hover:bg-rose-50 text-rose-800"
                                            }`}
                                        >
                                            <span>📍</span>
                                            <span>Sightseeing</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setActiveSection("itinerary"); scrollToPlan(); }}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1 ${
                                                activeSection === "itinerary" ? "bg-indigo-600 text-white shadow-xs" : "bg-white hover:bg-indigo-50 text-indigo-800"
                                            }`}
                                        >
                                            <span>📅</span>
                                            <span>Day-by-Day</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setActiveSection("budget"); scrollToPlan(); }}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1 ${
                                                activeSection === "budget" ? "bg-teal-600 text-white shadow-xs" : "bg-white hover:bg-teal-50 text-teal-800"
                                            }`}
                                        >
                                            <span>💰</span>
                                            <span>Budget</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setActiveSection("tips"); scrollToPlan(); }}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1 ${
                                                activeSection === "tips" ? "bg-purple-600 text-white shadow-xs" : "bg-white hover:bg-purple-50 text-purple-800"
                                            }`}
                                        >
                                            <span>💡</span>
                                            <span>Local Tips</span>
                                        </button>
                                    </div>
                                )}

                                {/* Inlined Search / Chat Form */}
                                <form
                                    onSubmit={(e) => { e.preventDefault(); handleSendChatMessage(); }}
                                    className="relative flex items-center bg-slate-50 hover:bg-slate-100/60 focus-within:bg-white focus-within:ring-2 focus-within:ring-sunset/40 focus-within:border-sunset border border-slate-200 rounded-2xl p-1.5 transition-all shadow-xs"
                                >

                                    <input
                                        id="planner-chat-input"
                                        type="text"
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        placeholder={SUGGESTED_PLACEHOLDERS[placeholderIndex]}
                                        disabled={isChatting || isPlanning}
                                        className={`flex-1 bg-transparent px-3 py-2 text-xs sm:text-sm text-slate-800 focus:outline-none min-w-0 transition-opacity duration-300 placeholder:text-slate-400/50 placeholder:font-light ${
                                            isPlaceholderFading ? "placeholder:opacity-20" : "placeholder:opacity-90"
                                        }`}
                                    />

                                    <button
                                        type="submit"
                                        disabled={isChatting || isPlanning || !chatInput.trim()}
                                        className="px-5 py-2.5 bg-gradient-to-r from-sunset to-sunset-hover text-white rounded-xl text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-40 flex items-center gap-1.5 flex-shrink-0"
                                    >
                                        <span>Send</span>
                                        <span>➔</span>
                                    </button>
                                </form>

                                {/* Bottom Meta Row */}
                                <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                                    <span className="flex items-center gap-1">
                                        {userLocation && userLocation.city ? (
                                            <span>📍 GPS Detected: <strong>{userLocation.city}</strong></span>
                                        ) : (
                                            <span>📍 AI-Powered Intelligent Route & Itinerary Planner</span>
                                        )}
                                    </span>
                                    <span>Verified Domestic Travel Planner • WanderWise AI</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* -------------------- SECTION 2: HOME HERO & SHOWCASE -------------------- */}
            {pageView === "home" && (
                <main className="flex-1">
                    
                    {/* FULL-SCREEN HERO SECTION */}
                    <section id="home" className="relative min-h-[92vh] flex items-center justify-center overflow-hidden">
                        
                        {/* Background Slides with Fade Transition */}
                        {HERO_SLIDES.map((slide, idx) => (
                            <div
                                key={idx}
                                className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                                    currentHeroSlide === idx ? "opacity-100 scale-105" : "opacity-0 scale-100 pointer-events-none"
                                } transform transition-transform duration-[7000ms]`}
                            >
                                <img
                                    src={slide.image}
                                    alt={slide.headline}
                                    className="w-full h-full object-cover"
                                />
                                {/* Gradient Overlays */}
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/40 to-slate-900/30"></div>
                            </div>
                        ))}

                        {/* Floating Drifting Clouds */}
                        <div className="absolute top-10 left-0 right-0 pointer-events-none opacity-40 animate-clouds flex justify-around">
                            <span className="text-7xl">☁️</span>
                            <span className="text-8xl">☁️</span>
                            <span className="text-6xl">☁️</span>
                        </div>

                        {/* Floating Paper Airplane */}
                        <div className="absolute top-1/4 right-1/4 pointer-events-none text-4xl animate-plane opacity-90 hidden sm:block">
                            ✈️
                        </div>

                        {/* Hero Center Content */}
                        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center text-white space-y-6 pt-12 pb-16">
                            
                            {/* Slide Tag badge */}
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold text-amber-300 border border-white/20 shadow-sm animate-bob">
                                <span>✨</span>
                                <span>{HERO_SLIDES[currentHeroSlide].tag}</span>
                                <span>•</span>
                                <span>{HERO_SLIDES[currentHeroSlide].location}</span>
                            </div>

                            {/* Main Inspiring Headline */}
                            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold font-heading tracking-tight leading-tight text-white drop-shadow-md">
                                Escape the Ordinary.<br />
                                <span className="bg-gradient-to-r from-amber-300 via-orange-300 to-rose-300 bg-clip-text text-transparent">
                                    Discover the Extraordinary.
                                </span>
                            </h1>

                            {/* One-line Plain-language Promise */}
                            <p className="text-base sm:text-lg md:text-xl text-slate-200 max-w-2xl mx-auto font-medium drop-shadow">
                                We handcraft your dream journeys, pick charming stays, and arrange every detail so you can simply pack your bags and go.
                            </p>

                            {/* Call to Action Button */}
                            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
                                <button
                                    onClick={() => {
                                        if (user) {
                                            setPageView("dashboard");
                                        } else {
                                            setPageView("signup");
                                        }
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    className="px-8 py-4 bg-gradient-to-r from-sunset via-orange-500 to-amber-500 hover:scale-105 text-white rounded-2xl font-extrabold text-base shadow-glow-orange transition-all duration-300 flex items-center gap-3 group"
                                >
                                    <span>Start Your Journey</span>
                                    <span className="group-hover:translate-x-1 transition-transform">➔</span>
                                </button>

                                <button
                                    onClick={() => scrollToSection("destinations")}
                                    className="px-6 py-4 bg-white/15 hover:bg-white/25 backdrop-blur-md text-white rounded-2xl font-bold text-sm border border-white/20 transition"
                                >
                                    Explore Top Destinations ↓
                                </button>
                            </div>

                            {/* Trust badges */}
                            <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-300 font-medium">
                                <span>✨ 100% Tailored Domestic Itineraries</span>
                                <span>•</span>
                                <span>🛡️ 24/7 Friendly Travel Care</span>
                            </div>
                        </div>

                        {/* Slide Indicator Dots */}
                        <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-2 z-20">
                            {HERO_SLIDES.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setCurrentHeroSlide(i)}
                                    className={`h-2.5 rounded-full transition-all duration-300 ${
                                        currentHeroSlide === i ? "w-8 bg-amber-400" : "w-2.5 bg-white/50 hover:bg-white"
                                    }`}
                                />
                            ))}
                        </div>
                    </section>

                    {/* DESTINATION CARDS SECTION */}
                    <section id="destinations" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                        <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
                            <span className="text-xs font-bold text-sunset uppercase tracking-wider">
                                Handcrafted Domestic Getaways
                            </span>
                            <h2 className="text-3xl sm:text-4xl font-extrabold font-heading text-slate-900 tracking-tight">
                                Beautiful Destinations to Travel
                            </h2>
                            <p className="text-sm text-slate-500">
                                From snow-dusted Himalayan peaks to golden beach shores and royal palaces, your perfect Indian holiday is waiting.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                            {DESTINATIONS.map((dest, i) => (
                                <div
                                    key={i}
                                    className="bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-soft hover:shadow-card transition-all duration-300 hover:-translate-y-1.5 group flex flex-col justify-between"
                                >
                                    {/* Image with Slow Zoom on Hover */}
                                    <div className="zoom-container h-64 relative">
                                        <img
                                            src={dest.image}
                                            alt={dest.name}
                                            className="w-full h-full object-cover zoom-image"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent"></div>
                                        
                                        {/* Badge */}
                                        <span className="absolute top-4 left-4 px-3 py-1 bg-white/90 backdrop-blur-md rounded-full text-xs font-bold text-slate-800 shadow-sm">
                                            {dest.badge}
                                        </span>

                                        <span className="absolute top-4 right-4 px-2.5 py-1 bg-amber-400 text-slate-900 font-extrabold text-xs rounded-full shadow-sm flex items-center gap-1">
                                            <span>★</span> {dest.rating}
                                        </span>

                                        <div className="absolute bottom-4 left-4 text-white">
                                            <span className="text-xs font-semibold text-amber-300">{dest.category}</span>
                                            <h3 className="text-xl font-bold font-heading">{dest.name}</h3>
                                        </div>
                                    </div>

                                    {/* Card Content */}
                                    <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                                        <p className="text-xs text-slate-600 line-clamp-2">
                                            {dest.description}
                                        </p>

                                        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                                            <span className="text-xs font-semibold text-slate-400">
                                                {dest.flightTime}
                                            </span>
                                            <button
                                                onClick={() => toggleWishlist(dest)}
                                                className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 ${
                                                    savedDestinations.some(d => d && d.name && dest?.name && d.name.toLowerCase() === dest.name.toLowerCase())
                                                        ? "bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100"
                                                        : "bg-orange-50 hover:bg-sunset text-sunset hover:text-white"
                                                }`}
                                            >
                                                <span>{savedDestinations.some(d => d && d.name && dest?.name && d.name.toLowerCase() === dest.name.toLowerCase()) ? "❤️" : "🤍"}</span>
                                                <span>{savedDestinations.some(d => d && d.name && dest?.name && d.name.toLowerCase() === dest.name.toLowerCase()) ? "In Wishlist" : "Add to Wishlist"}</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* ROTATING TRAVELER QUOTES SLIDER */}
                    <section className="bg-gradient-to-r from-amber-50 via-orange-50/50 to-sky-50 py-16 px-4 border-y border-amber-200/40">
                        <div className="max-w-4xl mx-auto space-y-6">
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-amber-200/40 pb-4 text-center sm:text-left">
                                <div>
                                    <span className="text-xs font-bold text-sunset uppercase tracking-wider block">
                                        Stories From Real Travelers
                                    </span>
                                    <h3 className="text-xl sm:text-2xl font-bold font-heading text-slate-900">
                                        Loved Across India
                                    </h3>
                                </div>
                                <button
                                    onClick={() => setIsFeedbackModalOpen(true)}
                                    className="px-4 py-2 bg-gradient-to-r from-sunset to-sunset-hover text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition flex items-center gap-1.5"
                                >
                                    <span>✍️</span>
                                    <span>Share Your Travel Feedback</span>
                                </button>
                            </div>

                            {/* Quote Box with Gentle Transition */}
                            {feedbackList.length > 0 && (
                                <div className="text-center space-y-6">
                                    <div className="min-h-[120px] flex flex-col justify-center transition-all duration-500">
                                        <p className="text-lg sm:text-2xl font-heading font-medium text-slate-800 italic leading-relaxed">
                                            "{feedbackList[currentQuoteIndex % feedbackList.length]?.comment || feedbackList[0].comment}"
                                        </p>
                                    </div>

                                    {/* Author Info */}
                                    <div className="flex items-center justify-center gap-3">
                                        <img
                                            src={feedbackList[currentQuoteIndex % feedbackList.length]?.avatar || feedbackList[0].avatar}
                                            alt={feedbackList[currentQuoteIndex % feedbackList.length]?.name || feedbackList[0].name}
                                            className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                                        />
                                        <div className="text-left">
                                            <div className="font-bold text-slate-900 text-sm">
                                                {feedbackList[currentQuoteIndex % feedbackList.length]?.name || feedbackList[0].name}
                                            </div>
                                            <div className="text-xs text-slate-500 flex items-center gap-1">
                                                <span>📍 {feedbackList[currentQuoteIndex % feedbackList.length]?.destination || feedbackList[0].destination}</span>
                                                <span className="text-amber-400 font-bold ml-1">{"★".repeat(feedbackList[currentQuoteIndex % feedbackList.length]?.rating || 5)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Quote navigation buttons */}
                                    <div className="flex justify-center gap-2 pt-2">
                                        {feedbackList.slice(0, 6).map((_, i) => (
                                            <button
                                                key={i}
                                                onClick={() => setCurrentQuoteIndex(i)}
                                                className={`w-2.5 h-2.5 rounded-full transition-all ${
                                                    currentQuoteIndex % feedbackList.length === i ? "w-6 bg-sunset" : "bg-slate-300"
                                                }`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* ============================================================ */}
                    {/* 3. ABOUT SECTION (Plain, Friendly Language)                  */}
                    {/* ============================================================ */}
                    <section id="about" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-16">
                        
                        {/* Intro */}
                        <div className="text-center max-w-3xl mx-auto space-y-4">
                            <span className="text-xs font-bold text-sunset uppercase tracking-wider">
                                How We Make Travel Wonderfully Simple
                            </span>
                            <h2 className="text-3xl sm:text-5xl font-extrabold font-heading text-slate-900 tracking-tight">
                                Travel Made Easy, Joyful, and Truly Yours
                            </h2>
                            <p className="text-base text-slate-600 leading-relaxed">
                                We believe vacations should bring pure happiness, not hours of stressful research. Here is how our friendly travel team takes care of everything for you:
                            </p>
                        </div>

                        {/* 4 Pillars of What We Do */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            
                            <div className="bg-white rounded-3xl p-7 border border-slate-200/80 shadow-soft hover:shadow-card transition-all duration-300 hover:-translate-y-1 space-y-3">
                                <div className="w-14 h-14 bg-blue-50 text-sky-600 rounded-2xl flex items-center justify-center text-2xl shadow-sm">
                                    🗺️
                                </div>
                                <h3 className="text-lg font-bold font-heading text-slate-900">Custom Trip Planning</h3>
                                <p className="text-xs text-slate-600 leading-relaxed">
                                    No rigid tours. We shape every day around your pace, preferred activities, and budget so your holiday feels natural and relaxing.
                                </p>
                            </div>

                            <div className="bg-white rounded-3xl p-7 border border-slate-200/80 shadow-soft hover:shadow-card transition-all duration-300 hover:-translate-y-1 space-y-3">
                                <div className="w-14 h-14 bg-orange-50 text-sunset rounded-2xl flex items-center justify-center text-2xl shadow-sm">
                                    🏨
                                </div>
                                <h3 className="text-lg font-bold font-heading text-slate-900">Handpicked Stays</h3>
                                <p className="text-xs text-slate-600 leading-relaxed">
                                    We carefully select verified, highly rated boutique hotels, cozy chalets, and beachfront resorts that guests genuinely love.
                                </p>
                            </div>

                            <div className="bg-white rounded-3xl p-7 border border-slate-200/80 shadow-soft hover:shadow-card transition-all duration-300 hover:-translate-y-1 space-y-3">
                                <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center text-2xl shadow-sm">
                                    ✈️
                                </div>
                                <h3 className="text-lg font-bold font-heading text-slate-900">Easy Bookings</h3>
                                <p className="text-xs text-slate-600 leading-relaxed">
                                    We compare direct flights, practical departure times, and transfer logistics so you avoid chaotic delays and arrive refreshed.
                                </p>
                            </div>

                            <div className="bg-white rounded-3xl p-7 border border-slate-200/80 shadow-soft hover:shadow-card transition-all duration-300 hover:-translate-y-1 space-y-3">
                                <div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center text-2xl shadow-sm">
                                    💛
                                </div>
                                <h3 className="text-lg font-bold font-heading text-slate-900">Caring 24/7 Support</h3>
                                <p className="text-xs text-slate-600 leading-relaxed">
                                    From your first question until you are safely back home, a friendly travel specialist is always one message away to help.
                                </p>
                            </div>

                        </div>

                        {/* Why Choose Us Highlights */}
                        <div className="bg-gradient-to-r from-sky-900 to-slate-900 text-white rounded-3xl p-8 md:p-12 shadow-card">
                            <div className="max-w-2xl mb-8">
                                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                                    Why Travelers Love WanderWise
                                </span>
                                <h3 className="text-2xl sm:text-3xl font-extrabold font-heading mt-1">
                                    Your Vacation, Handled with Care
                                </h3>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                <div className="space-y-1">
                                    <div className="text-amber-400 font-bold text-base flex items-center gap-1.5">
                                        <span>⚡</span> Zero Browser Clutter
                                    </div>
                                    <p className="text-xs text-slate-300">
                                        Forget juggling 25 open tabs. We bring flights, stays, sights, and costs into one clear plan.
                                    </p>
                                </div>

                                <div className="space-y-1">
                                    <div className="text-amber-400 font-bold text-base flex items-center gap-1.5">
                                        <span>🛡️</span> Verified Guest Ratings
                                    </div>
                                    <p className="text-xs text-slate-300">
                                        Every stay is verified for genuine comfort, quiet rooms, safety, and warm hospitality.
                                    </p>
                                </div>

                                <div className="space-y-1">
                                    <div className="text-amber-400 font-bold text-base flex items-center gap-1.5">
                                        <span>💰</span> Honest Transparent Prices
                                    </div>
                                    <p className="text-xs text-slate-300">
                                        Realistic budget estimates with zero surprise fees or hidden booking markups.
                                    </p>
                                </div>

                                <div className="space-y-1">
                                    <div className="text-amber-400 font-bold text-base flex items-center gap-1.5">
                                        <span>📍</span> Authentic Local Gems
                                    </div>
                                    <p className="text-xs text-slate-300">
                                        Discover hidden cafés, quiet scenic lookouts, and cultural spots that guidebooks overlook.
                                    </p>
                                </div>
                            </div>
                        </div>

                    </section>

                    {/* Bottom Inspirational Call To Action */}
                    <section className="py-16 px-4 bg-gradient-to-tr from-sunset via-orange-500 to-amber-500 text-white text-center">
                        <div className="max-w-3xl mx-auto space-y-6">
                            <h2 className="text-3xl sm:text-5xl font-extrabold font-heading tracking-tight">
                                Ready to Pack Your Bags?
                            </h2>
                            <p className="text-base text-orange-100 max-w-xl mx-auto font-medium">
                                Join thousands of happy travelers exploring the world with WanderWise. Start planning your next holiday in just one click.
                            </p>
                            <button
                                onClick={() => {
                                    if (user) {
                                        setPageView("dashboard");
                                    } else {
                                        setPageView("signup");
                                    }
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className="px-9 py-4 bg-white text-sunset hover:bg-slate-900 hover:text-white rounded-2xl font-extrabold text-base shadow-2xl transition-all duration-300 hover:scale-105"
                            >
                                Start Your Adventure Today ➔
                            </button>
                        </div>
                    </section>

                </main>
            )}

            {/* ============================================================ */}
            {/* FOOTER                                                       */}
            {/* ============================================================ */}
            {pageView !== "planner" && (
                <footer className="bg-slate-950 text-slate-400 py-12 px-4 sm:px-6 lg:px-8 border-t border-slate-800">
                    <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
                        <div className="space-y-1">
                            <div className="flex items-center justify-center md:justify-start gap-2 text-white font-heading font-extrabold text-lg">
                                <span>✈️</span>
                                <span>WanderWise Travel</span>
                            </div>
                            <p className="text-xs text-slate-500">
                                Handcrafted vacation planning, cozy boutique stays, and caring support.
                            </p>
                        </div>

                        <div className="flex items-center gap-6 text-xs font-semibold text-slate-400">
                            <button onClick={() => scrollToSection("home")} className="hover:text-white transition">Home</button>
                            <button onClick={() => scrollToSection("about")} className="hover:text-white transition">About Us</button>
                            <button onClick={() => scrollToSection("destinations")} className="hover:text-white transition">Destinations</button>
                            <button onClick={() => setPageView("signin")} className="hover:text-white transition">Traveler Sign In</button>
                        </div>

                        <div className="text-xs text-slate-600">
                            © 2026 WanderWise Travel Agency. All rights reserved.
                        </div>
                    </div>
                </footer>
            )}

            {/* ============================================================ */}
            {/* IRCTC FLIGHT BOOKING & BUDGET RECALCULATION MODAL            */}
            {/* ============================================================ */}
            {isBookingModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-4 animate-fade-in max-h-[92vh] overflow-y-auto custom-scrollbar">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2.5">
                                <span className="text-2xl">🎫</span>
                                <div>
                                    <h3 className="font-heading font-extrabold text-base sm:text-lg text-slate-900 leading-tight">
                                        Confirm Booked Flights & Upgrade Plan
                                    </h3>
                                    <p className="text-[11px] text-slate-500">
                                        Route: <strong>{currentParams?.source || "Origin"} ➔ {currentParams?.destination || "Destination"}</strong>
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsBookingModalOpen(false)}
                                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 text-sm font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleBudgetRecalculation} className="space-y-4 text-xs">
                            
                            {/* Question 1: One-Way or Round-Trip */}
                            <div>
                                <label className="block font-bold text-slate-800 text-xs mb-1.5">
                                    1. Did you book a One-Way flight or Round-Trip (Two-Way)?
                                </label>
                                <div className="grid grid-cols-2 gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => setBookingTripType("One-Way")}
                                        className={`py-2.5 px-3 rounded-2xl text-xs font-bold border transition flex items-center justify-center gap-2 ${
                                            bookingTripType === "One-Way"
                                                ? "bg-orange-50 border-sunset text-sunset shadow-xs ring-1 ring-sunset"
                                                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                                        }`}
                                    >
                                        <span>✈️</span>
                                        <span>One-Way</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setBookingTripType("Round-Trip"); setHasReturnFlight(true); }}
                                        className={`py-2.5 px-3 rounded-2xl text-xs font-bold border transition flex items-center justify-center gap-2 ${
                                            bookingTripType === "Round-Trip"
                                                ? "bg-orange-50 border-sunset text-sunset shadow-xs ring-1 ring-sunset"
                                                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                                        }`}
                                    >
                                        <span>🔄</span>
                                        <span>Round-Trip (Two-Way)</span>
                                    </button>
                                </div>
                            </div>

                            {/* Section 1: Outbound Journey */}
                            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                                    <span className="flex items-center gap-1.5">
                                        <span>🛫</span>
                                        <span>Outbound: {currentParams?.source || "Origin"} ➔ {currentParams?.destination || "Destination"}</span>
                                    </span>
                                    <span className="text-[10px] bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full font-bold">
                                        Outbound
                                    </span>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                        Booked Airline ({currentParams?.source || "Origin"} ➔ {currentParams?.destination || "Destination"})
                                    </label>
                                    <select
                                        value={outboundAirline}
                                        onChange={(e) => setOutboundAirline(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-sunset/30 focus:border-sunset"
                                    >
                                        <option value="IndiGo (Direct Domestic Flight)">IndiGo (Direct Domestic Flight)</option>
                                        <option value="Air India (Full Service Flight)">Air India (Full Service Flight)</option>
                                        <option value="SpiceJet Domestic Flight">SpiceJet Domestic Flight</option>
                                        <option value="Akasa Air Domestic Flight">Akasa Air Domestic Flight</option>
                                        <option value="Vistara / Air India Express">Vistara / Air India Express</option>
                                        <option value="Other Domestic Airline">Other Domestic Airline</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                        Flight Number (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={outboundFlightNo}
                                        onChange={(e) => setOutboundFlightNo(e.target.value)}
                                        placeholder="e.g. 6E-204"
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sunset/30 focus:border-sunset"
                                    />
                                </div>

                                {bookingTripType === "One-Way" && (
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                            Ticket Price in Rupees (₹) *
                                        </label>
                                        <input
                                            type="number"
                                            required
                                            min="1"
                                            value={bookedFlightPrice}
                                            onChange={(e) => setBookedFlightPrice(e.target.value)}
                                            placeholder="e.g. 4500"
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sunset/30 focus:border-sunset font-semibold text-emerald-800"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Section 2: Return Journey (Visible when Round-Trip) */}
                            {bookingTripType === "Round-Trip" && (
                                <div className="p-3.5 bg-orange-50/40 border border-orange-200 rounded-2xl space-y-3">
                                    <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                                        <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                                            <input
                                                type="checkbox"
                                                checked={hasReturnFlight}
                                                onChange={(e) => setHasReturnFlight(e.target.checked)}
                                                className="text-sunset focus:ring-sunset rounded"
                                            />
                                             <span className="flex items-center gap-1.5">
                                                <span>🛬</span>
                                                <span>Return: {currentParams?.destination || "Destination"} ➔ {currentParams?.source || "Origin"}</span>
                                            </span>
                                        </label>
                                        <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                                            Return
                                        </span>
                                    </div>

                                    {hasReturnFlight && (
                                        <>
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                                    Booked Return Airline ({currentParams?.destination || "Destination"} ➔ {currentParams?.source || "Origin"})
                                                </label>
                                                <select
                                                    value={returnAirline}
                                                    onChange={(e) => setReturnAirline(e.target.value)}
                                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-sunset/30 focus:border-sunset"
                                                >
                                                    <option value="IndiGo (Direct Domestic Flight)">IndiGo (Direct Domestic Flight)</option>
                                                    <option value="Air India (Full Service Flight)">Air India (Full Service Flight)</option>
                                                    <option value="SpiceJet Domestic Flight">SpiceJet Domestic Flight</option>
                                                    <option value="Akasa Air Domestic Flight">Akasa Air Domestic Flight</option>
                                                    <option value="Vistara / Air India Express">Vistara / Air India Express</option>
                                                    <option value="Other Domestic Airline">Other Domestic Airline</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                                    Return Flight Number (Optional)
                                                </label>
                                                <input
                                                    type="text"
                                                    value={returnFlightNo}
                                                    onChange={(e) => setReturnFlightNo(e.target.value)}
                                                    placeholder="e.g. 6E-512"
                                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sunset/30 focus:border-sunset"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                                    Total Combined Round-Trip Flight Fare in Rupees (₹) *
                                                </label>
                                                <input
                                                    type="number"
                                                    required
                                                    min="1"
                                                    value={bookedFlightPrice}
                                                    onChange={(e) => setBookedFlightPrice(e.target.value)}
                                                    placeholder="e.g. 9000 (total for both outbound & return tickets)"
                                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sunset/30 focus:border-sunset font-semibold text-emerald-800"
                                                />
                                                <p className="text-[10px] text-slate-500 mt-1">
                                                    Enter the total combined airfare paid for both journeys.
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Live Budget Recalculation Preview */}
                            {bookedFlightPrice && !isNaN(bookedFlightPrice) && Number(bookedFlightPrice) > 0 && (
                                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-[11px] space-y-1.5 text-emerald-950">
                                    <div className="font-bold flex items-center justify-between">
                                        <span>💰 Recalculated Budget Preview:</span>
                                        <span className="text-emerald-700 font-extrabold text-xs">
                                            Remaining: ₹{Math.max(0, ((parseFloat((currentParams?.budget || 25000).toString().replace(/[^0-9]/g, '')) || 25000) - parseFloat(bookedFlightPrice))).toLocaleString('en-IN')}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-slate-600 text-[10px]">
                                        <span>Total Budget: ₹{((parseFloat((currentParams?.budget || 25000).toString().replace(/[^0-9]/g, '')) || 25000)).toLocaleString('en-IN')}</span>
                                        <span>Airfare Paid: -₹{parseFloat(bookedFlightPrice).toLocaleString('en-IN')}</span>
                                    </div>
                                </div>
                            )}

                            <div className="pt-2 flex justify-end gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setIsBookingModalOpen(false)}
                                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition text-xs"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isUpdatingBudget || !bookedFlightPrice}
                                    className="px-5 py-2.5 bg-gradient-to-r from-sunset to-sunset-hover text-white rounded-xl font-bold transition shadow-md flex items-center gap-2 disabled:opacity-50 text-xs"
                                >
                                    {isUpdatingBudget ? (
                                        <>
                                            <div className="loader-spinner w-3 h-3"></div>
                                            <span>Updating Blueprint In-Place...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Upgrade Plan with Confirmed Tickets</span>
                                            <span>➔</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ============================================================ */}
            {/* SHARE TRAVEL FEEDBACK MODAL                                  */}
            {/* ============================================================ */}
            {isFeedbackModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-4 animate-fade-in">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">✨</span>
                                <h3 className="font-heading font-extrabold text-lg text-slate-900">
                                    Share Your Travel Feedback
                                </h3>
                            </div>
                            <button
                                onClick={() => setIsFeedbackModalOpen(false)}
                                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 text-sm font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        {feedbackSuccess ? (
                            <div className="p-4 bg-emerald-50 text-emerald-800 rounded-2xl text-xs font-bold text-center">
                                🎉 Thank you for sharing your travel experience! Your review is now live.
                            </div>
                        ) : (
                            <form onSubmit={handleSubmitFeedback} className="space-y-3.5 text-xs">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Your Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={fbName}
                                        onChange={(e) => setFbName(e.target.value)}
                                        placeholder="e.g. Ramesh Kulkarni"
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sunset/30 focus:border-sunset"
                                    />
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Destination in India Visited</label>
                                    <input
                                        type="text"
                                        required
                                        value={fbDest}
                                        onChange={(e) => setFbDest(e.target.value)}
                                        placeholder="e.g. Srinagar & Gulmarg, Kashmir"
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sunset/30 focus:border-sunset"
                                    />
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Rating</label>
                                    <div className="flex gap-2">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <button
                                                key={star}
                                                type="button"
                                                onClick={() => setFbRating(star)}
                                                className={`text-xl transition ${fbRating >= star ? 'text-amber-400 scale-110' : 'text-slate-300'}`}
                                            >
                                                ★
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Your Travel Review</label>
                                    <textarea
                                        required
                                        rows="3"
                                        value={fbComment}
                                        onChange={(e) => setFbComment(e.target.value)}
                                        placeholder="How was your holiday? Tell other domestic travelers what you loved most..."
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sunset/30 focus:border-sunset"
                                    ></textarea>
                                </div>

                                <div className="pt-2 flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsFeedbackModalOpen(false)}
                                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmittingFeedback}
                                        className="px-5 py-2.5 bg-gradient-to-r from-sunset to-sunset-hover text-white rounded-xl font-bold transition shadow-md"
                                    >
                                        {isSubmittingFeedback ? "Publishing..." : "Publish Feedback ➔"}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* ============================================================ */}
            {/* EMAIL TRAVEL BLUEPRINT MODAL                                 */}
            {/* ============================================================ */}
            {isEmailModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5 animate-fade-in">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">📧</span>
                                <h3 className="font-heading font-extrabold text-lg text-slate-900">
                                    Email Travel Blueprint
                                </h3>
                            </div>
                            <button
                                onClick={() => { setIsEmailModalOpen(false); setEmailStatus(null); }}
                                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 text-sm font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed">
                            Receive an official, clean, documented travel blueprint for <strong>{travelPlan?.destName || currentParams?.destination || "your holiday"}</strong> directly in your inbox.
                        </p>

                        <form onSubmit={handleSendEmail} className="space-y-4 text-xs">
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Traveler Email Address
                                </label>
                                <input
                                    type="email"
                                    required
                                    value={emailInput}
                                    onChange={(e) => setEmailInput(e.target.value)}
                                    placeholder="e.g. akshat0.r28@gmail.com"
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sunset/30 focus:border-sunset"
                                />
                            </div>

                            {emailStatus && (
                                <div className={`p-3 rounded-xl text-xs font-semibold ${emailStatus.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                                    {emailStatus.message}
                                </div>
                            )}

                            <div className="pt-2 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => { setIsEmailModalOpen(false); setEmailStatus(null); }}
                                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition"
                                >
                                    Close
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSendingEmail}
                                    className="px-5 py-2.5 bg-gradient-to-r from-sunset to-sunset-hover text-white rounded-xl font-bold transition shadow-md disabled:opacity-40"
                                >
                                    {isSendingEmail ? "Dispatching..." : "Send Blueprint ➔"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Sign In / Sign Up Modal */}
            <AuthModal
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
                initialTab={authModalTab}
                message={authModalMessage}
                onAuthSuccess={(u) => handleUserAuthenticated(u)}
            />

            {/* Emergency Medical & Hospital Finder Modal */}
            <EmergencyHospitalModal
                isOpen={isEmergencyModalOpen}
                onClose={() => setIsEmergencyModalOpen(false)}
                emergencyData={emergencyData}
                isLoading={isEmergencyLoading}
                openEmergencyModal={openEmergencyModal}
                userLocation={userLocation}
            />

        </div>
    );
}

// Global React Error Boundary for resilient, fail-safe rendering
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        console.error("WanderWise render error caught by ErrorBoundary:", error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 text-slate-800 font-sans">
                    <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-card border border-red-100 text-center space-y-4 animate-fade-in">
                        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center text-3xl mx-auto">
                            ⚠️
                        </div>
                        <h2 className="text-xl font-bold font-heading text-slate-900">Travel Lounge Temporarily Unavailable</h2>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            {this.state.error?.message || "A temporary display issue occurred while loading this view."}
                        </p>
                        <div className="pt-2 flex flex-col gap-2">
                            <button
                                onClick={() => {
                                    try {
                                        localStorage.removeItem("wanderwise_confirmed_trips_all");
                                        localStorage.removeItem("wanderwise_saved_plans_guest");
                                    } catch(e){}
                                    window.location.href = "/";
                                }}
                                className="w-full py-3 bg-gradient-to-r from-sunset to-sunset-hover text-white rounded-xl text-xs font-bold transition shadow-sm"
                            >
                                Clear Local Cache & Return Home ➔
                            </button>
                            <button
                                onClick={() => {
                                    this.setState({ hasError: false, error: null });
                                    window.location.reload();
                                }}
                                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                            >
                                Refresh Page
                            </button>
                        </div>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

// Mount React Root safely
function initWanderWise() {
    try {
        const rootEl = document.getElementById('root');
        if (!rootEl) {
            console.error("WanderWise mount error: #root container not found in DOM");
            return;
        }
        const RDOM = window.ReactDOM || ReactDOM;
        const root = RDOM.createRoot(rootEl);
        root.render(
            <ErrorBoundary>
                <App />
            </ErrorBoundary>
        );
        console.log("WanderWise Travel Application successfully mounted into DOM!");
    } catch(err) {
        console.error("WanderWise mount error:", err);
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initWanderWise);
} else {
    initWanderWise();
}