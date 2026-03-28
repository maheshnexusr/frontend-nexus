import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { logout, selectIsAuthenticated } from "@/features/auth/authSlice";
import sclinTechLogo      from "@/assets/images/Sclintech_BB_logo.png";
import colorLogo          from "@/assets/images/SclinNexus_color_logo.png";
import logoLight          from "@/assets/images/1.svg";
import logoDark           from "@/assets/images/2.svg";
import clientAbbott       from "@/assets/images/ClientLogos/abbott_logo.png";
import clientAlkem        from "@/assets/images/ClientLogos/alkem_logo.png";
import clientCipla        from "@/assets/images/ClientLogos/cipla_logo.png";
import clientDrReddys     from "@/assets/images/ClientLogos/dr_reddys_logo.png";
import clientAlphaMd      from "@/assets/images/ClientLogos/alpha_md.png";
import clientBharatBiotech from "@/assets/images/ClientLogos/bharat-biotech-logo.jpg";


// ─── Inline Styles ────────────────────────────────────────────────────────────
const styles = {
  // CSS variables are applied via a wrapper div with a style tag injection
};

const GRADIENT = "linear-gradient(135deg, #0ea5e9 0%, #10b981 100%)";
const PRIMARY = "#0ea5e9";
const PRIMARY_DARK = "#0284c7";
const DARK_BG = "#0f172a";
const DARK_SURFACE = "#1e293b";

// ─── Data ─────────────────────────────────────────────────────────────────────
const heroSlides = [
  {
    image:
      "https://images.pexels.com/photos/7579831/pexels-photo-7579831.jpeg?auto=compress&cs=tinysrgb&w=1920",
    title: "Transform Your",
    highlight: " Clinical Trials ",
    titleEnd: "with Modern SclinNexus Solutions",
    subtitle:
      "A powerful, intuitive clinical trial management platform that simplifies execution, ensures compliance, and accelerates your path to breakthrough discoveries.",
  },
  {
    image:
      "https://images.pexels.com/photos/3938022/pexels-photo-3938022.jpeg?auto=compress&cs=tinysrgb&w=1920",
    title: "Streamline Your",
    highlight: " Research Operations ",
    titleEnd: "with Advanced Analytics",
    subtitle:
      "Leverage real-time insights and predictive analytics to optimize your clinical trials and accelerate drug development timelines.",
  },
  {
    image:
      "https://images.pexels.com/photos/2280547/pexels-photo-2280547.jpeg?auto=compress&cs=tinysrgb&w=1920",
    title: "Ensure Complete",
    highlight: " Regulatory Compliance ",
    titleEnd: "with Built-in Standards",
    subtitle:
      "Stay audit-ready with FDA 21 CFR Part 11, GDPR, and ICH-GCP compliant document management and electronic signatures.",
  },
];

const stats = [
  { number: "500+", label: "Clinical Trials Managed" },
  { number: "50K+", label: "Patients Enrolled" },
  { number: "99.9%", label: "System Uptime" },
  { number: "40%", label: "Faster Trial Completion" },
];

const features = [
  {
    icon: "📄",
    title: "Sponsor eCOA",
    description:
      "Capture patient-reported outcomes with built-in compliance and real-time monitoring capabilities.",
    gradient: "linear-gradient(135deg, #a5b4fc 0%, #c4b5fd 100%)",
  },
  {
    icon: "⬛",
    title: "EDC System",
    description:
      "Streamline data collection with our intuitive electronic data capture solution designed for clinical excellence.",
    gradient: "linear-gradient(135deg, #fbcfe8 0%, #fecaca 100%)",
  },
  {
    icon: "⏱️",
    title: "IWRS Platform",
    description:
      "Simplify randomization, drug supply management and site coordination with intelligent workflows.",
    gradient: "linear-gradient(135deg, #93c5fd 0%, #a5f3fc 100%)",
  },
  {
    icon: "🛡️",
    title: "Nexus Vault",
    description:
      "Secure, compliant document storage with advanced encryption and audit trail capabilities.",
    gradient: "linear-gradient(135deg, #86efac 0%, #a7f3d0 100%)",
  },
  {
    icon: "📁",
    title: "SclinNexus Manager",
    description:
      "Streamline document workflows with advanced SclinNexus functionality and inspection readiness.",
    gradient: "linear-gradient(135deg, #fda4af 0%, #fde68a 100%)",
  },
  {
    icon: "🧠",
    title: "Medical Coding",
    description:
      "Optimize medical coding accuracy with AI-powered suggestions and centralized collaboration.",
    gradient: "linear-gradient(135deg, #c7d2fe 0%, #ddd6fe 100%)",
  },
];

const benefits = [
  { icon: "🏥", text: "FDA 21 CFR Part 11 Compliant" },
  { icon: "📊", text: "Real-time Data Analytics" },
  { icon: "🌐", text: "Global Regulatory Standards" },
  { icon: "🎧", text: "24/7 Technical Support" },
  { icon: "☁️", text: "Cloud-based Infrastructure" },
  { icon: "🌍", text: "Multi-language Support" },
  { icon: "🔒", text: "Enterprise-grade Security" },
  { icon: "⚡", text: "Lightning Fast Performance" },
];

