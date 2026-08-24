import { ArrowDown, BadgeCheck, Flame, ShieldCheck, Swords } from 'lucide-react';
import { Button } from './ui/button';
import DragonScene from './DragonScene';
import ParticleEffect from './ParticleEffect';
import ScrollReveal from './ScrollReveal';
import { TopBestUsernames } from './TopBestUsernames';
import { useDiscordLink } from '@/hooks/useDiscordLink';
import type { Username } from '@/types/username';

interface LandingPageProps {
  onViewAll: () => void;
  onLoadProgressive: () => void;
  usernames?: Username[];
}

const proofPoints = [
  { icon: BadgeCheck, label: 'Verified handles', value: 'Ready transfer' },
  { icon: ShieldCheck, label: 'Trusted Discord deal flow', value: 'Buyer support' },
  { icon: Flame, label: 'Rare short stock', value: '3L, 4L, semi' },
];

const LandingPage = ({ onViewAll, onLoadProgressive, usernames = [] }: LandingPageProps) => {
  const discordLink = useDiscordLink();

  return (
    <main className="dragon-page min-h-screen overflow-hidden text-white">
      <ParticleEffect />

      <section className="relative min-h-[92svh] px-5 pb-16 pt-6 md:px-10 lg:px-14">
        <div className="dragon-grid absolute inset-0" />
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="brand-sigil">
              <Swords className="h-5 w-5" aria-hidden="true" />
            </div>
            <span className="text-sm font-semibold uppercase tracking-[0.32em] text-red-100/80">
              Zentirog Vault
            </span>
          </div>
          <a
            href={discordLink}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden rounded-full border border-red-400/35 bg-red-950/30 px-5 py-3 text-sm font-semibold text-red-50 shadow-[0_0_30px_rgba(239,68,68,0.18)] transition hover:border-red-300 hover:bg-red-800/40 md:inline-flex"
          >
            Discord Deals
          </a>
        </div>

        <div className="mx-auto grid min-h-[78svh] max-w-7xl items-center gap-10 py-12 lg:grid-cols-[1fr_0.95fr] lg:py-6">
          <div className="relative z-10 max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-red-400/30 bg-black/35 px-4 py-2 text-sm font-semibold text-red-100 shadow-[0_0_35px_rgba(220,38,38,0.2)] backdrop-blur">
              <Flame className="h-4 w-4 text-red-400" aria-hidden="true" />
              Premium Discord usernames forged for serious buyers
            </div>
            <h1 className="max-w-4xl text-5xl font-black leading-[0.92] text-red-50 sm:text-6xl md:text-7xl xl:text-8xl">
              Zentirog Usernames
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-red-50/76 md:text-xl">
              Command rare Discord handles with a cinematic red and black vault built for fast browsing, clean prices, and instant buyer confidence.
            </p>

            <div className="mt-9 flex flex-col gap-4 sm:flex-row">
              <Button
                onClick={onLoadProgressive}
                size="lg"
                className="h-14 rounded-full bg-red-600 px-8 text-base font-bold text-white shadow-[0_0_40px_rgba(239,68,68,0.48)] transition hover:-translate-y-1 hover:bg-red-500"
              >
                Browse Best Drops
                <ArrowDown className="ml-2 h-5 w-5" aria-hidden="true" />
              </Button>
              <Button
                onClick={onViewAll}
                size="lg"
                variant="outline"
                className="h-14 rounded-full border-red-300/35 bg-black/30 px-8 text-base font-bold text-red-50 backdrop-blur transition hover:-translate-y-1 hover:bg-red-950/60"
              >
                View Full Vault
              </Button>
            </div>
          </div>

          <div className="relative z-10 mx-auto w-full max-w-[560px]">
            <DragonScene />
          </div>
        </div>

        <div className="mx-auto grid max-w-7xl gap-4 sm:grid-cols-3">
          {proofPoints.map((point, index) => {
            const Icon = point.icon;
            return (
              <ScrollReveal key={point.label} delay={index * 90}>
                <div className="proof-tile">
                  <Icon className="h-6 w-6 text-red-300" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red-200/70">{point.label}</p>
                    <p className="mt-1 text-xl font-black text-white">{point.value}</p>
                  </div>
                </div>
              </ScrollReveal>
            );
          })}
        </div>

        {usernames.length > 0 && (
          <div className="mt-12">
            <TopBestUsernames usernames={usernames} discordLink={discordLink} />
          </div>
        )}
      </section>

      <section className="relative px-5 pb-20 md:px-10 lg:px-14">
        <ScrollReveal className="mx-auto max-w-4xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.34em] text-red-300">Built to convert</p>
          <h2 className="mt-4 text-3xl font-black text-white md:text-5xl">
            Browse rare names with the heat, clarity, and urgency buyers expect.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-red-50/70">
            The vault prioritizes clean sorting, category filters, visible discounts, and direct Discord contact so customers can move from interest to purchase without friction.
          </p>
          <div className="mt-8 flex justify-center">
            <Button
              onClick={onLoadProgressive}
              className="h-13 rounded-full bg-white px-7 py-6 font-bold text-red-950 transition hover:-translate-y-1 hover:bg-red-100"
            >
              Enter the Market
            </Button>
          </div>
        </ScrollReveal>
      </section>
    </main>
  );
};

export default LandingPage;
