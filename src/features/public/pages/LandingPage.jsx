import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { logout, selectIsAuthenticated } from "@/features/auth/authSlice";
import colorLogo     from "@/assets/images/SclinNexus_color_logo.png";


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

// ─── i18n (EN / ES) ────────────────────────────────────────────────────────────
const LANGUAGES = [
  { code: "en", label: "English", short: "EN" },
  { code: "es", label: "Español", short: "ES" },
];
const LANG_STORAGE_KEY = "sclinnexus.lang";

const TRANSLATIONS = {
  en: {
    signIn:     "Sign In",
    getStarted: "Get Started",
    heroSlides,
  },
  es: {
    signIn:     "Iniciar sesión",
    getStarted: "Comenzar",
    heroSlides: [
      {
        image: heroSlides[0].image,
        title: "Transforme sus",
        highlight: " Ensayos Clínicos ",
        titleEnd: "con soluciones modernas SclinNexus",
        subtitle:
          "Una plataforma de gestión de ensayos clínicos potente e intuitiva que simplifica la ejecución, garantiza el cumplimiento y acelera el camino hacia descubrimientos revolucionarios.",
      },
      {
        image: heroSlides[1].image,
        title: "Optimice sus",
        highlight: " Operaciones de Investigación ",
        titleEnd: "con análisis avanzados",
        subtitle:
          "Aproveche los conocimientos en tiempo real y los análisis predictivos para optimizar sus ensayos clínicos y acelerar los plazos de desarrollo de fármacos.",
      },
      {
        image: heroSlides[2].image,
        title: "Garantice un",
        highlight: " Cumplimiento Normativo Total ",
        titleEnd: "con estándares integrados",
        subtitle:
          "Manténgase listo para auditorías con gestión documental y firmas electrónicas conformes con FDA 21 CFR Parte 11, GDPR e ICH-GCP.",
      },
    ],
  },
};

const stats = [
  { number: "500+", label: "Clinical Trials Managed" },
  { number: "50K+", label: "Patients Enrolled" },
  { number: "99.9%", label: "System Uptime" },
  { number: "40%", label: "Faster Trial Completion" },
];