const testimonials = [
  {
    name: "Dr. Anil Mehra, MD",
    role: "Principal Investigator, Oncology Research",
    quote:
      "SclinNexus simplified our study execution by consolidating data capture, monitoring, and reporting into a single platform. Investigator oversight and data review became significantly more efficient across all trial phases.",
    image:
      "https://images.pexels.com/photos/5215024/pexels-photo-5215024.jpeg?auto=compress&cs=tinysrgb&w=100",
  },
  {
    name: "Dr. Priya Nair, MD, PhD",
    role: "Director of Clinical Research",
    quote:
      "With SclinNexus, managing multicenter studies became far more structured. Study setup consistency and real-time visibility into patient data helped us reduce operational variability across sites.",
    image:
      "https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=100",
  },
  {
    name: "Dr. Rakesh Kulkarni, MD",
    role: "Head – Clinical Quality & Compliance",
    quote:
      "SclinNexus met our regulatory expectations with strong audit trails, controlled access, and validation support. The platform proved inspection-ready and aligned well with GxP and 21 CFR Part 11 requirements.",
    image:
      "https://images.pexels.com/photos/5452201/pexels-photo-5452201.jpeg?auto=compress&cs=tinysrgb&w=100",
  },
  {
    name: "Dr. Susan Williams, MD",
    role: "Clinical Data Management Lead",
    quote:
      "Data accuracy and integrity improved noticeably after adopting SclinNexus. Query resolution cycles shortened, and database lock timelines were achieved with greater confidence.",
    image:
      "https://images.pexels.com/photos/5407206/pexels-photo-5407206.jpeg?auto=compress&cs=tinysrgb&w=100",
  },
  {
    name: "Dr. Michael Thompson, MD",
    role: "Medical Director, Global Clinical Programs",
    quote:
      "SclinNexus enabled consistent governance across our global studies. The integrated dashboards provided clear insights into study progress, risks, and data quality at an executive level.",
    image:
      "https://images.pexels.com/photos/5452293/pexels-photo-5452293.jpeg?auto=compress&cs=tinysrgb&w=100",
  },
  {
    name: "Dr. Kavita Rao, MD",
    role: "Senior Clinical Investigator",
    quote:
      "The usability of SclinNexus stood out. Investigator workflows were intuitive, training time was minimal, and compliance controls were embedded without disrupting daily clinical operations.",
    image:
      "https://images.pexels.com/photos/5327656/pexels-photo-5327656.jpeg?auto=compress&cs=tinysrgb&w=100",
  },
  {
    name: "Dr. Rajesh Iyer, MD",
    role: "Principal Investigator, Clinical Research",
    quote:
      "SclinNexus enabled our site to manage protocol deviations, source data verification, and investigator sign-offs more efficiently. The system built-in controls supported compliance while allowing our team to focus on patient care and study quality.",
    image:
      "https://images.pexels.com/photos/5452268/pexels-photo-5452268.jpeg?auto=compress&cs=tinysrgb&w=100",
  },
];

