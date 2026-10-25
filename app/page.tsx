import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { money } from "@/components/compare/format";
import { Reveal } from "@/components/home/reveal";
import { SplitShowcase } from "@/components/home/split-showcase";
import { getCatalog } from "@/lib/catalog";
import { summarize } from "@/lib/cost";
import { LEGAL_AID_URL } from "@/lib/flags";

// The landing page as a street poster: maroon and burnt orange fields, condensed
// capitals, real Blacksburg photographs. Every number on it comes from a real
// hand-checked catalog listing, worked out by lib/cost.ts.
const EXAMPLE_NAME = "Foxridge";
const LEASE_MONTHS = 12;
const REPO_URL = "https://github.com/sam044/true-cost";

const STAGES = [
  {
    time: "Ten seconds",
    text: "First, say who's splitting the rent.",
    grow: 10,
    tone: "bg-maroon text-cream",
  },
  {
    time: "A few taps",
    text: "Then pick complexes we've already read, or capture any listing with the extension.",
    grow: 18,
    tone: "bg-orange text-ink",
  },
  {
    time: "About a minute",
    text: "Next, check every fee Gemma found, with the words it came from.",
    grow: 52,
    tone: "bg-ink text-cream dark:bg-cream dark:text-ink",
  },
  {
    time: "Instantly",
    text: "Last, see what each place really costs you per person.",
    grow: 12,
    tone: "bg-maroon-deep text-cream",
  },
];

const PHOTOS = {
  burruss: {
    src: "/home/burruss-hall.jpg",
    alt: "Burruss Hall at Virginia Tech, a Hokie Stone tower, with the Virginia flag flying in front",
    credit: "“VT Burruss Hall” by Ben Schumin",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
    page: "https://commons.wikimedia.org/w/index.php?curid=301502",
  },
  corner: {
    src: "/home/main-and-roanoke.jpg",
    alt: "Main Street and Roanoke Street in downtown Blacksburg under a cloudy sky",
    credit: "“Blacksburg, Virginia” by Smash the Iron Cage",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    page: "https://commons.wikimedia.org/w/index.php?curid=39867063",
  },
  dusk: {
    src: "/home/downtown-main-street.jpg",
    alt: "A brick corner building with red awnings on North Main Street, Blacksburg, at dusk",
    credit: "“Blacksburg-downtown-mainst” by Phuriphat Dejsuphong",
    license: "CC BY-SA 2.5",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/2.5/",
    page: "https://commons.wikimedia.org/w/index.php?curid=871161",
  },
  summer: {
    src: "/home/downtown-summer.jpg",
    alt: "Downtown Blacksburg in summer, shopfronts and trees along Main Street",
    credit: "“Downtown, Blacksburg, VA, USA” by Idawriter",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
    page: "https://commons.wikimedia.org/w/index.php?curid=53628990",
  },
};

function exampleListing() {
  const checked = getCatalog().filter((e) => !e.autoScanned);
  return checked.find((e) => e.name.includes(EXAMPLE_NAME)) ?? checked[0];
}

function CompareButton({ className }: { className?: string }) {
  return (
    <Button
      asChild
      size="lg"
      className={`h-14 rounded-none bg-orange px-7 text-base font-semibold text-ink shadow-none hover:bg-cream ${className ?? ""}`}
    >
      <Link href="/compare/setup">
        Compare apartments
        <ArrowRight
          aria-hidden
          className="size-5 transition-transform duration-200 ease-(--ease-out-strong) group-hover/button:translate-x-1"
        />
      </Link>
    </Button>
  );
}

