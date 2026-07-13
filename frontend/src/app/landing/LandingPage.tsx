"use client";

import {
    useEffect,
    useRef,
    useState,
    type CSSProperties,
    type ReactNode,
} from "react";
import Link from "next/link";
import {
    ArrowRight,
    Menu,
    X,
    ChevronDown,
    Scale,
    Building2,
    Rocket,
    TrendingUp,
    Building,
    MessageSquare,
    FolderKanban,
    Table2,
    Zap,
    Users,
    Gavel,
    Cpu,
    Sparkles,
    Check,
    FileText,
    Database,
    CheckCircle2,
} from "lucide-react";
import { cn } from "@/app/lib/utils";

const ACCENT = "#0071F2";

/* ─── Scroll-triggered reveal (IntersectionObserver, no scroll listeners) ─── */

function Reveal({
    children,
    delay = 0,
    scale = false,
    className,
}: {
    children: ReactNode;
    delay?: number;
    scale?: boolean;
    className?: string;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (
            typeof window !== "undefined" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ) {
            setVisible(true);
            return;
        }
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setVisible(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return (
        <div
            ref={ref}
            style={{ transitionDelay: `${delay}ms` }}
            className={cn(
                "reveal",
                scale && "reveal-scale",
                visible && "reveal-visible",
                className,
            )}
        >
            {children}
        </div>
    );
}

const NAV_LINKS = [
    { label: "Product", href: "#features" },
    { label: "Who it's for", href: "#audiences" },
    { label: "FAQ", href: "#faq" },
];

export function LandingPage() {
    return (
        <div className="min-h-screen bg-white font-sans text-gray-900">
            <SiteNav />
            <main>
                <Hero />
                <Audiences />
                <Features />
                <DeepAi />
                <Comparison />
                <FinalCta />
                <Faq />
            </main>
            <Footer />
        </div>
    );
}

function SiteNav() {
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-xl">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
                <Link
                    href="/"
                    className="font-bitter text-2xl font-medium text-gray-900 transition-opacity hover:opacity-70"
                >
                    Sterlex
                </Link>

                <nav className="hidden items-center gap-8 md:flex">
                    {NAV_LINKS.map((link) => (
                        <a
                            key={link.href}
                            href={link.href}
                            className="relative text-sm text-gray-600 transition-colors after:absolute after:-bottom-1 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-gray-900 after:transition-transform after:duration-300 hover:text-gray-900 hover:after:scale-x-100"
                        >
                            {link.label}
                        </a>
                    ))}
                </nav>

                <div className="hidden items-center gap-3 md:flex">
                    <Link
                        href="/login"
                        className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
                    >
                        Log in
                    </Link>
                    <Link
                        href="/signup"
                        className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:scale-[1.04] hover:bg-gray-800 hover:shadow-md active:scale-[0.98]"
                    >
                        Start free trial
                    </Link>
                </div>

                <button
                    onClick={() => setMenuOpen((v) => !v)}
                    className="p-2 text-gray-700 md:hidden"
                    aria-label="Toggle menu"
                >
                    {menuOpen ? (
                        <X className="h-5 w-5" />
                    ) : (
                        <Menu className="h-5 w-5" />
                    )}
                </button>
            </div>

            {menuOpen && (
                <div className="border-t border-gray-100 bg-white px-6 py-4 md:hidden">
                    <nav className="flex flex-col gap-4">
                        {NAV_LINKS.map((link) => (
                            <a
                                key={link.href}
                                href={link.href}
                                onClick={() => setMenuOpen(false)}
                                className="text-sm text-gray-600"
                            >
                                {link.label}
                            </a>
                        ))}
                        <div className="mt-2 flex flex-col gap-2 border-t border-gray-100 pt-4">
                            <Link
                                href="/login"
                                className="text-sm font-medium text-gray-600"
                            >
                                Log in
                            </Link>
                            <Link
                                href="/signup"
                                className="rounded-full bg-gray-900 px-4 py-2 text-center text-sm font-medium text-white"
                            >
                                Start free trial
                            </Link>
                        </div>
                    </nav>
                </div>
            )}
        </header>
    );
}

/* ─── Hero ─── */

function Hero() {
    return (
        <section className="relative isolate overflow-hidden bg-white pt-24 pb-24 md:pt-32 md:pb-32">
            {/* Animated gradient mesh + dot grid, desktop only for performance */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 opacity-[0.35]"
                style={{
                    backgroundImage:
                        "radial-gradient(rgba(0,0,0,0.10) 1px, transparent 1px)",
                    backgroundSize: "28px 28px",
                    maskImage:
                        "radial-gradient(ellipse 70% 60% at 50% 0%, black, transparent)",
                    WebkitMaskImage:
                        "radial-gradient(ellipse 70% 60% at 50% 0%, black, transparent)",
                }}
            />
            <div
                aria-hidden
                className="pointer-events-none absolute -top-32 left-1/4 -z-10 hidden h-[480px] w-[640px] rounded-full blur-3xl md:block"
                style={{
                    background:
                        "radial-gradient(closest-side, rgba(0,113,242,0.10), transparent)",
                    animation: "blobDriftA 22s ease-in-out infinite",
                }}
            />
            <div
                aria-hidden
                className="pointer-events-none absolute -top-20 right-[10%] -z-10 hidden h-[420px] w-[520px] rounded-full blur-3xl md:block"
                style={{
                    background:
                        "radial-gradient(closest-side, rgba(38,37,30,0.08), transparent)",
                    animation: "blobDriftB 28s ease-in-out infinite",
                }}
            />

            <div className="mx-auto max-w-7xl px-6 lg:px-8">
                <div className="mx-auto max-w-4xl text-center">
                    <h1 className="font-serif text-5xl font-medium tracking-tight text-gray-900 sm:text-6xl md:text-7xl">
                        <span
                            className="hero-enter block"
                            style={{ animationDelay: "0ms" }}
                        >
                            Enterprise legal AI.
                        </span>
                        <span
                            className="hero-enter block"
                            style={{ animationDelay: "120ms" }}
                        >
                            Without the enterprise price.
                        </span>
                    </h1>
                    <p
                        className="hero-enter mx-auto mt-7 max-w-2xl text-lg text-gray-500"
                        style={{ animationDelay: "260ms" }}
                    >
                        Contract review, due diligence, and verified legal
                        research. The same firepower as the platforms built
                        for BigLaw, without the procurement cycle. Sign up,
                        upload, start working.
                    </p>
                    <div
                        className="hero-enter mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
                        style={{ animationDelay: "400ms" }}
                    >
                        <Link
                            href="/signup"
                            className="group inline-flex items-center justify-center gap-2 rounded-full bg-gray-900 px-7 py-3.5 text-sm font-medium text-white shadow-[0_8px_24px_rgba(38,37,30,0.28)] transition-all duration-200 hover:scale-[1.04] hover:bg-gray-800 hover:shadow-[0_12px_32px_rgba(38,37,30,0.34)] active:scale-[0.98]"
                        >
                            Start your 7 day free trial
                            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                        </Link>
                        <p className="text-xs text-gray-400">Cancel anytime.</p>
                    </div>
                </div>

                {/* IMAGE PLACEHOLDER: hero product screenshot (Assistant view, ~1440x900).
                    Replace the inner labeled div with an <Image> and keep the browser frame. */}
                <Reveal scale delay={150} className="mx-auto mt-20 max-w-5xl">
                    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.14)]">
                        <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3">
                            <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
                            <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
                            <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
                            <span className="mx-auto rounded-md bg-white px-8 py-1 text-[11px] text-gray-400 shadow-sm">
                                app.sterlex.ai
                            </span>
                            <span className="w-12" />
                        </div>
                        <div className="flex h-[340px] items-center justify-center bg-offwhite/60 sm:h-[460px]">
                            <div className="text-center">
                                <p className="text-sm font-medium text-gray-400">
                                    IMAGE PLACEHOLDER: hero product screenshot
                                </p>
                                <p className="mt-1 text-xs text-gray-300">
                                    Assistant view, full app window
                                </p>
                            </div>
                        </div>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

/* ─── Who it's for ─── */

interface Audience {
    icon: React.ElementType;
    title: string;
    pain: string;
    solution: string;
}

const AUDIENCES: Audience[] = [
    {
        icon: Scale,
        title: "Law Firms",
        pain: "First pass review is eating your associates' week.",
        solution: "Upload, ask, get flagged issues in minutes.",
    },
    {
        icon: Building2,
        title: "Private Equity",
        pain: "Due diligence should not take three associates a week.",
        solution: "One Tabular Review across the entire data room.",
    },
    {
        icon: Rocket,
        title: "Venture Capital",
        pain: "Every SAFE and term sheet, read before you sign.",
        solution: "Instant analysis against your standard terms.",
    },
    {
        icon: TrendingUp,
        title: "Investment Banking",
        pain: "Deal documents move fast. Your review moves faster.",
        solution: "Workflows built for time sensitive transactions.",
    },
    {
        icon: Building,
        title: "Corporate / In House",
        pain: "One counsel. Unlimited contract volume.",
        solution: "Playbook driven review, consistent every time.",
    },
];

function Audiences() {
    return (
        <section id="audiences" className="bg-offwhite py-24 md:py-32">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
                <Reveal>
                    <h2 className="text-center font-serif text-3xl font-medium text-gray-900 sm:text-4xl md:text-5xl">
                        Built for every side of the table
                    </h2>
                </Reveal>
                <div className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
                    {AUDIENCES.map((item, i) => (
                        <Reveal key={item.title} delay={i * 70} className="flex">
                            <div className="flex flex-1 flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-1.5 hover:border-gray-300 hover:shadow-[0_16px_40px_rgba(15,23,42,0.10)]">
                                <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-gray-900">
                                    <item.icon className="h-5 w-5 text-white" />
                                </div>
                                <h3 className="text-sm font-semibold text-gray-900">
                                    {item.title}
                                </h3>
                                <p className="mt-3 text-sm text-gray-500">
                                    {item.pain}
                                </p>
                                <p className="mt-2 text-sm font-medium text-gray-800">
                                    {item.solution}
                                </p>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* ─── Features ─── */

interface Feature {
    icon: React.ElementType;
    title: string;
    description: string;
}

const FEATURES: Feature[] = [
    {
        icon: MessageSquare,
        title: "Assistant",
        description:
            "Ask anything about any document. Get answers with page level citations, instantly.",
    },
    {
        icon: FolderKanban,
        title: "Projects",
        description:
            "Every matter in one workspace. Documents, history, and context stay together.",
    },
    {
        icon: Table2,
        title: "Tabular Review",
        description:
            "Hundreds of documents. One structured table. Every cell traceable to its source.",
    },
    {
        icon: Zap,
        title: "Automated Workflows",
        description:
            "NDAs, credit agreements, change of control clauses. Reviewed in one click.",
    },
    {
        icon: Users,
        title: "Team Collaboration",
        description:
            "Share projects, findings, and chat history with your whole team.",
    },
    {
        icon: Gavel,
        title: "External Legal Data",
        description:
            "Real case law and court records ground every analysis in precedent.",
    },
    {
        icon: Cpu,
        title: "Choose Your AI",
        description:
            "Claude, GPT, or Gemini. Pick per task, switch anytime, or run all three.",
    },
];

function Features() {
    return (
        <section id="features" className="bg-white py-24 md:py-32">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
                <Reveal>
                    <h2 className="text-center font-serif text-3xl font-medium text-gray-900 sm:text-4xl md:text-5xl">
                        Everything a legal team needs.{" "}
                        <span className="sm:block">
                            Nothing you don&apos;t.
                        </span>
                    </h2>
                </Reveal>
                <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
                    {FEATURES.map((feature, i) => (
                        <Reveal key={feature.title} delay={(i % 2) * 90}>
                            <div className="group flex gap-4 rounded-2xl p-4 transition-colors duration-200 hover:bg-gray-50">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-900 transition-colors duration-300 group-hover:bg-accent-blue">
                                    <feature.icon className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-base font-semibold text-gray-900">
                                        {feature.title}
                                    </h3>
                                    <p className="mt-1.5 text-sm leading-relaxed text-gray-500">
                                        {feature.description}
                                    </p>
                                </div>
                            </div>
                        </Reveal>
                    ))}
                </div>

                {/* IMAGE PLACEHOLDER: Tabular Review product screenshot (wide, ~2000x1100).
                    Replace the labeled div below with an <Image>. */}
                <Reveal scale delay={100} className="mx-auto mt-20 max-w-5xl">
                    <div className="flex h-[280px] items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-offwhite/50 sm:h-[380px]">
                        <div className="text-center">
                            <p className="text-sm font-medium text-gray-400">
                                IMAGE PLACEHOLDER: Tabular Review screenshot
                            </p>
                            <p className="mt-1 text-xs text-gray-300">
                                Wide shot of the spreadsheet style extraction
                                view
                            </p>
                        </div>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

/* ─── Deep AI: animated data-flow diagram ─── */

function FlowLine({
    dir = "right",
    className,
}: {
    dir?: "right" | "down" | "up";
    className?: string;
}) {
    const cfg = {
        right: { w: 90, h: 24, d: "M3 12 H87" },
        down: { w: 24, h: 44, d: "M12 3 V41" },
        up: { w: 24, h: 44, d: "M12 41 V3" },
    }[dir];

    return (
        <svg
            width={cfg.w}
            height={cfg.h}
            viewBox={`0 0 ${cfg.w} ${cfg.h}`}
            fill="none"
            aria-hidden
            className={cn("shrink-0", className)}
        >
            <path
                d={cfg.d}
                stroke="rgba(255,255,255,0.14)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeDasharray="2 6"
            />
            <path
                d={cfg.d}
                pathLength={1}
                className="flow-path"
                stroke="rgba(0,113,242,0.65)"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
            <circle className="flow-dot" r="6" fill="rgba(0,113,242,0.22)">
                <animateMotion
                    dur="2.2s"
                    repeatCount="indefinite"
                    path={cfg.d}
                />
            </circle>
            <circle className="flow-dot" r="2.5" fill={ACCENT}>
                <animateMotion
                    dur="2.2s"
                    repeatCount="indefinite"
                    path={cfg.d}
                />
            </circle>
        </svg>
    );
}

const skeletonLine = (width: string): CSSProperties => ({ width });

interface DeepAiPillar {
    icon: React.ElementType;
    title: string;
    description: string;
}

const DEEP_AI_PILLARS: DeepAiPillar[] = [
    {
        icon: Cpu,
        title: "The right model for the job",
        description:
            "Claude, GPT, and Gemini side by side. Pick per task, or run them against each other and compare.",
    },
    {
        icon: Gavel,
        title: "Grounded in real law",
        description:
            "Citations are checked against real court records before they reach you. Not memory. Verification.",
    },
    {
        icon: Sparkles,
        title: "Tuned for legal work",
        description:
            "Clause numbering, tracked changes, citation formats. Built around how deals actually close.",
    },
];

function DeepAi() {
    return (
        <section className="relative isolate overflow-hidden bg-black py-24 md:py-32">
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-20 opacity-50"
                style={{
                    backgroundImage:
                        "radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1px)",
                    backgroundSize: "24px 24px",
                }}
            />
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10"
                style={{
                    background:
                        "radial-gradient(ellipse 70% 60% at 50% 0%, rgba(0,113,242,0.10), transparent)",
                }}
            />
            <div className="mx-auto max-w-5xl px-6 text-center lg:px-8">
                <Reveal>
                    <h2 className="font-serif text-3xl font-medium text-white sm:text-4xl md:text-5xl">
                        AI that reads like a real lawyer.
                    </h2>
                    <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-400">
                        Frontier models working in tandem. Real world data
                        behind every claim. Legal reasoning built in from the
                        first token. Watch a document become verified work
                        product.
                    </p>
                </Reveal>

                <Reveal delay={150}>
                    <div className="mt-16 flex flex-col items-center justify-center gap-1 lg:flex-row lg:gap-2">
                        {/* Input node */}
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-44 rounded-xl border border-white/12 bg-white/[0.04] p-3 text-left">
                                <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-gray-300" />
                                    <span className="text-xs font-medium text-gray-200">
                                        Credit agreement
                                    </span>
                                </div>
                                <div className="mt-2.5 space-y-1.5">
                                    <div
                                        className="h-1.5 rounded bg-white/10"
                                        style={skeletonLine("100%")}
                                    />
                                    <div
                                        className="h-1.5 rounded bg-white/10"
                                        style={skeletonLine("80%")}
                                    />
                                    <div
                                        className="h-1.5 rounded bg-white/10"
                                        style={skeletonLine("60%")}
                                    />
                                </div>
                            </div>
                            <span className="text-[11px] uppercase tracking-wider text-gray-500">
                                Your document
                            </span>
                        </div>

                        <FlowLine dir="right" className="hidden lg:block" />
                        <FlowLine dir="down" className="lg:hidden" />

                        {/* Engine node: models feed down, data feeds up */}
                        <div className="flex flex-col items-center">
                            <div className="flex items-center gap-1.5">
                                {["Claude", "GPT", "Gemini"].map((model) => (
                                    <span
                                        key={model}
                                        className="rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-gray-300"
                                    >
                                        {model}
                                    </span>
                                ))}
                            </div>
                            <FlowLine dir="down" />
                            <div className="rounded-2xl border border-white/15 bg-white/[0.06] px-8 py-4 shadow-[0_0_45px_rgba(0,113,242,0.16)]">
                                <span className="font-bitter text-xl font-medium text-white">
                                    Sterlex
                                </span>
                            </div>
                            <FlowLine dir="up" />
                            <div className="flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-3 py-1">
                                <Database className="h-3 w-3 text-gray-400" />
                                <span className="text-[11px] font-medium text-gray-300">
                                    Court records · Market data
                                </span>
                            </div>
                        </div>

                        <FlowLine dir="right" className="hidden lg:block" />
                        <FlowLine dir="down" className="lg:hidden" />

                        {/* Output node */}
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-44 rounded-xl border border-accent-blue/40 bg-accent-blue/[0.07] p-3 text-left">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-gray-100">
                                        Answer
                                    </span>
                                    <span className="flex items-center gap-1 text-[10px] font-medium text-green-400">
                                        <CheckCircle2 className="h-3 w-3" />
                                        Verified
                                    </span>
                                </div>
                                <div className="mt-2.5 space-y-1.5">
                                    <div className="flex items-center gap-1">
                                        <div
                                            className="h-1.5 rounded bg-white/15"
                                            style={skeletonLine("60%")}
                                        />
                                        <span className="rounded bg-accent-blue/30 px-1 text-[8px] leading-3 text-blue-200">
                                            1
                                        </span>
                                    </div>
                                    <div
                                        className="h-1.5 rounded bg-white/15"
                                        style={skeletonLine("100%")}
                                    />
                                    <div className="flex items-center gap-1">
                                        <div
                                            className="h-1.5 rounded bg-white/15"
                                            style={skeletonLine("75%")}
                                        />
                                        <span className="rounded bg-accent-blue/30 px-1 text-[8px] leading-3 text-blue-200">
                                            2
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <span className="text-[11px] uppercase tracking-wider text-gray-500">
                                Cited work product
                            </span>
                        </div>
                    </div>
                </Reveal>

                <div className="mx-auto mt-20 grid max-w-4xl grid-cols-1 gap-6 text-left sm:grid-cols-3">
                    {DEEP_AI_PILLARS.map((pillar, i) => (
                        <Reveal key={pillar.title} delay={i * 100}>
                            <div className="h-full rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.05]">
                                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.08]">
                                    <pillar.icon className="h-5 w-5 text-gray-200" />
                                </div>
                                <h3 className="text-sm font-semibold text-white">
                                    {pillar.title}
                                </h3>
                                <p className="mt-2 text-sm leading-relaxed text-gray-400">
                                    {pillar.description}
                                </p>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* ─── Comparison ─── */

const COMPARISON_ROWS = [
    {
        label: "Price",
        sterlex: "Self service, transparent",
        other: "Custom quote, six figures per year",
    },
    {
        label: "Onboarding",
        sterlex: "Live in minutes",
        other: "Weeks of implementation",
    },
    {
        label: "Sales process",
        sterlex: "None. Sign up and go",
        other: "Demo, call, procurement",
    },
];

function Comparison() {
    return (
        <section id="pricing" className="bg-offwhite py-24 md:py-32">
            <div className="mx-auto max-w-5xl px-6 lg:px-8">
                <Reveal>
                    <div className="text-center">
                        <h2 className="font-serif text-3xl font-medium text-gray-900 sm:text-4xl md:text-5xl">
                            A different model. Not just a cheaper one.
                        </h2>
                        <p className="mx-auto mt-4 max-w-2xl text-gray-600">
                            Most legal AI platforms were built for firms with
                            seven figure tech budgets. Sterlex was built for
                            everyone else.
                        </p>
                    </div>
                </Reveal>

                <Reveal delay={120}>
                    <div className="mt-14 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_10px_40px_rgba(15,23,42,0.06)]">
                        <div className="grid grid-cols-3 bg-gray-100 text-[11px] font-medium uppercase tracking-wider text-gray-600 sm:text-xs">
                            <div className="px-3 py-4 sm:px-6">&nbsp;</div>
                            <div className="border-l border-gray-200 px-3 py-4 font-bitter text-base font-medium normal-case tracking-normal text-gray-900 sm:px-6">
                                Sterlex
                            </div>
                            <div className="break-words border-l border-gray-200 px-3 py-4 sm:px-6">
                                Traditional Enterprise Legal AI
                            </div>
                        </div>
                        {COMPARISON_ROWS.map((row, i) => (
                            <div
                                key={row.label}
                                className={cn(
                                    "grid grid-cols-3 text-xs transition-colors duration-200 hover:bg-accent-blue/[0.03] sm:text-sm",
                                    i !== 0 && "border-t border-gray-200",
                                )}
                            >
                                <div className="break-words px-3 py-5 font-medium text-gray-900 sm:px-6">
                                    {row.label}
                                </div>
                                <div className="flex items-start gap-1.5 break-words border-l border-gray-200 bg-accent-blue/[0.04] px-3 py-5 text-gray-900 sm:gap-2 sm:px-6">
                                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-blue" />
                                    <span>{row.sterlex}</span>
                                </div>
                                <div className="break-words border-l border-gray-200 px-3 py-5 text-gray-600 sm:px-6">
                                    {row.other}
                                </div>
                            </div>
                        ))}
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

/* ─── Final CTA ─── */

function FinalCta() {
    return (
        <section className="relative isolate overflow-hidden bg-[#26251e] py-24 md:py-28">
            <div
                aria-hidden
                className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-[360px] w-[560px] -translate-x-1/2 rounded-full blur-3xl"
                style={{
                    background:
                        "radial-gradient(closest-side, rgba(0,113,242,0.14), transparent)",
                    animation: "blobDriftB 26s ease-in-out infinite",
                }}
            />
            <div className="mx-auto max-w-3xl px-6 text-center lg:px-8">
                <Reveal>
                    <h2 className="font-serif text-3xl font-medium text-white sm:text-4xl md:text-5xl">
                        Try Sterlex free for 7 days
                    </h2>
                    <p className="mt-4 text-white/80">
                        Full access from minute one. Cancel anytime.
                    </p>
                    <div className="mt-9">
                        <Link
                            href="/signup"
                            className="group inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-medium text-gray-900 shadow-lg transition-all duration-200 hover:scale-[1.04] hover:shadow-xl active:scale-[0.98]"
                        >
                            Start free trial
                            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                        </Link>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

/* ─── FAQ ─── */

const FAQS = [
    {
        q: "Is my data secure?",
        a: "Documents are encrypted, never used to train models, and you control which AI provider processes them.",
    },
    {
        q: "Which AI model should I use?",
        a: "Each has strengths. Connect one or all three, switch anytime.",
    },
    {
        q: "Do I need a contract or sales call?",
        a: "No. Sign up, upload, start working. Cancel whenever.",
    },
    {
        q: "Can Sterlex edit Word documents with tracked changes?",
        a: "Yes. Edits land as native tracked changes in the Word file. Accept or reject them like any other redline.",
    },
    {
        q: "What is Tabular Review?",
        a: "One structured table across every document in a data room. The same fields, side by side, extracted in one pass.",
    },
    {
        q: "Can my whole team use one project?",
        a: "Yes. Invite your team into a project and share documents, findings, and chat history.",
    },
    {
        q: "Does Sterlex verify case law citations?",
        a: "Yes. Every citation is checked against real court records before it reaches your answer. If a case does not exist, you will know.",
    },
];

function Faq() {
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    return (
        <section id="faq" className="bg-white py-24 md:py-32">
            <div className="mx-auto max-w-3xl px-6 lg:px-8">
                <Reveal>
                    <h2 className="text-center font-serif text-3xl font-medium text-gray-900 sm:text-4xl md:text-5xl">
                        Questions, answered.
                    </h2>
                </Reveal>
                <Reveal delay={100}>
                    <div className="mt-14 divide-y divide-gray-100 rounded-2xl border border-gray-100 shadow-[0_6px_24px_rgba(15,23,42,0.04)]">
                        {FAQS.map((item, i) => {
                            const open = openIndex === i;
                            return (
                                <div
                                    key={item.q}
                                    className="px-6 transition-colors duration-200 first:rounded-t-2xl last:rounded-b-2xl hover:bg-gray-50/70"
                                >
                                    <button
                                        onClick={() =>
                                            setOpenIndex(open ? null : i)
                                        }
                                        className="flex w-full items-center justify-between gap-4 py-5 text-left"
                                    >
                                        <span className="text-sm font-medium text-gray-900">
                                            {item.q}
                                        </span>
                                        <ChevronDown
                                            className={cn(
                                                "h-4 w-4 shrink-0 text-gray-400 transition-transform duration-300",
                                                open && "rotate-180",
                                            )}
                                        />
                                    </button>
                                    <div
                                        className={cn(
                                            "grid transition-[grid-template-rows] duration-300 ease-out",
                                            open
                                                ? "grid-rows-[1fr]"
                                                : "grid-rows-[0fr]",
                                        )}
                                    >
                                        <div className="overflow-hidden">
                                            <p className="pb-5 text-sm leading-relaxed text-gray-500">
                                                {item.a}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

/* ─── Footer ─── */

function Footer() {
    return (
        <footer className="bg-gray-950 py-14 text-gray-400">
            <div className="mx-auto max-w-7xl px-6 text-center lg:px-8">
                <span className="font-bitter text-xl font-medium text-white">
                    Sterlex
                </span>
                <p className="mx-auto mt-2 max-w-xs text-sm text-gray-500">
                    Enterprise legal AI. Without the enterprise price.
                </p>
            </div>
        </footer>
    );
}