const clientLogos = [
  { name: "Abbott",         src: clientAbbott        },
  { name: "Alkem",          src: clientAlkem         },
  { name: "Cipla",          src: clientCipla         },
  { name: "Dr. Reddy's",    src: clientDrReddys      },
  { name: "Bharat Biotech", src: clientBharatBiotech },
  { name: "Alpha MD",       src: clientAlphaMd       },
  { name: "Abbott",         src: clientAbbott        },
  { name: "Cipla",          src: clientCipla         },
];

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const ChevronLeft = ({ size = 24, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="15 18 9 12 15 6" />
  </svg>
);
const ChevronRight = ({ size = 24, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
const ArrowRight = ({ size = 16, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);
const ArrowLeft = ({ size = 20, color = "currentColor" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);
const Check = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="white"
    strokeWidth={3}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const Linkedin = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);
const Twitter = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" />
  </svg>
);

// ─── Privacy / Terms / Cookie Content ────────────────────────────────────────
const LEGAL_PAGES = {
  privacy: {
    title: "Privacy Policy",
    blocks: [
      {
        h: "Introduction",
        p: "SclinNexus is dedicated to protecting your online privacy. This policy outlines how SclinNexus collects, uses, and safeguards your personally identifiable information. For inquiries regarding this privacy statement, please contact us at support@SclinNexus.com.",
      },
      {
        h: "Information Collection and Use",
        p: "SclinNexus collects personal information when you register to receive communications or download information. We may combine this with data obtained from business partners. Registration may require details such as name, email address, birth date, gender, zip code, occupation, and personal interests.",
      },
      {
        h: "Information Sharing and Disclosure",
        p: "Our primary objective in collecting user information is to enhance your experience on our web publications. SclinNexus may also disclose user information when required by law, in good faith belief that disclosure is necessary to comply with legal processes or protect our rights.",
      },
      {
        h: "Email",
        p: "SclinNexus respects the privacy of its readers and will not disclose, distribute, or rent its email subscriber newsletter list to any third party, nor will it permit anyone else to do so.",
      },
    ],
  },
  terms: {
    title: "Terms & Conditions",
    blocks: [
      {
        h: "Acknowledgment and Agreement",
        p: "By accessing and using this website, you unconditionally accept and agree to the following terms and conditions. SclinNexus reserves the right to amend the Terms of Use at any time without prior notice.",
      },
      {
        h: "The Veracity of Information",
        p: "The information provided on this website is not warranted to be accurate, current, or complete, and may contain technical inaccuracies or typographical errors. SclinNexus disclaims any responsibility for updating the site to ensure the accuracy or completeness of the information posted herein.",
      },
      {
        h: "No Guarantees or Warranties",
        p: 'The website and its contents are provided on an "as is" basis. Utilization of the website and its contents is at the user\'s sole risk, without any representations, endorsements, or warranties of any kind, whether express or implied.',
      },
      {
        h: "Utilization of Website",
        p: "Content provided on this website is intended exclusively for the personal use of its users. Users are prohibited from copying, modifying, distributing, transmitting, displaying, performing, reproducing, or republishing any content without obtaining prior written consent from SclinNexus.",
      },
      {
        h: "Copyrights and Intellectual Property",
        p: "All content on this website, including white papers, case studies, graphics, icons, and the overall design, is the sole and exclusive property of SclinNexus, protected by applicable intellectual property laws.",
      },
      {
        h: "Disclaimer of Liability",
        p: "SclinNexus shall not be liable for any damages whatsoever arising out of or in connection with this website, including direct, indirect, incidental, special, exemplary, or consequential damages, lost profits, or business interruption.",
      },
    ],
  },
  cookies: {
    title: "Cookie Policy",
    blocks: [
      {
        h: "Use of Cookies",
        p: "We may utilize information gathered from our Cookies to discern user behavior and to deliver content and offers tailored to your profile, thereby enhancing the convenience for users of our Site.",
      },
      {
        h: "Marketing and Statistics Cookies",
        p: "We employ marketing and statistics cookies to gain insights into visitors' behavior, such as their interactions with the website and to track visitors' sessions.",
      },
      {
        h: "Managing Cookies",
        p: "Should you prefer not to have Cookies placed on your device, you may adjust the settings of your Internet browser to reject the placement of all or some Cookies and to alert you when a Cookie is placed on your device.",
      },
      {
        h: "Third-Party Tools",
        p: "We incorporate third-party tools on the SclinNexus website for analytical or user experience purposes.",
      },
      {
        h: "Social Media",
        p: "Should you use social media or other third-party credentials to log in to our website, the respective organization may set a cookie that allows them to recognize you.",
      },
      {
        h: "Your Rights Under GDPR",
        p: "You have the right to withdraw consent, request access and rectification of your personal data, request erasure, object to processing, and lodge a complaint with a data protection authority.",
      },
    ],
  },
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const dispatch        = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  const [isScrolled, setIsScrolled] = useState(false);
  const [activePage, setActivePage] = useState("home");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [hoveredFeature, setHoveredFeature] = useState(null);
  const [hoveredBenefit, setHoveredBenefit] = useState(null);
  const [hoveredSocial, setHoveredSocial] = useState(null);

  // Clear any active session when the landing page mounts.
  // This ensures Sign In always asks for credentials after returning here.
  useEffect(() => {
    if (isAuthenticated) dispatch(logout());
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll listener
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Hero carousel auto-advance
  useEffect(() => {
    const id = setInterval(
      () => setCurrentSlide((p) => (p + 1) % heroSlides.length),
      5000,
    );
    return () => clearInterval(id);
  }, []);

  // Testimonial auto-advance
  useEffect(() => {
    const id = setInterval(
      () => setCurrentTestimonial((p) => (p + 1) % testimonials.length),
      6000,
    );
    return () => clearInterval(id);
  }, []);

  const navigate = useNavigate();

  const goLegal = (page) => {
    setActivePage(page);
    window.scrollTo(0, 0);
  };

  // ─── Shared style tokens ───────────────────────────────────────────────────
  const scrolled = isScrolled || activePage !== "home";

  const headerStyle = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    padding: "1rem 3rem",
    transition: "all 0.3s ease",
    ...(scrolled
      ? {
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(20px)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
        }
      : {}),
  };

  const logoTextStyle = {
    fontSize: "1.5rem",
    fontWeight: 800,
    letterSpacing: "-0.02em",
    transition: "color 0.3s ease",
    color: scrolled ? "#1e293b" : "#ffffff",
  };

  const navBtnBase = {
    border: "none",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: "0.9375rem",
    fontWeight: 500,
    transition: "all 0.2s ease",
    background: "transparent",
  };

  return (
    <>
      {/* Inject keyframe CSS */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Serif+Display:ital@0;1&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .hero-content-animate { animation: fadeSlide 0.7s ease both; }
        .feature-card-hover:hover { transform: translateY(-8px); box-shadow: 0 20px 50px rgba(0,0,0,0.1) !important; }
        .feature-card-hover:hover .card-top-bar { opacity: 1 !important; }
        .footer-link:hover { color: #0ea5e9 !important; padding-left: 4px !important; }
        .social-link:hover { background: #0ea5e9 !important; transform: translateY(-2px); }
        .carousel-btn:hover { background: rgba(255,255,255,0.25) !important; transform: translateY(-50%) scale(1.1) !important; }
        .testimonial-nav-btn:hover { background: #0ea5e9 !important; border-color: #0ea5e9 !important; color: white !important; }
        .cta-primary-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(14,165,233,0.4) !important; }
        .cta-secondary-btn:hover { background: rgba(255,255,255,0.1) !important; border-color: rgba(255,255,255,0.6) !important; }
        .logo-item:hover { opacity: 1 !important; transform: scale(1.05) !important; }
        .logo-item:hover img { filter: grayscale(0%) !important; }
        .back-btn:hover { background: #e2e8f0 !important; color: #0ea5e9 !important; }
        .feature-link:hover { gap: 0.625rem !important; color: #0284c7 !important; }
        .signin-btn:hover { color: #0ea5e9 !important; }
        .signup-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(14,165,233,0.4) !important; }
        .benefit-item-el:hover { background: #ffffff !important; box-shadow: 0 10px 30px rgba(0,0,0,0.08) !important; transform: translateY(-2px); }
        .hero-cta-primary:hover { transform: translateY(-3px); box-shadow: 0 15px 40px rgba(14,165,233,0.45) !important; }
        .hero-cta-secondary:hover { background: rgba(255,255,255,0.2) !important; border-color: rgba(255,255,255,0.5) !important; }
        .cta-main-btn:hover { transform: translateY(-2px); box-shadow: 0 15px 40px rgba(0,0,0,0.3) !important; }
      `}</style>

      <div
        style={{
          fontFamily: "'DM Sans', sans-serif",
          background: "#ffffff",
          minHeight: "100vh",
          overflowX: "hidden",
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <header style={headerStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              maxWidth: 1400,
              margin: "0 auto",
            }}
          >
            {/* Logo */}
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
            >
              <img
                src={colorLogo}
                alt="SclinNexus Logo"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "#ffffff",
                  padding: 4,
                  objectFit: "contain",
                  flexShrink: 0,
                  boxShadow: scrolled ? "none" : "0 2px 8px rgba(0,0,0,0.15)",
                }}
              />
              <span style={logoTextStyle}>SclinNexus</span>
            </div>

            {/* Buttons */}
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
            >
              <button
                className="signin-btn"
                style={{
                  ...navBtnBase,
                  color: scrolled ? "#1e293b" : "#fff",
                  padding: "0.5rem 1rem",
                }}
                onClick={() => navigate("/signin")}
              >
                Sign In
              </button>
              <button
                className="signup-btn"
                style={{
                  ...navBtnBase,
                  padding: "0.625rem 1.5rem",
                  borderRadius: 8,
                  background: GRADIENT,
                  color: "#fff",
                  fontWeight: 600,
                  boxShadow: "0 4px 15px rgba(14,165,233,0.3)",
                  transition: "all 0.3s ease",
                }}
                onClick={() => navigate("/signup")}
              >
                Get Started
              </button>
            </div>
          </div>
        </header>

        {/* ── Pages ──────────────────────────────────────────────────────────── */}
        {activePage === "home" && (
          <>
            {/* ── Hero ─────────────────────────────────────────────────────── */}
            <section
              style={{
                position: "relative",
                minHeight: "100vh",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "8rem 2rem 2rem",
                overflow: "hidden",
              }}
            >
              {/* Carousel slides */}
              {heroSlides.map((slide, i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundImage: `url(${slide.image})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    opacity: i === currentSlide ? 1 : 0,
                    transition: "opacity 1s ease-in-out",
                  }}
                />
              ))}
              {/* Overlay */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(135deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.75) 100%)",
                  zIndex: 1,
                }}
              />

              {/* Content */}
              <div
                key={currentSlide}
                className="hero-content-animate"
                style={{
                  position: "relative",
                  zIndex: 10,
                  textAlign: "center",
                  maxWidth: 900,
                  margin: "0 auto",
                }}
              >
                <h1
                  style={{
                    fontSize: "clamp(1.5rem, 5vw, 3.5rem)",
                    fontWeight: 800,
                    color: "#fff",
                    marginBottom: "1.5rem",
                    lineHeight: 1.15,
                    letterSpacing: "-0.03em",
                    textShadow: "2px 2px 8px rgba(0,0,0,0.5)",
                  }}
                >
                  {heroSlides[currentSlide].title}
                  <span
                    style={{
                      background:
                        "linear-gradient(135deg, #4ade80 0%, #22d3ee 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    {heroSlides[currentSlide].highlight}
                  </span>
                  {heroSlides[currentSlide].titleEnd}
                </h1>
                <p
                  style={{
                    fontSize: "clamp(0.9rem, 2vw, 1.25rem)",
                    color: "#fff",
                    marginBottom: "2.5rem",
                    lineHeight: 1.7,
                    maxWidth: 700,
                    margin: "0 auto 2.5rem",
                    textShadow: "1px 1px 6px rgba(0,0,0,0.5)",
                  }}
                >
                  {heroSlides[currentSlide].subtitle}
                </p>
              </div>

              {/* Carousel nav */}
              <button
                className="carousel-btn"
                onClick={() =>
                  setCurrentSlide(
                    (p) => (p - 1 + heroSlides.length) % heroSlides.length,
                  )
                }
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "2rem",
                  transform: "translateY(-50%)",
                  zIndex: 15,
                  background: "rgba(255,255,255,0.15)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: "50%",
                  width: 50,
                  height: 50,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                }}
              >
                <ChevronLeft size={28} />
              </button>
              <button
                className="carousel-btn"
                onClick={() =>
                  setCurrentSlide((p) => (p + 1) % heroSlides.length)
                }
                style={{
                  position: "absolute",
                  top: "50%",
                  right: "2rem",
                  transform: "translateY(-50%)",
                  zIndex: 15,
                  background: "rgba(255,255,255,0.15)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: "50%",
                  width: 50,
                  height: 50,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                }}
              >
                <ChevronRight size={28} />
              </button>

              {/* Dots */}
              <div
                style={{
                  position: "absolute",
                  bottom: 140,
                  left: "50%",
                  transform: "translateX(-50%)",
                  display: "flex",
                  gap: "0.75rem",
                  zIndex: 15,
                }}
              >
                {heroSlides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentSlide(i)}
                    style={{
                      width: i === currentSlide ? 32 : 12,
                      height: 12,
                      borderRadius: i === currentSlide ? 6 : "50%",
                      background:
                        i === currentSlide ? PRIMARY : "rgba(255,255,255,0.4)",
                      border: "none",
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                    }}
                  />
                ))}
              </div>

              {/* Stats bar */}
              <div
                style={{
                  position: "relative",
                  zIndex: 10,
                  display: "flex",
                  justifyContent: "center",
                  gap: "4rem",
                  marginTop: "4rem",
                  paddingTop: "3rem",
                  borderTop: "1px solid rgba(255,255,255,0.15)",
                  flexWrap: "wrap",
                }}
              >
                {stats.map((s, i) => (
                  <div key={i} style={{ textAlign: "center" }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: "clamp(1.25rem, 3vw, 2.5rem)",
                        fontWeight: 800,
                        color: "#fff",
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {s.number}
                    </span>
                    <span
                      style={{
                        fontSize: "0.875rem",
                        color: "rgba(255,255,255,0.85)",
                      }}
                    >
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Trusted By ───────────────────────────────────────────────── */}
            <section
              style={{
                padding: "3rem 2rem",
                background: "#f8fafc",
                borderBottom: "1px solid #e2e8f0",
                overflow: "hidden",
              }}
            >
              <p
                style={{
                  textAlign: "center",
                  color: "#64748b",
                  fontSize: "0.875rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: "1.5rem",
                }}
              >
                Trusted by leading pharmaceutical and research organizations
              </p>
              <div
                style={{
                  width: "100%",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: 0,
                    width: 100,
                    background:
                      "linear-gradient(to right, #f8fafc, transparent)",
                    zIndex: 2,
                    pointerEvents: "none",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    right: 0,
                    width: 100,
                    background:
                      "linear-gradient(to left, #f8fafc, transparent)",
                    zIndex: 2,
                    pointerEvents: "none",
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    gap: "3rem",
                    animation: "marquee 20s linear infinite",
                    width: "max-content",
                  }}
                >
                  {[...clientLogos, ...clientLogos].map((logo, i) => (
                    <div
                      key={i}
                      className="logo-item"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: 0.7,
                        transition: "all 0.3s ease",
                        padding: "0.75rem 1.5rem",
                        borderRadius: 8,
                        background: "#fff",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                        minWidth: 120,
                      }}
                    >
                      <img
                        src={logo.src}
                        alt={logo.name}
                        style={{
                          maxHeight: 50,
                          maxWidth: 100,
                          objectFit: "contain",
                          filter: "grayscale(100%)",
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ── Features ─────────────────────────────────────────────────── */}
            <section
              id="features"
              style={{ padding: "6rem 2rem", background: "#fff" }}
            >
              <div style={{ textAlign: "center", marginBottom: "4rem" }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "0.375rem 1rem",
                    background: "rgba(14,165,233,0.1)",
                    color: PRIMARY,
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    borderRadius: 50,
                    marginBottom: "1rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Platform Features
                </span>
                <h2
                  style={{
                    fontSize: "clamp(1.75rem, 4vw, 2.75rem)",
                    fontWeight: 800,
                    color: "#1e293b",
                    marginBottom: "1rem",
                    letterSpacing: "-0.02em",
                  }}
                >
                  Integrated Clinical Platform
                </h2>
                <p
                  style={{
                    fontSize: "1.125rem",
                    color: "#64748b",
                    maxWidth: 600,
                    margin: "0 auto",
                    lineHeight: 1.7,
                  }}
                >
                  Everything you need to manage clinical trials efficiently,
                  from patient enrollment to regulatory submissions.
                </p>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                  gap: "2rem",
                  maxWidth: 1200,
                  margin: "0 auto",
                }}
              >
                {features.map((f, i) => (
                  <div
                    key={i}
                    className="feature-card-hover"
                    onMouseEnter={() => setHoveredFeature(i)}
                    onMouseLeave={() => setHoveredFeature(null)}
                    style={{
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: 20,
                      padding: "2rem",
                      transition: "all 0.4s ease",
                      position: "relative",
                      overflow: "hidden",
                      boxShadow:
                        hoveredFeature === i
                          ? "0 20px 50px rgba(0,0,0,0.1)"
                          : "none",
                      borderColor:
                        hoveredFeature === i ? "transparent" : "#e2e8f0",
                    }}
                  >
                    <div
                      className="card-top-bar"
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 4,
                        background: GRADIENT,
                        opacity: hoveredFeature === i ? 1 : 0,
                        transition: "opacity 0.3s ease",
                      }}
                    />
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 14,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: "1.25rem",
                        background: f.gradient,
                        fontSize: 28,
                      }}
                    >
                      {f.icon}
                    </div>
                    <h3
                      style={{
                        fontSize: "1.25rem",
                        fontWeight: 700,
                        color: "#1e293b",
                        marginBottom: "0.75rem",
                      }}
                    >
                      {f.title}
                    </h3>
                    <p
                      style={{
                        fontSize: "0.9375rem",
                        color: "#64748b",
                        lineHeight: 1.6,
                        marginBottom: "1.25rem",
                      }}
                    >
                      {f.description}
                    </p>
                    <a
                      href="#"
                      className="feature-link"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.375rem",
                        color: PRIMARY,
                        fontWeight: 600,
                        fontSize: "0.875rem",
                        textDecoration: "none",
                        transition: "gap 0.3s ease",
                      }}
                    >
                      Learn more <ArrowRight size={16} />
                    </a>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Showcase ─────────────────────────────────────────────────── */}
            <section style={{ padding: "6rem 2rem", background: "#f8fafc" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                  gap: "4rem",
                  alignItems: "center",
                  maxWidth: 1200,
                  margin: "0 auto",
                }}
              >
                <div>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "0.375rem 1rem",
                      background: "rgba(14,165,233,0.1)",
                      color: PRIMARY,
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      borderRadius: 50,
                      marginBottom: "1rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Why Choose Us
                  </span>
                  <h2
                    style={{
                      fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
                      fontWeight: 800,
                      color: "#1e293b",
                      marginBottom: "1.5rem",
                      lineHeight: 1.2,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    Designed for{" "}
                    <span
                      style={{
                        background: GRADIENT,
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                      }}
                    >
                      Modern Clinical Research
                    </span>
                  </h2>
                  <p
                    style={{
                      fontSize: "1.0625rem",
                      color: "#64748b",
                      lineHeight: 1.7,
                      marginBottom: "2rem",
                    }}
                  >
                    Our platform is built from the ground up to meet the unique
                    challenges of clinical trials, with features that ensure
                    compliance, security, and efficiency at every step.
                  </p>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "1.25rem",
                    }}
                  >
                    {[
                      {
                        h: "Regulatory Compliance",
                        p: "Built-in FDA 21 CFR Part 11, GDPR, and ICH-GCP compliance",
                      },
                      {
                        h: "Real-time Collaboration",
                        p: "Connect sites, sponsors, and CROs on a single platform",
                      },
                      {
                        h: "AI-Powered Insights",
                        p: "Predictive analytics to identify risks and optimize timelines",
                      },
                    ].map((item, i) => (
                      <div key={i} style={{ display: "flex", gap: "1rem" }}>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            background: GRADIENT,
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <Check size={16} />
                        </div>
                        <div>
                          <h4
                            style={{
                              fontSize: "1rem",
                              fontWeight: 600,
                              color: "#1e293b",
                              marginBottom: "0.25rem",
                            }}
                          >
                            {item.h}
                          </h4>
                          <p
                            style={{
                              fontSize: "0.875rem",
                              color: "#64748b",
                              margin: 0,
                              lineHeight: 1.5,
                            }}
                          >
                            {item.p}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ position: "relative", height: 450 }}>
                  <img
                    src="https://images.pexels.com/photos/3938022/pexels-photo-3938022.jpeg?auto=compress&cs=tinysrgb&w=600"
                    alt="Clinical Lab"
                    style={{
                      position: "absolute",
                      width: "70%",
                      height: "80%",
                      top: 0,
                      left: 0,
                      zIndex: 2,
                      objectFit: "cover",
                      borderRadius: 20,
                      boxShadow: "0 25px 50px rgba(0,0,0,0.15)",
                    }}
                  />
                  <img
                    src="https://images.pexels.com/photos/4226219/pexels-photo-4226219.jpeg?auto=compress&cs=tinysrgb&w=600"
                    alt="Medical Team"
                    style={{
                      position: "absolute",
                      width: "60%",
                      height: "70%",
                      bottom: 0,
                      right: 0,
                      zIndex: 1,
                      objectFit: "cover",
                      borderRadius: 20,
                      boxShadow: "0 25px 50px rgba(0,0,0,0.15)",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      width: 100,
                      height: 100,
                      background: GRADIENT,
                      borderRadius: "50%",
                      opacity: 0.2,
                      top: "10%",
                      right: "20%",
                      zIndex: 0,
                    }}
                  />
                </div>
              </div>
            </section>

            {/* ── Benefits ─────────────────────────────────────────────────── */}
            <section
              id="benefits"
              style={{ padding: "6rem 2rem", background: "#fff" }}
            >
              <div style={{ textAlign: "center", marginBottom: "4rem" }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "0.375rem 1rem",
                    background: "rgba(14,165,233,0.1)",
                    color: PRIMARY,
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    borderRadius: 50,
                    marginBottom: "1rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Benefits
                </span>
                <h2
                  style={{
                    fontSize: "clamp(1.75rem, 4vw, 2.75rem)",
                    fontWeight: 800,
                    color: "#1e293b",
                    marginBottom: "1rem",
                    letterSpacing: "-0.02em",
                  }}
                >
                  Why Choose SclinNexus?
                </h2>
                <p
                  style={{
                    fontSize: "1.125rem",
                    color: "#64748b",
                    maxWidth: 600,
                    margin: "0 auto",
                    lineHeight: 1.7,
                  }}
                >
                  Comprehensive capabilities, flexible deployment, and proven
                  reliability for sponsors, CROs, and research sites.
                </p>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: "1.5rem",
                  maxWidth: 1200,
                  margin: "0 auto",
                }}
              >
                {benefits.map((b, i) => (
                  <div
                    key={i}
                    className="benefit-item-el"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "1rem",
                      padding: "1.25rem",
                      background: "#f8fafc",
                      borderRadius: 12,
                      transition: "all 0.3s ease",
                      cursor: "default",
                    }}
                  >
                    <span style={{ fontSize: 24, flexShrink: 0 }}>
                      {b.icon}
                    </span>
                    <span
                      style={{
                        fontSize: "0.9375rem",
                        color: "#1e293b",
                        fontWeight: 500,
                      }}
                    >
                      {b.text}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Testimonials ─────────────────────────────────────────────── */}
            <section
              style={{
                padding: "6rem 2rem",
                background: "#f8fafc",
                textAlign: "center",
              }}
            >
              <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.5rem 1rem",
                    background: "rgba(14,165,233,0.1)",
                    color: PRIMARY,
                    borderRadius: 100,
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    marginBottom: "1rem",
                  }}
                >
                  Customer Experience
                </span>
                <h2
                  style={{
                    fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
                    fontWeight: 700,
                    color: "#1e293b",
                    marginBottom: "3rem",
                  }}
                >
                  Why Clients Trust SclinSuite
                </h2>

                <div
                  style={{
                    position: "relative",
                    maxWidth: 900,
                    margin: "0 auto",
                    padding: "0 60px",
                  }}
                >
                  <div
                    key={currentTestimonial}
                    className="hero-content-animate"
                    style={{
                      background: "#fff",
                      borderRadius: 24,
                      padding: "3rem",
                      boxShadow: "0 20px 60px rgba(0,0,0,0.08)",
                    }}
                  >
                    <div
                      style={{
                        width: 100,
                        height: 100,
                        borderRadius: "50%",
                        overflow: "hidden",
                        margin: "0 auto 1.5rem",
                        border: `4px solid ${PRIMARY}`,
                      }}
                    >
                      <img
                        src={testimonials[currentTestimonial].image}
                        alt={testimonials[currentTestimonial].name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    </div>
                    <p
                      style={{
                        fontSize: "1.125rem",
                        color: "#64748b",
                        lineHeight: 1.8,
                        marginBottom: "1.5rem",
                        fontStyle: "italic",
                        maxWidth: 700,
                        margin: "0 auto 1.5rem",
                      }}
                    >
                      "{testimonials[currentTestimonial].quote}"
                    </p>
                    <h4
                      style={{
                        fontSize: "1.25rem",
                        fontWeight: 600,
                        color: "#1e293b",
                        marginBottom: "0.25rem",
                      }}
                    >
                      {testimonials[currentTestimonial].name}
                    </h4>
                    <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
                      {testimonials[currentTestimonial].role}
                    </p>
                  </div>

                  <button
                    className="testimonial-nav-btn"
                    onClick={() =>
                      setCurrentTestimonial(
                        (p) =>
                          (p - 1 + testimonials.length) % testimonials.length,
                      )
                    }
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: 0,
                      transform: "translateY(-50%)",
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      color: "#1e293b",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      zIndex: 10,
                    }}
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <button
                    className="testimonial-nav-btn"
                    onClick={() =>
                      setCurrentTestimonial(
                        (p) => (p + 1) % testimonials.length,
                      )
                    }
                    style={{
                      position: "absolute",
                      top: "50%",
                      right: 0,
                      transform: "translateY(-50%)",
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      color: "#1e293b",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      zIndex: 10,
                    }}
                  >
                    <ChevronRight size={24} />
                  </button>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      gap: "0.5rem",
                      marginTop: "2rem",
                    }}
                  >
                    {testimonials.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentTestimonial(i)}
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background:
                            i === currentTestimonial ? PRIMARY : "#cbd5e1",
                          border: "none",
                          cursor: "pointer",
                          transition: "all 0.3s ease",
                          transform:
                            i === currentTestimonial
                              ? "scale(1.2)"
                              : "scale(1)",
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* ── CTA ──────────────────────────────────────────────────────── */}
            <section
              id="contact"
              style={{
                position: "relative",
                padding: "6rem 2rem",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: `linear-gradient(135deg, ${DARK_BG} 0%, #1e3a5f 50%, ${PRIMARY_DARK} 100%)`,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage:
                    "radial-gradient(circle at 20% 80%, rgba(14,165,233,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(16,185,129,0.15) 0%, transparent 50%)",
                }}
              />
              <div
                style={{
                  position: "relative",
                  zIndex: 10,
                  textAlign: "center",
                  maxWidth: 700,
                  margin: "0 auto",
                }}
              >
                <h2
                  style={{
                    fontSize: "clamp(1.75rem, 4vw, 2.75rem)",
                    fontWeight: 800,
                    color: "#fff",
                    marginBottom: "1.25rem",
                    letterSpacing: "-0.02em",
                  }}
                >
                  Ready to Accelerate Your Clinical Trials?
                </h2>
                <p
                  style={{
                    fontSize: "1.125rem",
                    color: "rgba(255,255,255,0.85)",
                    marginBottom: "2rem",
                    lineHeight: 1.7,
                  }}
                >
                  Join hundreds of research organizations already using
                  SclinNexus to streamline their clinical operations and bring
                  treatments to patients faster.
                </p>
                <div
                  style={{
                    display: "flex",
                    gap: "1rem",
                    justifyContent: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    className="cta-main-btn"
                    style={{
                      padding: "1rem 2rem",
                      fontSize: "1rem",
                      fontWeight: 600,
                      borderRadius: 12,
                      background: "#fff",
                      border: "none",
                      color: PRIMARY_DARK,
                      boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                    }}
                    onClick={() => navigate("/signup")}
                  >
                    Contact Us Today
                  </button>
                </div>
              </div>
            </section>
          </>
        )}

        {/* ── Legal Pages ──────────────────────────────────────────────────── */}
        {["privacy", "terms", "cookies"].includes(activePage) && (
          <section
            style={{
              padding: "8rem 2rem 5rem",
              background: "#fff",
              minHeight: "calc(100vh - 200px)",
            }}
          >
            <div style={{ maxWidth: 900, margin: "0 auto" }}>
              <button
                className="back-btn"
                onClick={() => {
                  setActivePage("home");
                  window.scrollTo(0, 0);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.75rem 1.25rem",
                  background: "#f8fafc",
                  border: "none",
                  borderRadius: 8,
                  color: "#1e293b",
                  fontSize: "0.9375rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  marginBottom: "2rem",
                }}
              >
                <ArrowLeft size={20} /> Back to Home
              </button>
              <h2
                style={{
                  fontSize: "clamp(1.5rem, 4vw, 2.25rem)",
                  fontWeight: 700,
                  color: "#1e293b",
                  marginBottom: "2.5rem",
                  paddingBottom: "1rem",
                  borderBottom: "2px solid #e2e8f0",
                }}
              >
                {LEGAL_PAGES[activePage].title}
              </h2>
              {LEGAL_PAGES[activePage].blocks.map((block, i) => (
                <div key={i} style={{ marginBottom: "2rem" }}>
                  <h3
                    style={{
                      fontSize: "1.25rem",
                      fontWeight: 600,
                      color: "#1e293b",
                      marginBottom: "0.75rem",
                    }}
                  >
                    {block.h}
                  </h3>
                  <p
                    style={{
                      fontSize: "1rem",
                      lineHeight: 1.8,
                      color: "#64748b",
                    }}
                  >
                    {block.p}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <footer
          style={{
            padding: "4rem 2rem 2rem",
            background: DARK_BG,
            color: "#fff",
          }}
        >
          <div style={{ maxWidth: 1400, margin: "0 auto" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "3rem",
                paddingBottom: "3rem",
                borderBottom: "1px solid rgba(255,255,255,0.1)",
                marginBottom: "2rem",
              }}
            >
              {/* Brand */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    marginBottom: "1.25rem",
                  }}
                >
                  <img
                    src={colorLogo}
                    alt="SclinNexus Logo"
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      background: "#ffffff",
                      padding: 4,
                      objectFit: "contain",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: "1.375rem",
                      fontWeight: 800,
                      color: "#fff",
                    }}
                  >
                    SclinNexus
                  </span>
                </div>
                <p
                  style={{
                    fontSize: "0.9375rem",
                    color: "rgba(255,255,255,0.6)",
                    lineHeight: 1.6,
                    marginBottom: "1.5rem",
                    maxWidth: 280,
                  }}
                >
                  Empowering clinical research with innovative technology
                  solutions for faster, safer drug development.
                </p>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  {[<Linkedin size={20} />, <Twitter size={20} />].map(
                    (Icon, i) => (
                      <a
                        key={i}
                        className="social-link"
                        href="#"
                        style={{
                          width: 40,
                          height: 40,
                          background: "rgba(255,255,255,0.1)",
                          borderRadius: 10,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          transition: "all 0.3s ease",
                          textDecoration: "none",
                        }}
                      >
                        {Icon}
                      </a>
                    ),
                  )}
                </div>
              </div>

              {/* Link columns */}
              {[
                {
                  title: "Platform",
                  links: ["Features", "Pricing", "Security", "Integrations"],
                },
                {
                  title: "Solutions",
                  links: [
                    "For Sponsors",
                    "For CROs",
                    "For Sites",
                    "For Biotech",
                  ],
                },
                {
                  title: "Resources",
                  links: ["Blog", "Documentation", "Webinars", "Support"],
                },
                {
                  title: "Legal",
                  links: [
                    { label: "Privacy Policy", page: "privacy" },
                    { label: "Terms of Service", page: "terms" },
                    { label: "Cookie Policy", page: "cookies" },
                  ],
                },
              ].map((col, ci) => (
                <div key={ci}>
                  <h4
                    style={{
                      fontSize: "0.9375rem",
                      fontWeight: 600,
                      color: "#fff",
                      marginBottom: "1.25rem",
                    }}
                  >
                    {col.title}
                  </h4>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {col.links.map((link, li) => {
                      const label =
                        typeof link === "string" ? link : link.label;
                      const href =
                        typeof link === "string"
                          ? `#${label.toLowerCase().replace(/\s+/g, "-")}`
                          : "#";
                      const onClick =
                        typeof link === "object"
                          ? (e) => {
                              e.preventDefault();
                              goLegal(link.page);
                            }
                          : undefined;
                      return (
                        <li key={li} style={{ marginBottom: "0.75rem" }}>
                          <a
                            className="footer-link"
                            href={href}
                            onClick={onClick}
                            style={{
                              color: "rgba(255,255,255,0.6)",
                              textDecoration: "none",
                              fontSize: "0.9375rem",
                              transition: "all 0.2s ease",
                              display: "inline-block",
                            }}
                          >
                            {label}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "1rem",
              }}
            >
              <p
                style={{
                  fontSize: "0.875rem",
                  color: "rgba(255,255,255,0.5)",
                  margin: 0,
                }}
              >
                © 2026 SclinNexus. All rights reserved.
              </p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  fontSize: "0.875rem",
                  color: "rgba(255,255,255,0.5)",
                }}
              >
                <span>Powered by</span>
                <img
                  src={sclinTechLogo}
                  alt="SclinTech Logo"
                  style={{
                    height: 48,
                    width: "auto",
                    objectFit: "contain",
                    filter: "brightness(1.1)",
                  }}
                />
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
