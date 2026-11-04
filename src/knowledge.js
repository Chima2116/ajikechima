// Answers come only from facts already published on the portfolio. Nothing here is generated.
const B = import.meta.env.PROD ? "../" : "/site/";
const S = {
  nuton: { name: "Nuton case study", href: B + "work/nuton.html" },
  kova: { name: "Kova case study", href: B + "work/kova.html" },
  mobi: { name: "Mobihealth case study", href: B + "work/mobihealth.html" },
  sync: { name: "Syncorix case study", href: B + "work/syncorix.html" },
  exp: { name: "Experience", href: B + "index.html#experience" },
  how: { name: "How I work", href: B + "index.html#how" },
  arch: { name: "Archive", href: B + "index.html#more-work" },
  ff: { name: "FreelanceFlow case study", href: B + "work/freelance-flow.html" },
  snap: { name: "Snapchat settings case study", href: B + "work/snapchat-settings.html" },
  dive: { name: "DiveHQ case study", href: B + "work/divehq.html" },
  xp: { name: "Xplore case study", href: B + "work/xplore.html" },
  work: { name: "Selected work", href: B + "index.html#work" },
  about: { name: "About", href: B + "index.html#about" },
  contact: { name: "Contact", href: B + "index.html#contact" },
};

export const ENTRIES = [
  {
    keys: ["skills", "good at", "strength", "tools", "design system", "expertise", "specialis", "industries", "what do you design"],
    text: "Chimaobi designs products, websites and the occasional brand, mostly for healthcare, fintech and AI teams. Day to day that means user research, user flows, high-fidelity UI for web and mobile, design systems, prototypes, and handoffs that engineers can build from.",
    sources: [S.work, S.how],
  },
  {
    keys: ["process", "how do you work", "how i work", "approach", "method", "workflow", "research", "testing"],
    text: "Every project moves through four steps: understand (talk to the people being designed for), map (flows, screens and edge cases), design (high-fidelity UI on a reusable system), and test and hand off (test early, then give engineers something they can build from).",
    sources: [S.how],
  },
  {
    keys: ["ai product", "ai-assisted", "vibe", "artificial", "design ai", "ai design", "work with ai"],
    text: "Chimaobi designs AI products: Nuton's AI tutor and explained quizzes, and Syncorix's clinical AI that a pharmacist can question and overrule. They also build working products with AI-assisted coding.",
    sources: [S.nuton, S.sync],
  },
  {
    keys: ["right now", "currently", "working on now", "working on at the moment", "these days"],
    text: "Right now Chimaobi is co-founder and lead product designer at Nuton, and is designing for Kova and Freshile too.",
    sources: [S.work],
  },
  {
    keys: ["resume", "cv", "curriculum"],
    text: "The resume is linked in the left rail and in the contact section of the site.",
    sources: [S.contact],
  },
  {
    keys: ["linkedin", "dribbble", "twitter", "social", "online", "behance"],
    text: "LinkedIn, Dribbble and X links are in the left rail and in the contact section.",
    sources: [S.contact],
  },
  {
    keys: ["based", "located", "location", "lagos", "time zone", "timezone", "nigeria", "where are you"],
    text: "Based in Lagos, Nigeria (WAT, GMT+1), and open to work.",
    sources: [S.contact],
  },
  {
    keys: ["archive", "older project", "other project", "personal project", "concept"],
    text: "The archive holds other case studies: client work (Mobihealth, Syncorix, Summit Bank), personal projects (FreelanceFlow, DiveHQ, Xplore, Foodshop) and a concept redesign of Snapchat's settings.",
    sources: [S.arch],
  },
  {
    keys: ["freelanceflow", "freelance flow", "freelancer"],
    text: "FreelanceFlow is a personal project from 2025: a unified web app for freelancers that puts tasks, time tracking and invoicing in one place, designed around one freelancer's day.",
    sources: [S.ff],
  },
  {
    keys: ["snapchat"],
    text: "A concept redesign from 2023 of Snapchat's settings page, started from interviews with four friends. It adds search, clearer grouping and two new ideas.",
    sources: [S.snap],
  },
  {
    keys: ["foodshop", "food shop", "usefood", "framer", "food vendor", "whatsapp"],
    text: "Foodshop is a personal project: a website for a tool that helps food vendors set up an online store and take orders and payments on WhatsApp, designed and built in Framer.",
    sources: [S.arch],
  },
  {
    keys: ["divehq", "dive hq", "qr", "payments app"],
    text: "DiveHQ is a personal product and brand project from 2023: a QR payments app to scan to pay, send money instantly and split bills, with a light and a dark mode.",
    sources: [S.dive],
  },
  {
    keys: ["xplore", "travel"],
    text: "Xplore is a personal project from 2022: a mobile app that simplifies travel planning by putting searching, booking and finding things to do in one place.",
    sources: [S.xp],
  },
  {
    keys: ["summit", "bank"],
    text: "Summit Bank was client work in 2025: Chimaobi designed the bank's website.",
    sources: [S.arch],
  },
  {
    keys: ["confidential", "nda", "can't talk", "cannot talk", "secret", "unreleased"],
    text: "Some of Chimaobi's work can't be shown publicly yet, so it isn't on the site.",
    sources: [S.work],
  },
  {
    keys: ["hobb", "outside work", "free time", "anime", "fifa", "barca", "football", "fun", "interests", "for fun"],
    text: "Outside work Chimaobi loves anime and FIFA, is a die-hard Barca fan, and describes themself as a wonderful spiker.",
    sources: [S.about],
  },
  {
    keys: ["experience", "years", "how long", "how many", "senior", "background", "career", "worked", "worked at", "employer", "companies", "company", "where have", "history"],
    text: "Chimaobi has been designing for 6 years, counting from when they started in 2020. Professional roles began in December 2022. They have worked at Nuton (co-founder and lead product designer, Nov 2024 to now), Syncorix Global (product designer, Apr 2025 to Jan 2026), Mobihealth International (product designer, Nov 2023 to Apr 2025) and 21st Century Technologies (UI/UX designer, Dec 2022 to Oct 2023).",
    sources: [S.exp],
  },
  {
    keys: ["who", "about you", "yourself", "introduce", "chimaobi", "designer"],
    text: "Chimaobi Ajike is a product designer based in Lagos. Recent work spans AI learning, fintech and healthcare products.",
    sources: [S.about, S.work],
  },
  {
    keys: ["available", "hire", "hiring", "open to work", "relocat", "remote", "job"],
    text: "Chimaobi is open to work. Based in Lagos (WAT, GMT+1).",
    sources: [S.contact],
  },
  {
    keys: ["nuton", "newton", "nuton.app", "learning", "tutor", "quiz", "ai learning"],
    text: "Nuton is an AI learning platform Chimaobi co-founded in November 2024. As co-founder and lead product designer, they designed the whole platform: onboarding, structured lessons, an AI tutor, and quizzes that explain every answer, plus the brand and design system. The engineering was done by the other co-founder.",
    sources: [S.nuton],
  },
  {
    keys: ["kova", "fintech", "money", "wallet"],
    text: "Kova is a group money-management product. Chimaobi designed the website and the social media flyers, and took over the mobile app design.",
    sources: [S.kova],
  },
  {
    keys: ["freshile", "cleaning"],
    text: "Freshile is an on-demand cleaning service (2025). Chimaobi designed the website, the user personas, and the customer and cleaner mobile apps. The admin dashboard is next.",
    sources: [S.work],
  },
  {
    keys: ["tls nigeria", "tls", "marine", "logistics", "offshore"],
    text: "TLS Nigeria is an offshore marine logistics and support company serving oil and gas. Chimaobi designed its corporate website (2026).",
    sources: [S.work],
  },
  {
    keys: ["mobihealth", "moby hill", "moby", "mobi hill", "mobile health", "health", "telehealth", "doctor", "patient"],
    text: "At Mobihealth International (Nov 2023 to Apr 2025) Chimaobi led the redesign of the website, patient web app, doctor dashboard and mobile app, with a design system underneath. The work started from interviews with doctors and patients.",
    sources: [S.mobi, S.exp],
  },
  {
    keys: ["syncorix", "tinkerix", "sincorix", "syncrix", "sync", "pharmac", "insurer"],
    text: "At Syncorix Global (Apr 2025 to Jan 2026) Chimaobi designed the pharmacist, doctor and insurer products of an AI healthcare platform, so the pharmacist can always question and overrule the AI. The company has since ceased operations.",
    sources: [S.sync, S.exp],
  },
  {
    keys: ["21st", "first century", "21 century", "century", "technologies", "hr", "visitor", "first job"],
    text: "At 21st Century Technologies (Dec 2022 to Oct 2023) Chimaobi was a UI/UX designer: in-house systems for HR management, internal email and visitor management, a pre-launch mobile app, and a redesign of the company website.",
    sources: [S.exp],
  },
  {
    keys: ["education", "degree", "university", "babcock", "study", "school"],
    text: "Chimaobi has a BSc in Software Engineering from Babcock University, Ogun State (graduated July 2022).",
    sources: [S.about],
  },
  {
    keys: ["code", "coding", "developer", "engineer", "handoff"],
    text: "Studying software engineering is why Chimaobi talks to engineers in their own terms, writes proper handoffs, and builds working products with AI-assisted coding. Chimaobi also builds with AI agents, Claude and Codex specifically, so an idea can go from Figma to something that runs. They did not write Nuton's code.",
    sources: [S.about],
  },
  {
    keys: ["contact", "email", "reach", "talk", "touch"],
    text: "The quickest way is email: ajike2116@gmail.com. Other links are on the contact section of the site.",
    sources: [S.contact],
  },
  {
    keys: ["work", "project", "portfolio", "case stud", "recent"],
    text: "Selected work: Nuton (2026), Kova (2026), Freshile (2025) and TLS Nigeria (2026). Older client work, personal projects and concept redesigns are in the archive.",
    sources: [S.work],
  },
];

