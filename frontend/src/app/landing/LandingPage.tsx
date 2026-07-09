"use client";

import { useState } from "react";
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
    Linkedin,
    Twitter,
    Mail,
} from "lucide-react";
import { cn } from "@/app/lib/utils";

const NAV_LINKS = [
    { label: "Product", href: "#features" },
    { label: "Who it's for", href: "#audiences" },
    { label: "Pricing", href: "#pricing" },
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
                <Link href="/" className="font-bitter text-2xl font-medium text-burgundy-600">
                    Sterlex
                </Link>

                <nav className="hidden items-center gap-8 md:flex">
                    {NAV_LINKS.map((link) => (
                        <a
                            key={link.href}
                            href={link.href}
                            className="text-sm text-gray-600 transition-colors hover:text-gray-900"
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
                        className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800"
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

function Hero() {
    return (
        <section className="relative overflow-hidden bg-white pt-20 pb-24 md:pt-28 md:pb-32">
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[600px] bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(110,31,45,0.08),transparent)]"
            />
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
                <div className="mx-auto max-w-3xl text-center">
                    <h1 className="font-serif text-4xl font-medium tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
                        Enterprise legal AI.
                        <br />
                        Without the enterprise price.
                    </h1>
                    <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-500">
                        Sterlex gives small and mid size firms the same
                        document review, due diligence, and legal research
                        power as the big platforms. Self service, no sales
                        calls, live in minutes.
                    </p>
                    <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                        <Link
                            href="/signup"
                            className="inline-flex items-center justify-center gap-2 rounded-full bg-burgundy-600 px-7 py-3.5 text-sm font-medium text-white shadow-[0_8px_24px_rgba(110,31,45,0.28)] transition-colors hover:bg-burgundy-700"
                        >
                            Start your 7 day free trial
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                        <p className="text-xs text-gray-400">
                            No credit card required. Cancel anytime.
                        </p>
                    </div>
                </div>

                {/* Product preview placeholder. Swap for a real product screenshot. */}
                <div className="mx-auto mt-20 max-w-5xl">
                    <div className="relative rounded-2xl border border-gray-200 bg-gray-50 p-2 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
                        <div className="flex h-[360px] items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white sm:h-[440px]">
                            <div className="text-center">
                                <p className="text-sm font-medium text-gray-400">
                                    Product screenshot
                                </p>
                                <p className="mt-1 text-xs text-gray-300">
                                    Drop an image of the Assistant or Tabular
                                    Review view here
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

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
        pain: "Stop losing hours to first pass contract review.",
        solution: "Upload, ask, get flagged issues in minutes.",
    },
    {
        icon: Building2,
        title: "Private Equity",
        pain: "Due diligence shouldn't take three associates a week.",
        solution: "Tabular Review across the whole data room, side by side.",
    },
    {
        icon: Rocket,
        title: "Venture Capital",
        pain: "Every SAFE and term sheet, reviewed before you sign.",
        solution: "Instant analysis against your standard terms.",
    },
    {
        icon: TrendingUp,
        title: "Investment Banking",
        pain: "Deal documents move fast. Your review should too.",
        solution: "Workflows built for time sensitive transactions.",
    },
    {
        icon: Building,
        title: "Corporate / In House",
        pain: "One counsel, unlimited contract volume.",
        solution: "Consistent playbook driven review, every time.",
    },
];

function Audiences() {
    return (
        <section id="audiences" className="bg-gray-50 py-24 md:py-32">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
                <h2 className="text-center font-serif text-3xl font-medium text-gray-900 sm:text-4xl">
                    Built for every kind of deal team
                </h2>
                <div className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
                    {AUDIENCES.map((item) => (
                        <div
                            key={item.title}
                            className="flex flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
                        >
                            <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-burgundy-50">
                                <item.icon className="h-5 w-5 text-burgundy-600" />
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
                    ))}
                </div>
            </div>
        </section>
    );
}

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
            "Ask questions about any document and get cited, page referenced answers instantly.",
    },
    {
        icon: FolderKanban,
        title: "Projects",
        description:
            "Keep every matter organized. Documents, history, and context in one workspace.",
    },
    {
        icon: Table2,
        title: "Tabular Review",
        description:
            "Extract structured data across hundreds of documents into one spreadsheet style view.",
    },
    {
        icon: Zap,
        title: "Automated Workflows",
        description:
            "Pre built reviews for NDAs, credit agreements, change of control clauses, and more. Run in one click.",
    },
    {
        icon: Users,
        title: "Team Collaboration",
        description:
            "Share projects and findings with your whole team, not just yourself.",
    },
    {
        icon: Gavel,
        title: "External Legal Data",
        description:
            "We use real case law and court decisions to ground your analysis in precedent.",
    },
    {
        icon: Cpu,
        title: "Choose Your AI",
        description:
            "Connect Claude, ChatGPT, or Gemini. Use whichever model fits the task, or all three.",
    },
];