export default function Home() {
  const example = exampleListing();
  const catalog = getCatalog();
  const names = catalog.map((e) => e.name);
  const ticket = example
    ? summarize(example.apartment, { people: 2, leaseMonths: LEASE_MONTHS })
    : null;

  return (
    <div className="-mb-24">
      {/* Hero: the claim, shouted, with the price tag stuck on a Blacksburg photo. */}
      <section className="bleed overflow-hidden bg-maroon pt-10 pb-16 text-cream sm:pt-14 lg:pb-24">
        <h1 className="hero-headline display-type">
          <span className="line-mask" style={{ "--i": 0 } as React.CSSProperties}>
            <span>The rent you see</span>
          </span>
          <span className="line-mask" style={{ "--i": 1 } as React.CSSProperties}>
            <span>isn&apos;t the rent you pay.</span>
          </span>
        </h1>

        <div className="mt-10 grid items-start gap-12 lg:mt-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div
            className="fade-up flex flex-col items-start gap-7"
            style={{ "--d": "380ms" } as React.CSSProperties}
          >
            <p className="max-w-[38ch] text-lg text-pretty text-cream sm:text-xl sm:leading-relaxed">
              Admin fees, utility fees, parking, reconditioning. True Cost reads your apartment
              screenshots and shows what each place really costs you per month, before you sign.
            </p>
            <CompareButton />
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-cream/75">
              <span>Made by renters, for renters</span>
              <span aria-hidden>·</span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-orange" aria-hidden />
                No sign-up.
              </span>
            </p>
          </div>

          <div
            className="fade-up relative mx-auto w-full max-w-xl lg:-mt-6"
            style={{ "--d": "520ms" } as React.CSSProperties}
          >
            <figure className="relative ml-auto aspect-[4/5] w-[78%] rotate-[3deg] overflow-hidden bg-maroon-deep sm:w-[66%]">
              <Image
                src={PHOTOS.burruss.src}
                alt={PHOTOS.burruss.alt}
                fill
                priority
                sizes="(min-width: 1024px) 380px, 70vw"
                className="drift object-cover object-[50%_30%]"
              />
            </figure>
            {example && ticket && (
              <div
                data-ui
                className="absolute bottom-[-1.5rem] left-0 w-[64%] max-w-xs -rotate-[4deg] bg-cream p-5 text-ink shadow-[0_18px_40px_-12px_rgb(0_0_0/0.45)] sm:p-6"
              >
                <p className="text-sm font-semibold">{example.name}</p>
                <p className="text-xs text-ink/60">Split 2 ways, per person, per month</p>
                <dl className="mt-4 flex flex-col gap-1.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink/70">Advertised</dt>
                    <dd className="tabular-nums line-through decoration-ink/40">
                      {money(ticket.advertisedMonthly)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-dashed border-ink/20 pt-2">
                    <dt className="font-medium">True cost</dt>
                    <dd className="text-3xl leading-none display-type text-maroon tabular-nums">
                      {money(ticket.trueMonthly)}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* How it works: the stepper itself, enlarged into the diagram. */}
      <section aria-labelledby="how-heading" className="py-24 sm:py-32">
        <Reveal className="flex flex-col gap-14">
          <h2 id="how-heading" className="text-6xl display-type sm:text-8xl">
            Four steps. No sign-up.
          </h2>
          <ol data-ui className="flex flex-col gap-1.5 lg:flex-row">
            {STAGES.map((stage) => (
              <li
                key={stage.time}
                className="flex flex-col gap-4 lg:min-w-[12%]"
                style={{ flexGrow: stage.grow, flexBasis: 0 }}
              >
                <div
                  className={`flex min-h-24 items-start p-5 lg:h-[22vh] lg:min-h-40 ${stage.tone}`}
                >
                  <span className="text-3xl display-type sm:text-4xl">{stage.time}</span>
                </div>
                <p className="max-w-[24ch] text-base text-pretty">{stage.text}</p>
              </li>
            ))}
          </ol>
        </Reveal>
      </section>

      {example && <SplitShowcase apartment={example.apartment} leaseMonths={LEASE_MONTHS} />}

      {/* The catalog, as a line of names running off both edges. */}
      <section aria-labelledby="names-heading">
        <h2 id="names-heading" className="sr-only">
          Complexes already in the catalog
        </h2>
        <div className="bleed overflow-hidden bg-maroon py-10 text-cream sm:py-14" aria-hidden>
          <div className="marquee flex w-max text-[4.5rem] display-type whitespace-nowrap sm:text-[7.5rem]">
            {[0, 1].map((copy) => (
              <span key={copy} className="flex items-center">
                {names.map((name) => (
                  <span key={`${copy}-${name}`} className="flex items-center">
                    <span>{name}</span>
                    <span className="mx-[0.35em] inline-block size-[0.22em] rounded-full bg-orange" />
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>
        <Reveal className="flex flex-col gap-6 pt-8 pb-24 sm:flex-row sm:items-end sm:justify-between sm:pb-32">
          <p className="max-w-[48ch] text-lg text-pretty">
            {catalog.length} Blacksburg complexes with fees already read from each listing. Pick up
            to three and compare them, or capture any other listing with the extension.
          </p>
          <Link
            href="/compare/add"
            className="w-fit text-lg font-semibold text-maroon underline decoration-2 underline-offset-[6px] transition-colors hover:text-orange focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:text-orange dark:hover:text-cream"
          >
            Browse the complexes
          </Link>
        </Reveal>
      </section>

      {/* Blacksburg itself: the town these leases are signed in. */}
      <section aria-labelledby="town-heading" className="pb-24 sm:pb-32">
        <Reveal className="grid gap-4 md:grid-cols-12 md:gap-6">
          <figure className="relative aspect-[4/3] overflow-hidden md:col-span-7 md:aspect-auto md:min-h-[30rem]">
            <Image
              src={PHOTOS.corner.src}
              alt={PHOTOS.corner.alt}
              fill
              sizes="(min-width: 768px) 60vw, 100vw"
              className="object-cover"
            />
          </figure>
          <div className="flex flex-col gap-4 md:col-span-5">
            <div className="flex flex-1 flex-col justify-end gap-4 bg-ink p-7 text-cream sm:p-9 dark:bg-cream dark:text-ink">
              <h2 id="town-heading" className="text-5xl display-type sm:text-6xl">
                Made by renters, for renters.
              </h2>
              <p className="text-base text-pretty text-cream/90 dark:text-ink/80">
                Built in Blacksburg for students signing their first leases. True Cost is free,
                needs no sign-up, and never sends anything for you. Fee reading runs on Gemma 4.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <figure className="relative aspect-square -rotate-2 overflow-hidden">
                <Image
                  src={PHOTOS.dusk.src}
                  alt={PHOTOS.dusk.alt}
                  fill
                  sizes="(min-width: 768px) 20vw, 50vw"
                  className="object-cover"
                />
              </figure>
              <figure className="relative aspect-square rotate-2 overflow-hidden">
                <Image
                  src={PHOTOS.summer.src}
                  alt={PHOTOS.summer.alt}
                  fill
                  sizes="(min-width: 768px) 20vw, 50vw"
                  className="object-cover"
                />
              </figure>
            </div>
          </div>
        </Reveal>
      </section>

      {/* The close: the claim again, inverted. */}
      <section
        aria-labelledby="close-heading"
        className="bleed flex min-h-[64svh] flex-col justify-between gap-16 bg-ink py-20 text-cream sm:py-24 dark:bg-maroon-deep"
      >
        <Reveal>
          <h2
            id="close-heading"
            className="text-[3.6rem] display-type sm:text-[7rem] lg:text-[9.5rem]"
          >
            Sign with your
            <br />
            eyes open.
          </h2>
        </Reveal>
        <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <p className="max-w-[36ch] text-xl text-pretty text-cream/90">
            Every fee, counted per person, before the lease is in front of you.
          </p>
          <CompareButton className="w-full sm:w-auto" />
        </div>
      </section>

      {/* Footer: the name, built from blocks. */}
      <footer className="bleed bg-ink pt-6 pb-10 text-cream">
        <div aria-hidden className="flex h-[22svh] items-end gap-1 sm:h-[34svh]">
          {"TRUECOST".split("").map((letter, i) => (
            <span
              key={i}
              className={`flex flex-1 items-end justify-center pb-[0.06em] text-[clamp(3rem,11vw,11rem)] leading-[0.8] display-type ${
                ["bg-maroon", "bg-orange text-ink", "bg-maroon-deep", "bg-cream text-ink"][i % 4]
              } ${i === 4 ? "ml-3 sm:ml-6" : ""}`}
              style={{ height: `${[78, 92, 64, 100, 86, 70, 96, 60][i]}%` }}
            >
              {letter}
            </span>
          ))}
        </div>
        <div className="mt-14 grid gap-10 text-[0.95rem] sm:grid-cols-12">
          <nav aria-label="Footer" className="flex flex-col gap-2 sm:col-span-4">
            <Link href="/compare/setup" className="w-fit hover:text-orange">
              Compare apartments
            </Link>
            <Link href="/compare/add" className="w-fit hover:text-orange">
              Browse the complexes
            </Link>
            <a
              href={`${REPO_URL}/tree/main/extension`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-fit hover:text-orange"
            >
              Get the extension<span className="sr-only"> (opens in a new tab)</span>
            </a>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-fit hover:text-orange"
            >
              Source on GitHub<span className="sr-only"> (opens in a new tab)</span>
            </a>
            <a
              href={LEGAL_AID_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-fit hover:text-orange"
            >
              Virginia Law Help<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </nav>
          <div className="flex flex-col gap-2 text-cream/70 sm:col-span-8">
            <p>This is information, not legal advice.</p>
            <p className="text-sm text-pretty">
              Photographs from Wikimedia Commons:{" "}
              {Object.values(PHOTOS).map((p, i, all) => (
                <span key={p.src}>
                  <a
                    href={p.page}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-cream/30 underline-offset-2 hover:text-cream"
                  >
                    {p.credit}
                  </a>
                  ,{" "}
                  <a
                    href={p.licenseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-cream/30 underline-offset-2 hover:text-cream"
                  >
                    {p.license}
                  </a>
                  {i < all.length - 1 ? "; " : "."}
                </span>
              ))}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
