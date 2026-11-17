import { creatorTokens, type CreatorTemplateId } from "@linkyo/tokens";
import { Icon } from "@linkyo/ui";
import { Check } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";

import { phoneShots, phoneSizes } from "./assets";
import { ClaimForm } from "./claim-form";
import { Phone } from "./phone";
import { TiltStage } from "./tilt-stage";

export const order = (n: number) => ({ "--i": n }) as CSSProperties;

const CYCLE: CreatorTemplateId[] = ["nocturne", "atelier", "marquee", "daylight", "pulse"];

/**
 * The one orchestrated moment: on a dark studio stage with a soft blue glow, the headline rises
 * line by line while three real creator pages fan in; the centre phone cycles through all five
 * templates and the stage leans toward the mouse.
 */
export function Hero({ locale }: { locale: string }) {
  const t = useTranslations("marketing");
  const shots = phoneShots(locale);
  const pills = t.raw("hero.pills") as string[];
  return (
    <section data-theme="dark" aria-labelledby="hero-title" className="relative isolate mx-3 overflow-clip rounded-xl bg-canvas text-fg md:mx-5">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="mk-glow absolute -end-1/4 top-0 aspect-square w-3/4 rounded-full bg-primary opacity-secondary blur-ambient" />
        <div className="absolute -start-1/4 bottom-0 aspect-square w-1/2 rounded-full bg-primary-pressed opacity-disabled blur-ambient" />
      </div>
      <div className="relative mx-auto grid max-w-content grid-cols-1 items-center gap-12 px-5 pt-24 pb-16 md:px-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-10 lg:pt-32 lg:pb-24">
        <div className="grid min-w-0 grid-cols-1 justify-items-start gap-6">
          <p className="mk-rise text-small font-semibold text-fg-secondary" style={order(0)}>
            {t("hero.kicker")}
          </p>
          <h1 id="hero-title" className="max-w-full text-display tracking-display text-balance md:text-display-xl 2xl:text-display-2xl">
            <span className="mk-rise block" style={order(1)}>
              {t("hero.title1")}
            </span>
            <span className="mk-rise block text-link" style={order(2)}>
              {t("hero.title2")}
            </span>
          </h1>
          <p className="mk-rise max-w-full text-body-lg text-pretty text-fg-secondary" style={order(3)}>
            {t("hero.lead")}
          </p>
          <div className="mk-rise w-full" style={order(4)}>
            <ClaimForm id="hero-claim" />
          </div>
          <ul className="mk-rise flex flex-wrap gap-2" style={order(5)}>
            {pills.map((pill) => (
              <li key={pill} className="inline-flex h-control-sm items-center gap-2 rounded-full border border-line-strong px-3 text-small text-fg-secondary">
                <Icon icon={Check} size="sm" className="text-success-strong" />
                {pill}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto aspect-square w-full max-w-creator">
          <p className="sr-only">{t("hero.phones")}</p>
          <TiltStage className="absolute inset-0">
            <div aria-hidden className="mk-phone-in absolute start-1/12 top-1/6 w-2/5 -rotate-6" style={order(1)}>
              <div className="mk-float" style={order(1)}>
                <Phone>
                  <Image src={shots.pulse} alt="" fill sizes={phoneSizes.side} placeholder="blur" className="object-cover object-top" />
                </Phone>
              </div>
            </div>
            <div aria-hidden className="mk-phone-in absolute end-1/12 top-1/6 w-2/5 rotate-6" style={order(2)}>
              <div className="mk-float" style={order(2)}>
                <Phone>
                  <Image src={shots.daylight} alt="" fill sizes={phoneSizes.side} placeholder="blur" className="object-cover object-top" />
                </Phone>
              </div>
            </div>
            <div aria-hidden className="mk-phone-in absolute inset-x-0 top-0 mx-auto w-1/2 layer-raised" style={order(0)}>
              <Phone>
                {CYCLE.map((id, index) => (
                  <div key={id} className="mk-cycle-item absolute inset-0" style={order(index)}>
                    <Image src={shots[id]} alt="" fill sizes={phoneSizes.hero} placeholder="blur" preload={index === 0} fetchPriority={index === 0 ? "high" : "auto"} loading={index === 0 ? "eager" : "lazy"} className="object-cover object-top" />
                  </div>
                ))}
              </Phone>
              <div className="relative mt-4 grid h-control-sm place-items-center">
                {CYCLE.map((id, index) => (
                  <span key={id} className="mk-cycle-label col-start-1 row-start-1 inline-flex h-control-sm items-center rounded-full border border-line-strong bg-surface px-3 text-small font-semibold" style={order(index)}>
                    {creatorTokens.templates[id].label}
                  </span>
                ))}
              </div>
            </div>
          </TiltStage>
        </div>
      </div>
    </section>
  );
}