function Features() {
    return (
        <section id="features" className="bg-white py-24 md:py-32">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
                <h2 className="text-center font-serif text-3xl font-medium text-gray-900 sm:text-4xl">
                    Everything a legal team needs, nothing you don&apos;t
                </h2>
                <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-x-12 gap-y-10 md:grid-cols-2">
                    {FEATURES.map((feature) => (
                        <div key={feature.title} className="flex gap-4">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-900">
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
                    ))}
                </div>
            </div>
        </section>
    );
}

interface DeepAiPillar {
    icon: React.ElementType;
    title: string;
    description: string;
}

const DEEP_AI_PILLARS: DeepAiPillar[] = [
    {
        icon: Cpu,
        title: "The best model for the job",
        description:
            "Claude, GPT, and Gemini, connected side by side. Pick the model for the task, or run them against each other and compare.",
    },
    {
        icon: Gavel,
        title: "Grounded in real law",
        description:
            "Every citation is checked against real case law and court records before it reaches you. Not memory. Verification.",
    },
    {
        icon: Sparkles,
        title: "Tuned for legal work",
        description:
            "Clause numbering, tracked changes, citation formats. Our review logic is trained on how real deals and real filings actually work.",
    },
];

function DeepAi() {
    return (
        <section className="relative overflow-hidden bg-black py-24 md:py-32">
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_60%_at_50%_0%,rgba(110,31,45,0.25),transparent)]"
            />
            <div className="mx-auto max-w-5xl px-6 text-center lg:px-8">
                <h2 className="font-serif text-3xl font-medium text-white sm:text-4xl md:text-5xl">
                    AI that reads like a real lawyer.
                </h2>
                <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-400">
                    Multiple frontier models working in tandem. Real world data
                    grounding every insight. Legal reasoning baked in from the
                    beginning. That is how we turn models into work product.
                </p>

                <div className="mt-16 flex flex-col items-center justify-center gap-4 sm:gap-6 lg:flex-row">
                    <div className="flex flex-wrap items-center justify-center gap-3">
                        {["Claude", "GPT", "Gemini"].map((model) => (
                            <span
                                key={model}
                                className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-200 sm:px-4 sm:py-2 sm:text-sm"
                            >
                                {model}
                            </span>
                        ))}
                    </div>
                    <ArrowRight className="hidden h-4 w-4 shrink-0 text-gray-600 lg:block" />
                    <ChevronDown className="h-4 w-4 shrink-0 text-gray-600 lg:hidden" />
                    <div className="text-xs font-medium text-gray-400">
                        Real world
                        <br />
                        information
                    </div>
                    <ArrowRight className="hidden h-4 w-4 shrink-0 text-gray-600 lg:block" />
                    <ChevronDown className="h-4 w-4 shrink-0 text-gray-600 lg:hidden" />
                    <span className="font-bitter text-lg font-medium text-burgundy-400">
                        Sterlex
                    </span>
                    <ArrowRight className="hidden h-4 w-4 shrink-0 text-gray-600 lg:block" />
                    <ChevronDown className="h-4 w-4 shrink-0 text-gray-600 lg:hidden" />
                    <span className="rounded-full border border-burgundy-400/50 bg-burgundy-600/25 px-4 py-2 text-sm font-medium text-white">
                        Polished work
                    </span>
                </div>

                <div className="mx-auto mt-20 grid max-w-4xl grid-cols-1 gap-6 text-left sm:grid-cols-3">
                    {DEEP_AI_PILLARS.map((pillar) => (
                        <div
                            key={pillar.title}
                            className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
                        >
                            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-burgundy-600/15">
                                <pillar.icon className="h-5 w-5 text-burgundy-300" />
                            </div>
                            <h3 className="text-sm font-semibold text-white">
                                {pillar.title}
                            </h3>
                            <p className="mt-2 text-sm leading-relaxed text-gray-400">
                                {pillar.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

const COMPARISON_ROWS = [
    {
        label: "Price",
        sterlex: "Self service, transparent",
        other: "Custom quote, six figures per year",
    },
    {
        label: "Onboarding",
        sterlex: "Instant",
        other: "Weeks of implementation",
    },
    {
        label: "Sales process",
        sterlex: "None. Sign up and go",
        other: "Sales call required",
    },
];

function Comparison() {
    return (
        <section id="pricing" className="bg-gray-50 py-24 md:py-32">
            <div className="mx-auto max-w-5xl px-6 lg:px-8">
                <div className="text-center">
                    <h2 className="font-serif text-3xl font-medium text-gray-900 sm:text-4xl">
                        A different model, not just a cheaper one
                    </h2>
                    <p className="mx-auto mt-4 max-w-2xl text-gray-600">
                        Most enterprise legal AI platforms were built for
                        firms with seven figure tech budgets. Sterlex was
                        built for everyone else.
                    </p>
                </div>

                <div className="mt-14 overflow-hidden rounded-2xl border border-gray-200 bg-white">
                    <div className="grid grid-cols-3 bg-gray-100 text-[11px] font-medium uppercase tracking-wider text-gray-600 sm:text-xs">
                        <div className="px-3 py-4 sm:px-6">&nbsp;</div>
                        <div className="border-l border-gray-200 px-3 py-4 font-bitter text-sm font-medium text-gray-900 sm:px-6">
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
                                "grid grid-cols-3 text-xs sm:text-sm",
                                i !== 0 && "border-t border-gray-200",
                            )}
                        >
                            <div className="break-words px-3 py-5 font-medium text-gray-900 sm:px-6">
                                {row.label}
                            </div>
                            <div className="flex items-start gap-1.5 break-words border-l border-gray-200 bg-burgundy-50 px-3 py-5 text-gray-900 sm:gap-2 sm:px-6">
                                <Check className="mt-0.5 h-4 w-4 shrink-0 text-burgundy-600" />
                                <span>{row.sterlex}</span>
                            </div>
                            <div className="break-words border-l border-gray-200 px-3 py-5 text-gray-600 sm:px-6">
                                {row.other}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

function FinalCta() {
    return (
        <section className="bg-burgundy-600 py-24 md:py-28">
            <div className="mx-auto max-w-3xl px-6 text-center lg:px-8">
                <h2 className="font-serif text-3xl font-medium text-white sm:text-4xl">
                    Try Sterlex free for 7 days
                </h2>
                <p className="mt-4 text-white/85">
                    Full access. Cancel anytime.
                </p>
                <div className="mt-9">
                    <Link
                        href="/signup"
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-medium text-burgundy-700 shadow-lg transition-colors hover:bg-burgundy-50"
                    >
                        Start free trial
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                </div>
            </div>
        </section>
    );
}

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
        a: "No. Self service signup, cancel whenever.",
    },
    {
        q: "Can Sterlex edit Word documents with tracked changes?",
        a: "Yes. Edits appear as native tracked changes in the Word file, ready to accept or reject like any other redline.",
    },
    {
        q: "What is Tabular Review?",
        a: "A spreadsheet style view that extracts the same fields across every document in a data room, side by side, in one pass.",
    },
    {
        q: "Can my whole team use one project?",
        a: "Yes. Invite your team to a project and share documents, findings, and chat history together.",
    },
    {
        q: "Does Sterlex verify case law citations?",
        a: "Yes. Citations are checked against real court records before they reach your answer, so you are not citing a case that does not exist.",
    },
    {
        q: "What happens after the 7 day trial?",
        a: "You choose a plan and continue, or you walk away. No auto lock in contracts.",
    },
];

function Faq() {
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    return (
        <section id="faq" className="bg-white py-24 md:py-32">
            <div className="mx-auto max-w-3xl px-6 lg:px-8">
                <h2 className="text-center font-serif text-3xl font-medium text-gray-900 sm:text-4xl">
                    Frequently asked questions
                </h2>
                <div className="mt-14 divide-y divide-gray-100 rounded-2xl border border-gray-100">
                    {FAQS.map((item, i) => {
                        const open = openIndex === i;
                        return (
                            <div key={item.q} className="px-6">
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
                                            "h-4 w-4 shrink-0 text-gray-400 transition-transform",
                                            open && "rotate-180",
                                        )}
                                    />
                                </button>
                                {open && (
                                    <p className="pb-5 text-sm leading-relaxed text-gray-500">
                                        {item.a}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

const FOOTER_LINKS = [
    { label: "About", href: "/support" },
    { label: "Pricing", href: "#pricing" },
    { label: "Legal", href: "/support" },
];

function Footer() {
    return (
        <footer className="bg-gray-950 py-14 text-gray-400">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
                <div className="flex flex-col items-center justify-between gap-8 sm:flex-row">
                    <div>
                        <span className="font-bitter text-xl font-medium text-white">
                            Sterlex
                        </span>
                        <p className="mt-2 max-w-xs text-sm text-gray-500">
                            Enterprise legal AI. Without the enterprise
                            price.
                        </p>
                    </div>

                    <nav className="flex flex-wrap items-center justify-center gap-6">
                        {FOOTER_LINKS.map((link) => (
                            <a
                                key={link.label}
                                href={link.href}
                                className="text-sm text-gray-400 transition-colors hover:text-white"
                            >
                                {link.label}
                            </a>
                        ))}
                    </nav>

                    <div className="flex items-center gap-4">
                        <a
                            href="https://linkedin.com"
                            aria-label="LinkedIn"
                            className="text-gray-500 transition-colors hover:text-white"
                        >
                            <Linkedin className="h-4 w-4" />
                        </a>
                        <a
                            href="https://twitter.com"
                            aria-label="X (Twitter)"
                            className="text-gray-500 transition-colors hover:text-white"
                        >
                            <Twitter className="h-4 w-4" />
                        </a>
                        <a
                            href="mailto:hello@sterlex.ai"
                            aria-label="Email"
                            className="text-gray-500 transition-colors hover:text-white"
                        >
                            <Mail className="h-4 w-4" />
                        </a>
                    </div>
                </div>

                <div className="mt-10 border-t border-white/10 pt-8 text-center text-xs text-gray-500">
                    © {new Date().getFullYear()} Sterlex. All rights
                    reserved.
                </div>
            </div>
        </footer>
    );
}