export const GROUPS = [
  { title: "Work", items: [
    { label: "Nuton", q: "What did you design at Nuton?" },
    { label: "Kova", q: "Tell me about Kova" },
    { label: "Freshile", q: "Tell me about Freshile" },
    { label: "TLS Nigeria", q: "Tell me about TLS Nigeria" },
    { label: "The archive", q: "What is in the archive?" },
  ] },
  { title: "Experience", items: [
    { label: "Years of experience", q: "How many years of experience do you have?" },
    { label: "Where you've worked", q: "Where have you worked?" },
    { label: "Mobihealth", q: "Tell me about Mobihealth" },
    { label: "Syncorix", q: "Tell me about Syncorix" },
    { label: "21st Century", q: "What did you do at 21st Century Technologies?" },
    { label: "Education", q: "Where did you study?" },
  ] },
  { title: "Craft", items: [
    { label: "Skills", q: "What are your skills?" },
    { label: "Your process", q: "How do you work?" },
    { label: "AI products", q: "Do you design AI products?" },
    { label: "Do you code?", q: "Do you code?" },
  ] },
  { title: "About", items: [
    { label: "Who you are", q: "Who is Chimaobi?" },
    { label: "Right now", q: "What are you working on right now?" },
    { label: "Based where?", q: "Where are you based?" },
    { label: "Outside work", q: "What do you do outside work?" },
  ] },
  { title: "Hire", items: [
    { label: "Open to work?", q: "Are you open to work?" },
    { label: "Contact", q: "How can I contact you?" },
    { label: "Resume", q: "Where is your resume?" },
    { label: "Find you online", q: "Where can I find you online?" },
  ] },
];

export const FALLBACK =
  "I don't have that on record. I only answer from what's published on this portfolio. For anything else, email ajike2116@gmail.com.";

export function answer(q) {
  const t = q.toLowerCase();
  let best = null, score = 0;
  for (const e of ENTRIES) {
    const s = e.keys.reduce((n, k) => n + (t.includes(k) ? k.length : 0), 0);
    if (s > score) { best = e; score = s; }
  }
  return best ? { text: best.text, sources: best.sources } : { text: FALLBACK, sources: [] };
}
