"use client";

import * as React from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";

import { PhoneMock } from "@/components/landing/phone-mock";

/**
 * The two phones, angled, with the drift.
 *
 * **Why two, and why both facing front.** A marketplace has to convince two
 * different people of two different things, and most landing pages pick one
 * and demote the other to a link in the nav. Two screens state the
 * two-sidedness without spending a word of copy: the client's says *your
 * artisan is on the way*, the artisan's says *you are online, here is your
 * job*. The reference this was drawn from angles one handset rear-on to show
 * its camera array - that is a hardware flex, and it works for Apple because
 * the hardware is the product. Here the hardware is interchangeable and a
 * stock camera bump would spend half the hero on somebody else's industrial
 * design.
 *
 * **The risk that creates.** A phone back and a phone front are obviously two
 * objects; two dashboards can read as one screen duplicated, especially now
 * that both carry the same azure live-job card. So the separation is carried
 * entirely by depth: different scale, a real overlap, and the back phone set
 * deeper into the glow.
 *
 * **Motion.** Transform and opacity only, so it stays on the compositor. The
 * two phones drift at slightly different rates through the first viewport -
 * about fourteen pixels of separation in total, which is enough that the hero
 * has depth and little enough that nobody consciously notices. All of it
 * collapses under `prefers-reduced-motion`, where the phones simply sit where
 * they land.
 */
export function HeroPhones() {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const frontY = useTransform(scrollYProgress, [0, 1], [0, -28]);
  const backY = useTransform(scrollYProgress, [0, 1], [0, -14]);

  const enter = (delay: number) =>
    reduce
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y: 24 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.52, delay, ease: [0.16, 1, 0.3, 1] as const },
        };

  return (
    <div
      ref={ref}
      // `-mb` pulls the pair down so the panel's bottom edge crops them. It
      // buys back the dead space that sat under the calls to action, and a
      // device entering the frame reads as a photograph of something rather
      // than a sticker placed inside a box.
      className="relative -mb-14 flex items-center justify-center pt-4 sm:-mb-16 lg:-mb-20"
    >
      {/* The glow the screens sit in. Behind both phones, so the light reads as
          coming from the panel rather than from the images. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 -z-10 size-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-azure-400/25 blur-3xl"
      />

      {/* Behind and higher: the artisan. */}
      <motion.div
        {...enter(0.18)}
        style={reduce ? undefined : { y: backY }}
        className="relative z-0 -mr-14 -translate-y-6 rotate-[7deg] sm:-mr-20 sm:-translate-y-8 xl:-mr-24"
      >
        <PhoneMock
          src="/img/hero/artisan.png"
          alt="The ArtisanGH artisan app, showing a job in progress and today's earnings"
          sizes="(min-width: 1280px) 210px, (min-width: 640px) 190px, 130px"
          className="w-[130px] sm:w-[190px] xl:w-[210px]"
        />
      </motion.div>

      {/* In front and lower: the client. Priority, because at `lg` this is the
          largest element above the fold and therefore the LCP candidate. */}
      <motion.div
        {...enter(0.08)}
        style={reduce ? undefined : { y: frontY }}
        className="relative z-10 translate-y-6 -rotate-[9deg]"
      >
        <PhoneMock
          src="/img/hero/client.png"
          alt="The ArtisanGH client app, showing a booked electrician on the way"
          priority
          sizes="(min-width: 1280px) 250px, (min-width: 640px) 225px, 158px"
          className="w-[158px] sm:w-[225px] xl:w-[250px]"
        />
      </motion.div>
    </div>
  );
}