const features = [
  {
    icon: "ecoa",
    title: "Sponsor eCOA",
    description:
      "Capture patient-reported outcomes with built-in compliance and real-time monitoring capabilities.",
    iconBg: "#eff6ff",
    iconBorder: "#dbeafe",
    accent: "#2563eb",
  },
  {
    icon: "edc",
    title: "EDC System",
    description:
      "Streamline data collection with our intuitive electronic data capture solution designed for clinical excellence.",
    iconBg: "#f0fdfa",
    iconBorder: "#ccfbf1",
    accent: "#0d9488",
  },
  {
    icon: "iwrs",
    title: "IWRS Platform",
    description:
      "Simplify randomization, drug supply management and site coordination with intelligent workflows.",
    iconBg: "#f0f9ff",
    iconBorder: "#e0f2fe",
    accent: "#0284c7",
  },
  {
    icon: "vault",
    title: "Nexus Vault",
    description:
      "Secure, compliant document storage with advanced encryption and audit trail capabilities.",
    iconBg: "#f1f5f9",
    iconBorder: "#e2e8f0",
    accent: "#475569",
  },
  {
    icon: "manager",
    title: "SclinNexus Manager",
    description:
      "Streamline document workflows with advanced SclinNexus functionality and inspection readiness.",
    iconBg: "#ecfeff",
    iconBorder: "#cffafe",
    accent: "#0891b2",
  },
  {
    icon: "coding",
    title: "Medical Coding",
    description:
      "Optimize medical coding accuracy with AI-powered suggestions and centralized collaboration.",
    iconBg: "#eff6ff",
    iconBorder: "#dbeafe",
    accent: "#3b82f6",
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

// ─── Feature Card Icons (clean line-style, inherit currentColor) ──────────────
const FEATURE_ICON_PATHS = {
  // Sponsor eCOA — clipboard with check
  ecoa: (
    <>
      <path d="M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1z" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 13l2 2 4-4" />
    </>
  ),
  // EDC System — database
  edc: (
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
      <path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
    </>
  ),
  // IWRS Platform — randomization / shuffle
  iwrs: (
    <>
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" />
      <line x1="15" y1="15" x2="21" y2="21" />
      <line x1="4" y1="4" x2="9" y2="9" />
    </>
  ),
  // Nexus Vault — shield with check
  vault: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  // SclinNexus Manager — folder
  manager: (
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  ),
  // Medical Coding — code brackets
  coding: (
    <>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </>
  ),
};
const FeatureIcon = ({ name, size = 28 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {FEATURE_ICON_PATHS[name]}
  </svg>
);

// ─── Privacy / Terms / Cookie Content ────────────────────────────────────────
// Each block: { h: heading, body: [ "paragraph" | { list: ["item", ...] } ] }
const LEGAL_PAGES = {
  privacy: {
    title: "Privacy Policy",
    updated: "06-Jun-2026",
    blocks: [
      {
        h: "1. Introduction",
        body: [
          'Welcome to SclinNexus ("Company," "we," "our," "us"). We are committed to protecting the privacy and security of your information. This Privacy Policy describes how we collect, use, disclose, and safeguard your information when you use our Clinical Trial Management System (CTMS) platform, website, and related services (collectively, the "Platform").',
          'This Platform is designed specifically for use by Clinical Research Sponsors, Contract Research Organizations (CROs), site staff, investigators, and regulators involved in the management of clinical trials ("Authorized Users").',
          "Please read this Privacy Policy carefully. By accessing or using the Platform, you acknowledge that you have read and understood this policy.",
        ],
      },
      {
        h: "2. Definitions",
        body: [
          {
            list: [
              '"Personal Data": Any information relating to an identified or identifiable natural person (a "Data Subject").',
              '"Special Categories of Data": Personal data revealing racial or ethnic origin, political opinions, religious or philosophical beliefs, or trade union membership, and the processing of genetic data, biometric data for the purpose of uniquely identifying a natural person, data concerning health, or data concerning a natural person\'s sex life or sexual orientation.',
              '"Sponsor": The individual, company, institution, or organization which takes responsibility for the initiation, management, and/or financing of a clinical trial.',
              '"CRO" (Contract Research Organization): A person or an organization (commercial, academic, or other) contracted by the Sponsor to perform one or more of a Sponsor\'s trial-related duties and functions.',
              '"Trial Subject": An individual who participates in a clinical trial managed through the Platform.',
              '"User" / "Authorized User": Personnel from our clients (Sponsors, CROs, and Sites) who have login credentials to use the Platform for trial management.',
            ],
          },
        ],
      },
      {
        h: "3. Data Controller and Data Processor",
        body: [
          "A critical distinction in clinical research is the difference between a Controller and a Processor.",
          "For Trial Subject Data: SclinNexus acts as a Data Processor on behalf of our Clients (the Sponsors and the CROs acting on their behalf). Our Clients are the Data Controllers (or may be Co-Controllers). They determine the purposes and means of processing the data.",
          "If you are a Trial Subject, your relationship is with the clinical trial Sponsor and the Investigational Site; you should refer to their Informed Consent Form (ICF) and privacy notices for information on how your data is handled. SclinNexus processes this data strictly according to our Clients' documented instructions.",
          "For Authorized User Data: SclinNexus acts as a Data Controller for the contact information and account details of our Users (personnel from Sponsors, CROs, and Sites). This section governs how we handle that specific information.",
        ],
      },
      {
        h: "4. Information We Collect",
        body: [
          "We collect information in three primary ways:",
          "A. Information Provided by Authorized Users (Controllers of Trial Data) — When Users (Sponsor employees, CRO monitors, or Site staff) input data into the Platform regarding a clinical trial, this may include:",
          {
            list: [
              "Trial Data: Protocol details, site monitoring reports, adverse event logs, and study metrics.",
              "Trial Subject Data (Pseudonymized): To maintain confidentiality, Trial Subject data is typically identified by a unique Subject ID number. However, depending on Client configuration, this may include Special Categories of Data, such as health information, genetic data, or lab results.",
            ],
          },
          "B. Information Provided by Authorized Users (Account Data) — When you register for an account (as a representative of a Sponsor, CRO, or Site), we collect:",
          {
            list: [
              "Identity Data: Name, job title, employer (Sponsor/CRO/Site), professional license/credentials.",
              "Contact Data: Business email address, phone number.",
              "Authentication Data: Username, hashed password.",
            ],
          },
          "C. Technical Data Collected Automatically — When you access the Platform, we automatically collect:",
          {
            list: [
              "Usage Data: Log files, clickstream data, features used, time spent on pages.",
              "Device Data: IP address, browser type, operating system.",
            ],
          },
        ],
      },
      {
        h: "5. How We Use Your Information",
        body: [
          "We use the information we collect for the following purposes:",
          {
            list: [
              "To Provide the Service: To host and maintain the Platform, manage clinical trial data, facilitate collaboration between Sponsors, CROs, and trial sites, and generate reports.",
              "System Administration: To ensure the security and integrity of the Platform, troubleshoot bugs, and monitor for unauthorized access.",
              "Compliance: To assist our Clients (Sponsors and CROs) in meeting regulatory requirements (e.g., FDA, EMA) by maintaining accurate audit trails (GDPR Article 30 records, 21 CFR Part 11 compliance).",
              "Communication: To send you service-related announcements, updates, security alerts, and support messages (Account Data only).",
              "Improvement: To analyze usage trends to improve user interface and platform functionality (using aggregated, non-identifiable data).",
            ],
          },
          "Legal Basis for Processing (for GDPR purposes):",
          {
            list: [
              "Performance of a Contract: Processing is necessary for the performance of our contract with you or your employer (Sponsor/CRO).",
              "Legal Obligation: Processing is necessary for compliance with legal obligations (e.g., retaining records for regulatory audits).",
              "Legitimate Interests: Processing is necessary for our legitimate interests (e.g., ensuring network and information security).",
              "Consent: Where required by law, we may ask for your consent to process certain data.",
            ],
          },
        ],
      },
      {
        h: "6. Data Sharing and Disclosure",
        body: [
          "We respect the confidentiality of clinical trial data. We do not sell, rent, or lease Personal Data to third parties. We may share data in the following specific contexts:",
          {
            list: [
              "With Our Clients (Sponsors and CROs): All Trial Subject Data entered into the Platform is owned and controlled by our Clients (Sponsors and the CROs acting on their behalf). They have full access to their trial data. A Sponsor may grant a CRO access to specific trials for monitoring and management purposes.",
              "Service Providers (Sub-processors): We engage trusted third-party vendors to perform functions on our behalf, such as cloud hosting (e.g., AWS, Azure), database management, and email delivery. These sub-processors are bound by strict contractual data processing agreements that comply with applicable laws (including Standard Contractual Clauses for international data transfers).",
              "Regulatory Authorities: We may be required to provide access to data to regulatory authorities (e.g., FDA, EMA, MHRA) as part of an audit or inspection of our systems or a specific clinical trial conducted by a Sponsor or CRO.",
              "Legal Requirements: We may disclose information if required to do so by law or in response to valid requests by public authorities (e.g., a court order or subpoena).",
            ],
          },
        ],
      },
      {
        h: "7. International Data Transfers",
        body: [
          "SclinNexus operates globally. Your information may be transferred to, stored, and processed in countries outside of your own, including the United States and the European Economic Area (EEA). This is often necessary for Sponsors and CROs who operate multinational trials.",
          "Where we transfer data from the EEA to countries not deemed adequate by the European Commission, we rely on appropriate safeguards, such as:",
          {
            list: [
              "Standard Contractual Clauses (SCCs) approved by the European Commission.",
              "Binding Corporate Rules (where applicable).",
            ],
          },
          "We ensure that any third-party sub-processors also provide adequate guarantees regarding the security of the data.",
        ],
      },
      {
        h: "8. Data Security",
        body: [
          "We have implemented appropriate technical and organizational security measures designed to protect your information from accidental loss and unauthorized access, use, alteration, or disclosure. These include:",
          {
            list: [
              "Encryption: Data is encrypted in transit (TLS 1.2+) and at rest (AES-256).",
              "Access Controls: Role-based access controls (RBAC) and multi-factor authentication (MFA) for Users, allowing Sponsors and CROs to manage permissions granularly.",
              "Audit Trails: Comprehensive logging of all access and modifications to trial data to ensure accountability and traceability for regulatory inspections.",
              "Certifications: We adhere to industry standards such as ISO 27001, SOC 2 Type II, and the HIPAA compliance framework.",
            ],
          },
          "Despite these measures, no method of transmission over the Internet or method of electronic storage is 100% secure.",
        ],
      },
      {
        h: "9. Data Retention",
        body: [
          "Trial Subject Data: We retain Trial Subject Data according to the instructions of our Clients (the Sponsors and CROs) and in accordance with applicable legal and regulatory requirements (e.g., ICH-GCP guidelines, which often require retention for up to 25 years). Upon the termination of a Client agreement, data is returned to the Client (Sponsor/CRO) and deleted from our production systems in accordance with our contract, subject to legal holds required by regulators.",
          "Account Data: We retain Authorized User account data for as long as the account is active or as needed to provide services. If you close your account, we will retain your data only as necessary for legal and audit purposes (e.g., audit trails linking you to actions performed in the system cannot be deleted).",
        ],
      },
      {
        h: "10. Your Rights (Data Subject Rights)",
        body: [
          "Depending on your jurisdiction (e.g., EU/UK under GDPR, California under CCPA), you may have specific rights regarding your Personal Data (applies to Account Data only, as we are the Controller for that data). These rights may include:",
          {
            list: [
              "The right to access your data.",
              "The right to rectification (correcting inaccurate data).",
              "The right to erasure ('right to be forgotten').",
              "The right to restrict processing.",
              "The right to data portability.",
            ],
          },
          "For Trial Subjects: If you are a Trial Subject and wish to exercise any of these rights regarding your clinical trial data, you must contact the clinical trial site, the CRO managing the trial, or the study Sponsor directly. As a Data Processor, SclinNexus cannot modify or delete clinical trial data without instructions from the Controller (Sponsor or CRO). We will assist our Clients in responding to such requests where legally required.",
          "To exercise your rights regarding your Account Data, please contact us at privacy@sclinnexus.com.",
        ],
      },
      {
        h: "11. Children's Privacy",
        body: [
          "The Platform is not intended for use by individuals under the age of legal majority (typically 18). We do not knowingly collect Personal Data from minors. If we become aware that we have inadvertently collected such information, we will take steps to delete it promptly.",
        ],
      },
      {
        h: "12. Changes to This Privacy Policy",
        body: [
          'We may update this Privacy Policy from time to time to reflect changes in our practices, technologies, legal requirements, or other factors. We will notify Users (Sponsors, CROs, and Sites) of any material changes via email or through a notice on the Platform prior to the change becoming effective. The "Last Updated" date at the top of this policy will be revised.',
        ],
      },
      {
        h: "13. Contact Us",
        body: [
          "If you have any questions about this Privacy Policy or our privacy practices, please contact our Data Protection Officer (DPO) at SclinNexus, Data Protection Officer — privacy@sclinnexus.com.",
        ],
      },
    ],
  },
  terms: {
    title: "Terms of Service",
    updated: "06-Jun-2026",
    blocks: [
      {
        h: "1. Agreement to Terms",
        body: [
          'Welcome to SclinNexus ("Company," "we," "our," "us"). These Terms of Service ("Terms") govern your access to and use of our Clinical Trial Management System (CTMS) platform, website, and related services (collectively, the "Platform").',
          'By registering for an account, accessing, or using the Platform, you ("Subscriber," "Client," "you") agree to be bound by these Terms. If you are entering into these Terms on behalf of a company or other legal entity (e.g., a Sponsor, CRO, or Research Site), you represent that you have the authority to bind such entity to these Terms.',
          "If you do not agree to these Terms, you must not access or use the Platform.",
        ],
      },
      {
        h: "2. Eligibility",
        body: [
          "By using the Platform, you represent and warrant that:",
          {
            list: [
              "You are at least 18 years of age (or the age of legal majority in your jurisdiction).",
              "You have the legal capacity to enter into a binding contract.",
              "You are not located in a country that is subject to a U.S. or other applicable government embargo.",
              "You are not a competitor of SclinNexus and are not using the Platform for reasons that are competitive with us.",
            ],
          },
        ],
      },
      {
        h: "3. Description of the Service",
        body: [
          "SclinNexus provides a cloud-based software-as-a-service (SaaS) platform designed to assist clinical research Sponsors, CROs, and site staff in managing clinical trials. Features may include, but are not limited to:",
          {
            list: [
              "Study planning and tracking",
              "Site management and monitoring",
              "Subject visit scheduling and data capture (eCRF)",
              "Adverse event tracking",
              "Regulatory document management (TMF)",
              "Reporting and analytics",
              "Oversight tools for Sponsors managing multiple CRO partners",
            ],
          },
          "We reserve the right to modify, update, or discontinue features of the Platform at any time, with or without notice, provided that such changes do not materially diminish the core functionality of the service during a paid subscription term.",
        ],
      },
      {
        h: "4. Account Registration and Security",
        body: [
          "4.1 Account Creation — To use the Platform, you must register for an account. You agree to provide accurate, current, and complete information during the registration process and to update such information to keep it accurate, current, and complete.",
          "4.2 Credentials — You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account. You agree to:",
          {
            list: [
              "Not share your password or account access with anyone else.",
              "Not permit any third party to access the Platform using your credentials.",
              "Notify us immediately of any unauthorized use of your account or any other breach of security at security@sclinnexus.com.",
            ],
          },
          "4.3 Account Types and Roles — We offer different account types to reflect the hierarchical nature of clinical research:",
          {
            list: [
              "Sponsor Administrators: Can create and manage trials, oversee CRO activities, and access high-level portfolio data.",
              "CRO Users: Can be granted access to specific trials by the Sponsor to perform monitoring and data management tasks.",
              "Site Users: Enter data at the clinical site level.",
              "Read-Only Auditors: For regulatory inspections.",
            ],
          },
          "Your level of access to data and features is determined by the role assigned to you by your organization's account administrator (either at the Sponsor or CRO).",
        ],
      },
      {
        h: "5. Subscriptions, Fees, and Payments",
        body: [
          "5.1 Subscription Plans — Access to the Platform is provided on a subscription basis. The fees, billing periods, and specific features included in your plan are detailed in the Order Form or separate agreement provided to you (the Sponsor or CRO) at the time of purchase.",
          "5.2 Fees and Taxes — You agree to pay all subscription fees specified in the Order Form. Fees are non-refundable except as required by law or as expressly set forth in these Terms. You are responsible for all taxes associated with your subscription, excluding taxes based on our net income.",
          "5.3 Late Payment — If payment is not received by the due date, we reserve the right to suspend or terminate your (Sponsor's or CRO's) access to the Platform. We may charge interest on overdue amounts at the rate of 1.5% per month (or the maximum rate permitted by law).",
        ],
      },
      {
        h: "6. Acceptable Use Policy",
        body: [
          "You agree not to use the Platform to:",
          {
            list: [
              "Violate Laws: Engage in any activity that violates any applicable law or regulation, including data protection laws (GDPR, HIPAA, etc.) and clinical research regulations (ICH-GCP).",
              "Harm Others: Upload, transmit, or distribute any content that is unlawful, harmful, threatening, abusive, harassing, defamatory, or invasive of another's privacy.",
              "Security Breaches: Attempt to gain unauthorized access to the Platform, other user accounts (Sponsor, CRO, or Site), or our systems or networks.",
              "Reverse Engineer: Reverse engineer, decompile, disassemble, or otherwise attempt to discover the source code of the Platform.",
              "Malicious Code: Transmit any worms, viruses, or other code of a destructive nature.",
            ],
          },
        ],
      },
      {
        h: "7. Data, Ownership, and Processing",
        body: [
          "7.1 Client Data — You (Sponsor or CRO) retain all right, title, and interest in and to all data, information, and materials entered into the Platform by you or on your behalf, including clinical trial data and Protected Health Information (PHI) (\"Client Data\"). This is your data.",
          {
            list: [
              "Sponsors own the data generated from their trials.",
              "CROs may act as Data Processors for the Sponsor and must adhere to the Sponsor's instructions regarding the data.",
              "Sites enter data on behalf of the Sponsor/CRO.",
            ],
          },
          "7.2 SclinNexus IP — We retain all right, title, and interest in and to the Platform, our software, our trademarks, and our logos. These Terms do not grant you any ownership rights in our IP.",
          "7.3 Data Processing Agreement (DPA) — As SclinNexus processes clinical trial data on behalf of Sponsors and CROs, our relationship regarding data privacy and security is governed by a separate Data Processing Agreement (DPA), which is incorporated into these Terms by reference. The DPA sets out our obligations regarding the processing of Personal Data, including security measures, sub-processor notifications, and assistance with data subject rights.",
          "7.4 Aggregate/Anonymized Data — We may collect and use aggregated and anonymized data derived from your use of the Platform for the purpose of improving our services, benchmarking, and product development. This data cannot identify you, your CRO partners, or your Trial Subjects.",
        ],
      },
      {
        h: "8. Confidentiality",
        body: [
          'Given the sensitive nature of clinical trial information, both parties agree to hold in strict confidence all Confidential Information disclosed in connection with these Terms. "Confidential Information" includes, but is not limited to, unpublished trial data, patient information, protocols, business strategies of Sponsors and CROs, and source code. This obligation of confidentiality survives the termination of these Terms.',
        ],
      },
      {
        h: "9. Third-Party Services and Sub-Processors",
        body: [
          "The Platform may integrate with or utilize third-party service providers (e.g., cloud hosting providers, data storage, email services) to deliver the Service. A current list of our Sub-processors is maintained and made available to Clients on request. We will provide notice of changes to our Sub-processors in accordance with our DPA.",
        ],
      },
      {
        h: "10. Disclaimer of Warranties",
        body: [
          'THE PLATFORM IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT ANY WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO, IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE (INCLUDING FOR SPECIFIC SPONSOR OR CRO NEEDS), TITLE, AND NON-INFRINGEMENT.',
          "We do not warrant that the Platform will be uninterrupted, error-free, secure, or free from viruses or other harmful components. You use the Platform at your own risk. No advice or information obtained by you from us shall create any warranty not expressly stated in these Terms.",
        ],
      },
      {
        h: "11. Limitation of Liability",
        body: [
          "TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL SCLINNEXUS, ITS AFFILIATES, OFFICERS, EMPLOYEES, OR LICENSORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES (WHETHER INCURRED BY A SPONSOR, CRO, OR SITE), WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM (I) YOUR USE OR INABILITY TO USE THE PLATFORM; (II) ANY CONDUCT OR CONTENT OF ANY THIRD PARTY ON THE PLATFORM; OR (III) UNAUTHORIZED ACCESS, USE, OR ALTERATION OF YOUR TRANSMISSIONS OR CONTENT.",
          "OUR TOTAL LIABILITY TO YOU FOR ALL CLAIMS ARISING FROM OR RELATING TO THESE TERMS OR THE PLATFORM SHALL NOT EXCEED THE AMOUNT PAID BY YOU TO US DURING THE TWELVE (12) MONTHS PRIOR TO THE EVENT GIVING RISE TO THE LIABILITY.",
        ],
      },
      {
        h: "12. Indemnification",
        body: [
          "You (the Sponsor or CRO) agree to defend, indemnify, and hold harmless SclinNexus and its employees, contractors, and agents from and against any and all claims, damages, obligations, losses, liabilities, costs, and expenses (including reasonable legal fees) arising from: (i) your use of and access to the Platform; (ii) your violation of any term of these Terms; (iii) your violation of any third-party right, including any privacy right or intellectual property right; or (iv) your violation of any applicable law or regulation governing the conduct of clinical trials.",
        ],
      },
      {
        h: "13. Termination",
        body: [
          "13.1 By You — You (the Sponsor or CRO) may terminate your account and subscription at any time by providing written notice to us, subject to the terms of your subscription agreement (e.g., early termination fees may apply).",
          "13.2 By Us — We may suspend or terminate your access to the Platform immediately, without prior notice or liability, if:",
          {
            list: [
              "You breach any provision of these Terms.",
              "Your payment is past due.",
              "We are required to do so by law or regulatory authority.",
            ],
          },
          "13.3 Effect of Termination — Upon termination, your right to access the Platform will cease immediately. We will provide you (Sponsor/CRO) with a reasonable period (e.g., 30 days) to retrieve your Client Data, subject to our standard data export fees, unless prohibited by law. Thereafter, we may delete your Client Data from our systems in accordance with our data retention policy.",
        ],
      },
      {
        h: "14. Governing Law and Dispute Resolution",
        body: [
          "These Terms shall be governed by the applicable laws of the jurisdiction in which SclinNexus is incorporated, without regard to its conflict of law provisions. Any disputes arising out of or relating to these Terms or the Platform shall be resolved through binding arbitration in accordance with the applicable arbitration rules, except that either party may seek injunctive or other equitable relief in court to protect its intellectual property rights.",
        ],
      },
      {
        h: "15. General Provisions",
        body: [
          {
            list: [
              "Entire Agreement: These Terms, together with the Privacy Policy, Cookie Policy, and DPA, constitute the entire agreement between you (the Sponsor/CRO) and SclinNexus regarding the use of the Platform.",
              "Waiver: Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights.",
              "Severability: If any provision of these Terms is held to be invalid or unenforceable, the remaining provisions will remain in full force and effect.",
              "Assignment: You may not assign these Terms without our prior written consent. We may assign these Terms without restriction.",
            ],
          },
        ],
      },
      {
        h: "16. Contact Information",
        body: [
          "For questions about these Terms, please contact us at SclinNexus, Legal Department — legal@sclinnexus.com.",
        ],
      },
    ],
  },
  cookies: {
    title: "Cookie Policy",
    updated: "06-Jun-2026",
    blocks: [
      {
        h: "1. Introduction",
        body: [
          'This Cookie Policy explains how SclinNexus ("Company," "we," "our," "us") uses cookies and similar tracking technologies (e.g., pixels, web beacons, local storage) when you visit our website or use our Clinical Trial Management System (CTMS) Platform (collectively, the "Platform").',
          "By continuing to browse or use the Platform, you consent to our use of cookies as described in this policy, subject to your cookie preferences and applicable law.",
          "Important Note on Clinical Trial Data: SclinNexus is designed with patient privacy as a priority. Our cookies are used strictly for operational and analytical purposes related to the functionality of the Platform and User experience. We do not use cookies to collect or track Protected Health Information (PHI) or identifiable Trial Subject data belonging to our Sponsor and CRO clients.",
        ],
      },
      {
        h: "2. What Are Cookies?",
        body: [
          "Cookies are small text files that are placed on your computer or mobile device by websites that you visit. They are widely used to make websites work more efficiently, as well as to provide information to the owners of the site. Cookies can be:",
          {
            list: [
              "Session Cookies: These are temporary and are deleted from your device when you close your browser.",
              "Persistent Cookies: These remain on your device for a set period or until you delete them manually.",
            ],
          },
        ],
      },
      {
        h: "3. Why Do We Use Cookies?",
        body: [
          "We use cookies for several reasons, primarily to ensure the security and functionality of our Platform. Because SclinNexus is a professional tool for Sponsors, CROs, and clinical research sites, our use of cookies is limited compared to standard marketing websites. We use cookies to:",
          {
            list: [
              "Essential/Strictly Necessary Cookies: Enable core Platform functionality such as user authentication (for Sponsor, CRO, and Site staff), session management, and security. The Platform cannot function properly without these cookies.",
              "Functional Cookies: Remember your preferences (e.g., language, dashboard layout) to provide a personalized experience.",
              "Performance/Analytics Cookies: Collect aggregated, anonymized information about how Users (Sponsors, CROs, Sites) interact with the Platform (e.g., which pages are visited most, error rates) to help us improve performance and usability.",
            ],
          },
          "We do not use targeting or advertising cookies. We do not allow third-party advertising networks to collect information about you on our Platform.",
        ],
      },
      {
        h: "4. Types of Cookies We Use",
        body: [
          "The specific types of cookies used on SclinNexus are detailed below:",
          {
            list: [
              "Strictly Necessary Cookies — Essential for you to move around the Platform and use its features, such as accessing secure areas of the CTMS designated for specific Sponsor or CRO trials. Examples: session_id, csrf_token, auth_token (first-party). Duration: session / persistent.",
              "Functional Cookies — Allow the Platform to remember choices you make (such as your Sponsor/CRO-specific dashboard, language, or region) and provide enhanced, more personal features. Examples: user_preferences, table_settings (first-party). Duration: persistent.",
              "Analytics Cookies — Collect information about how visitors use the Platform, for instance which pages visitors go to most often. We use this data to optimize the Platform for Sponsors, CROs, and sites. All data collected is aggregated and anonymized. Examples: Google Analytics, Mixpanel (configured to anonymize IPs). Duration: persistent.",
            ],
          },
        ],
      },
      {
        h: "5. How to Control Cookies",
        body: [
          "You have the right to decide whether to accept or reject cookies.",
          {
            list: [
              "Cookie Consent Banner: Upon your first visit to the Platform, you will see a banner requesting your consent to set non-essential cookies (Functional and Analytics). You may accept all, reject non-essential, or customize your preferences.",
              "Browser Settings: You can also set or amend your web browser controls to accept or refuse cookies. If you choose to reject cookies, you may still use our Platform, but your access to some functionality and areas may be restricted.",
            ],
          },
          "Most major browsers (Chrome, Firefox, Safari, and Edge) provide guidance in their help sections on how to manage cookies.",
          "Please note: Disabling Strictly Necessary Cookies will prevent the Platform from functioning correctly (e.g., you will not be able to log in).",
        ],
      },
      {
        h: "6. Changes to This Cookie Policy",
        body: [
          'We may update this Cookie Policy from time to time to reflect changes in technology, regulation, or our business operations. When we update this policy, we will revise the "Last Updated" date at the top of the policy. If changes are material, we may notify you (Sponsors, CROs, and Users) more prominently.',
        ],
      },
      {
        h: "7. Contact Us",
        body: [
          "If you have any questions about our use of cookies or this policy, please contact us at SclinNexus, Data Protection Officer — privacy@sclinnexus.com.",
        ],
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
  const [hoveredBenefit, setHoveredBenefit] = useState(null);
  const [hoveredSocial, setHoveredSocial] = useState(null);
  const [lang, setLang] = useState(() => {
    try {
      const saved = localStorage.getItem(LANG_STORAGE_KEY);
      return saved && TRANSLATIONS[saved] ? saved : "en";
    } catch { return "en"; }
  });
  const [langOpen, setLangOpen] = useState(false);
  const t = TRANSLATIONS[lang] ?? TRANSLATIONS.en;
  const localizedHeroSlides = t.heroSlides;

  useEffect(() => {
    try { localStorage.setItem(LANG_STORAGE_KEY, lang); } catch { /* ignore */ }
    try { document.documentElement.lang = lang; } catch { /* ignore */ }
  }, [lang]);

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
        .feature-card-hover:hover { transform: translateY(-4px); box-shadow: 0 12px 28px rgba(15,23,42,0.10) !important; border-color: #cbd5e1 !important; }
        .feature-card-hover:hover .card-top-bar { transform: scaleX(1) !important; }
        .feature-card-hover:hover .feature-icon-box { transform: scale(1.04); }
        .footer-link { position: relative; }
        .footer-link::before { content: ""; position: absolute; left: 0; bottom: -2px; width: 0; height: 1px; background: linear-gradient(90deg, #38bdf8, #0ea5e9); transition: width 0.3s ease; }
        .footer-link:hover { color: #e0f2fe !important; transform: translateX(5px); }
        .footer-link:hover::before { width: 100%; }
        .footer-social { transition: transform 0.3s ease, background 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease; }
        .footer-social:hover { transform: translateY(-3px); background: linear-gradient(140deg, #0ea5e9, #0284c7) !important; border-color: rgba(56,189,248,0.6) !important; box-shadow: 0 10px 28px rgba(14,165,233,0.45), 0 0 0 4px rgba(14,165,233,0.12) !important; }
        .footer-logo-wrap { transition: transform 0.3s ease, box-shadow 0.3s ease; }
        .footer-logo-wrap:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(14,165,233,0.35) !important; }
        .social-link:hover { background: #0ea5e9 !important; transform: translateY(-2px); }
        @media (max-width: 1024px) {
          .footer-grid { grid-template-columns: 1fr 1fr 1fr !important; gap: 2.5rem 2rem !important; }
          .footer-brand-col { grid-column: 1 / -1 !important; }
        }
        @media (max-width: 600px) {
          .footer-grid { grid-template-columns: 1fr 1fr !important; gap: 2rem 1.5rem !important; }
          .footer-brand-col { grid-column: 1 / -1 !important; }
          .footer-bottom { flex-direction: column !important; text-align: center !important; }
        }
        .carousel-btn:hover { background: rgba(255,255,255,0.25) !important; transform: translateY(-50%) scale(1.1) !important; }
        .testimonial-nav-btn:hover { background: #0ea5e9 !important; border-color: #0ea5e9 !important; color: white !important; }
        .cta-primary-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(14,165,233,0.4) !important; }
        .cta-secondary-btn:hover { background: rgba(255,255,255,0.1) !important; border-color: rgba(255,255,255,0.6) !important; }
        .logo-item:hover { opacity: 1 !important; transform: scale(1.05) !important; }
        .back-btn:hover { background: #e2e8f0 !important; color: #0ea5e9 !important; }
        .feature-link:hover { gap: 0.625rem !important; color: #0284c7 !important; }
        .signin-btn:hover { color: #0ea5e9 !important; }
        .signup-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(14,165,233,0.4) !important; }
        .benefit-item-el:hover { background: #ffffff !important; box-shadow: 0 10px 30px rgba(0,0,0,0.08) !important; transform: translateY(-2px); }
        .hero-cta-primary:hover { transform: translateY(-3px); box-shadow: 0 15px 40px rgba(14,165,233,0.45) !important; }
        .hero-cta-secondary:hover { background: rgba(255,255,255,0.2) !important; border-color: rgba(255,255,255,0.5) !important; }
        .cta-main-btn:hover { transform: translateY(-2px); box-shadow: 0 15px 40px rgba(0,0,0,0.3) !important; }
        @keyframes contactFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(0, -24px) scale(1.06); }
        }
        @keyframes contactFloatAlt {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(0, 28px) scale(1.08); }
        }
        .contact-glow-1 { animation: contactFloat 9s ease-in-out infinite; }
        .contact-glow-2 { animation: contactFloatAlt 11s ease-in-out infinite; }
        .contact-card { transition: transform 0.35s ease, box-shadow 0.35s ease; }
        .contact-card:hover { transform: translateY(-6px); box-shadow: 0 40px 90px rgba(14,165,233,0.22), 0 12px 32px rgba(15,23,42,0.10) !important; }
        .contact-icon-wrap { transition: transform 0.35s ease, box-shadow 0.35s ease; }
        .contact-card:hover .contact-icon-wrap { transform: translateY(-3px) scale(1.04); box-shadow: 0 16px 40px rgba(14,165,233,0.45) !important; }
        .contact-email { transition: color 0.25s ease, transform 0.25s ease, text-shadow 0.25s ease; }
        .contact-email:hover { color: ${PRIMARY_DARK} !important; transform: scale(1.02); text-shadow: 0 6px 22px rgba(14,165,233,0.35); }
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
              {/* Language switcher */}
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  aria-label="Change language"
                  aria-haspopup="menu"
                  aria-expanded={langOpen}
                  onClick={() => setLangOpen((o) => !o)}
                  onBlur={() => setTimeout(() => setLangOpen(false), 160)}
                  style={{
                    ...navBtnBase,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    color: scrolled ? "#1e293b" : "#fff",
                    padding: "0.5rem 0.75rem",
                    borderRadius: 8,
                    border: scrolled ? "1px solid #e2e8f0" : "1px solid rgba(255,255,255,0.4)",
                    fontWeight: 600,
                  }}
                >
                  <span role="img" aria-hidden="true">🌐</span>
                  <span>{LANGUAGES.find((l) => l.code === lang)?.short ?? "EN"}</span>
                  <span style={{ fontSize: 10 }}>▾</span>
                </button>
                {langOpen && (
                  <div
                    role="menu"
                    style={{
                      position: "absolute",
                      top: "calc(100% + 6px)",
                      right: 0,
                      minWidth: 140,
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      boxShadow: "0 12px 24px rgba(15,23,42,0.12)",
                      padding: 4,
                      zIndex: 50,
                    }}
                  >
                    {LANGUAGES.map((l) => (
                      <button
                        key={l.code}
                        type="button"
                        role="menuitem"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setLang(l.code);
                          setLangOpen(false);
                        }}
                        style={{
                          display: "block",
                          width: "100%",
                          textAlign: "left",
                          padding: "8px 10px",
                          border: 0,
                          background: l.code === lang ? "#f1f5f9" : "transparent",
                          color: "#0f172a",
                          fontSize: 13,
                          fontWeight: l.code === lang ? 700 : 500,
                          borderRadius: 6,
                          cursor: "pointer",
                        }}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                className="signin-btn"
                style={{
                  ...navBtnBase,
                  color: scrolled ? "#1e293b" : "#fff",
                  padding: "0.5rem 1rem",
                }}
                onClick={() => navigate("/signin")}
              >
                {t.signIn}
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
                onClick={() => navigate("/signin")}
              >
                {t.getStarted}
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
                  {localizedHeroSlides[currentSlide].title}
                  <span
                    style={{
                      background:
                        "linear-gradient(135deg, #4ade80 0%, #22d3ee 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    {localizedHeroSlides[currentSlide].highlight}
                  </span>
                  {localizedHeroSlides[currentSlide].titleEnd}
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
                  {localizedHeroSlides[currentSlide].subtitle}
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
                    style={{
                      background: "#fff",
                      border: "1px solid #E5E7EB",
                      borderRadius: 18,
                      padding: "2rem 1.875rem",
                      transition:
                        "transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease",
                      position: "relative",
                      overflow: "hidden",
                      boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
                    }}
                  >
                    <div
                      className="card-top-bar"
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 3,
                        background: PRIMARY,
                        transform: "scaleX(0.18)",
                        transformOrigin: "left",
                        transition: "transform 0.3s ease",
                      }}
                    />
                    <div
                      className="feature-icon-box"
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 12,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: "1.375rem",
                        background: f.iconBg,
                        border: `1px solid ${f.iconBorder}`,
                        color: f.accent,
                        transition: "transform 0.25s ease",
                      }}
                    >
                      <FeatureIcon name={f.icon} size={26} />
                    </div>
                    <h3
                      style={{
                        fontSize: "1.1875rem",
                        fontWeight: 700,
                        color: "#0f172a",
                        marginBottom: "0.625rem",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {f.title}
                    </h3>
                    <p
                      style={{
                        fontSize: "0.9375rem",
                        color: "#475569",
                        lineHeight: 1.65,
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

            {/* ── Contact Us ───────────────────────────────────────────────── */}
            <section
              id="contact"
              style={{
                position: "relative",
                padding: "4.5rem 2rem 5rem",
                background: "linear-gradient(180deg, #f8fbff 0%, #eef5fc 100%)",
                overflow: "hidden",
              }}
            >
              {/* Abstract healthcare background pattern */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage:
                    "radial-gradient(circle at 1px 1px, rgba(14,165,233,0.10) 1px, transparent 0)",
                  backgroundSize: "26px 26px",
                  maskImage:
                    "radial-gradient(ellipse 70% 60% at 50% 45%, #000 35%, transparent 80%)",
                  WebkitMaskImage:
                    "radial-gradient(ellipse 70% 60% at 50% 45%, #000 35%, transparent 80%)",
                  pointerEvents: "none",
                }}
              />
              {/* Floating glow effects */}
              <div
                aria-hidden
                className="contact-glow-1"
                style={{
                  position: "absolute",
                  top: "8%",
                  left: "12%",
                  width: 320,
                  height: 320,
                  borderRadius: "50%",
                  background:
                    "radial-gradient(circle, rgba(14,165,233,0.22) 0%, transparent 70%)",
                  filter: "blur(40px)",
                  pointerEvents: "none",
                }}
              />
              <div
                aria-hidden
                className="contact-glow-2"
                style={{
                  position: "absolute",
                  bottom: "6%",
                  right: "14%",
                  width: 360,
                  height: 360,
                  borderRadius: "50%",
                  background:
                    "radial-gradient(circle, rgba(2,132,199,0.18) 0%, transparent 70%)",
                  filter: "blur(45px)",
                  pointerEvents: "none",
                }}
              />

              <div
                style={{
                  position: "relative",
                  maxWidth: 760,
                  margin: "0 auto",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                }}
              >
                <span style={{ display: "inline-block", padding: "0.375rem 1rem", background: "rgba(14,165,233,0.12)", color: PRIMARY, fontSize: "0.8125rem", fontWeight: 600, borderRadius: 50, marginBottom: "1rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Contact
                </span>
                <h2 style={{ fontSize: "clamp(1.875rem, 4vw, 2.75rem)", fontWeight: 800, color: "#0f172a", marginBottom: "0.625rem", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
                  Get In Touch
                </h2>
                <p style={{ fontSize: "1.0625rem", color: "#64748b", maxWidth: 520, margin: "0 auto 2.5rem", lineHeight: 1.6 }}>
                  Have questions about SclinNexus? Our team is here to help.
                </p>

                {/* Soft blue gradient halo behind the card */}
                <div style={{ position: "relative", width: "100%", maxWidth: 520 }}>
                  <div
                    aria-hidden
                    style={{
                      position: "absolute",
                      inset: "-18px",
                      borderRadius: 32,
                      background:
                        "radial-gradient(ellipse at center, rgba(14,165,233,0.28) 0%, transparent 70%)",
                      filter: "blur(28px)",
                      pointerEvents: "none",
                    }}
                  />
                  {/* Gradient border wrapper */}
                  <div
                    className="contact-card"
                    style={{
                      position: "relative",
                      borderRadius: 24,
                      padding: 1.5,
                      background:
                        "linear-gradient(140deg, rgba(14,165,233,0.55), rgba(255,255,255,0.2) 45%, rgba(2,132,199,0.45))",
                      boxShadow:
                        "0 30px 70px rgba(15,23,42,0.12), 0 8px 24px rgba(14,165,233,0.12)",
                    }}
                  >
                    {/* Glassmorphism card */}
                    <div
                      style={{
                        borderRadius: 23,
                        padding: "3rem 2.5rem",
                        textAlign: "center",
                        background:
                          "linear-gradient(160deg, rgba(255,255,255,0.92) 0%, rgba(248,251,255,0.86) 100%)",
                        backdropFilter: "blur(18px)",
                        WebkitBackdropFilter: "blur(18px)",
                      }}
                    >
                      {/* Larger icon container with soft glow */}
                      <div
                        className="contact-icon-wrap"
                        style={{
                          width: 84,
                          height: 84,
                          margin: "0 auto 1.5rem",
                          borderRadius: 22,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 38,
                          background:
                            "linear-gradient(140deg, #0ea5e9 0%, #0284c7 100%)",
                          boxShadow:
                            "0 12px 30px rgba(14,165,233,0.40), inset 0 1px 0 rgba(255,255,255,0.4)",
                        }}
                      >
                        <span style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.15))" }}>📧</span>
                      </div>
                      <a
                        href="mailto:support@sclinnexus.com"
                        className="contact-email"
                        style={{
                          display: "inline-block",
                          fontSize: "1.375rem",
                          color: PRIMARY,
                          fontWeight: 700,
                          letterSpacing: "-0.01em",
                          marginBottom: "0.75rem",
                          textDecoration: "none",
                        }}
                      >
                        support@sclinnexus.com
                      </a>
                      <p style={{ fontSize: "0.9375rem", color: "#64748b", maxWidth: 380, margin: "0 auto", lineHeight: 1.65 }}>
                        For platform-related inquiries and assistance, contact our support team.
                      </p>
                    </div>
                  </div>
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
              {LEGAL_PAGES[activePage].updated && (
                <p
                  style={{
                    fontSize: "0.875rem",
                    color: "#94a3b8",
                    marginTop: "-1.75rem",
                    marginBottom: "2.5rem",
                  }}
                >
                  Last updated: {LEGAL_PAGES[activePage].updated}
                </p>
              )}
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
                  {(block.body || [block.p]).map((node, j) =>
                    typeof node === "string" ? (
                      <p
                        key={j}
                        style={{
                          fontSize: "1rem",
                          lineHeight: 1.8,
                          color: "#64748b",
                          marginBottom: "1rem",
                        }}
                      >
                        {node}
                      </p>
                    ) : (
                      <ul
                        key={j}
                        style={{
                          margin: "0 0 1rem",
                          paddingLeft: "1.5rem",
                          color: "#64748b",
                        }}
                      >
                        {node.list.map((item, k) => (
                          <li
                            key={k}
                            style={{
                              fontSize: "1rem",
                              lineHeight: 1.8,
                              marginBottom: "0.5rem",
                            }}
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    )
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <footer
          style={{
            position: "relative",
            padding: "5rem 2rem 2.5rem",
            background:
              "linear-gradient(180deg, #0b1222 0%, #0f172a 55%, #0a1120 100%)",
            color: "#fff",
            overflow: "hidden",
          }}
        >
          {/* Subtle mesh gradient glow */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(60% 55% at 15% 0%, rgba(14,165,233,0.16) 0%, transparent 60%), radial-gradient(50% 50% at 85% 10%, rgba(2,132,199,0.14) 0%, transparent 55%), radial-gradient(70% 60% at 50% 120%, rgba(56,189,248,0.10) 0%, transparent 60%)",
              pointerEvents: "none",
            }}
          />
          {/* Subtle background texture */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)",
              backgroundSize: "22px 22px",
              maskImage:
                "linear-gradient(180deg, rgba(0,0,0,0.5), transparent 70%)",
              WebkitMaskImage:
                "linear-gradient(180deg, rgba(0,0,0,0.5), transparent 70%)",
              pointerEvents: "none",
            }}
          />
          <div style={{ position: "relative", maxWidth: 1400, margin: "0 auto" }}>
            <div
              className="footer-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "1.4fr repeat(4, 1fr)",
                gap: "4rem",
                paddingBottom: "3.5rem",
                marginBottom: "2rem",
              }}
            >
              {/* Brand */}
              <div className="footer-brand-col" style={{ maxWidth: 320 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.875rem",
                    marginBottom: "1.5rem",
                  }}
                >
                  <span
                    className="footer-logo-wrap"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      background:
                        "linear-gradient(150deg, #ffffff 0%, #eef5fc 100%)",
                      padding: 7,
                      boxShadow:
                        "0 8px 22px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.6)",
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={colorLogo}
                      alt="SclinNexus Logo"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                      }}
                    />
                  </span>
                  <span
                    style={{
                      fontSize: "1.5rem",
                      fontWeight: 800,
                      letterSpacing: "-0.02em",
                      background:
                        "linear-gradient(90deg, #ffffff 0%, #cbe6fb 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    SclinNexus
                  </span>
                </div>
                <p
                  style={{
                    fontSize: "0.9375rem",
                    color: "rgba(226,232,240,0.65)",
                    lineHeight: 1.7,
                    marginBottom: "1.75rem",
                    maxWidth: 300,
                  }}
                >
                  Empowering clinical research with innovative technology
                  solutions for faster, safer drug development.
                </p>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  {[<Linkedin size={19} />, <Twitter size={19} />].map(
                    (Icon, i) => (
                      <a
                        key={i}
                        className="footer-social"
                        href="#"
                        style={{
                          width: 42,
                          height: 42,
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.12)",
                          borderRadius: 12,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#e2e8f0",
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
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: "#7dd3fc",
                      marginBottom: "1.5rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
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
                        <li key={li} style={{ marginBottom: "0.875rem" }}>
                          <a
                            className="footer-link"
                            href={href}
                            onClick={onClick}
                            style={{
                              color: "rgba(226,232,240,0.62)",
                              textDecoration: "none",
                              fontSize: "0.9375rem",
                              transition: "color 0.25s ease, transform 0.25s ease",
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

            {/* Gradient divider line */}
            <div
              aria-hidden
              style={{
                height: 1,
                width: "100%",
                marginBottom: "2rem",
                background:
                  "linear-gradient(90deg, transparent, rgba(56,189,248,0.45) 25%, rgba(56,189,248,0.45) 75%, transparent)",
              }}
            />

            <div
              className="footer-bottom"
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
                  color: "rgba(226,232,240,0.5)",
                  margin: 0,
                }}
              >
                © 2026 SclinNexus. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
